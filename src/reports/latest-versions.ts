import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import fs from 'fs';
import path from 'path';
import type {JavaDownloadRelease} from '../distributions/base-models.js';
import {JavaDistribution} from '../distributions/package-types.js';
import {
  isAlpineLinux,
  normalizePlatform
} from '../distributions/platform-types.js';
import {isMainModule} from '../is-main-module.js';
import {RetryingHttpClient} from '../retrying-http-client.js';
import {getLatestMajorVersion} from '../util.js';
import {
  type ActionSource,
  type MetadataResolver,
  currentResolver,
  getResolverArchitectures,
  loadMetadataResolver
} from './resolver.js';

/**
 * Reports the exact JDK version each distribution currently resolves for a set
 * of version specs, using the installers' own metadata resolution. Nothing is
 * downloaded: resolution stops where `setup-java` would start the download.
 */

// Zulu's supported JDK catalog starts at Java 6, including non-LTS releases.
const FIRST_MAJOR_VERSION = 6;
export const REPORTED_DISTRIBUTIONS = currentResolver.distributions;

const PACKAGE_TYPE = 'jdk';
const CONCURRENCY = 6;
const METADATA_TIMEOUT_MS = 60_000;
const ORACLE_RELEASES_URL = 'https://java.oraclecloud.com/currentJavaReleases';
const MUSL_PLATFORM = 'linux-musl';
const PLATFORM_LABELS: Record<string, string> = {
  linux: 'Linux',
  [MUSL_PLATFORM]: 'Alpine Linux',
  macos: 'macOS',
  windows: 'Windows',
  solaris: 'Solaris'
};
const PLATFORM_ORDER = Object.keys(PLATFORM_LABELS);
const ARCHITECTURE_ORDER = [
  'x64',
  'aarch64',
  'x86',
  'armv7',
  'ppc64le',
  'ppc64',
  'riscv64',
  's390x'
];

/**
 * - `unsupported`: excluded by the action's package/platform capability maps.
 * - `unavailable`: the vendor's metadata has no matching release.
 * - `error`: the metadata lookup failed.
 */
export type ResolutionStatus =
  'resolved' | 'unsupported' | 'unavailable' | 'error';

export interface VersionResolution {
  distribution: string;
  versionSpec: string;
  platform: string;
  architecture: string;
  status: ResolutionStatus;
  version?: string;
  /** The release URL serves whatever build the vendor last published. */
  floating?: boolean;
  /** `Last-Modified` date of a floating artifact, from a HEAD request. */
  publishedAt?: string;
  /** Version the vendor currently advertises for a floating artifact. */
  advertisedVersion?: string;
  message?: string;
}

export interface ResolutionReport {
  source: ActionSource;
  platform: string;
  generatedAt: string;
  /** Expected platform/architecture probes, from this revision rather than main. */
  targets?: Record<string, Record<string, string[]>>;
  results: VersionResolution[];
}

interface ReleaseResolver {
  version: string;
  http: httpm.HttpClient;
  findPackageForDownload(range: string): Promise<JavaDownloadRelease>;
}

/** Alpine is reported separately because installers pick musl builds there. */
export function getReportPlatform(
  platform: NodeJS.Platform = process.platform,
  alpine = isAlpineLinux(platform)
): string {
  if (alpine) {
    return MUSL_PLATFORM;
  }
  return normalizePlatform(platform) ?? platform;
}

/**
 * Architectures `setup-java` supports for a distribution on a report
 * platform, including ones restricted to some Java versions.
 */
export function getSupportedArchitectures(
  distribution: string,
  platform: string,
  resolver: MetadataResolver = currentResolver
): string[] {
  return getResolverArchitectures(resolver, distribution, platform);
}

export function classifyResolutionError(error: unknown): ResolutionStatus {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /not supported|only supported|does not support|unsupported|not valid SemVer/i.test(
      message
    )
  ) {
    return 'unsupported';
  }
  if (
    (error instanceof Error && error.name === 'VersionNotFoundError') ||
    /no matching version|no \w+ release for|could not determine the latest available|not supported|only supported|does not support|not available|could not find|unsupported/i.test(
      message
    )
  ) {
    return 'unavailable';
  }
  return 'error';
}

/**
 * Shares metadata responses between installer instances. Most installers
 * fetch a vendor's whole release list for every request, and JetBrains probes
 * each release URL with HEAD, so resolving many version/architecture
 * combinations would otherwise repeat identical requests and exhaust API rate
 * limits. Failed requests are also retained for this snapshot so an obsolete
 * endpoint does not stall every major-version probe. Installers only read the
 * status and headers of HEAD responses.
 */
function shareMetadataResponses(
  http: httpm.HttpClient,
  cache: Map<string, Promise<unknown>>
): void {
  const share = <T>(key: string, request: () => Promise<T>): Promise<T> => {
    let response = cache.get(key) as Promise<T> | undefined;
    if (!response) {
      response = new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => {
          http.dispose();
          reject(
            new Error(
              `Metadata request timed out after ${METADATA_TIMEOUT_MS} ms: ${key.split('\n')[0]}`
            )
          );
        }, METADATA_TIMEOUT_MS);
        Promise.resolve()
          .then(request)
          .then(
            value => {
              clearTimeout(timer);
              resolve(value);
            },
            error => {
              clearTimeout(timer);
              reject(error);
            }
          );
      });
      cache.set(key, response);
    }
    return response;
  };

  const getJson = http.getJson.bind(http);
  http.getJson = (async (requestUrl: string, additionalHeaders?: object) =>
    structuredClone(
      await share(
        `GET ${requestUrl}\n${JSON.stringify(additionalHeaders ?? {})}`,
        () => getJson(requestUrl, additionalHeaders as never)
      )
    )) as typeof http.getJson;

  const head = http.head.bind(http);
  http.head = (requestUrl, additionalHeaders) =>
    share(
      `HEAD ${requestUrl}\n${JSON.stringify(additionalHeaders ?? {})}`,
      () => head(requestUrl, additionalHeaders)
    );
}

async function describeFloatingRelease(
  http: httpm.HttpClient,
  distribution: string,
  release: JavaDownloadRelease
): Promise<Pick<VersionResolution, 'publishedAt' | 'advertisedVersion'>> {
  const details: Pick<VersionResolution, 'publishedAt' | 'advertisedVersion'> =
    {};
  try {
    const response = await http.head(release.url);
    const lastModified = response.message.headers['last-modified'];
    if (lastModified && !Number.isNaN(Date.parse(lastModified))) {
      details.publishedAt = new Date(lastModified).toISOString().slice(0, 10);
    }
  } catch (error) {
    core.debug(`HEAD ${release.url} failed: ${error}`);
  }

  // Oracle's `/latest/` artifacts carry the NFTC license; only then is the
  // release advertised by the Java Releases API the one being served.
  if (distribution === JavaDistribution.Oracle) {
    try {
      const response = await http.getJson<{
        releaseVersion?: string;
        licenseDetails?: {licenseType?: string};
      }>(`${ORACLE_RELEASES_URL}/${release.version.split('.')[0]}`);
      if (
        response.result?.releaseVersion &&
        response.result.licenseDetails?.licenseType === 'NFTC'
      ) {
        details.advertisedVersion = response.result.releaseVersion;
      }
    } catch (error) {
      core.debug(`Oracle Java Releases API lookup failed: ${error}`);
    }
  }
  return details;
}

async function resolveOne(
  distributionName: string,
  versionSpec: string,
  platform: string,
  architecture: string,
  cache: Map<string, Promise<unknown>>,
  http: httpm.HttpClient,
  metadataResolver: MetadataResolver
): Promise<VersionResolution> {
  const base = {
    distribution: distributionName,
    versionSpec,
    platform,
    architecture
  };

  let installer: unknown;
  try {
    const installerOptions = {
      version: versionSpec,
      architecture,
      packageType: PACKAGE_TYPE,
      checkLatest: true
    };
    if (platform === 'solaris') {
      if (distributionName !== JavaDistribution.Liberica) {
        return {
          ...base,
          status: 'error',
          message: `No Solaris metadata resolver for '${distributionName}'.`
        };
      }
      installer =
        await metadataResolver.createSolarisInstaller(installerOptions);
    } else {
      installer = await metadataResolver.getJavaDistribution(
        distributionName,
        installerOptions
      );
    }
  } catch (error) {
    return {
      ...base,
      status: classifyResolutionError(error),
      message: error instanceof Error ? error.message : String(error)
    };
  }
  if (!installer) {
    return {...base, status: 'error', message: 'Unknown distribution'};
  }

  // `findPackageForDownload` is the metadata step `setupJava` runs right
  // before downloading; it is protected because the action never needs it on
  // its own.
  if (!isReleaseResolver(installer)) {
    throw new Error(`Invalid metadata resolver for '${distributionName}'.`);
  }
  const resolver = installer;
  // Fail closed if a resolver ever crosses the metadata/download boundary.
  const forbidInstall = () => {
    throw new Error(
      'JDK download/install is forbidden in the versions report.'
    );
  };
  Object.defineProperties(installer, {
    setupJava: {value: forbidInstall},
    downloadTool: {value: forbidInstall}
  });
  shareMetadataResponses(resolver.http, cache);
  try {
    const release = await resolver.findPackageForDownload(resolver.version);
    // Older releases returned the requested major without a floating marker.
    const floating =
      release.floating || new URL(release.url).pathname.includes('/latest/');
    return {
      ...base,
      status: 'resolved',
      version: release.version,
      ...(floating
        ? {
            floating: true,
            ...(await describeFloatingRelease(http, distributionName, release))
          }
        : {})
    };
  } catch (error) {
    return {
      ...base,
      status: classifyResolutionError(error),
      message: error instanceof Error ? error.message : String(error)
    };
  }
}

function isReleaseResolver(value: unknown): value is ReleaseResolver {
  return (
    typeof value === 'object' &&
    value !== null &&
    'version' in value &&
    typeof value.version === 'string' &&
    'http' in value &&
    typeof value.http === 'object' &&
    value.http !== null &&
    'getJson' in value.http &&
    typeof value.http.getJson === 'function' &&
    'head' in value.http &&
    typeof value.http.head === 'function' &&
    'findPackageForDownload' in value &&
    typeof value.findPackageForDownload === 'function'
  );
}

async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  };
  await Promise.all(
    Array.from({length: Math.min(limit, tasks.length)}, worker)
  );
  return results;
}

/** Every supported stable major through the newest GA release, plus `latest`. */
export async function getDefaultVersions(
  http: httpm.HttpClient
): Promise<string[]> {
  shareMetadataResponses(http, new Map());
  const latestMajor = await getLatestMajorVersion(http);
  if (!Number.isSafeInteger(latestMajor) || latestMajor < FIRST_MAJOR_VERSION) {
    throw new Error(
      `Invalid newest Java feature release in vendor metadata: ${latestMajor}`
    );
  }
  const versions = Array.from(
    {length: latestMajor - FIRST_MAJOR_VERSION + 1},
    (_, index) => String(FIRST_MAJOR_VERSION + index)
  );
  return [...versions, 'latest'];
}

/**
 * Distributions for which vendor metadata matched nothing at all. Missing
 * every requested version on every platform signals an unreachable or changed
 * metadata source rather than genuinely unavailable releases.
 */
export function findSilentDistributions(
  results: VersionResolution[]
): string[] {
  const distributions = [...new Set(results.map(r => r.distribution))];
  return distributions.filter(distribution => {
    const distributionResults = results.filter(
      r => r.distribution === distribution
    );
    return (
      !distributionResults.some(r => r.status === 'resolved') &&
      distributionResults.some(r => r.status === 'unavailable')
    );
  });
}

export async function resolveLatestVersions(options: {
  distributions: string[];
  versions: string[];
  /** Restricts the architectures; defaults to all supported ones. */
  architectures?: string[];
  /** Solaris metadata can be resolved on any host; other targets use the host. */
  platform?: string;
  resolver?: MetadataResolver;
}): Promise<ResolutionReport> {
  const resolver = options.resolver ?? currentResolver;
  const http = new RetryingHttpClient('actions/setup-java');
  shareMetadataResponses(http, new Map());
  const hostPlatform = getReportPlatform();
  const platform = options.platform || hostPlatform;
  if (platform !== hostPlatform && platform !== 'solaris') {
    throw new Error(
      `Cannot resolve '${platform}' metadata on '${hostPlatform}'; use a matching runner.`
    );
  }
  const tasks = options.distributions.map(distribution => async () => {
    const architectures = getSupportedArchitectures(
      distribution,
      platform,
      resolver
    ).filter(
      architecture =>
        !options.architectures?.length ||
        options.architectures.includes(architecture)
    );
    // Each distribution resolves sequentially so its shared metadata is
    // fetched once and requests to a single vendor API are not bursty.
    const cache = new Map<string, Promise<unknown>>();
    const results: VersionResolution[] = [];
    const startedAt = Date.now();
    for (const versionSpec of options.versions) {
      for (const architecture of architectures) {
        const result = await resolveOne(
          distribution,
          versionSpec,
          platform,
          architecture,
          cache,
          http,
          resolver
        );
        core.info(
          `${distribution} ${versionSpec} (${formatPlatform(result)}): ${
            result.status === 'resolved'
              ? `${result.version}${result.floating ? ' (floating)' : ''}`
              : `${result.status} - ${result.message?.split('\n')[0]}`
          }`
        );
        results.push(result);
      }
    }
    core.info(
      `${distribution}: ${results.length} lookups in ${Math.round((Date.now() - startedAt) / 1000)}s`
    );
    return results;
  });

  const results = (await runWithConcurrency(tasks, CONCURRENCY)).flat();
  return {
    source: resolver.source,
    platform,
    generatedAt: new Date().toISOString(),
    targets: Object.fromEntries(
      options.distributions.map(distribution => [
        distribution,
        Object.fromEntries(
          PLATFORM_ORDER.map(target => [
            target,
            getSupportedArchitectures(distribution, target, resolver)
          ]).filter(([, architectures]) => architectures.length > 0)
        )
      ])
    ),
    results
  };
}

function formatPlatform(
  result: Pick<VersionResolution, 'platform' | 'architecture'>
): string {
  return `${PLATFORM_LABELS[result.platform] ?? result.platform} ${result.architecture}`;
}

function comparePlatforms(
  a: Pick<VersionResolution, 'platform' | 'architecture'>,
  b: Pick<VersionResolution, 'platform' | 'architecture'>
): number {
  const rank = (order: string[], value: string) => {
    const index = order.indexOf(value);
    return index === -1 ? order.length : index;
  };
  return (
    rank(PLATFORM_ORDER, a.platform) - rank(PLATFORM_ORDER, b.platform) ||
    a.platform.localeCompare(b.platform) ||
    rank(ARCHITECTURE_ORDER, a.architecture) -
      rank(ARCHITECTURE_ORDER, b.architecture) ||
    a.architecture.localeCompare(b.architecture)
  );
}

function formatCell(result: VersionResolution | undefined): string {
  switch (result?.status) {
    case undefined:
      return '';
    case 'resolved':
      if (!result.floating) {
        return `\`${result.version}\``;
      }
      return (
        `\`${result.advertisedVersion ?? result.version}\` ¹` +
        (result.publishedAt ? ` (published ${result.publishedAt})` : '')
      );
    case 'unavailable':
      return '—';
    case 'unsupported':
      return 'n/a';
    case 'error':
      return '❗ error';
  }
}

interface Problem {
  distribution: string;
  versionSpec?: string;
  platform?: string;
  message: string;
}

function getProblems(results: VersionResolution[]): Problem[] {
  return [
    ...findSilentDistributions(results).map(distribution => ({
      distribution,
      message:
        'No release matched any requested version on any platform. The vendor metadata may be unreachable or its format may have changed.'
    })),
    ...results
      .filter(r => r.status === 'error')
      .map(r => ({
        distribution: r.distribution,
        versionSpec: r.versionSpec,
        platform: formatPlatform(r),
        message: r.message?.split('\n')[0] ?? 'Unknown error'
      }))
  ];
}

/** Supported operating systems for which no runner produced a report. */
function getUncheckedPlatforms(
  distribution: string,
  reportedPlatforms: Set<string>,
  targets?: Record<string, Record<string, string[]>>
): string[] {
  const platforms =
    targets?.[distribution] ??
    Object.fromEntries(
      PLATFORM_ORDER.map(platform => [
        platform,
        getSupportedArchitectures(distribution, platform)
      ])
    );
  return Object.entries(platforms)
    .filter(
      ([platform, architectures]) =>
        architectures.length > 0 && !reportedPlatforms.has(platform)
    )
    .map(
      ([platform, architectures]) =>
        `${PLATFORM_LABELS[platform] ?? platform} (${architectures.join(', ')})`
    );
}

function escapeTableText(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderSourceReport(
  reports: ResolutionReport[],
  options: {runUrl?: string} = {}
): string {
  const results = reports.flatMap(report => report.results);
  const distributions = [...new Set(results.map(r => r.distribution))].sort();
  const versionSpecs = [...new Set(results.map(r => r.versionSpec))];
  const reportedPlatforms = new Set(reports.map(report => report.platform));
  const generatedAt = reports
    .map(report => report.generatedAt)
    .sort()
    .at(-1);
  const silentDistributions = findSilentDistributions(results);

  const lines: string[] = [`## setup-java@${reports[0].source.ref}`, ''];
  lines.push(
    `Generated ${generatedAt ? `${generatedAt.replace('T', ' ').slice(0, 16)} UTC` : 'now'} for package type \`${PACKAGE_TYPE}\` on ${PLATFORM_ORDER.filter(
      p => reportedPlatforms.has(p)
    )
      .map(p => PLATFORM_LABELS[p])
      .join(', ')}.` +
      (options.runUrl ? ` [Workflow run](${options.runUrl}).` : ''),
    '',
    'For each distribution, the table lists platform/architecture probes and the exact version this revision resolves from the distribution’s metadata today for each `java-version`. That is what a job installs on a tool-cache miss or with `check-latest: true`. Vendors publish builds per platform, so the same request can resolve to different versions on different platforms. No JDK was downloaded to produce this report.',
    '',
    '`—` no matching release is published for this platform · `n/a` `setup-java` does not support this version on this platform · ❗ the lookup failed',
    ''
  );

  const problems = getProblems(results);
  if (problems.length > 0) {
    lines.push(
      '## Needs attention',
      '',
      '| Distribution | Version | Platform | Problem |',
      '| --- | --- | --- | --- |'
    );
    for (const problem of problems) {
      lines.push(
        `| \`${problem.distribution}\` | ${problem.versionSpec ? `\`${problem.versionSpec}\`` : 'all'} | ${problem.platform ?? 'all'} | ${escapeTableText(problem.message)} |`
      );
    }
    lines.push('');
  }

  for (const distribution of distributions) {
    const distributionResults = results.filter(
      r => r.distribution === distribution
    );
    const platforms = distributionResults
      .filter(
        (result, index) =>
          distributionResults.findIndex(
            other =>
              other.platform === result.platform &&
              other.architecture === result.architecture
          ) === index
      )
      .sort(comparePlatforms);

    lines.push(
      `## \`${distribution}\`${silentDistributions.includes(distribution) ? ' ❗' : ''}`,
      '',
      `| Platform | ${versionSpecs.map(v => `\`${v}\``).join(' | ')} |`,
      `| --- | ${versionSpecs.map(() => '---').join(' | ')} |`
    );
    for (const platform of platforms) {
      const cells = versionSpecs.map(versionSpec =>
        formatCell(
          distributionResults.find(
            r =>
              r.versionSpec === versionSpec &&
              r.platform === platform.platform &&
              r.architecture === platform.architecture
          )
        )
      );
      lines.push(`| ${formatPlatform(platform)} | ${cells.join(' | ')} |`);
    }
    lines.push('');

    const unchecked = getUncheckedPlatforms(
      distribution,
      reportedPlatforms,
      reports[0]?.targets
    );
    if (unchecked.length > 0) {
      lines.push(
        `Not checked, because no runner reported these platforms: ${unchecked.join(', ')}.`,
        ''
      );
    }
  }

  if (results.some(r => r.status === 'resolved' && r.floating)) {
    lines.push(
      '---',
      '',
      '¹ Major-only requests download the vendor’s mutable `/latest/` artifact, so the exact version is only known after download. The version the vendor advertises is shown when available.',
      ''
    );
  }

  return lines.join('\n');
}

export function renderMarkdownReport(
  reports: ResolutionReport[],
  options: {
    runUrl?: string;
    expectedRefs?: string[];
    overviewOnly?: boolean;
  } = {}
): string {
  const refs = [
    ...new Set([
      ...(options.expectedRefs ?? []),
      ...reports.map(report => report.source.ref)
    ])
  ];
  const lines = [
    '# Latest JDK versions by setup-java revision',
    '',
    "Each section uses that revision's own installers and dependencies. `v6` and `v5` track the latest major tags, pinned to the commits below for this run. No JDKs are downloaded.",
    '',
    "Older revisions may support different distributions, platforms or version syntax. In particular, `latest` is reported as `n/a` when that revision rejects it; it is not substituted with main's behavior. Revisions without capability maps probe all candidate architectures, leaving unsupported or unpublished combinations visible.",
    '',
    '| setup-java | Package version | Commit | Result |',
    '| --- | --- | --- | --- |'
  ];
  for (const ref of refs) {
    const group = reports.filter(report => report.source.ref === ref);
    if (!group.length) {
      lines.push(`| \`${ref}\` | - | - | Not checked: no reports received |`);
      continue;
    }
    const source = group[0].source;
    if (
      group.some(
        report =>
          report.source.sha !== source.sha ||
          report.source.version !== source.version
      )
    ) {
      throw new Error(
        `Reports for '${ref}' were produced from different revisions.`
      );
    }
    const problems = getProblems(group.flatMap(report => report.results));
    const platforms = new Set(group.map(report => report.platform));
    const missing = PLATFORM_ORDER.filter(platform => !platforms.has(platform));
    lines.push(
      `| \`${ref}\` | ${source.version ?? 'local'} | ${source.sha ? `[\`${source.sha.slice(0, 12)}\`](https://github.com/actions/setup-java/commit/${source.sha})` : 'local checkout'} | ${platforms.size}/${PLATFORM_ORDER.length} platforms${missing.length ? `; not checked: ${missing.map(platform => PLATFORM_LABELS[platform]).join(', ')}` : ''}${problems.length ? `; ${problems.length} lookup problems` : ''} |`
    );
  }
  if (options.overviewOnly) {
    return lines.join('\n');
  }
  for (const ref of refs) {
    const group = reports.filter(report => report.source.ref === ref);
    if (!group.length) {
      continue;
    }
    lines.push(
      '',
      '<details>',
      `<summary>setup-java@${ref}</summary>`,
      '',
      renderSourceReport(group, options),
      '</details>',
      ''
    );
  }
  return lines.join('\n');
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  const items = (value ?? '')
    .split(/[,\s]+/)
    .map(item => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : fallback;
}

function readReports(inputDir: string): ResolutionReport[] {
  return fs
    .readdirSync(inputDir, {recursive: true, encoding: 'utf8'})
    .filter(file => file.endsWith('.json'))
    .sort()
    .map(
      file =>
        JSON.parse(
          fs.readFileSync(path.join(inputDir, file), 'utf8')
        ) as ResolutionReport
    );
}

export async function run(args: string[]): Promise<void> {
  const [command, target, markdownOutput] = args;
  if (command === 'resolve' && target) {
    const resolver = process.env.REPORT_RESOLVER
      ? await loadMetadataResolver(process.env.REPORT_RESOLVER)
      : currentResolver;
    const versions = parseList(process.env.REPORT_VERSIONS, []);
    const report = await resolveLatestVersions({
      distributions: parseList(
        process.env.REPORT_DISTRIBUTIONS,
        resolver.distributions
      ),
      versions:
        versions.length > 0
          ? versions
          : await getDefaultVersions(
              new RetryingHttpClient('actions/setup-java')
            ),
      architectures: parseList(process.env.REPORT_ARCHITECTURES, []),
      platform: process.env.REPORT_PLATFORM,
      resolver
    });
    fs.mkdirSync(path.dirname(path.resolve(target)), {recursive: true});
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
    return;
  }

  if (command === 'summarize' && target) {
    const expectedRefs = parseList(process.env.REPORT_REFS, []);
    const reports = fs.existsSync(target) ? readReports(target) : [];
    if (reports.length === 0 && expectedRefs.length === 0) {
      throw new Error(`No resolution reports found in '${target}'.`);
    }
    const {GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID} = process.env;
    const runUrl =
      GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
        ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
        : undefined;
    const markdown = renderMarkdownReport(reports, {
      runUrl,
      expectedRefs
    });
    if (markdownOutput) {
      fs.writeFileSync(markdownOutput, markdown);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      // GitHub limits a step summary to 1 MiB. Keep the complete report in the
      // artifact even when many legacy lookup errors make it too large.
      if (Buffer.byteLength(markdown, 'utf8') > 1_000_000) {
        core.warning(
          'The full report exceeds the job summary size limit; showing its overview.'
        );
        const overview = renderMarkdownReport(reports, {
          runUrl,
          expectedRefs,
          overviewOnly: true
        });
        await core.summary
          .addRaw(
            `${overview}\n\nFull per-platform tables are in the \`latest-jdk-versions-report\` artifact${runUrl ? ` on the [workflow run](${runUrl})` : ''}. The full report exceeded GitHub's summary size limit.\n`
          )
          .write();
      } else {
        await core.summary.addRaw(markdown).write();
      }
    } else {
      core.info(markdown);
    }

    for (const ref of expectedRefs) {
      if (!reports.some(report => report.source.ref === ref)) {
        core.warning(
          `${ref}: not checked because no resolution reports were received.`
        );
      }
    }
    for (const ref of new Set(reports.map(report => report.source.ref))) {
      for (const problem of getProblems(
        reports
          .filter(report => report.source.ref === ref)
          .flatMap(report => report.results)
      )) {
        const scope = [problem.versionSpec, problem.platform]
          .filter(Boolean)
          .join(', ');
        core.warning(
          `${ref}: ${problem.distribution}${scope ? ` (${scope})` : ''}: ${problem.message}`
        );
      }
    }
    return;
  }

  throw new Error(
    'Usage: resolve <output.json> | summarize <input-dir> [output.md]'
  );
}

if (isMainModule(import.meta.url)) {
  run(process.argv.slice(2)).catch(error => {
    core.setFailed(error instanceof Error ? error.message : String(error));
  });
}

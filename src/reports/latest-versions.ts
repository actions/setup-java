import * as core from '@actions/core';
import * as httpm from '@actions/http-client';
import fs from 'fs';
import path from 'path';
import {getJavaDistribution} from '../distributions/distribution-factory.js';
import type {JavaBase} from '../distributions/base-installer.js';
import type {JavaDownloadRelease} from '../distributions/base-models.js';
import {JavaDistribution} from '../distributions/package-types.js';
import {isMainModule} from '../is-main-module.js';
import {RetryingHttpClient} from '../retrying-http-client.js';
import {getLatestMajorVersion} from '../util.js';

/**
 * Reports the exact JDK version each distribution currently resolves for a set
 * of version specs, using the installers' own metadata resolution. Nothing is
 * downloaded: resolution stops where `setup-java` would start the download.
 */

export const LTS_VERSIONS = ['8', '11', '17', '21', '25'];
export const DEFAULT_ARCHITECTURES = ['x64', 'aarch64'];
export const REPORTED_DISTRIBUTIONS: string[] = Object.values(
  JavaDistribution
).filter(distribution => distribution !== JavaDistribution.JdkFile);

const PACKAGE_TYPE = 'jdk';
const CONCURRENCY = 6;
const ORACLE_RELEASES_URL = 'https://java.oraclecloud.com/currentJavaReleases';

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
  platform: string;
  generatedAt: string;
  results: VersionResolution[];
}

interface ReleaseResolver {
  version: string;
  http: httpm.HttpClient;
  findPackageForDownload(range: string): Promise<JavaDownloadRelease>;
}

export function getReportPlatform(
  platform: NodeJS.Platform = process.platform
): string {
  switch (platform) {
    case 'darwin':
      return 'macos';
    case 'win32':
      return 'windows';
    default:
      return platform;
  }
}

export function classifyResolutionError(error: unknown): ResolutionStatus {
  const message = error instanceof Error ? error.message : String(error);
  if (
    (error instanceof Error && error.name === 'VersionNotFoundError') ||
    /no matching version|no \w+ release for|not supported|only supported|does not support|not available|could not find|unsupported/i.test(
      message
    )
  ) {
    return 'unavailable';
  }
  return 'error';
}

/**
 * Shares JSON metadata responses between installer instances. Most installers
 * fetch a vendor's whole release list for every request, so resolving many
 * version/architecture combinations would otherwise refetch identical
 * documents and exhaust API rate limits.
 */
function shareJsonResponses(
  http: httpm.HttpClient,
  cache: Map<string, Promise<unknown>>
): void {
  const getJson = http.getJson.bind(http);
  http.getJson = (async (requestUrl: string, additionalHeaders?: object) => {
    const key = `${requestUrl}\n${JSON.stringify(additionalHeaders ?? {})}`;
    let response = cache.get(key);
    if (!response) {
      response = getJson(requestUrl, additionalHeaders as never);
      cache.set(key, response);
      response.catch(() => cache.delete(key));
    }
    return structuredClone(await response);
  }) as typeof http.getJson;
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
  architecture: string,
  cache: Map<string, Promise<unknown>>,
  http: httpm.HttpClient
): Promise<VersionResolution> {
  const base = {
    distribution: distributionName,
    versionSpec,
    platform: getReportPlatform(),
    architecture
  };

  let installer: JavaBase | null;
  try {
    installer = await getJavaDistribution(distributionName, {
      version: versionSpec,
      architecture,
      packageType: PACKAGE_TYPE,
      checkLatest: true
    });
  } catch (error) {
    return {
      ...base,
      status: 'unsupported',
      message: error instanceof Error ? error.message : String(error)
    };
  }
  if (!installer) {
    return {...base, status: 'error', message: 'Unknown distribution'};
  }

  // `findPackageForDownload` is the metadata step `setupJava` runs right
  // before downloading; it is protected because the action never needs it on
  // its own.
  const resolver = installer as unknown as ReleaseResolver;
  shareJsonResponses(resolver.http, cache);
  try {
    const release = await resolver.findPackageForDownload(resolver.version);
    return {
      ...base,
      status: 'resolved',
      version: release.version,
      ...(release.floating
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

/** LTS majors, the newest feature release, and the `latest` alias. */
export async function getDefaultVersions(
  http: httpm.HttpClient
): Promise<string[]> {
  const versions = [...LTS_VERSIONS];
  try {
    const featureRelease = String(await getLatestMajorVersion(http));
    if (!versions.includes(featureRelease)) {
      versions.push(featureRelease);
    }
  } catch (error) {
    core.warning(
      `Could not determine the newest Java feature release: ${error}`
    );
  }
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
  architectures: string[];
}): Promise<ResolutionReport> {
  const http = new RetryingHttpClient('actions/setup-java');
  const tasks = options.distributions.map(distribution => async () => {
    // Each distribution resolves sequentially so its shared metadata is
    // fetched once and requests to a single vendor API are not bursty.
    const cache = new Map<string, Promise<unknown>>();
    const results: VersionResolution[] = [];
    for (const versionSpec of options.versions) {
      for (const architecture of options.architectures) {
        const result = await resolveOne(
          distribution,
          versionSpec,
          architecture,
          cache,
          http
        );
        core.info(
          `${distribution} ${versionSpec} (${result.platform}-${architecture}): ${
            result.status === 'resolved'
              ? `${result.version}${result.floating ? ' (floating)' : ''}`
              : `${result.status} - ${result.message?.split('\n')[0]}`
          }`
        );
        results.push(result);
      }
    }
    return results;
  });

  const results = (await runWithConcurrency(tasks, CONCURRENCY)).flat();
  return {
    platform: getReportPlatform(),
    generatedAt: new Date().toISOString(),
    results
  };
}

function formatResolvedVersion(result: VersionResolution): string {
  if (!result.floating) {
    return `\`${result.version}\``;
  }
  return `\`${result.advertisedVersion ?? result.version}\` ¹`;
}

function formatCell(results: VersionResolution[]): string {
  if (results.length === 0) {
    return '';
  }
  const resolved = results.filter(result => result.status === 'resolved');
  const hasErrors = results.some(result => result.status === 'error');
  if (resolved.length === 0) {
    return hasErrors ? '❗ error' : '—';
  }

  const counts = new Map<string, number>();
  for (const result of resolved) {
    const formatted = formatResolvedVersion(result);
    counts.set(formatted, (counts.get(formatted) ?? 0) + 1);
  }
  const versions = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([version]) => version);

  let cell = versions.join(' / ');
  if (versions.length > 1) {
    cell += ' ⚠️';
  }
  if (hasErrors) {
    cell += ' ❗';
  }
  return cell;
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
        platform: `${r.platform} ${r.architecture}`,
        message: r.message?.split('\n')[0] ?? 'Unknown error'
      }))
  ];
}

function escapeTableText(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderTableHeader(firstColumn: string, versionSpecs: string[]) {
  return [
    `| ${firstColumn} | ${versionSpecs.map(v => `\`${v}\``).join(' | ')} |`,
    `| --- | ${versionSpecs.map(() => '---').join(' | ')} |`
  ];
}

export function renderMarkdownReport(
  reports: ResolutionReport[],
  options: {runUrl?: string} = {}
): string {
  const results = reports.flatMap(report => report.results);
  const distributions = [...new Set(results.map(r => r.distribution))].sort();
  const versionSpecs = [...new Set(results.map(r => r.versionSpec))];
  const platforms = [
    ...new Set(results.map(r => `${r.platform} ${r.architecture}`))
  ].sort();
  const generatedAt = reports
    .map(report => report.generatedAt)
    .sort()
    .at(-1);

  const silentDistributions = findSilentDistributions(results);

  const lines: string[] = ['# Latest JDK versions resolved by setup-java', ''];
  lines.push(
    `Generated ${generatedAt ? `${generatedAt.replace('T', ' ').slice(0, 16)} UTC` : 'now'} for package type \`${PACKAGE_TYPE}\` on ${platforms.map(p => `\`${p}\``).join(', ')}.` +
      (options.runUrl ? ` [Workflow run](${options.runUrl}).` : ''),
    '',
    'Each cell shows the exact version `setup-java` resolves from the distribution’s metadata today for the requested `java-version`. That is what a job installs on a tool-cache miss or with `check-latest: true`. No JDK was downloaded to produce this report.',
    ''
  );

  lines.push(...renderTableHeader('Distribution', versionSpecs));
  for (const distribution of distributions) {
    const cells = versionSpecs.map(versionSpec =>
      formatCell(
        results.filter(
          r => r.distribution === distribution && r.versionSpec === versionSpec
        )
      )
    );
    const marker = silentDistributions.includes(distribution) ? ' ❗' : '';
    lines.push(`| \`${distribution}\`${marker} | ${cells.join(' | ')} |`);
  }
  lines.push(
    '',
    '— not offered for this version or platform · ⚠️ differs by platform (see details) · ❗ needs attention (see below)',
    '',
    '¹ Major-only requests download the vendor’s mutable `/latest/` artifact, so the exact version is only known after download. The vendor-advertised release is shown when available.',
    ''
  );

  lines.push('## Details by platform', '');
  for (const distribution of distributions) {
    const distributionResults = results.filter(
      r => r.distribution === distribution
    );
    const needsAttention =
      silentDistributions.includes(distribution) ||
      versionSpecs.some(versionSpec =>
        /[⚠❗]/u.test(
          formatCell(
            distributionResults.filter(r => r.versionSpec === versionSpec)
          )
        )
      );
    lines.push(
      `<details${needsAttention ? ' open' : ''}><summary><code>${distribution}</code>${needsAttention ? ' ⚠️' : ''}</summary>`,
      '',
      ...renderTableHeader('Platform', versionSpecs)
    );
    for (const platform of platforms) {
      const cells = versionSpecs.map(versionSpec => {
        const result = distributionResults.find(
          r =>
            r.versionSpec === versionSpec &&
            `${r.platform} ${r.architecture}` === platform
        );
        if (!result) {
          return '';
        }
        if (result.status === 'resolved') {
          return (
            formatResolvedVersion(result) +
            (result.publishedAt ? ` (published ${result.publishedAt})` : '')
          );
        }
        return result.status === 'error' ? '❗ error' : '—';
      });
      lines.push(`| ${platform} | ${cells.join(' | ')} |`);
    }
    lines.push('', '</details>', '');
  }

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
    const versions = parseList(process.env.REPORT_VERSIONS, []);
    const report = await resolveLatestVersions({
      distributions: parseList(
        process.env.REPORT_DISTRIBUTIONS,
        REPORTED_DISTRIBUTIONS
      ),
      versions:
        versions.length > 0
          ? versions
          : await getDefaultVersions(
              new RetryingHttpClient('actions/setup-java')
            ),
      architectures: parseList(
        process.env.REPORT_ARCHITECTURES,
        DEFAULT_ARCHITECTURES
      )
    });
    fs.mkdirSync(path.dirname(path.resolve(target)), {recursive: true});
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
    return;
  }

  if (command === 'summarize' && target) {
    const reports = readReports(target);
    if (reports.length === 0) {
      throw new Error(`No resolution reports found in '${target}'.`);
    }
    const {GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID} = process.env;
    const runUrl =
      GITHUB_SERVER_URL && GITHUB_REPOSITORY && GITHUB_RUN_ID
        ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}`
        : undefined;
    const markdown = renderMarkdownReport(reports, {runUrl});
    if (markdownOutput) {
      fs.writeFileSync(markdownOutput, markdown);
    }
    if (process.env.GITHUB_STEP_SUMMARY) {
      await core.summary.addRaw(markdown).write();
    } else {
      core.info(markdown);
    }

    for (const problem of getProblems(
      reports.flatMap(report => report.results)
    )) {
      const scope = [problem.versionSpec, problem.platform]
        .filter(Boolean)
        .join(', ');
      core.warning(
        `${problem.distribution}${scope ? ` (${scope})` : ''}: ${problem.message}`
      );
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

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import {JavaBase} from '../base-installer.js';
import {HttpCodes} from '@actions/http-client';
import {GraalVMEAVersion} from './models.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import {
  convertVersionToSemver,
  extractJdkFile,
  getDownloadArchiveExtension,
  getGitHubHttpHeaders,
  getLatestMajorVersion,
  getNextPageUrlFromLinkHeader,
  isVersionSatisfies,
  MAX_PAGINATION_PAGES,
  renameWinArchive,
  validatePaginationUrl
} from '../../util.js';

const GRAALVM_DL_BASE = 'https://download.oracle.com/graalvm';
const GRAALVM_DOWNLOAD_URL = 'https://www.graalvm.org/downloads/';
const GRAALVM_COMMUNITY_RELEASES_URL =
  'https://api.github.com/repos/graalvm/graalvm-ce-builds/releases?per_page=100';
const GRAALVM_COMMUNITY_RELEASES_PAGE_ORIGIN = 'https://api.github.com';
const GRAALVM_COMMUNITY_DOWNLOAD_URL =
  'https://github.com/graalvm/graalvm-ce-builds/releases';
const GRAALVM_COMMUNITY_ASSET_PREFIX = 'graalvm-community-jdk-';
const GRAALVM_COMMUNITY_VERSION_PATTERN = /^\d+(?:\.\d+)*$/;
const IS_WINDOWS = process.platform === 'win32';
const GRAALVM_PLATFORM = IS_WINDOWS ? 'windows' : process.platform;
const GRAALVM_MIN_VERSION = 17;
const SUPPORTED_ARCHITECTURES = ['x64', 'aarch64'] as const;
type SupportedArchitecture = (typeof SUPPORTED_ARCHITECTURES)[number];
type OsVersions = 'linux' | 'macos' | 'windows';

interface GraalVMCommunityAsset {
  name: string;
  browser_download_url: string;
}

interface GraalVMCommunityRelease {
  draft: boolean;
  prerelease: boolean;
  assets: GraalVMCommunityAsset[];
}

export class GraalVMDistribution extends JavaBase {
  constructor(
    installerOptions: JavaInstallerOptions,
    distributionName = 'GraalVM'
  ) {
    super(distributionName, installerOptions);
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    try {
      core.info(
        `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
      );
      let javaArchivePath = await tc.downloadTool(javaRelease.url);

      core.info(`Extracting Java archive...`);
      const extension = getDownloadArchiveExtension();
      if (IS_WINDOWS) {
        javaArchivePath = renameWinArchive(javaArchivePath);
      }

      const extractedJavaPath = await extractJdkFile(
        javaArchivePath,
        extension
      );

      // Add validation for extracted path
      if (!fs.existsSync(extractedJavaPath)) {
        throw new Error(
          `Extraction failed: path ${extractedJavaPath} does not exist`
        );
      }

      const dirContents = fs.readdirSync(extractedJavaPath);
      if (dirContents.length === 0) {
        throw new Error(
          'Extraction failed: no files found in extracted directory'
        );
      }

      const archivePath = path.join(extractedJavaPath, dirContents[0]);
      const version = this.getToolcacheVersionName(javaRelease.version);

      const javaPath = await tc.cacheDir(
        archivePath,
        this.toolcacheFolderName,
        version,
        this.architecture
      );

      return {version: javaRelease.version, path: javaPath};
    } catch (error) {
      core.error(`Failed to download and extract GraalVM: ${error}`);
      throw error;
    }
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    this.validateVersionRange(range);
    const arch = this.getSupportedArchitecture();

    if (!this.stable) {
      return this.findEABuildDownloadUrl(`${range}-ea`);
    }

    // The `latest` alias is normalized to the SemVer wildcard. Oracle GraalVM
    // builds its download URLs from a concrete major and has no endpoint to list
    // releases, so resolve the newest available GA major from the Adoptium API.
    if (this.latest) {
      range = (await getLatestMajorVersion(this.http)).toString();
    }

    const {platform, extension, major} = this.validateStableBuildRequest(range);

    const fileUrl = this.constructFileUrl(
      range,
      major,
      platform,
      arch,
      extension
    );

    const response = await this.http.head(fileUrl);
    this.handleHttpResponse(response, range);

    return {url: fileUrl, version: range};
  }

  protected validateVersionRange(range: string): void {
    if (!range || typeof range !== 'string') {
      throw new Error('Version range is required and must be a string');
    }
  }

  protected getSupportedArchitecture(): SupportedArchitecture {
    const arch = this.distributionArchitecture();
    if (!SUPPORTED_ARCHITECTURES.includes(arch as SupportedArchitecture)) {
      throw new Error(
        `Unsupported architecture: ${this.architecture}. Supported architectures are: ${SUPPORTED_ARCHITECTURES.join(', ')}`
      );
    }

    return arch as SupportedArchitecture;
  }

  protected validateStableBuildRequest(range: string): {
    platform: OsVersions;
    extension: string;
    major: string;
  } {
    if (this.packageType !== 'jdk') {
      throw new Error(
        `${this.distribution} provides only the \`jdk\` package type`
      );
    }

    const platform = this.getPlatform();
    const extension = getDownloadArchiveExtension();
    const major = range.includes('.') ? range.split('.')[0] : range;
    const majorVersion = parseInt(major);

    if (isNaN(majorVersion)) {
      throw new Error(`Invalid version format: ${range}`);
    }

    if (majorVersion < GRAALVM_MIN_VERSION) {
      throw new Error(
        `${this.distribution} is only supported for JDK ${GRAALVM_MIN_VERSION} and later. Requested version: ${major}`
      );
    }

    return {
      platform,
      major,
      extension
    };
  }

  private constructFileUrl(
    range: string,
    major: string,
    platform: string,
    arch: string,
    extension: string
  ): string {
    return range.includes('.')
      ? `${GRAALVM_DL_BASE}/${major}/archive/graalvm-jdk-${range}_${platform}-${arch}_bin.${extension}`
      : `${GRAALVM_DL_BASE}/${range}/latest/graalvm-jdk-${range}_${platform}-${arch}_bin.${extension}`;
  }

  private handleHttpResponse(response: any, range: string): void {
    const statusCode = response.message.statusCode;

    if (statusCode === HttpCodes.NotFound) {
      // Create the standard error with additional hint about checking the download URL
      const error = this.createVersionNotFoundError(range);
      if (this.latest) {
        error.message += `\nThe latest Java major version (${range}) is not yet available for the ${this.distribution} distribution. Please specify a concrete version instead of 'latest'.`;
      }
      error.message += `\nPlease check if this version is available at ${GRAALVM_DOWNLOAD_URL} . Pick a version from the list.`;
      throw error;
    }

    if (
      statusCode === HttpCodes.Unauthorized ||
      statusCode === HttpCodes.Forbidden
    ) {
      throw new Error(
        `Access denied when downloading GraalVM. Status code: ${statusCode}. Please check your credentials or permissions.`
      );
    }

    if (statusCode !== HttpCodes.OK) {
      throw new Error(
        `HTTP request for GraalVM failed with status code: ${statusCode} (${response.message.statusMessage || 'Unknown error'})`
      );
    }
  }

  private async findEABuildDownloadUrl(
    javaEaVersion: string
  ): Promise<JavaDownloadRelease> {
    core.debug(`Searching for EA build: ${javaEaVersion}`);

    const versions = await this.fetchEAJson(javaEaVersion);
    core.debug(`Found ${versions.length} EA versions`);

    const latestVersion = versions.find(v => v.latest);
    if (!latestVersion) {
      const availableVersions = versions.map(v => v.version);
      throw this.createVersionNotFoundError(
        javaEaVersion,
        availableVersions,
        'Note: No EA build is marked as latest for this version.'
      );
    }

    core.debug(`Latest version found: ${latestVersion.version}`);

    const arch = this.distributionArchitecture();
    const file = latestVersion.files.find(
      f => f.arch === arch && f.platform === GRAALVM_PLATFORM
    );

    if (!file) {
      core.error(
        `Available files for architecture ${arch}: ${JSON.stringify(latestVersion.files)}`
      );
      throw new Error(
        `Unable to find file for architecture '${arch}' and platform '${GRAALVM_PLATFORM}'`
      );
    }

    if (!file.filename.startsWith('graalvm-jdk-')) {
      throw new Error(
        `Invalid filename format: ${file.filename}. Expected to start with 'graalvm-jdk-'`
      );
    }

    const downloadUrl = `${latestVersion.download_base_url}${file.filename}`;
    core.debug(`Download URL: ${downloadUrl}`);

    return {
      url: downloadUrl,
      version: latestVersion.version
    };
  }

  private async fetchEAJson(
    javaEaVersion: string
  ): Promise<GraalVMEAVersion[]> {
    const url = `https://api.github.com/repos/graalvm/oracle-graalvm-ea-builds/contents/versions/${javaEaVersion}.json?ref=main`;
    const headers = getGitHubHttpHeaders();

    core.debug(
      `Trying to fetch available version info for GraalVM EA builds from '${url}'`
    );

    try {
      const response = await this.http.getJson<GraalVMEAVersion[]>(
        url,
        headers
      );

      if (!response.result) {
        throw new Error(
          `No GraalVM EA build found for version '${javaEaVersion}'. Please check if the version is correct.`
        );
      }

      return response.result;
    } catch (error) {
      if (error instanceof Error) {
        // Check if it's a 404 error (file not found)
        if (error.message?.includes('404')) {
          throw new Error(
            `GraalVM EA version '${javaEaVersion}' not found. Please verify the version exists in the EA builds repository.`,
            {cause: error}
          );
        }
        // Re-throw with more context
        throw new Error(
          `Failed to fetch GraalVM EA version information for '${javaEaVersion}': ${error.message}`,
          {cause: error}
        );
      }
      // If it's not an Error instance, throw a generic error
      throw new Error(
        `Failed to fetch GraalVM EA version information for '${javaEaVersion}'`,
        {cause: error}
      );
    }
  }

  public getPlatform(platform: NodeJS.Platform = process.platform): OsVersions {
    const platformMap: Record<string, OsVersions> = {
      darwin: 'macos',
      win32: 'windows',
      linux: 'linux'
    };

    const result = platformMap[platform];
    if (!result) {
      throw new Error(
        `Platform '${platform}' is not supported. Supported platforms: 'linux', 'macos', 'windows'`
      );
    }
    return result;
  }
}

export class GraalVMCommunityDistribution extends GraalVMDistribution {
  constructor(installerOptions: JavaInstallerOptions) {
    super(installerOptions, 'GraalVM Community');
  }

  protected get toolcacheFolderName(): string {
    return `Java_GraalVM_Community_${this.packageType}`;
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    this.validateVersionRange(range);

    if (!this.stable) {
      throw new Error('GraalVM Community does not provide early access builds');
    }

    const arch = this.getSupportedArchitecture();

    // GraalVM Community publishes its releases on GitHub, so the `latest` alias
    // (normalized to the SemVer wildcard `x`) can float to the newest GA it
    // actually ships. Unlike Oracle GraalVM (which has no listing endpoint and
    // must derive the newest major from the Adoptium API), we match against the
    // real release list here, so `latest` never fails when GraalVM lags behind a
    // brand-new Java major.
    let platform: OsVersions;
    let extension: string;
    if (this.latest) {
      if (this.packageType !== 'jdk') {
        throw new Error(
          `${this.distribution} provides only the \`jdk\` package type`
        );
      }
      platform = this.getPlatform();
      extension = getDownloadArchiveExtension();
    } else {
      ({platform, extension} = this.validateStableBuildRequest(range));
    }

    // GraalVM Community asset names embed the platform, architecture and
    // archive type, e.g. `graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz`.
    const assetSuffix = `_${platform}-${arch}_bin.${extension}`;
    const availableVersions = await this.getAvailableVersions(assetSuffix);

    const satisfiedVersion = availableVersions
      .filter(item => isVersionSatisfies(range, item.version))
      .sort((a, b) => -semver.compareBuild(a.version, b.version))[0];

    if (!satisfiedVersion) {
      const error = this.createVersionNotFoundError(
        range,
        availableVersions.map(item => item.version),
        `Platform: ${platform}`
      );
      error.message += `\nPlease check if this version is available at ${GRAALVM_COMMUNITY_DOWNLOAD_URL}.`;
      throw error;
    }

    return satisfiedVersion;
  }

  private async getAvailableVersions(
    assetSuffix: string
  ): Promise<JavaDownloadRelease[]> {
    const headers = getGitHubHttpHeaders();
    const versions = new Map<string, JavaDownloadRelease>();
    let releasesUrl: string | null = GRAALVM_COMMUNITY_RELEASES_URL;

    for (
      let pageIndex = 0;
      releasesUrl && pageIndex < MAX_PAGINATION_PAGES;
      pageIndex++
    ) {
      const response = await this.http.getJson<GraalVMCommunityRelease[]>(
        releasesUrl,
        headers
      );

      // A successful GitHub releases listing is always a JSON array (possibly
      // empty). Anything else indicates an unexpected/error payload (rate
      // limiting, auth failure, etc.) that must be surfaced instead of being
      // silently treated as "no releases", which would later look like a
      // misleading "version not found" error.
      if (!Array.isArray(response.result)) {
        throw new Error(
          `Unexpected response while listing GraalVM Community releases from ${releasesUrl} ` +
            `(HTTP status code: ${response.statusCode}). Expected a JSON array of releases. ` +
            `Please check if the service is available at ${GRAALVM_COMMUNITY_DOWNLOAD_URL}.`
        );
      }

      const releases = response.result;
      if (releases.length === 0) {
        break;
      }

      for (const release of releases) {
        if (release.draft || release.prerelease) {
          continue;
        }

        for (const asset of release.assets ?? []) {
          const version = this.extractAssetVersion(asset.name, assetSuffix);
          if (version) {
            versions.set(version, {
              version,
              url: asset.browser_download_url
            });
          }
        }
      }

      releasesUrl = this.getNextReleasesUrl(response.headers);
    }

    return [...versions.values()];
  }

  // Returns the GraalVM JDK version encoded in a release asset name when it
  // matches the requested platform/architecture/archive suffix, otherwise null.
  private extractAssetVersion(
    assetName: string,
    assetSuffix: string
  ): string | null {
    if (
      !assetName.startsWith(GRAALVM_COMMUNITY_ASSET_PREFIX) ||
      !assetName.endsWith(assetSuffix)
    ) {
      return null;
    }

    const rawVersion = assetName.slice(
      GRAALVM_COMMUNITY_ASSET_PREFIX.length,
      -assetSuffix.length
    );

    if (!GRAALVM_COMMUNITY_VERSION_PATTERN.test(rawVersion)) {
      return null;
    }

    return convertVersionToSemver(rawVersion);
  }

  private getNextReleasesUrl(
    headers: Record<string, string | string[] | undefined>
  ): string | null {
    const nextUrl = getNextPageUrlFromLinkHeader(headers);
    if (
      nextUrl &&
      !validatePaginationUrl(nextUrl, GRAALVM_COMMUNITY_RELEASES_PAGE_ORIGIN)
    ) {
      core.warning(
        `Ignoring pagination link with unexpected origin: ${nextUrl}`
      );
      return null;
    }
    return nextUrl;
  }
}

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import {JavaBase} from '../base-installer';
import {HttpCodes} from '@actions/http-client';
import {GraalVMEAVersion} from './models';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  getGitHubHttpHeaders,
  renameWinArchive
} from '../../util';

const GRAALVM_DL_BASE = 'https://download.oracle.com/graalvm';
const IS_WINDOWS = process.platform === 'win32';
const GRAALVM_PLATFORM = IS_WINDOWS ? 'windows' : process.platform;
const GRAALVM_MIN_VERSION = 17;
const SUPPORTED_ARCHITECTURES = ['x64', 'aarch64'] as const;
type SupportedArchitecture = (typeof SUPPORTED_ARCHITECTURES)[number];
type OsVersions = 'linux' | 'macos' | 'windows';

export class GraalVMDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('GraalVM', installerOptions);
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
    // Add input validation
    if (!range || typeof range !== 'string') {
      throw new Error('Version range is required and must be a string');
    }

    const arch = this.distributionArchitecture();
    if (!SUPPORTED_ARCHITECTURES.includes(arch as SupportedArchitecture)) {
      throw new Error(
        `Unsupported architecture: ${this.architecture}. Supported architectures are: ${SUPPORTED_ARCHITECTURES.join(', ')}`
      );
    }

    if (!this.stable) {
      return this.findEABuildDownloadUrl(`${range}-ea`);
    }

    if (this.packageType !== 'jdk') {
      throw new Error('GraalVM provides only the `jdk` package type');
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
        `GraalVM is only supported for JDK ${GRAALVM_MIN_VERSION} and later. Requested version: ${major}`
      );
    }

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
      throw new Error(
        `Could not find GraalVM for SemVer ${range}. Please check if this version is available at ${GRAALVM_DL_BASE}`
      );
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
      core.error(
        `Available versions: ${versions.map(v => v.version).join(', ')}`
      );
      throw new Error(`Unable to find latest version for '${javaEaVersion}'`);
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
            `GraalVM EA version '${javaEaVersion}' not found. Please verify the version exists in the EA builds repository.`
          );
        }
        // Re-throw with more context
        throw new Error(
          `Failed to fetch GraalVM EA version information for '${javaEaVersion}': ${error.message}`
        );
      }
      // If it's not an Error instance, throw a generic error
      throw new Error(
        `Failed to fetch GraalVM EA version information for '${javaEaVersion}'`
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

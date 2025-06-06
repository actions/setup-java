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

export class GraalVMDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('GraalVM', installerOptions);
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    let javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();
    if (IS_WINDOWS) {
      javaArchivePath = renameWinArchive(javaArchivePath);
    }
    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);
    const archivePath = path.join(
      extractedJavaPath,
      fs.readdirSync(extractedJavaPath)[0]
    );
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );
    return {version: javaRelease.version, path: javaPath};
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    const arch = this.distributionArchitecture();
    if (!['x64', 'aarch64'].includes(arch)) {
      throw new Error(`Unsupported architecture: ${this.architecture}`);
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
    const fileUrl = this.constructFileUrl(
      range,
      major,
      platform,
      arch,
      extension
    );

    if (parseInt(major) < 17) {
      throw new Error('GraalVM is only supported for JDK 17 and later');
    }

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
    if (response.message.statusCode === HttpCodes.NotFound) {
      throw new Error(`Could not find GraalVM for SemVer ${range}`);
    }
    if (response.message.statusCode !== HttpCodes.OK) {
      throw new Error(
        `Http request for GraalVM failed with status code: ${response.message.statusCode}`
      );
    }
  }

  private async findEABuildDownloadUrl(
    javaEaVersion: string
  ): Promise<JavaDownloadRelease> {
    const versions = await this.fetchEAJson(javaEaVersion);
    const latestVersion = versions.find(v => v.latest);
    if (!latestVersion) {
      throw new Error(`Unable to find latest version for '${javaEaVersion}'`);
    }

    const arch = this.distributionArchitecture();
    const file = latestVersion.files.find(
      f => f.arch === arch && f.platform === GRAALVM_PLATFORM
    );
    if (!file || !file.filename.startsWith('graalvm-jdk-')) {
      throw new Error(`Unable to find file metadata for '${javaEaVersion}'`);
    }

    return {
      url: `${latestVersion.download_base_url}${file.filename}`,
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
    const fetchedJson = await this.http
      .getJson<GraalVMEAVersion[]>(url, headers)
      .then(res => res.result);

    if (!fetchedJson) {
      throw new Error(
        `No GraalVM EA build found for version '${javaEaVersion}'. Please check if the version is correct.`
      );
    }
    return fetchedJson;
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

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';

import {JavaBase} from '../base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  getGitHubHttpHeaders
} from '../../util';
import {HttpCodes} from '@actions/http-client';
import {GraalVMEAVersion} from './models';

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
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();

    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
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
    if (arch !== 'x64' && arch !== 'aarch64') {
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
    let major;
    let fileUrl;
    if (range.includes('.')) {
      major = range.split('.')[0];
      fileUrl = `${GRAALVM_DL_BASE}/${major}/archive/graalvm-jdk-${range}_${platform}-${arch}_bin.${extension}`;
    } else {
      major = range;
      fileUrl = `${GRAALVM_DL_BASE}/${range}/latest/graalvm-jdk-${range}_${platform}-${arch}_bin.${extension}`;
    }

    if (parseInt(major) < 17) {
      throw new Error('GraalVM is only supported for JDK 17 and later');
    }

    const response = await this.http.head(fileUrl);

    if (response.message.statusCode === HttpCodes.NotFound) {
      throw new Error(`Could not find GraalVM for SemVer ${range}`);
    }

    if (response.message.statusCode !== HttpCodes.OK) {
      throw new Error(
        `Http request for GraalVM failed with status code: ${response.message.statusCode}`
      );
    }

    return {url: fileUrl, version: range};
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
    const owner = 'graalvm';
    const repository = 'oracle-graalvm-ea-builds';
    const branch = 'main';
    const filePath = `versions/${javaEaVersion}.json`;

    const url = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;

    const headers = getGitHubHttpHeaders();

    core.debug(
      `Trying to fetch available version info for GraalVM EA builds from '${url}'`
    );
    let fetchedJson;
    try {
      fetchedJson = (await this.http.getJson<GraalVMEAVersion[]>(url, headers))
        .result;
    } catch (err) {
      throw Error(
        `Fetching version info for GraalVM EA builds from '${url}' failed with the error: ${
          (err as Error).message
        }`
      );
    }
    if (fetchedJson === null) {
      throw Error(
        `No GraalVM EA build found. Are you sure java-version: '${javaEaVersion}' is correct?`
      );
    }
    return fetchedJson;
  }

  public getPlatform(platform: NodeJS.Platform = process.platform): OsVersions {
    switch (platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      case 'linux':
        return 'linux';
      default:
        throw new Error(
          `Platform '${platform}' is not supported. Supported platforms: 'linux', 'macos', 'windows'`
        );
    }
  }
}

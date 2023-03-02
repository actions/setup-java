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
import {extractJdkFile, getDownloadArchiveExtension} from '../../util';
import {HttpCodes} from '@actions/http-client';

const ORACLE_DL_BASE = 'https://download.oracle.com/java';

export class OracleDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Oracle', installerOptions);
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
      throw new Error('Early access versions are not supported');
    }

    if (this.packageType !== 'jdk') {
      throw new Error('Oracle JDK provides only the `jdk` package type');
    }

    const platform = this.getPlatform();
    const extension = getDownloadArchiveExtension();
    let major;
    let fileUrl;
    if (range.includes('.')) {
      major = range.split('.')[0];
      fileUrl = `${ORACLE_DL_BASE}/${major}/archive/jdk-${range}_${platform}-${arch}_bin.${extension}`;
    } else {
      major = range;
      fileUrl = `${ORACLE_DL_BASE}/${range}/latest/jdk-${range}_${platform}-${arch}_bin.${extension}`;
    }

    if (parseInt(major) < 17) {
      throw new Error('Oracle JDK is only supported for JDK 17 and later');
    }

    const response = await this.http.head(fileUrl);

    if (response.message.statusCode === HttpCodes.NotFound) {
      throw new Error(`Could not find Oracle JDK for SemVer ${range}`);
    }

    if (response.message.statusCode !== HttpCodes.OK) {
      throw new Error(
        `Http request for Oracle JDK failed with status code: ${response.message.statusCode}`
      );
    }

    return {url: fileUrl, version: range};
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

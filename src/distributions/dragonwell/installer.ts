import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';

import {JavaBase} from '../base-installer';
import {extractJdkFile, getDownloadArchiveExtension} from '../../util';
import {IDragonwellVersions, IDragonwellAllVersions} from './models';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';

export class DragonwellDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Dragonwell', installerOptions);
  }

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    if (!this.stable) {
      throw new Error('Early access versions are not supported');
    }
    let majorVersion = version;
    if (version.includes('.')) {
      const splits = version.split('.');
      majorVersion = splits[0];
      version = splits.length >= 3 ? splits.slice(0, 3).join('.') : version;
    }
    const edition = majorVersion == '17' ? 'Standard' : 'Extended';
    const availableVersions = await this.getAvailableVersions();
    const matchedVersions = availableVersions
      .filter(item => item.jdk_version == version && item.edition == edition)
      .map(item => {
        return {
          version: item.jdk_version,
          url: item.download_link
        } as JavaDownloadRelease;
      });
    if (!matchedVersions.length) {
      throw new Error(
        `Couldn't find any satisfied version for the specified: "${version}".`
      );
    }

    const resolvedVersion = matchedVersions[0];
    return resolvedVersion;
  }

  private async getAvailableVersions(): Promise<IDragonwellVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();

    const availableVersionsUrl =
      'https://raw.githubusercontent.com/dragonwell-releng/dragonwell-setup-java/main/releases.json';

    const fetchedDragonwellVersions =
      (await this.http.getJson<IDragonwellAllVersions>(availableVersionsUrl))
        .result ?? {};
    if (Object.keys(fetchedDragonwellVersions).length == 0) {
      throw Error(
        `Couldn't fetch any dragonwell versions from ${availableVersionsUrl}`
      );
    }
    const availableVersions = this.getEligibleAvailableVersions(
      platform,
      arch,
      fetchedDragonwellVersions
    );

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      core.debug(availableVersions.map(item => item.jdk_version).join(', '));
      core.endGroup();
    }

    return availableVersions;
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);

    const extractedJavaPath = await extractJdkFile(
      javaArchivePath,
      getDownloadArchiveExtension()
    );

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

  private getEligibleAvailableVersions(
    platform: string,
    arch: string,
    dragonwellVersions: IDragonwellAllVersions
  ): IDragonwellVersions[] {
    const eligibleVersions: IDragonwellVersions[] = [];

    for (const majorVersion in dragonwellVersions) {
      const majorVersionMap = dragonwellVersions[majorVersion];
      for (let jdkVersion in majorVersionMap) {
        const jdkVersionMap = majorVersionMap[jdkVersion];
        if (!(platform in jdkVersionMap)) {
          continue;
        }
        const platformMap = jdkVersionMap[platform];
        if (!(arch in platformMap)) {
          continue;
        }
        const archMap = platformMap[arch];
        if (jdkVersion === 'latest') {
          jdkVersion = majorVersion;
        }
        if (jdkVersion.includes('.')) {
          const splits = jdkVersion.split('.');
          jdkVersion =
            splits.length >= 3 ? splits.slice(0, 3).join('.') : jdkVersion;
        }
        for (const edition in archMap) {
          eligibleVersions.push({
            os: platform,
            architecture: arch,
            jdk_version: jdkVersion,
            checksum: archMap[edition].sha256,
            download_link: archMap[edition].download_url,
            edition: edition,
            image_type: 'jdk'
          });
        }
      }
    }
    return eligibleVersions;
  }

  private getPlatformOption(): string {
    switch (process.platform) {
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }
}

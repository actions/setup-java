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
    const resolvedVersion =
      matchedVersions.length > 0 ? matchedVersions[0] : null;
    if (!resolvedVersion) {
      const versionsMsg = core.isDebug()
        ? `Available versions: ${availableVersions}`
        : '';
      throw new Error(
        `Cannot find satisfied version for ${version}.${versionsMsg}`
      );
    }
    return resolvedVersion;
  }

  private async getAvailableVersions(): Promise<IDragonwellVersions[]> {
    const platform = this.getPlatformOption();
    let arch = this.distributionArchitecture();

    const majorVersion = this.version.includes('.')
      ? this.version.split('.')[0]
      : this.version;
    if (['8', '11', '17'].includes(majorVersion) != true) {
      throw new Error('Support dragonwell versions: 8, 11, 17');
    }

    const availableVersionsUrl =
      'https://dragonwell-jdk.io/map_with_checksum.json';

    const fetchedDragonwellVersions =
      (await this.http.getJson<IDragonwellAllVersions>(availableVersionsUrl))
        .result ?? {};
    if (Object.keys(fetchedDragonwellVersions).length == 0) {
      throw Error(
        `Could fetch any dragonwell versions from ${availableVersionsUrl}`
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

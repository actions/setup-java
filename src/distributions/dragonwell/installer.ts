import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import semver from 'semver';

import fs from 'fs';
import path from 'path';

import {JavaBase} from '../base-installer';
import {extractJdkFile, getDownloadArchiveExtension, isVersionSatisfies} from '../../util';
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
    
    const availableVersions = await this.getAvailableVersions();

    const matchedVersions = availableVersions
      .filter(item => {
        return isVersionSatisfies(version, item.jdk_version);
      }) 
      .map(item => {
        return {
          version: item.jdk_version,
          url: item.download_link
        } as JavaDownloadRelease;
      });

    if (!matchedVersions.length) {
      throw new Error(
        `Couldn't find any satisfied version for the specified java-version: "${version}".`
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
        .result;

    if (!fetchedDragonwellVersions) { 
      throw new Error(
        `Couldn't fetch any dragonwell versions from ${availableVersionsUrl}`
      );
    }
    
    const availableVersions = this.parseVersions(
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

  private parseVersions(
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
          continue;
        }

        if (jdkVersion.split(".").length > 3) {
          jdkVersion = this.transformToSemver(jdkVersion);
        }

        for (const edition in archMap) {
          eligibleVersions.push({
            os: platform,
            architecture: arch,
            jdk_version: jdkVersion,
            checksum: archMap[edition].sha256 ?? "",
            download_link: archMap[edition].download_url,
            edition: edition,
            image_type: 'jdk'
          });
          break; // Get the first available link to the JDK. In most cases it should point to the Extended version of JDK, in rare cases like with v17 it points to the Standard version (the only available).
        }
      }
    }

    const sortedEligibleVersions = this.sortParsedVersions(eligibleVersions); // сортирует версии в порядке убивания
    
    return sortedEligibleVersions;
  }

  // Sorts versions in descending order as by default data in JSON isn't sorted
  private sortParsedVersions(eligibleVersions: IDragonwellVersions[]): IDragonwellVersions[] {
    const sortedVersions = eligibleVersions.sort((versionObj1, versionObj2) => {
      const version1 = versionObj1.jdk_version;
      const version2 = versionObj2.jdk_version;
      return semver.compareBuild(version1, version2);
    });
    return sortedVersions.reverse();
  }

  // Some version of Dragonwell JDK are numerated with help of non-semver notation (more then 3 digits).
  // Common practice is to transform excess digits to the so-called semver build part, which is prefixed with the plus sign, to be able to operate with them using semver tools.
  private transformToSemver(version: string) {
    const splits = version.split('.');
    const versionMainPart = splits.slice(0,3).join(".");
    const versionBuildPart = splits.slice(3).join(".");
    return `${versionMainPart}+${versionBuildPart}`;
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

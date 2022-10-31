import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import path from 'path';
import fs from 'fs';
import semver from 'semver';

import { JavaBase } from '../base-installer';
import { IZuluVersions } from './models';
import { extractJdkFile, getDownloadArchiveExtension, isVersionSatisfies } from '../../util';
import { JavaDownloadRelease, JavaInstallerOptions, JavaInstallerResults } from '../base-models';

export class ZuluDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Zulu', installerOptions);
  }

  protected async findPackageForDownload(version: string): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersions = availableVersionsRaw.map(item => {
      return {
        version: this.convertVersionToSemver(item.jdk_version),
        url: item.url,
        zuluVersion: this.convertVersionToSemver(item.zulu_version)
      };
    });

    const satisfiedVersions = availableVersions
      .filter(item => isVersionSatisfies(version, item.version))
      .sort((a, b) => {
        // Azul provides two versions: jdk_version and azul_version
        // we should sort by both fields by descending
        return (
          -semver.compareBuild(a.version, b.version) ||
          -semver.compareBuild(a.zuluVersion, b.zuluVersion)
        );
      })
      .map(item => {
        return {
          version: item.version,
          url: item.url
        } as JavaDownloadRelease;
      });

    const resolvedFullVersion = satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableOptions = availableVersions.map(item => item.version).join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for semver ${version}. ${availableOptionsMessage}`
      );
    }

    return resolvedFullVersion;
  }

  protected async downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
    let extractedJavaPath: string;

    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    let extension = getDownloadArchiveExtension();

    extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      this.getToolcacheVersionName(javaRelease.version),
      this.architecture
    );

    return { version: javaRelease.version, path: javaPath };
  }

  private async getAvailableVersions(): Promise<IZuluVersions[]> {
    const { arch, hw_bitness, abi } = this.getArchitectureOptions();
    const [bundleType, features] = this.packageType.split('+');
    const platform = this.getPlatformOption();
    const extension = getDownloadArchiveExtension();
    const javafx = features?.includes('fx') ?? false;
    const releaseStatus = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('azul-retrieve-available-versions');
    }
    const requestArguments = [
      `os=${platform}`,
      `ext=${extension}`,
      `bundle_type=${bundleType}`,
      `javafx=${javafx}`,
      `arch=${arch}`,
      `hw_bitness=${hw_bitness}`,
      `release_status=${releaseStatus}`,
      abi ? `abi=${abi}` : null,
      features ? `features=${features}` : null
    ]
      .filter(Boolean)
      .join('&');

    const availableVersionsUrl = `https://api.azul.com/zulu/download/community/v1.0/bundles/?${requestArguments}`;
    if (core.isDebug()) {
      core.debug(`Gathering available versions from '${availableVersionsUrl}'`);
    }

    const availableVersions =
      (await this.http.getJson<Array<IZuluVersions>>(availableVersionsUrl)).result ?? [];

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('azul-retrieve-available-versions');
      console.log(`Available versions: [${availableVersions.length}]`);
      console.log(availableVersions.map(item => item.jdk_version.join('.')).join(', '));
      core.endGroup();
    }

    return availableVersions;
  }

  private getArchitectureOptions(): {
    arch: string;
    hw_bitness: string;
    abi: string;
  } {
    const arch = this.distributionArchitecture();
    switch (arch) {
      case 'x64':
        return { arch: 'x86', hw_bitness: '64', abi: '' };
      case 'x86':
        return { arch: 'x86', hw_bitness: '32', abi: '' };
      case 'aarch64':
      case 'arm64':
        return { arch: 'arm', hw_bitness: '64', abi: '' };
      default:
        return { arch: arch, hw_bitness: '', abi: '' };
    }
  }

  private getPlatformOption(): string {
    // Azul has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }

  // Azul API returns jdk_version as array of digits like [11, 0, 2, 1]
  private convertVersionToSemver(version_array: number[]) {
    const mainVersion = version_array.slice(0, 3).join('.');
    if (version_array.length > 3) {
      // intentionally ignore more than 4 numbers because it is invalid semver
      return `${mainVersion}+${version_array[3]}`;
    }

    return mainVersion;
  }
}

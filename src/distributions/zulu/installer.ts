import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import path from 'path';
import fs from 'fs';
import semver from 'semver';

import {JavaBase} from '../base-installer';
import {IZuluVersions} from './models';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  convertVersionToSemver,
  isVersionSatisfies,
  renameWinArchive
} from '../../util';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';

export class ZuluDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Zulu', installerOptions);
  }

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersions = availableVersionsRaw.map(item => {
      return {
        version: convertVersionToSemver(item.java_version),
        url: item.download_url,
        zuluVersion: convertVersionToSemver(item.distro_version)
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

    const resolvedFullVersion =
      satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableOptions = availableVersions
        .map(item => item.version)
        .join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for semver ${version}. ${availableOptionsMessage}`
      );
    }

    return resolvedFullVersion;
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
    if (process.platform === 'win32') {
      javaArchivePath = renameWinArchive(javaArchivePath);
    }
    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      this.getToolcacheVersionName(javaRelease.version),
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  private async getAvailableVersions(): Promise<IZuluVersions[]> {
    const {arch, hw_bitness, abi} = this.getArchitectureOptions();
    const [bundleType, features] = this.packageType.split('+');
    const platform = this.getPlatformOption();
    const extension = getDownloadArchiveExtension();
    const javafx = features?.includes('fx') ?? false;
    const crac = features?.includes('crac') ?? false;
    const releaseStatus = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Zulu took'); // eslint-disable-line no-console
    }

    // Fetch all pages to avoid missing packages when there are > 100 results
    let allVersions: IZuluVersions[] = [];
    let page = 1;
    const pageSize = 100;
    let hasMore = true;

    while (hasMore) {
      // Map architecture for new metadata API (x86+64bit -> x64, arm+64bit -> aarch64, etc.)
      let archParam = arch;
      if (arch === 'x86' && hw_bitness === '64') {
        archParam = 'x64';
      } else if (arch === 'arm' && hw_bitness === '64') {
        archParam = 'aarch64';
      }

      const requestArguments = [
        `os=${platform === 'linux' ? 'linux-glibc' : platform}`,
        `arch=${archParam}`,
        `archive_type=${extension}`,
        `java_package_type=${bundleType}`,
        `javafx_bundled=${javafx}`,
        `crac_supported=${crac}`,
        `release_status=${releaseStatus}`,
        `availability_types=ca`,
        // Only filter by TCK certification for GA releases
        // EA releases typically don't have TCK certification
        releaseStatus === 'ga' ? `certifications=tck` : '',
        `page=${page}`,
        `page_size=${pageSize}`
      ]
        .filter(Boolean)
        .join('&');

      const availableVersionsUrl = `https://api.azul.com/metadata/v1/zulu/packages/?${requestArguments}`;

      core.debug(`Gathering available versions from '${availableVersionsUrl}'`);

      const pageResults =
        (await this.http.getJson<Array<IZuluVersions>>(availableVersionsUrl))
          .result ?? [];

      allVersions = allVersions.concat(pageResults);

      // If we got fewer results than page size, we've reached the end
      hasMore = pageResults.length === pageSize;
      page++;
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Zulu took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${allVersions.length}]`);
      core.debug(
        allVersions.map(item => item.java_version.join('.')).join(', ')
      );
      core.endGroup();
    }

    return allVersions;
  }

  private getArchitectureOptions(): {
    arch: string;
    hw_bitness: string;
    abi: string;
  } {
    const arch = this.distributionArchitecture();
    switch (arch) {
      case 'x64':
        return {arch: 'x86', hw_bitness: '64', abi: ''};
      case 'x86':
        return {arch: 'x86', hw_bitness: '32', abi: ''};
      case 'aarch64':
      case 'arm64':
        return {arch: 'arm', hw_bitness: '64', abi: ''};
      default:
        return {arch: arch, hw_bitness: '', abi: ''};
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
}

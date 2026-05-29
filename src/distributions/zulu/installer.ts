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
        // Azul provides two versions: java_version and distro_version
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
      const availableVersionStrings = availableVersions.map(
        item => item.version
      );
      throw this.createVersionNotFoundError(version, availableVersionStrings);
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
    const arch = this.getArchitectureOptions();
    const [bundleType, features] = this.packageType.split('+');
    const platform = this.getPlatformOption();
    const extension = getDownloadArchiveExtension();
    const javafx = features?.includes('fx') ?? false;
    const releaseStatus = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Zulu took'); // eslint-disable-line no-console
    }

    const baseRequestArguments = [
      `os=${platform}`,
      `archive_type=${extension}`,
      `java_package_type=${bundleType}`,
      `javafx_bundled=${javafx}`,
      `arch=${arch}`,
      `release_status=${releaseStatus}`,
      `availability_types=ca`
    ].join('&');

    // need to iterate through all pages to retrieve the list of all versions
    // Azul API doesn't provide a way to retrieve the count of pages so use an infinity loop
    let page_index = 1;
    const availableVersions: IZuluVersions[] = [];
    while (true) {
      const requestArguments = `${baseRequestArguments}&page=${page_index}&page_size=100`;
      const availableVersionsUrl = `https://api.azul.com/metadata/v1/zulu/packages/?${requestArguments}`;
      if (core.isDebug() && page_index === 1) {
        // url is identical except page_index so print it once for debug
        core.debug(
          `Gathering available versions from '${availableVersionsUrl}'`
        );
      }

      const paginationPage = (
        await this.http.getJson<IZuluVersions[]>(availableVersionsUrl)
      ).result;
      if (paginationPage === null || paginationPage.length === 0) {
        // break infinity loop because we have reached end of pagination
        break;
      }

      availableVersions.push(...paginationPage);
      page_index++;
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Zulu took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(
        availableVersions.map(item => item.java_version.join('.')).join(', ')
      );
      core.endGroup();
    }

    return availableVersions;
  }

  private getArchitectureOptions(): string {
    const arch = this.distributionArchitecture();
    switch (arch) {
      case 'x64':
        return 'x64';
      case 'x86':
        return 'x86';
      case 'aarch64':
      case 'arm64':
        return 'aarch64';
      default:
        return arch;
    }
  }

  private getPlatformOption(): string {
    // Azul has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      case 'linux':
        // The new Metadata API's "linux" value returns both glibc and musl packages;
        // use "linux_glibc" to target only glibc, which is what standard runners use.
        return 'linux_glibc';
      default:
        return process.platform;
    }
  }
}

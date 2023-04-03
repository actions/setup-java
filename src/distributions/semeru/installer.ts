import {JavaBase} from '../base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import semver from 'semver';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  isVersionSatisfies
} from '../../util';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import {ISemeruAvailableVersions} from './models';

const supportedArchitectures = [
  'x64',
  'x86',
  'ppc64le',
  'ppc64',
  's390x',
  'aarch64'
];

export class SemeruDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('IBM_Semeru', installerOptions);
  }

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    if (!supportedArchitectures.includes(this.architecture)) {
      throw new Error(
        `Unsupported architecture for IBM Semeru: ${
          this.architecture
        }, the following are supported: ${supportedArchitectures.join(', ')}`
      );
    }

    if (!this.stable) {
      throw new Error(
        'IBM Semeru does not provide builds for early access versions'
      );
    }

    if (this.packageType !== 'jdk' && this.packageType !== 'jre') {
      throw new Error('IBM Semeru only provide `jdk` and `jre` package types');
    }

    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersionsWithBinaries = availableVersionsRaw
      .filter(item => item.binaries.length > 0)
      .map(item => {
        // normalize 17.0.0-beta+33.0.202107301459 to 17.0.0+33.0.202107301459 for earlier access versions
        const formattedVersion = this.stable
          ? item.version_data.semver
          : item.version_data.semver.replace('-beta+', '+');
        return {
          version: formattedVersion,
          url: item.binaries[0].package.link
        } as JavaDownloadRelease;
      });

    const satisfiedVersions = availableVersionsWithBinaries
      .filter(item => isVersionSatisfies(version, item.version))
      .sort((a, b) => {
        return -semver.compareBuild(a.version, b.version);
      });

    const resolvedFullVersion =
      satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableOptions = availableVersionsWithBinaries
        .map(item => item.version)
        .join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for SemVer '${version}'. ${availableOptionsMessage}`
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
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();

    const extractedJavaPath: string = await extractJdkFile(
      javaArchivePath,
      extension
    );

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath: string = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected get toolcacheFolderName(): string {
    return super.toolcacheFolderName;
  }

  public async getAvailableVersions(): Promise<ISemeruAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.architecture;
    const imageType = this.packageType;
    const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
    const releaseType = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Semeru took'); // eslint-disable-line no-console
    }

    const baseRequestArguments = [
      `project=jdk`,
      'vendor=ibm',
      `heap_size=normal`,
      'sort_method=DEFAULT',
      'sort_order=DESC',
      `os=${platform}`,
      `architecture=${arch}`,
      `image_type=${imageType}`,
      `release_type=${releaseType}`,
      `jvm_impl=openj9`
    ].join('&');

    // need to iterate through all pages to retrieve the list of all versions
    // Adoptium API doesn't provide way to retrieve the count of pages to iterate so infinity loop
    let page_index = 0;
    const availableVersions: ISemeruAvailableVersions[] = [];
    while (true) {
      const requestArguments = `${baseRequestArguments}&page_size=20&page=${page_index}`;
      const availableVersionsUrl = `https://api.adoptopenjdk.net/v3/assets/version/${versionRange}?${requestArguments}`;
      if (core.isDebug() && page_index === 0) {
        // url is identical except page_index so print it once for debug
        core.debug(
          `Gathering available versions from '${availableVersionsUrl}'`
        );
      }

      const paginationPage = (
        await this.http.getJson<ISemeruAvailableVersions[]>(
          availableVersionsUrl
        )
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
      console.timeEnd('Retrieving available versions for Semeru took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(
        availableVersions.map(item => item.version_data.semver).join(', ')
      );
      core.endGroup();
    }

    return availableVersions;
  }

  private getPlatformOption(): string {
    // Adopt has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }
}

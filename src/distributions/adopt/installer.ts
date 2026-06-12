import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';
import semver from 'semver';

import {JavaBase} from '../base-installer';
import {IAdoptAvailableVersions} from './models';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  extractJdkFile,
  getNextPageUrlFromLinkHeader,
  getDownloadArchiveExtension,
  isVersionSatisfies,
  renameWinArchive,
  MAX_PAGINATION_PAGES,
  validatePaginationUrl
} from '../../util';
import {TemurinDistribution, TemurinImplementation} from '../temurin/installer';

export enum AdoptImplementation {
  Hotspot = 'Hotspot',
  OpenJ9 = 'OpenJ9'
}

export class AdoptDistribution extends JavaBase {
  constructor(
    installerOptions: JavaInstallerOptions,
    private readonly jvmImpl: AdoptImplementation,
    private readonly temurinDistribution: TemurinDistribution | null = null
  ) {
    super(`Adopt-${jvmImpl}`, installerOptions);

    if (
      temurinDistribution !== null &&
      jvmImpl !== AdoptImplementation.Hotspot
    ) {
      throw new Error('Only Hotspot JVM is supported by Temurin.');
    }

    // Only use the temurin repo for Hotspot JVMs
    if (
      temurinDistribution === null &&
      jvmImpl === AdoptImplementation.Hotspot
    ) {
      this.temurinDistribution = new TemurinDistribution(
        installerOptions,
        TemurinImplementation.Hotspot
      );
    }
  }

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    if (this.jvmImpl === AdoptImplementation.Hotspot) {
      core.notice(
        "AdoptOpenJDK has moved to Eclipse Temurin https://github.com/actions/setup-java#supported-distributions please consider changing to the 'temurin' distribution type in your setup-java configuration."
      );
    }

    if (
      this.jvmImpl === AdoptImplementation.Hotspot &&
      this.temurinDistribution !== null
    ) {
      try {
        return await this.temurinDistribution.findPackageForDownload(version);
      } catch (error) {
        // Log the failure but always fall back to legacy AdoptOpenJDK for resilience
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('No matching version found')) {
          core.notice(
            'The JVM you are looking for could not be found in the Temurin repository, this likely indicates ' +
              'that you are using an out of date version of Java, consider updating and moving to using the Temurin distribution type in setup-java.'
          );
        } else {
          // Log other errors for debugging but gracefully fall back
          core.debug(
            `Temurin lookup failed: ${errorMessage}. Falling back to AdoptOpenJDK API.`
          );
        }
      }
    }

    // failed to find a Temurin version, so fall back to AdoptOpenJDK
    return this.findPackageForDownloadOldAdoptOpenJdk(version);
  }

  private async findPackageForDownloadOldAdoptOpenJdk(
    version: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersionsWithBinaries = availableVersionsRaw
      .filter(item => item.binaries.length > 0)
      .map(item => {
        return {
          version: item.version_data.semver,
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
      const availableVersionStrings = availableVersionsWithBinaries.map(
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
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected get toolcacheFolderName(): string {
    if (this.jvmImpl === AdoptImplementation.Hotspot) {
      // exclude Hotspot postfix from distribution name because Hosted runners have pre-cached Adopt OpenJDK under "Java_Adopt_jdk"
      // for more information see: https://github.com/actions/setup-java/pull/155#discussion_r610451063
      return `Java_Adopt_${this.packageType}`;
    }
    return super.toolcacheFolderName;
  }

  private async getAvailableVersions(): Promise<IAdoptAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
    const imageType = this.packageType;
    const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
    const releaseType = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Adopt took'); // eslint-disable-line no-console
    }

    const baseRequestArguments = [
      `project=jdk`,
      'vendor=adoptopenjdk',
      `heap_size=normal`,
      'sort_method=DEFAULT',
      'sort_order=DESC',
      `os=${platform}`,
      `architecture=${arch}`,
      `image_type=${imageType}`,
      `release_type=${releaseType}`,
      `jvm_impl=${this.jvmImpl.toLowerCase()}`
    ].join('&');

    const requestArguments = `${baseRequestArguments}&page_size=20&page=0`;
    let availableVersionsUrl: string | null =
      `https://api.adoptopenjdk.net/v3/assets/version/${versionRange}?${requestArguments}`;
    const availableVersions: IAdoptAvailableVersions[] = [];
    let pageCount = 0;
    if (core.isDebug()) {
      core.debug(`Gathering available versions from '${availableVersionsUrl}'`);
    }

    while (availableVersionsUrl) {
      pageCount++;
      const response =
        await this.http.getJson<IAdoptAvailableVersions[]>(
          availableVersionsUrl
        );
      const paginationPage = response.result;
      const nextUrl = getNextPageUrlFromLinkHeader(response.headers);
      if (
        nextUrl &&
        !validatePaginationUrl(nextUrl, 'https://api.adoptopenjdk.net')
      ) {
        core.warning(
          `Ignoring pagination link with unexpected origin: ${nextUrl}`
        );
        availableVersionsUrl = null;
      } else {
        availableVersionsUrl = nextUrl;
      }
      if (paginationPage === null || paginationPage.length === 0) {
        break;
      }

      availableVersions.push(...paginationPage);

      if (pageCount >= MAX_PAGINATION_PAGES) {
        core.warning(
          `Reached pagination safeguard limit (${MAX_PAGINATION_PAGES} pages) while listing Adopt releases.`
        );
        break;
      }
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Adopt took'); // eslint-disable-line no-console
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

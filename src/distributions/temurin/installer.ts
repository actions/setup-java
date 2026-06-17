import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';
import semver from 'semver';
import * as gpg from '../../gpg';

import {JavaBase} from '../base-installer';
import {ITemurinAvailableVersions} from './models';
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

export enum TemurinImplementation {
  Hotspot = 'Hotspot'
}

export class TemurinDistribution extends JavaBase {
  constructor(
    installerOptions: JavaInstallerOptions,
    private readonly jvmImpl: TemurinImplementation
  ) {
    super(`Temurin-${jvmImpl}`, installerOptions);
  }

  /**
   * @internal For cross-distribution reuse only. Not intended as a public API.
   */
  public async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
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
          url: item.binaries[0].package.link,
          signatureUrl: item.binaries[0].package.signature_link
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

    if (this.verifySignature) {
      if (!javaRelease.signatureUrl) {
        throw new Error(
          `Input 'verify-signature' is enabled, but no signature URL was found for Temurin version ${javaRelease.version}.`
        );
      }
      core.info(`Verifying Java package signature...`);
      try {
        await gpg.verifyPackageSignature(
          javaArchivePath,
          javaRelease.signatureUrl,
          gpg.ADOPTIUM_SIGNATURE_KEY_FINGERPRINT
        );
      } catch (error) {
        throw new Error(
          `Failed to verify signature for Temurin version ${javaRelease.version}: ${
            (error as Error).message
          }`
        );
      }
    }

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
    return super.toolcacheFolderName;
  }

  protected supportsSignatureVerification(): boolean {
    return true;
  }

  private async getAvailableVersions(): Promise<ITemurinAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
    const imageType = this.packageType;
    const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
    const releaseType = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Temurin took'); // eslint-disable-line no-console
    }

    const baseRequestArguments = [
      `project=jdk`,
      'vendor=adoptium',
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
      `https://api.adoptium.net/v3/assets/version/${versionRange}?${requestArguments}`;
    const availableVersions: ITemurinAvailableVersions[] = [];
    let pageCount = 0;
    if (core.isDebug()) {
      core.debug(`Gathering available versions from '${availableVersionsUrl}'`);
    }

    while (availableVersionsUrl) {
      pageCount++;
      const response =
        await this.http.getJson<ITemurinAvailableVersions[]>(
          availableVersionsUrl
        );
      const paginationPage = response.result;
      const nextUrl = getNextPageUrlFromLinkHeader(response.headers);
      if (
        nextUrl &&
        !validatePaginationUrl(nextUrl, 'https://api.adoptium.net')
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
          `Reached pagination safeguard limit (${MAX_PAGINATION_PAGES} pages) while listing Temurin releases.`
        );
        break;
      }
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Temurin took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(
        availableVersions.map(item => item.version_data.semver).join(', ')
      );
      core.endGroup();
    }

    return availableVersions;
  }

  private getPlatformOption(): string {
    // Adoptium has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'windows';
      case 'linux':
        if (fs.existsSync('/etc/alpine-release')) {
          return 'alpine-linux';
        }
        return 'linux';
      default:
        return process.platform;
    }
  }
}

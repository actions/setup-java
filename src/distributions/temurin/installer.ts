import * as core from '@actions/core';

import fs from 'fs';
import path from 'path';
import semver from 'semver';
import * as gpg from '../../gpg.js';

import {ADOPTIUM_PUBLIC_KEY} from './adoptium-key.js';
import {JavaBase} from '../base-installer.js';
import {ITemurinAvailableVersions} from './models.js';
import {
  MACOS_JAVA_CONTENT_POSTFIX,
  SIGNATURE_VERIFICATION_FAILURE_HELP
} from '../../constants.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import {
  cacheJdkDir,
  extractJdkFile,
  getNextPageUrlFromLinkHeader,
  getDownloadArchiveExtension,
  isVersionSatisfies,
  renameWinArchive,
  MAX_PAGINATION_PAGES,
  validatePaginationUrl
} from '../../util.js';
import {isAlpineLinux} from '../platform-types.js';

export {ADOPTIUM_PUBLIC_KEY} from './adoptium-key.js';

export enum TemurinImplementation {
  Hotspot = 'Hotspot'
}

export class TemurinDistribution extends JavaBase {
  private readonly includeJmods: boolean;

  constructor(
    installerOptions: JavaInstallerOptions,
    private readonly jvmImpl: TemurinImplementation
  ) {
    super(`Temurin-${jvmImpl}`, installerOptions);
    this.includeJmods = this.packageType === 'jdk+jmods';
  }

  /**
   * @internal For cross-distribution reuse only. Not intended as a public API.
   */
  public async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    return this.resolvePackage(
      version,
      this.includeJmods ? 'jdk' : this.packageType
    );
  }

  private async resolvePackage(
    version: string,
    imageType: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions(imageType);
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
          signatureUrl: item.binaries[0].package.signature_link,
          checksum: {
            algorithm: 'sha256',
            value: item.binaries[0].package.checksum,
            source: item.binaries[0].package.checksum_link
          }
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
    let javaArchivePath = await this.downloadPackage(javaRelease);

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();
    if (process.platform === 'win32') {
      javaArchivePath = renameWinArchive(javaArchivePath);
    }
    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const javaHome =
      process.platform === 'darwin'
        ? path.join(archivePath, MACOS_JAVA_CONTENT_POSTFIX)
        : archivePath;
    if (this.includeJmods && !fs.existsSync(path.join(javaHome, 'jmods'))) {
      await this.installJmods(javaRelease.version, javaHome);
    }
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await cacheJdkDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected supportsSignatureVerification(): boolean {
    return true;
  }

  private async downloadPackage(release: JavaDownloadRelease): Promise<string> {
    const archivePath = await this.downloadAndVerify(release);

    if (this.verifySignature) {
      try {
        if (!(await gpg.isGpgAvailable())) {
          throw new Error(
            "Input 'verify-signature' is enabled, but gpg is not available."
          );
        }
        if (!release.signatureUrl) {
          throw new Error(
            `Input 'verify-signature' is enabled, but no signature URL was found for Temurin version ${release.version}.`
          );
        }
        core.info(`Verifying Java package signature...`);
        try {
          await gpg.verifyPackageSignature(
            archivePath,
            release.signatureUrl,
            this.verifySignaturePublicKey ?? ADOPTIUM_PUBLIC_KEY
          );
        } catch (error) {
          const verificationError = new Error(
            `Failed to verify signature for Temurin version ${release.version} from ${release.signatureUrl}: ${(error as Error).message} ${SIGNATURE_VERIFICATION_FAILURE_HELP}`,
            {cause: error}
          );
          if (this.verifySignatureExplicitlyRequested) {
            throw verificationError;
          } else {
            core.warning(verificationError.message);
          }
        }
      } catch (error) {
        if (this.verifySignatureExplicitlyRequested) {
          throw error;
        }
        core.warning(
          error instanceof Error ? error.message : `Unknown error: ${error}`
        );
      }
    }

    return archivePath;
  }

  private async installJmods(version: string, javaHome: string): Promise<void> {
    const jmodsRelease = await this.resolvePackage(version, 'jmods');
    core.info(
      `Downloading JMODs ${jmodsRelease.version} (${this.distribution}) from ${jmodsRelease.url} ...`
    );
    let jmodsArchivePath = await this.downloadPackage(jmodsRelease);
    if (process.platform === 'win32') {
      jmodsArchivePath = renameWinArchive(jmodsArchivePath);
    }
    const extractedJmodsPath = await extractJdkFile(
      jmodsArchivePath,
      getDownloadArchiveExtension()
    );
    const jmodsDirectory = path.join(
      extractedJmodsPath,
      fs.readdirSync(extractedJmodsPath)[0]
    );
    fs.cpSync(jmodsDirectory, path.join(javaHome, 'jmods'), {recursive: true});
  }

  private async getAvailableVersions(
    imageType = this.includeJmods ? 'jdk' : this.packageType
  ): Promise<ITemurinAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
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
        if (isAlpineLinux()) {
          return 'alpine-linux';
        }
        return 'linux';
      default:
        return process.platform;
    }
  }

  protected distributionArchitecture(): string {
    const architecture = super.distributionArchitecture();
    return architecture === 'armv7' ? 'arm' : architecture;
  }
}

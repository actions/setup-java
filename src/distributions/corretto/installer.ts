import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';
import {HttpCodes} from '@actions/http-client';
import {
  cacheJdkDir,
  extractJdkFile,
  getDownloadArchiveExtension,
  getGitHubHttpHeaders,
  isExactCorrettoVersion,
  convertVersionToSemver,
  renameWinArchive
} from '../../util.js';
import {JavaBase} from '../base-installer.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import {
  ICorrettoAllAvailableVersions,
  ICorrettoAvailableVersions
} from './models.js';
import {isAlpineLinux} from '../platform-types.js';

const CORRETTO_VERSIONS_URL =
  'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json';

export class CorrettoDistribution extends JavaBase {
  private readonly requestedVersion: string;

  constructor(installerOptions: JavaInstallerOptions) {
    super('Corretto', {
      ...installerOptions,
      // Java 8 releases use zero-padded fields, e.g. 8.472.08.1.
      version: isExactCorrettoVersion(installerOptions.version)
        ? installerOptions.version.replace(/(^|\.)0+(?=\d)/g, '$1')
        : installerOptions.version
    });
    this.requestedVersion = installerOptions.version
      .replace('+', '.')
      .replace(/^8\.(\d+)\.(\d)\./, '8.$1.0$2.');
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    let javaArchivePath = await this.downloadAndVerify(javaRelease);

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();
    if (process.platform === 'win32') {
      javaArchivePath = renameWinArchive(javaArchivePath);
    }
    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await cacheJdkDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    if (!this.stable) {
      throw new Error('Early access versions are not supported');
    }
    if (isExactCorrettoVersion(this.requestedVersion)) {
      return this.findExactRelease();
    }
    const availableVersions = await this.getAvailableVersions();

    // The `latest` alias is normalized to the SemVer wildcard, but Corretto
    // matches on an exact major version, so resolve it to the newest available
    // major from Corretto's own list.
    if (this.latest) {
      const majors = availableVersions
        .map(item => parseInt(item.version, 10))
        .filter(major => Number.isFinite(major) && major > 0);

      if (majors.length === 0) {
        throw new Error(
          'Could not determine the latest available Corretto major version from remote metadata'
        );
      }

      version = Math.max(...majors).toString();
    }

    if (version.includes('.')) {
      throw new Error(
        'Specify a major version or a full Corretto release, such as 25.0.5.0.10'
      );
    }
    const matchingVersions = availableVersions
      .filter(item => item.version == version)
      .map(item => {
        return {
          version: convertVersionToSemver(item.correttoVersion),
          url: item.downloadLink,
          checksum: {
            algorithm: 'sha256',
            value: item.checksum_sha256,
            source: CORRETTO_VERSIONS_URL
          }
        } as JavaDownloadRelease;
      });

    const resolvedVersion =
      matchingVersions.length > 0 ? matchingVersions[0] : null;
    if (!resolvedVersion) {
      const availableVersionStrings = availableVersions.map(
        item => item.version
      );
      throw this.createVersionNotFoundError(version, availableVersionStrings);
    }
    return resolvedVersion;
  }

  private async findExactRelease(): Promise<JavaDownloadRelease> {
    const version = this.requestedVersion;
    const major = version.split('.')[0];
    const platform = this.getPlatformOption();
    const arch = this.architecture;
    if (platform !== 'windows' && this.packageType !== 'jdk') {
      throw new Error('Corretto JRE archives are only available for Windows');
    }
    const os =
      platform === 'macos'
        ? 'macosx'
        : platform === 'alpine'
          ? 'alpine-linux'
          : platform;
    const suffix =
      platform === 'windows' ? `-${this.packageType}.zip` : '.tar.gz';
    const url = `https://corretto.aws/downloads/resources/${version}/amazon-corretto-${version}-${os}-${arch}${suffix}`;

    // Versioned archives have no checksum sidecar; Amazon publishes their SHA-256s in the release notes.
    const source = `https://api.github.com/repos/corretto/corretto-${major}/releases/tags/${version}`;
    const response = await this.http.getJson<{body: string | null}>(source, {
      ...getGitHubHttpHeaders(),
      accept: 'application/vnd.github+json'
    });
    const row = response.result?.body
      ?.split(/\r?\n/)
      .find(line => line.includes(`](${url})`));
    const checksum = row?.match(/`([a-fA-F0-9]{64})`/)?.[1];
    if (checksum) {
      return {
        version: this.version,
        url,
        checksum: {algorithm: 'sha256', value: checksum, source}
      };
    }

    // The current catalog also covers releases missing from GitHub, such as Corretto 15 and 16.
    const archive = (await this.getAvailableVersions()).find(
      item => item.downloadLink === url
    );
    if (archive) {
      return {
        version: this.version,
        url,
        checksum: {
          algorithm: 'sha256',
          value: archive.checksum_sha256,
          source: CORRETTO_VERSIONS_URL
        }
      };
    }
    if (response.statusCode === HttpCodes.NotFound) {
      throw new Error(
        `Corretto release ${version} was not found in Amazon's GitHub releases or current download catalog`
      );
    }
    if (!row) {
      throw new Error(
        `No ${platform}/${arch} ${this.packageType} archive is listed for Corretto ${version}`
      );
    }
    throw new Error(
      `No SHA-256 checksum is published for Corretto ${version} (${platform}, ${arch}, ${this.packageType})`
    );
  }

  private async getAvailableVersions(): Promise<ICorrettoAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
    const imageType = this.packageType;

    if (core.isDebug()) {
      console.time('Retrieving available versions for Corretto took'); // eslint-disable-line no-console
    }

    const fetchCurrentVersions =
      await this.http.getJson<ICorrettoAllAvailableVersions>(
        CORRETTO_VERSIONS_URL
      );
    const fetchedCurrentVersions = fetchCurrentVersions.result;
    if (!fetchedCurrentVersions) {
      throw Error(
        `Could not fetch latest corretto versions from ${CORRETTO_VERSIONS_URL}`
      );
    }

    const eligibleVersions =
      fetchedCurrentVersions?.[platform]?.[arch]?.[imageType];
    const availableVersions =
      this.getAvailableVersionsForPlatform(eligibleVersions);

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Corretto took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(
        availableVersions
          .map(item => `${item.version}: ${item.correttoVersion}`)
          .join(', ')
      );
      core.endGroup();
    }

    return availableVersions;
  }

  private getAvailableVersionsForPlatform(
    eligibleVersions:
      ICorrettoAllAvailableVersions['os']['arch']['imageType'] | undefined
  ): ICorrettoAvailableVersions[] {
    const availableVersions: ICorrettoAvailableVersions[] = [];

    for (const version in eligibleVersions) {
      const availableVersion = eligibleVersions[version];
      for (const fileType in availableVersion) {
        const skipNonExtractableBinaries =
          fileType != getDownloadArchiveExtension();
        if (skipNonExtractableBinaries) {
          continue;
        }
        const availableVersionDetails = availableVersion[fileType];
        const correttoVersion = this.getCorrettoVersion(
          availableVersionDetails.resource
        );

        availableVersions.push({
          checksum: availableVersionDetails.checksum,
          checksum_sha256: availableVersionDetails.checksum_sha256,
          fileType,
          resource: availableVersionDetails.resource,
          downloadLink: `https://corretto.aws${availableVersionDetails.resource}`,
          version: version,
          correttoVersion
        });
      }
    }
    return availableVersions;
  }

  private getPlatformOption(): string {
    // Corretto has its own platform names so we need to map them
    switch (process.platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      case 'linux':
        return isAlpineLinux() ? 'alpine' : 'linux';
      default:
        return process.platform;
    }
  }

  protected distributionArchitecture(): string {
    const architecture = super.distributionArchitecture();
    return architecture === 'armv7' ? 'arm' : architecture;
  }

  private getCorrettoVersion(resource: string): string {
    const regex = /(\d+.+)\//;
    const match = regex.exec(resource);
    if (match === null) {
      throw Error(`Could not parse corretto version from ${resource}`);
    }
    return match[1];
  }
}

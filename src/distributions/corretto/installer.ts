import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  convertVersionToSemver
} from '../../util';
import {JavaBase} from '../base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  ICorrettoAllAvailableVersions,
  ICorrettoAvailableVersions
} from './models';

export class CorrettoDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Corretto', installerOptions);
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

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    if (!this.stable) {
      throw new Error('Early access versions are not supported');
    }
    if (version.includes('.')) {
      throw new Error('Only major versions are supported');
    }
    const availableVersions = await this.getAvailableVersions();
    const matchingVersions = availableVersions
      .filter(item => item.version == version)
      .map(item => {
        return {
          version: convertVersionToSemver(item.correttoVersion),
          url: item.downloadLink
        } as JavaDownloadRelease;
      });

    const resolvedVersion =
      matchingVersions.length > 0 ? matchingVersions[0] : null;
    if (!resolvedVersion) {
      const availableOptions = availableVersions
        .map(item => item.version)
        .join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for SemVer '${version}'. ${availableOptionsMessage}`
      );
    }
    return resolvedVersion;
  }

  private async getAvailableVersions(): Promise<ICorrettoAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
    const imageType = this.packageType;

    if (core.isDebug()) {
      console.time('Retrieving available versions for Coretto took'); // eslint-disable-line no-console
    }

    const availableVersionsUrl =
      'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json';
    const fetchCurrentVersions =
      await this.http.getJson<ICorrettoAllAvailableVersions>(
        availableVersionsUrl
      );
    const fetchedCurrentVersions = fetchCurrentVersions.result;
    if (!fetchedCurrentVersions) {
      throw Error(
        `Could not fetch latest corretto versions from ${availableVersionsUrl}`
      );
    }

    const eligibleVersions =
      fetchedCurrentVersions?.[platform]?.[arch]?.[imageType];
    const availableVersions =
      this.getAvailableVersionsForPlatform(eligibleVersions);

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Coretto took'); // eslint-disable-line no-console
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
      | ICorrettoAllAvailableVersions['os']['arch']['imageType']
      | undefined
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
      default:
        return process.platform;
    }
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

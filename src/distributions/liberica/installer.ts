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
import {ArchitectureOptions, LibericaVersion, OsVersions} from './models';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';

const supportedPlatform = `'linux', 'linux-musl', 'macos', 'solaris', 'windows'`;

const supportedArchitectures = `'x86', 'x64', 'armv7', 'aarch64', 'ppc64le'`;

export class LibericaDistributions extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Liberica', installerOptions);
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

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();

    const availableVersions = availableVersionsRaw.map(item => ({
      url: item.downloadUrl,
      version: this.convertVersionToSemver(item)
    }));

    const satisfiedVersion = availableVersions
      .filter(item => isVersionSatisfies(range, item.version))
      .sort((a, b) => -semver.compareBuild(a.version, b.version))[0];

    if (!satisfiedVersion) {
      const availableOptions = availableVersions
        .map(item => item.version)
        .join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for semver ${range}. ${availableOptionsMessage}`
      );
    }

    return satisfiedVersion;
  }

  private async getAvailableVersions(): Promise<LibericaVersion[]> {
    if (core.isDebug()) {
      console.time('Retrieving available versions for Liberica took'); // eslint-disable-line no-console
    }
    const url = this.prepareAvailableVersionsUrl();

    core.debug(`Gathering available versions from '${url}'`);

    const availableVersions =
      (await this.http.getJson<LibericaVersion[]>(url)).result ?? [];

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Liberica took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(availableVersions.map(item => item.version).join(', '));
      core.endGroup();
    }

    return availableVersions;
  }

  private prepareAvailableVersionsUrl() {
    const urlOptions = {
      os: this.getPlatformOption(),
      'bundle-type': this.getBundleType(),
      ...this.getArchitectureOptions(),
      'build-type': this.stable ? 'all' : 'ea',
      'installation-type': 'archive',
      fields:
        'downloadUrl,version,featureVersion,interimVersion,updateVersion,buildVersion'
    };

    const searchParams = new URLSearchParams(urlOptions).toString();

    return `https://api.bell-sw.com/v1/liberica/releases?${searchParams}`;
  }

  private getBundleType(): string {
    const [bundleType, feature] = this.packageType.split('+');
    if (feature?.includes('fx')) {
      return bundleType + '-full';
    }
    return bundleType;
  }

  private getArchitectureOptions(): ArchitectureOptions {
    const arch = this.distributionArchitecture();
    switch (arch) {
      case 'x86':
        return {bitness: '32', arch: 'x86'};
      case 'x64':
        return {bitness: '64', arch: 'x86'};
      case 'armv7':
        return {bitness: '32', arch: 'arm'};
      case 'aarch64':
        return {bitness: '64', arch: 'arm'};
      case 'ppc64le':
        return {bitness: '64', arch: 'ppc'};
      default:
        throw new Error(
          `Architecture '${this.architecture}' is not supported. Supported architectures: ${supportedArchitectures}`
        );
    }
  }

  private getPlatformOption(
    platform: NodeJS.Platform = process.platform
  ): OsVersions {
    switch (platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
      case 'cygwin':
        return 'windows';
      case 'linux':
        return 'linux';
      case 'sunos':
        return 'solaris';
      default:
        throw new Error(
          `Platform '${platform}' is not supported. Supported platforms: ${supportedPlatform}`
        );
    }
  }

  private convertVersionToSemver(version: LibericaVersion): string {
    const {buildVersion, featureVersion, interimVersion, updateVersion} =
      version;
    const mainVersion = [featureVersion, interimVersion, updateVersion].join(
      '.'
    );
    if (buildVersion != 0) {
      return `${mainVersion}+${buildVersion}`;
    }
    return mainVersion;
  }

  protected distributionArchitecture(): string {
    const arch = super.distributionArchitecture();
    switch (arch) {
      case 'arm':
        return 'armv7';
      default:
        return arch;
    }
  }
}

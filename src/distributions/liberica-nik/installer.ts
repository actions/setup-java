import {JavaBase} from '../base-installer.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import semver from 'semver';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  isVersionSatisfies,
  renameWinArchive
} from '../../util.js';
import * as core from '@actions/core';
import {ArchitectureOptions, NikVersion, OsVersions} from './models.js';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';

const supportedPlatform = `'linux', 'macos', 'windows'`;

const supportedArchitectures = `'x64', 'aarch64'`;

export class LibericaNikDistributions extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Liberica_NIK', installerOptions);
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

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();

    const availableVersions = availableVersionsRaw
      .map(item => {
        const jdkVersion = this.getJdkVersion(item);
        return jdkVersion ? {url: item.downloadUrl, version: jdkVersion} : null;
      })
      .filter((item): item is {url: string; version: string} => item !== null);

    const satisfiedVersion = availableVersions
      .filter(item => isVersionSatisfies(range, item.version))
      .sort((a, b) => -semver.compareBuild(a.version, b.version))[0];

    if (!satisfiedVersion) {
      const availableVersionStrings = availableVersions.map(
        item => item.version
      );
      throw this.createVersionNotFoundError(range, availableVersionStrings);
    }

    return satisfiedVersion;
  }

  private async getAvailableVersions(): Promise<NikVersion[]> {
    if (core.isDebug()) {
      console.time('Retrieving available versions for Liberica NIK took'); // eslint-disable-line no-console
    }
    const url = this.prepareAvailableVersionsUrl();

    core.debug(`Gathering available versions from '${url}'`);

    const availableVersions =
      (await this.http.getJson<NikVersion[]>(url)).result ?? [];

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Liberica NIK took'); // eslint-disable-line no-console
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
      fields: 'downloadUrl,version,components,component,embedded'
    };

    const searchParams = new URLSearchParams(urlOptions).toString();

    return `https://api.bell-sw.com/v1/nik/releases?${searchParams}`;
  }

  // NIK's top-level `version` is the GraalVM/NIK version; the JDK version that
  // users select on lives in the embedded `liberica` component.
  private getJdkVersion(release: NikVersion): string | null {
    const liberica = release.components?.find(
      component => component.component === 'liberica'
    );
    return liberica ? this.convertVersionToSemver(liberica.version) : null;
  }

  // The `full` bundle adds JavaFX/Swing GUI support; otherwise use `standard`.
  private getBundleType(): string {
    const [, feature] = this.packageType.split('+');
    return feature?.includes('fx') ? 'full' : 'standard';
  }

  private getArchitectureOptions(): ArchitectureOptions {
    const arch = this.distributionArchitecture();
    switch (arch) {
      case 'x64':
        return {bitness: '64', arch: 'x86'};
      case 'aarch64':
        return {bitness: '64', arch: 'arm'};
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
      default:
        throw new Error(
          `Platform '${platform}' is not supported. Supported platforms: ${supportedPlatform}`
        );
    }
  }

  // JDK versions come as strings like '25.0.1+16', '23+38' or '11.0.15.1+2'.
  // Normalize them to valid SemVer while preserving build metadata so newer
  // NIK builds of the same JDK sort ahead of older ones.
  private convertVersionToSemver(jdkVersion: string): string {
    const [main, build] = jdkVersion.split('+');
    const parts = main.split('.');
    while (parts.length < 3) {
      parts.push('0');
    }
    const base = parts.slice(0, 3).join('.');
    const buildMeta = [...parts.slice(3), ...(build ? [build] : [])];
    return buildMeta.length ? `${base}+${buildMeta.join('.')}` : base;
  }
}

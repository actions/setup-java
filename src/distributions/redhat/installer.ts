import * as core from '@actions/core';
import fs from 'fs';
import path from 'path';
import semver from 'semver';
import {
  cacheJdkDir,
  extractJdkFile,
  isVersionSatisfies,
  renameWinArchive
} from '../../util.js';
import {JavaBase} from '../base-installer.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import {
  IDiscoPackage,
  IDiscoPackageDetailsResponse,
  IDiscoPackageListResponse
} from './models.js';
import {isAlpineLinux} from '../platform-types.js';

const DISCO_API_URL = 'https://api.foojay.io/disco/v3.0';

export class RedHatDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('RedHat', installerOptions);
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    if (!this.stable) {
      throw new Error('Early access versions are not supported');
    }

    const availablePackages = await this.getAvailablePackages();
    const normalizedPackages = availablePackages
      .map(item => ({
        item,
        version: this.normalizeDiscoVersion(item.java_version)
      }))
      .filter(
        (item): item is {item: IDiscoPackage; version: string} =>
          item.version !== null
      )
      .sort((left, right) => -semver.compareBuild(left.version, right.version));

    const selectedPackage = normalizedPackages.find(item =>
      isVersionSatisfies(range, item.version)
    );
    if (!selectedPackage) {
      throw this.createVersionNotFoundError(
        range,
        normalizedPackages.map(item => item.version),
        `Operating system: ${this.getOperatingSystem()}`
      );
    }

    const detailsUrl = `${DISCO_API_URL}/ids/${selectedPackage.item.id}`;
    const response =
      await this.http.getJson<IDiscoPackageDetailsResponse>(detailsUrl);
    const details = response.result?.result?.[0];
    if (!details?.direct_download_uri) {
      throw new Error(
        `Foojay Disco returned no direct Red Hat download URL for package '${selectedPackage.item.id}'.`
      );
    }
    const checksum = details.checksum?.trim();
    if (details.checksum_type?.toLowerCase() !== 'sha256' || !checksum) {
      throw new Error(
        `Foojay Disco returned no SHA-256 checksum for Red Hat package '${selectedPackage.item.id}'.`
      );
    }

    return {
      version: selectedPackage.version,
      url: details.direct_download_uri,
      checksum: {
        algorithm: 'sha256',
        value: checksum,
        source: detailsUrl
      }
    };
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    let javaArchivePath = await this.downloadAndVerify(javaRelease);

    core.info('Extracting Java archive...');
    const archiveType = this.getArchiveType();
    if (archiveType === 'zip') {
      javaArchivePath = renameWinArchive(javaArchivePath);
    }
    const extractedJavaPath = await extractJdkFile(
      javaArchivePath,
      archiveType
    );
    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    if (!archiveName) {
      throw new Error(
        `The Red Hat archive for Java ${javaRelease.version} was empty.`
      );
    }
    const archivePath = path.join(extractedJavaPath, archiveName);
    const javaPath = await cacheJdkDir(
      archivePath,
      this.toolcacheFolderName,
      this.getToolcacheVersionName(javaRelease.version),
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  private async getAvailablePackages(): Promise<IDiscoPackage[]> {
    const operatingSystem = this.getOperatingSystem();
    const archiveType = this.getArchiveType();
    const query = new URLSearchParams({
      distro: 'redhat',
      release_status: 'ga',
      operating_system: operatingSystem,
      architecture: this.distributionArchitecture(),
      package_type: this.packageType,
      archive_type: archiveType,
      directly_downloadable: 'true'
    });
    const url = `${DISCO_API_URL}/packages?${query.toString()}`;
    const response = await this.http.getJson<IDiscoPackageListResponse>(url);
    const packages = response.result?.result;
    if (!Array.isArray(packages)) {
      throw new Error(
        `Could not fetch Red Hat package metadata from Foojay Disco: ${url}`
      );
    }

    return packages.filter(
      item =>
        item.distribution === 'redhat' &&
        item.release_status === 'ga' &&
        item.operating_system === operatingSystem &&
        item.architecture === this.distributionArchitecture() &&
        item.package_type === this.packageType &&
        item.archive_type === archiveType &&
        item.directly_downloadable
    );
  }

  private getOperatingSystem(alpine = isAlpineLinux()): string {
    if (alpine) {
      throw new Error(
        "Distribution 'redhat' does not support Alpine Linux because Red Hat portable archives require glibc."
      );
    }
    return process.platform === 'win32' ? 'windows' : 'linux';
  }

  private getArchiveType(): string {
    return process.platform === 'win32' ? 'zip' : 'tar.xz';
  }

  private normalizeDiscoVersion(version: string): string | null {
    let normalizedVersion = version.trim();
    if (/^\d+\+\d+$/.test(normalizedVersion)) {
      normalizedVersion = normalizedVersion.replace('+', '.0.0+');
    } else if (/^\d+$/.test(normalizedVersion)) {
      normalizedVersion = `${normalizedVersion}.0.0`;
    } else if (/^\d+\.\d+$/.test(normalizedVersion)) {
      normalizedVersion = `${normalizedVersion}.0`;
    }

    return semver.valid(normalizedVersion) ? normalizedVersion : null;
  }
}

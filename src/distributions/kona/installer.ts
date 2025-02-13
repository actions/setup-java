import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';

import {JavaBase} from '../base-installer';
import {IKonaReleaseInfo, IKonaRelease} from './models';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  isVersionSatisfies
} from '../../util';

export class KonaDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Kona', installerOptions);
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Kona JDK ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);

    const extension = getDownloadArchiveExtension();
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

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    if (!this.stable) {
      throw new Error('Kona provides stable releases only');
    }

    if (this.packageType !== 'jdk') {
      throw new Error('Kona provides jdk only');
    }

    const availableReleases = await this.getAvailableReleases();
    const releases = availableReleases
      .filter(item => {
        return isVersionSatisfies(version, item.version);
      })
      .map(item => {
        return {
          version: item.version,
          url: item.downloadUrl
        } as JavaDownloadRelease;
      });

    if (!releases.length) {
      throw new Error(
        `No Kona release for the specified version "${version}" on OS "${this.getOs()}" and arch "${this.getArch()}".`
      );
    }

    return releases[0];
  }

  private async getAvailableReleases(): Promise<IKonaRelease[]> {
    if (core.isDebug()) {
      console.time('Retrieving available releases for Kona took'); // eslint-disable-line no-console
    }

    const releaseInfo = await this.fetchReleaseInfo();
    if (!releaseInfo) {
      throw new Error(`Couldn't fetch Kona release information`);
    }

    const availableReleases = this.chooseReleases(
      this.getOs(),
      this.getArch(),
      releaseInfo
    );

    if (core.isDebug()) {
      core.startGroup('Print information about available releases');
      core.debug(availableReleases.map(item => item.version).join(', '));
      core.endGroup();
    }

    return availableReleases;
  }

  private async fetchReleaseInfo(): Promise<IKonaReleaseInfo | null> {
    const releasesInfoUrl =
      'https://tencent.github.io/konajdk/releases/kona-v1.json';

    try {
      core.debug(`Fetching Kona release info from URL: ${releasesInfoUrl}`);
      return (await this.http.getJson<IKonaReleaseInfo>(releasesInfoUrl))
        .result;
    } catch (err) {
      core.debug(
        `Fetching Kona release info from the URL: ${releasesInfoUrl} failed with the error: ${
          (err as Error).message
        }`
      );
      return null;
    }
  }

  private chooseReleases(
    os: string,
    arch: string,
    releaseInfo: IKonaReleaseInfo
  ): IKonaRelease[] {
    const releases: IKonaRelease[] = [];

    for (const majorVersion in releaseInfo) {
      const versions = releaseInfo[majorVersion];

      for (const version of versions) {
        if (!version.latest) {
          continue;
        }

        for (const file of version.files) {
          if (file.os === os && file.arch === arch) {
            releases.push({
              version: version.version,
              jdkVersion: version.jdkVersion,
              os: os,
              arch: arch,
              downloadUrl: version.baseUrl + file.filename,
              checksum: file.checksum
            });

            break;
          }
        }
      }
    }

    return releases;
  }

  private getOs(): string {
    switch (process.platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }

  private getArch(): string {
    switch (this.architecture) {
      case 'arm64':
        return 'aarch64';
      case 'x64':
        return 'x86_64';
      default:
        return this.architecture;
    }
  }
}

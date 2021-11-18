import { JavaBase } from '../base-installer';
import { JavaDownloadRelease, JavaInstallerOptions, JavaInstallerResults } from '../base-models';
import semver from 'semver';
import { extractJdkFile, getDownloadArchiveExtension, isVersionSatisfies } from '../../util';
import * as core from '@actions/core';
import { ArchitectureOptions, MicrosoftVersion, OsVersions } from './models';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';

const supportedPlatform = `'linux', 'macos', 'windows'`;

const supportedArchitecture = `'x64', 'armv7', 'aarch64'`;

export class MicrosoftDistributions extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Microsoft', installerOptions);
  }

  protected async downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
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

    return { version: javaRelease.version, path: javaPath };
  }

  protected async findPackageForDownload(range: string): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();

    const availableVersions = availableVersionsRaw.map(item => ({
      url: `https://aka.ms/download-jdk/microsoft-jdk-${
        item.fullVersion
      }-${this.getPlatformOption()}-${this.architecture}.tar.gz`,
      version: this.convertVersionToSemver(item)
    }));

    const satisfiedVersion = availableVersions
      .filter(item => isVersionSatisfies(range, item.version))
      .sort((a, b) => -semver.compareBuild(a.version, b.version))[0];

    if (!satisfiedVersion) {
      const availableOptions = availableVersions.map(item => item.version).join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for semver ${range}. ${availableOptionsMessage}`
      );
    }

    return satisfiedVersion;
  }

  private async getAvailableVersions(): Promise<MicrosoftVersion[]> {
    console.time('microsoft-retrieve-available-versions');

    // TODO get these dynamically!
    var jdkVersions = [
      {
        majorVersion: 17,
        minorVersion: 0,
        patchVersion: 1,
        fullVersion: '17.0.1.12.1'
      },
      {
        majorVersion: 16,
        minorVersion: 0,
        patchVersion: 2,
        fullVersion: '16.0.2.7.1'
      },
      {
        majorVersion: 11,
        minorVersion: 0,
        patchVersion: 13,
        fullVersion: '11.0.13.8.1'
      }
    ];

    return jdkVersions;
  }

  private getArchitectureOptions(): ArchitectureOptions {
    switch (this.architecture) {
      case 'x64':
        return { bitness: '64', arch: 'x86' };
      case 'aarch64':
        return { bitness: '64', arch: 'arm' };
      default:
        throw new Error(
          `Architecture '${this.architecture}' is not supported. Supported architectures: ${supportedArchitecture}`
        );
    }
  }

  private getPlatformOption(platform: NodeJS.Platform = process.platform): OsVersions {
    switch (platform) {
      case 'darwin':
        return 'macos';
      case 'win32':
        return 'windows';
      case 'linux':
        return 'linux';
      default:
        throw new Error(
          `Platform '${platform}' is not supported. Supported platforms: ${supportedPlatform}`
        );
    }
  }

  private convertVersionToSemver(version: MicrosoftVersion): string {
    return `${version.majorVersion}.${version.minorVersion}.${version.patchVersion}`;
  }
}

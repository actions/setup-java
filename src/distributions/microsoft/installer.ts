import { JavaBase } from '../base-installer';
import { JavaDownloadRelease, JavaInstallerOptions, JavaInstallerResults } from '../base-models';
import semver from 'semver';
import { extractJdkFile, getDownloadArchiveExtension, isVersionSatisfies } from '../../util';
import * as core from '@actions/core';
import { MicrosoftVersion, PlatformOptions } from './models';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';

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
    if (this.architecture !== 'x64' && this.architecture !== 'aarch64') {
      throw new Error(`Unsupported architecture: ${this.architecture}`);
    }

    if (!this.stable) {
      throw new Error('Early access versions are not supported');
    }

    if (this.packageType !== 'jdk') {
      throw new Error('Microsoft Build of OpenJDK provides only the `jdk` package type');
    }

    const availableVersionsRaw = await this.getAvailableVersions();

    const opts = this.getPlatformOption();
    const availableVersions = availableVersionsRaw.map(item => ({
      url: `https://aka.ms/download-jdk/microsoft-jdk-${item.version.join('.')}-${opts.os}-${
        this.architecture
      }.${opts.archive}`,
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
        `Could not find satisfied version for SemVer ${range}. ${availableOptionsMessage}`
      );
    }

    return satisfiedVersion;
  }

  private async getAvailableVersions(): Promise<MicrosoftVersion[]> {
    // TODO get these dynamically!
    // We will need Microsoft to add an endpoint where we can query for versions.
    const jdkVersions = [
      {
        version: [17, 0, 1, 12, 1]
      },
      {
        version: [16, 0, 2, 7, 1]
      }
    ];

    // M1 is only supported for Java 16 & 17
    if (process.platform !== 'darwin' || this.architecture !== 'aarch64') {
      jdkVersions.push({
        version: [11, 0, 13, 8, 1]
      });
    }

    return jdkVersions;
  }

  private getPlatformOption(
    platform: NodeJS.Platform = process.platform /* for testing */
  ): PlatformOptions {
    switch (platform) {
      case 'darwin':
        return { archive: 'tar.gz', os: 'macos' };
      case 'win32':
        return { archive: 'zip', os: 'windows' };
      case 'linux':
        return { archive: 'tar.gz', os: 'linux' };
      default:
        throw new Error(
          `Platform '${platform}' is not supported. Supported platforms: 'darwin', 'linux', 'win32'`
        );
    }
  }

  private convertVersionToSemver(version: MicrosoftVersion): string {
    const major = version.version[0];
    const minor = version.version[1];
    const patch = version.version[2];
    return `${major}.${minor}.${patch}`;
  }
}

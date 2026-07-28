import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import semver from 'semver';

import {JavaBase} from '../base-installer.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  isVersionSatisfies,
  renameWinArchive
} from '../../util.js';

const OPENJDK_BASE_URL = 'https://jdk.java.net';

export class OpenJdkDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('OpenJDK', installerOptions);
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    if (this.packageType !== 'jdk') {
      throw new Error('OpenJDK provides only the `jdk` package type');
    }

    const arch = this.distributionArchitecture();
    if (!['x64', 'aarch64'].includes(arch)) {
      throw new Error(`Unsupported architecture: ${this.architecture}`);
    }

    const platform = this.getPlatform();
    const releases = await this.getAvailableVersions(platform, arch);
    const matchingReleases = releases
      .filter(release => isVersionSatisfies(range, release.version))
      .sort((left, right) => -semver.compareBuild(left.version, right.version));

    if (!matchingReleases.length) {
      throw this.createVersionNotFoundError(
        range,
        releases.map(release => release.version),
        `Platform: ${platform}`
      );
    }

    return matchingReleases[0];
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

  private async getAvailableVersions(
    platform: string,
    arch: string
  ): Promise<JavaDownloadRelease[]> {
    const homePage = await this.fetchPage(`${OPENJDK_BASE_URL}/`);
    const releasePageUrls = Array.from(
      homePage.matchAll(/href="\/(\d+)\/">JDK\s+\d+/g),
      match => `${OPENJDK_BASE_URL}/${match[1]}/`
    );

    const pages = await Promise.all(
      releasePageUrls.map(url => this.fetchPage(url))
    );
    if (this.stable) {
      pages.push(await this.fetchPage(`${OPENJDK_BASE_URL}/archive/`));
    }

    const releases = pages.flatMap(page =>
      this.parseReleases(page, platform, arch)
    );

    return releases.filter(
      release => release.url.includes('/early_access/') !== this.stable
    );
  }

  private async fetchPage(url: string): Promise<string> {
    const response = await this.http.get(url);
    return response.readBody();
  }

  private parseReleases(
    html: string,
    platform: string,
    arch: string
  ): JavaDownloadRelease[] {
    const extension = platform === 'windows' ? 'zip' : 'tar.gz';
    const pattern = new RegExp(
      `href="(https://download\\.java\\.net/[^"]+/openjdk-([^"_]+)_${platform}-${arch}_bin\\.${extension.replaceAll('.', '\\.')})"`,
      'g'
    );

    return Array.from(html.matchAll(pattern), match => ({
      version: this.toSemver(match[2]),
      url: match[1]
    }));
  }

  private toSemver(version: string): string {
    const [javaVersion, build] = version.replace('-ea', '').split('+');
    const normalizedVersion = javaVersion.includes('.')
      ? javaVersion
      : `${javaVersion}.0.0`;
    return build ? `${normalizedVersion}+${build}` : normalizedVersion;
  }

  private getPlatform(platform: NodeJS.Platform = process.platform): string {
    switch (platform) {
      case 'darwin':
        return 'macos';
      case 'linux':
        return 'linux';
      case 'win32':
        return 'windows';
      default:
        throw new Error(
          `Platform '${platform}' is not supported. Supported platforms: 'linux', 'macos', 'windows'`
        );
    }
  }
}

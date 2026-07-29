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
  convertVersionToSemver,
  extractJdkFile,
  isVersionSatisfies,
  renameWinArchive
} from '../../util.js';

const OPENJDK_BASE_URL = 'https://jdk.java.net';

export class OpenJdkDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Oracle OpenJDK', installerOptions);
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    if (this.packageType !== 'jdk') {
      throw new Error('Oracle OpenJDK provides only the `jdk` package type');
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
    let javaArchivePath = await this.downloadAndVerify(javaRelease);

    core.info(`Extracting Java archive...`);
    const extension = javaRelease.url.endsWith('.zip') ? 'zip' : 'tar.gz';
    if (extension === 'zip') {
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
    const platformPattern = platform === 'macos' ? '(?:macos|osx)' : platform;
    const extensionPattern =
      platform === 'windows' ? '(?:zip|tar\\.gz)' : 'tar\\.gz';
    const pattern = new RegExp(
      `href="(https://download\\.java\\.net/[^"]+/openjdk-([^"_]+)_${platformPattern}-${arch}_bin\\.${extensionPattern})"`,
      'g'
    );

    return Array.from(html.matchAll(pattern), match => {
      const url = match[1];
      const build =
        url.match(/\/(\d+)\/(?:GPL\/)?openjdk-/)?.[1] ??
        this.findBuildInArchiveHeading(html, match.index, match[2]);
      return {
        version: this.toSemver(match[2], build),
        url
      };
    });
  }

  private findBuildInArchiveHeading(
    html: string,
    assetIndex: number,
    version: string
  ): string | undefined {
    const headings = Array.from(
      html.slice(0, assetIndex).matchAll(/\(build\s+([^)]+)\)/g)
    );
    const headingVersion = headings.at(-1)?.[1];
    if (!headingVersion) {
      return undefined;
    }

    const [javaVersion, build] = headingVersion.split('+');
    return javaVersion === version ? build : undefined;
  }

  private toSemver(version: string, urlBuild?: string): string {
    const [javaVersion, filenameBuild] = version.replace('-ea', '').split('+');
    const versionParts = javaVersion.split('.');
    const normalizedVersion = convertVersionToSemver(
      versionParts.length === 1 ? `${javaVersion}.0.0` : javaVersion
    );
    const build =
      filenameBuild ?? (versionParts.length <= 3 ? urlBuild : undefined);
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

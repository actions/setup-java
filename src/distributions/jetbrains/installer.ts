import * as core from '@actions/core';

import fs from 'fs';
import path from 'path';
import semver from 'semver';

import {JavaBase} from '../base-installer.js';
import {IJetBrainsRawVersion, IJetBrainsVersion} from './models.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models.js';
import {
  cacheJdkDir,
  extractJdkFile,
  getNextPageUrlFromLinkHeader,
  isVersionSatisfies,
  MAX_PAGINATION_PAGES,
  validatePaginationUrl
} from '../../util.js';
import {OutgoingHttpHeaders} from 'http';
import {HttpCodes} from '@actions/http-client';

const JETBRAINS_RELEASES_URL =
  'https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases?per_page=100';
const GITHUB_API_ORIGIN = 'https://api.github.com';

export class JetBrainsDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('JetBrains', installerOptions);
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    const versionsRaw = await this.getAvailableVersions();

    const versions = versionsRaw.map(v => {
      const formattedVersion = `${v.semver}+${v.build}`;

      return {
        version: formattedVersion,
        url: v.url
      } as JavaDownloadRelease;
    });

    const satisfiedVersions = versions
      .filter(item => isVersionSatisfies(range, item.version))
      .sort((a, b) => {
        return -semver.compareBuild(a.version, b.version);
      });

    const resolvedFullVersion =
      satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableVersionStrings = versionsRaw.map(
        item => `${item.tag_name} (${item.semver}+${item.build})`
      );
      throw this.createVersionNotFoundError(range, availableVersionStrings);
    }

    return {
      ...resolvedFullVersion,
      // JetBrains' `.checksum` sibling doesn't disclose its algorithm via the
      // filename, and older JBR builds (e.g. JBR 11) publish a SHA-256 digest
      // there while newer builds publish SHA-512. Accept either, preferring
      // the stronger SHA-512 when the digest length is ambiguous.
      checksum: await this.fetchChecksum(
        `${resolvedFullVersion.url}.checksum`,
        ['sha512', 'sha256']
      )
    };
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );

    const javaArchivePath = await this.downloadAndVerify(javaRelease);

    core.info(`Extracting Java archive...`);
    const extractedJavaPath = await extractJdkFile(javaArchivePath, 'tar.gz');

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

  private async getAvailableVersions(): Promise<IJetBrainsVersion[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();

    if (core.isDebug()) {
      console.time('Retrieving available versions for JBR took'); // eslint-disable-line no-console
    }

    const rawVersions: IJetBrainsRawVersion[] = [];
    const bearerToken = process.env.GITHUB_TOKEN;
    const requestHeaders: OutgoingHttpHeaders = {};
    if (bearerToken) {
      requestHeaders['Authorization'] = `Bearer ${bearerToken}`;
    }
    let releasesUrl: string | null = JETBRAINS_RELEASES_URL;
    let pageCount = 0;

    if (core.isDebug()) {
      core.debug(`Gathering available versions from '${releasesUrl}'`);
    }

    while (releasesUrl) {
      pageCount++;
      const response = await this.http.getJson<IJetBrainsRawVersion[]>(
        releasesUrl,
        requestHeaders
      );
      const paginationPageResult = response.result;
      if (!paginationPageResult || paginationPageResult.length === 0) {
        break;
      }

      rawVersions.push(
        ...paginationPageResult.filter(version =>
          this.stable ? !version.prerelease : version.prerelease
        )
      );

      const nextUrl = getNextPageUrlFromLinkHeader(response.headers);
      if (nextUrl && !validatePaginationUrl(nextUrl, GITHUB_API_ORIGIN)) {
        core.warning(
          `Ignoring pagination link with unexpected origin: ${nextUrl}`
        );
        releasesUrl = null;
      } else {
        releasesUrl = nextUrl;
      }

      if (pageCount >= MAX_PAGINATION_PAGES) {
        if (releasesUrl) {
          core.warning(
            `Reached pagination safeguard limit (${MAX_PAGINATION_PAGES} pages) while listing JetBrains Runtime releases.`
          );
        }
        break;
      }
    }

    if (this.stable) {
      // Add versions not available from the API but are downloadable
      const hidden = ['11_0_10b1145.115', '11_0_11b1341.60'];
      rawVersions.push(
        ...hidden.map(tag => ({tag_name: tag, name: tag, prerelease: false}))
      );
    }

    const versions0 = rawVersions.map(async v => {
      // Release tags look like one of these:
      // jbr-release-21.0.3b465.3
      // jbr17-b87.7
      // jb11_0_11-b87.7
      // jbr11_0_15b2043.56
      // 11_0_11b1536.2
      // 11_0_11-b1522
      const tag = v.tag_name;

      // Extract version string
      const vstring = tag
        .replace('jbr-release-', '')
        .replace('jbr', '')
        .replace('jb', '')
        .replace('-', '');

      const vsplit = vstring.split('b');
      let semver = vsplit[0];
      const build = vsplit[1];

      // Normalize semver
      if (!semver.includes('.') && !semver.includes('_'))
        semver = `${semver}.0.0`;

      // Construct URL
      let type: string;
      switch (this.packageType ?? '') {
        case 'jre':
          type = 'jbr';
          break;
        case 'jdk+jcef':
          type = 'jbrsdk_jcef';
          break;
        case 'jre+jcef':
          type = 'jbr_jcef';
          break;
        case 'jdk+ft':
          type = 'jbrsdk_ft';
          break;
        case 'jre+ft':
          type = 'jbr_ft';
          break;
        default:
          type = 'jbrsdk';
          break;
      }

      let url = `https://cache-redirector.jetbrains.com/intellij-jbr/${type}-${semver}-${platform}-${arch}-b${build}.tar.gz`;
      let include = false;

      const res = await this.http.head(url);
      if (res.message.statusCode === HttpCodes.OK) {
        include = true;
      } else {
        url = `https://cache-redirector.jetbrains.com/intellij-jbr/${type}_nomod-${semver}-${platform}-${arch}-b${build}.tar.gz`;
        const res2 = await this.http.head(url);
        if (res2.message.statusCode === HttpCodes.OK) {
          include = true;
        }
      }

      const version = {
        tag_name: tag,
        semver: semver.replace(/_/g, '.'),
        build: build,
        url: url
      } as IJetBrainsVersion;

      return {
        item: version,
        include: include
      };
    });

    const versions = await Promise.all(versions0).then(res =>
      res.filter(item => item.include).map(item => item.item)
    );

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for JBR took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${versions.length}]`);
      core.debug(versions.map(item => item.semver).join(', '));
      core.endGroup();
    }

    return versions;
  }

  private getPlatformOption(): string {
    // Jetbrains has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'osx';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }
}

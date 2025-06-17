import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';
import semver from 'semver';

import {JavaBase} from '../base-installer';
import {IJetBrainsRawVersion, IJetBrainsVersion} from './models';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {extractJdkFile, isVersionSatisfies} from '../../util';
import {OutgoingHttpHeaders} from 'http';
import {HttpCodes} from '@actions/http-client';

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
      const availableOptions = versionsRaw
        .map(item => `${item.tag_name} (${item.semver}+${item.build})`)
        .join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for SemVer '${range}'. ${availableOptionsMessage}`
      );
    }

    return resolvedFullVersion;
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );

    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    const extractedJavaPath = await extractJdkFile(javaArchivePath, 'tar.gz');

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

  private async getAvailableVersions(): Promise<IJetBrainsVersion[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();

    if (core.isDebug()) {
      console.time('Retrieving available versions for JBR took'); // eslint-disable-line no-console
    }

    // need to iterate through all pages to retrieve the list of all versions
    // GitHub API doesn't provide way to retrieve the count of pages to iterate so infinity loop
    let page_index = 1;
    const rawVersions: IJetBrainsRawVersion[] = [];
    const bearerToken = process.env.GITHUB_TOKEN;

    while (true) {
      const requestArguments = `per_page=100&page=${page_index}`;
      const requestHeaders: OutgoingHttpHeaders = {};

      if (bearerToken) {
        requestHeaders['Authorization'] = `Bearer ${bearerToken}`;
      }

      const rawUrl = `https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases?${requestArguments}`;

      if (core.isDebug() && page_index === 1) {
        // url is identical except page_index so print it once for debug
        core.debug(`Gathering available versions from '${rawUrl}'`);
      }

      const paginationPageResult = (
        await this.http.getJson<IJetBrainsRawVersion[]>(rawUrl, requestHeaders)
      ).result;
      if (!paginationPageResult || paginationPageResult.length === 0) {
        // break infinity loop because we have reached end of pagination
        break;
      }

      const paginationPage: IJetBrainsRawVersion[] =
        paginationPageResult.filter(version =>
          this.stable ? !version.prerelease : version.prerelease
        );
      if (!paginationPage || paginationPage.length === 0) {
        // break infinity loop because we have reached end of pagination
        break;
      }

      rawVersions.push(...paginationPage);
      page_index++;
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

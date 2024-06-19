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
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  isVersionSatisfies
} from '../../util';

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
      const availableOptions = versionsRaw.map(item => item.tag_name).join(', ');
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
    while (true) {
      const requestArguments = `per_page=100&page=${page_index}`;
      const rawUrl = `https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases?${requestArguments}`;

      if (core.isDebug() && page_index === 1) {
        // url is identical except page_index so print it once for debug
        core.debug(
          `Gathering available versions from '${rawUrl}'`
        );
      }

      const paginationPage = (
        await this.http.getJson<IJetBrainsRawVersion[]>(
          rawUrl
        )
      ).result;
      if (!paginationPage || paginationPage.length === 0) {
        // break infinity loop because we have reached end of pagination
        break;
      }

      rawVersions.push(...paginationPage);
      page_index++;
    }

    const versions = rawVersions.map(v => {
      // Release tags look like one of these:
      // jbr-release-21.0.3b465.3
      // jb11_0_11-b87.7
      // jbr11_0_15b2043.56
      const tag = v.tag_name;

      // Extract version string
      let vstring;

      switch (tag.match(/-/g)?.length) {
        case 2:
          vstring = tag.substring(tag.lastIndexOf('-') + 1);
          break;
        case 1:
          vstring = tag.substring(2).replace(/-/g, '').replace(/_/g, '.');
          break;
        case undefined: // 0
          vstring = tag.substring(3)
          break;
        default:
          throw new Error(`Unrecognized tag_name: ${tag}`)
      }

      const vsplit = vstring.split('b');
      const semver = vsplit[0].replace(/_/g, '.');
      const build = +vsplit[1];

      // Construct URL
      const url = `https://cache-redirector.jetbrains.com/intellij-jbr/jbrsdk_jcef-${semver}-${platform}-${arch}-b${build}.tar.gz`;

      return {
        tag_name: tag,
        semver: semver,
        build: build,
        url: url
      } as IJetBrainsVersion;
    });

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for JBR took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${versions.length}]`);
      core.debug(versions.map(item => item.tag_name).join(', '));
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

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';
import semver from 'semver';

import { JavaBase } from '../base-installer';
import { IAdoptAvailableVersions } from './models';
import { JavaInstallerOptions, JavaDownloadRelease, JavaInstallerResults } from '../base-models';
import { MACOS_JAVA_CONTENT_POSTFIX } from '../../constants';
import { extractJdkFile, getDownloadArchiveExtension, isVersionSatisfies } from '../../util';

export class AdoptDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Adopt', installerOptions);
  }

  protected async findPackageForDownload(version: string): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersionsWithBinaries = availableVersionsRaw
      .filter(item => item.binaries.length > 0)
      .map(item => {
        return {
          version: item.version_data.semver,
          url: item.binaries[0].package.link
        } as JavaDownloadRelease;
      });

    const satisfiedVersions = availableVersionsWithBinaries
      .filter(item => isVersionSatisfies(version, item.version))
      .sort((a, b) => {
        return -semver.compareBuild(a.version, b.version);
      });

    const resolvedFullVersion = satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableOptions = availableVersionsWithBinaries.map(item => item.version).join(', ');
      const availableOptionsMessage = availableOptions
        ? `\nAvailable versions: ${availableOptions}`
        : '';
      throw new Error(
        `Could not find satisfied version for SemVer '${version}'. ${availableOptionsMessage}`
      );
    }

    return resolvedFullVersion;
  }

  protected async downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
    let javaPath: string;
    let extractedJavaPath: string;

    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);
    let extension = getDownloadArchiveExtension();

    extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const version = this.getToolcacheVersionName(javaRelease.version);

    javaPath = await tc.cacheDir(archivePath, this.toolcacheFolderName, version, this.architecture);

    if (process.platform === 'darwin') {
      javaPath = path.join(javaPath, MACOS_JAVA_CONTENT_POSTFIX);
    }

    return { version: javaRelease.version, path: javaPath };
  }

  private async getAvailableVersions(): Promise<IAdoptAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.architecture;
    const imageType = this.packageType;
    const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
    const releaseType = this.stable ? 'ga' : 'ea';

    console.time('adopt-retrieve-available-versions');

    const baseRequestArguments = [
      `project=jdk`,
      'vendor=adoptopenjdk',
      `heap_size=normal`,
      `jvm_impl=hotspot`,
      'sort_method=DEFAULT',
      'sort_order=DESC',
      `os=${platform}`,
      `architecture=${arch}`,
      `image_type=${imageType}`,
      `release_type=${releaseType}`
    ].join('&');

    // need to iterate through all pages to retrieve the list of all versions
    // Adopt API doesn't provide way to retrieve the count of pages to iterate so infinity loop
    let page_index = 0;
    const availableVersions: IAdoptAvailableVersions[] = [];
    while (true) {
      const requestArguments = `${baseRequestArguments}&page_size=20&page=${page_index}`;
      const availableVersionsUrl = `https://api.adoptopenjdk.net/v3/assets/version/${versionRange}?${requestArguments}`;
      if (core.isDebug() && page_index === 0) {
        // url is identical except page_index so print it once for debug
        core.debug(`Gathering available versions from '${availableVersionsUrl}'`);
      }

      const paginationPage = (
        await this.http.getJson<IAdoptAvailableVersions[]>(availableVersionsUrl)
      ).result;
      if (paginationPage === null || paginationPage.length === 0) {
        // break infinity loop because we have reached end of pagination
        break;
      }

      availableVersions.push(...paginationPage);
      page_index++;
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('adopt-retrieve-available-versions');
      console.log(`Available versions: [${availableVersions.length}]`);
      console.log(availableVersions.map(item => item.version_data.semver).join(', '));
      core.endGroup();
    }

    return availableVersions;
  }

  private getPlatformOption(): string {
    // Adopt has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }
}

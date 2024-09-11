import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import semver from 'semver';
import fs from 'fs';
import {OutgoingHttpHeaders} from 'http';
import path from 'path';
import {
  convertVersionToSemver,
  extractJdkFile,
  getDownloadArchiveExtension,
  getGitHubHttpHeaders,
  isVersionSatisfies
} from '../../util';
import {JavaBase} from '../base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {ISapMachineAllVersions, ISapMachineVersions} from './models';

export class SapMachineDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('SapMachine', installerOptions);
  }

  protected async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    core.debug(`Only stable versions: ${this.stable}`);

    if (!['jdk', 'jre'].includes(this.packageType)) {
      throw new Error(
        'SapMachine provides only the `jdk` and `jre` package type'
      );
    }

    const availableVersions = await this.getAvailableVersions();

    const matchedVersions = availableVersions
      .filter(item => {
        return isVersionSatisfies(version, item.version);
      })
      .map(item => {
        return {
          version: item.version,
          url: item.downloadLink
        } as JavaDownloadRelease;
      });

    if (!matchedVersions.length) {
      throw new Error(
        `Couldn't find any satisfied version for the specified java-version: "${version}" and architecture: "${this.architecture}".`
      );
    }

    const resolvedVersion = matchedVersions[0];
    return resolvedVersion;
  }

  private async getAvailableVersions(): Promise<ISapMachineVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();

    let fetchedReleasesJson = await this.fetchReleasesFromUrl(
      'https://sap.github.io/SapMachine/assets/data/sapmachine-releases-all.json'
    );

    if (!fetchedReleasesJson) {
      fetchedReleasesJson = await this.fetchReleasesFromUrl(
        'https://api.github.com/repos/SAP/SapMachine/contents/assets/data/sapmachine-releases-all.json?ref=gh-pages',
        getGitHubHttpHeaders()
      );
    }

    if (!fetchedReleasesJson) {
      throw new Error(
        `Couldn't fetch SapMachine versions information from both primary and backup urls`
      );
    }

    core.debug(
      'Successfully fetched information about available SapMachine versions'
    );

    const availableVersions = this.parseVersions(
      platform,
      arch,
      fetchedReleasesJson
    );

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      core.debug(availableVersions.map(item => item.version).join(', '));
      core.endGroup();
    }

    return availableVersions;
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    const javaArchivePath = await tc.downloadTool(javaRelease.url);

    core.info(`Extracting Java archive...`);

    const extractedJavaPath = await extractJdkFile(
      javaArchivePath,
      getDownloadArchiveExtension()
    );

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

  private parseVersions(
    platform: string,
    arch: string,
    versions: ISapMachineAllVersions
  ): ISapMachineVersions[] {
    const eligibleVersions: ISapMachineVersions[] = [];

    for (const [, majorVersionMap] of Object.entries(versions)) {
      for (const [, jdkVersionMap] of Object.entries(majorVersionMap.updates)) {
        for (const [buildVersion, buildVersionMap] of Object.entries(
          jdkVersionMap
        )) {
          let buildVersionWithoutPrefix = buildVersion.replace(
            'sapmachine-',
            ''
          );
          if (!buildVersionWithoutPrefix.includes('.')) {
            // replace major version with major.minor.patch and keep the remaining build identifier after the + as is with regex
            buildVersionWithoutPrefix = buildVersionWithoutPrefix.replace(
              /(\d+)(\+.*)?/,
              '$1.0.0$2'
            );
          }
          // replace + with . to convert to semver format if we have more than 3 version digits
          if (buildVersionWithoutPrefix.split('.').length > 3) {
            buildVersionWithoutPrefix = buildVersionWithoutPrefix.replace(
              '+',
              '.'
            );
          }
          buildVersionWithoutPrefix = convertVersionToSemver(
            buildVersionWithoutPrefix
          );

          // ignore invalid version
          if (!semver.valid(buildVersionWithoutPrefix)) {
            core.debug(`Invalid version: ${buildVersionWithoutPrefix}`);
            continue;
          }

          // skip earlyAccessVersions if stable version requested
          if (this.stable && buildVersionMap.ea === 'true') {
            continue;
          }

          for (const [edition, editionAssets] of Object.entries(
            buildVersionMap.assets
          )) {
            if (this.packageType !== edition) {
              continue;
            }
            for (const [archAndPlatForm, archAssets] of Object.entries(
              editionAssets
            )) {
              let expectedArchAndPlatform = `${platform}-${arch}`;
              if (platform === 'linux-musl') {
                expectedArchAndPlatform = `linux-${arch}-musl`;
              }
              if (archAndPlatForm !== expectedArchAndPlatform) {
                continue;
              }
              for (const [contentType, contentTypeAssets] of Object.entries(
                archAssets
              )) {
                // skip if not tar.gz and zip files
                if (contentType !== 'tar.gz' && contentType !== 'zip') {
                  continue;
                }
                eligibleVersions.push({
                  os: platform,
                  architecture: arch,
                  version: buildVersionWithoutPrefix,
                  checksum: contentTypeAssets.checksum,
                  downloadLink: contentTypeAssets.url,
                  packageType: edition
                });
              }
            }
          }
        }
      }
    }

    const sortedVersions = this.sortParsedVersions(eligibleVersions);

    return sortedVersions;
  }

  // Sorts versions in descending order as by default data in JSON isn't sorted
  private sortParsedVersions(
    eligibleVersions: ISapMachineVersions[]
  ): ISapMachineVersions[] {
    const sortedVersions = eligibleVersions.sort((versionObj1, versionObj2) => {
      const version1 = versionObj1.version;
      const version2 = versionObj2.version;
      return semver.compareBuild(version1, version2);
    });
    return sortedVersions.reverse();
  }

  private getPlatformOption(): string {
    switch (process.platform) {
      case 'win32':
        return 'windows';
      case 'darwin':
        return 'macos';
      case 'linux':
        // figure out if alpine/musl
        if (fs.existsSync('/etc/alpine-release')) {
          return 'linux-musl';
        }
        return 'linux';
      default:
        return process.platform;
    }
  }

  private async fetchReleasesFromUrl(
    url: string,
    headers: OutgoingHttpHeaders = {}
  ): Promise<ISapMachineAllVersions | null> {
    try {
      core.debug(
        `Trying to fetch available SapMachine versions info from the primary url: ${url}`
      );
      const releases = (
        await this.http.getJson<ISapMachineAllVersions>(url, headers)
      ).result;
      return releases;
    } catch (err) {
      core.debug(
        `Fetching SapMachine versions info from the link: ${url} ended up with the error: ${
          (err as Error).message
        }`
      );
      return null;
    }
  }
}

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import { JavaBase } from '../base-installer';
import { JavaDownloadRelease, JavaInstallerResults } from '../base-models';
import { ICorrettoAllAvailableVersions, ICorettoAvailableVersions } from './models';

export class CorettoDistribution extends JavaBase {
  protected downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
    throw new Error('Method not implemented.');
  }
  protected findPackageForDownload(range: string): Promise<JavaDownloadRelease> {
    throw new Error('Method not implemented.');
  }

  private async getAvailableVersions(): Promise<ICorettoAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.architecture;
    const imageType = this.packageType;

    console.time('coretto-retrieve-available-versions');

    const availableVersionsUrl =
      'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json';
    const fetchResult = await this.http.getJson<ICorrettoAllAvailableVersions>(
      availableVersionsUrl
    );
    if (!fetchResult.result) {
      throw Error(`Could not fetch latest corretto versions from ${availableVersionsUrl}`);
    }
    const availableVersions: ICorettoAvailableVersions[] = [];
    const eligbleVersions = fetchResult.result[platform][arch][imageType];
    for (const version in eligbleVersions) {
      const availableVersion = eligbleVersions[version];
      for (const fileType in availableVersion) {
        const availableVersionDetails = availableVersion[fileType];
        const correttoVersion = this.getCorettoVersionr(availableVersionDetails.resource);

        availableVersions.push({
          checksum: availableVersionDetails.checksum,
          checksum_sha256: availableVersionDetails.checksum_sha256,
          fileType,
          resource: availableVersionDetails.resource,
          version: version,
          correttoVersion
        });
      }
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('coretto-retrieve-available-versions');
      console.log(`Available versions: [${availableVersions.length}]`);
      console.log(
        availableVersions.map(item => `${item.version}: ${item.correttoVersion}`).join(', ')
      );
      core.endGroup();
    }

    return availableVersions;
  }

  private getPlatformOption(): string {
    // Coretto has its own platform names so we need to map them
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'windows';
      default:
        return process.platform;
    }
  }

  private getCorettoVersionr(resource: string): string {
    const regex = /(\d+.+)\//;
    const match = regex.exec(resource);
    if (match === null) {
      throw Error(`Could not parse corretto version from ${resource}`);
    }
    return match[1];
  }
}

import {JavaBase} from '../base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {extractJdkFile, getDownloadArchiveExtension} from '../../util';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import {OutgoingHttpHeaders} from 'http';
import fs from 'fs';
import path from 'path';
import {ITypedResponse} from '@actions/http-client/interfaces';

export class MicrosoftDistributions extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Microsoft', installerOptions);
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

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      this.getToolcacheVersionName(javaRelease.version),
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    const arch = this.distributionArchitecture();
    if (arch !== 'x64' && arch !== 'aarch64') {
      throw new Error(`Unsupported architecture: ${this.architecture}`);
    }

    if (!this.stable) {
      throw new Error('Early access versions are not supported');
    }

    if (this.packageType !== 'jdk') {
      throw new Error(
        'Microsoft Build of OpenJDK provides only the `jdk` package type'
      );
    }

    const manifest = await this.getAvailableVersions();

    if (!manifest) {
      throw new Error('Could not load manifest for Microsoft Build of OpenJDK');
    }

    const foundRelease = await tc.findFromManifest(range, true, manifest, arch);

    if (!foundRelease) {
      throw new Error(
        `Could not find satisfied version for SemVer ${range}.\nAvailable versions: ${manifest
          .map(item => item.version)
          .join(', ')}`
      );
    }

    return {
      url: foundRelease.files[0].download_url,
      version: foundRelease.version
    };
  }

  private async getAvailableVersions(): Promise<tc.IToolRelease[] | null> {
    // TODO get these dynamically!
    // We will need Microsoft to add an endpoint where we can query for versions.
    const token = core.getInput('token');
    const auth = !token ? undefined : `token ${token}`;
    const owner = 'actions';
    const repository = 'setup-java';
    const branch = 'main';
    const filePath =
      'src/distributions/microsoft/microsoft-openjdk-versions.json';

    let releases: tc.IToolRelease[] | null = null;
    const fileUrl = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;

    const headers: OutgoingHttpHeaders = {
      authorization: auth,
      accept: 'application/vnd.github.VERSION.raw'
    };

    let response: ITypedResponse<tc.IToolRelease[]> | null = null;

    if (core.isDebug()) {
      console.time('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
    }

    try {
      response = await this.http.getJson<tc.IToolRelease[]>(fileUrl, headers);
      if (!response.result) {
        return null;
      }
    } catch (err) {
      core.debug(
        `Http request for microsoft-openjdk-versions.json failed with status code: ${response?.statusCode}`
      );
      return null;
    }

    if (response.result) {
      releases = response.result;
    }

    if (core.isDebug() && releases) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${releases.length}]`);
      core.debug(releases.map(item => item.version).join(', '));
      core.endGroup();
    }

    return releases;
  }
}

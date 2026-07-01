import {JavaBase} from '../base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  extractJdkFile,
  getDownloadArchiveExtension,
  renameWinArchive
} from '../../util';
import * as gpg from '../../gpg';
import {MICROSOFT_PUBLIC_KEY} from './microsoft-key';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import {TypedResponse} from '@actions/http-client/lib/interfaces';

export {MICROSOFT_PUBLIC_KEY} from './microsoft-key';

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
    let javaArchivePath = await tc.downloadTool(javaRelease.url);

    if (this.verifySignature) {
      if (!javaRelease.signatureUrl) {
        throw new Error(
          `Input 'verify-signature' is enabled, but no signature URL was found for Microsoft Build of OpenJDK version ${javaRelease.version}.`
        );
      }
      core.info(`Verifying Java package signature...`);
      try {
        await gpg.verifyPackageSignature(
          javaArchivePath,
          javaRelease.signatureUrl,
          this.verifySignaturePublicKey ?? MICROSOFT_PUBLIC_KEY
        );
      } catch (error) {
        throw new Error(
          `Failed to verify signature for Microsoft Build of OpenJDK version ${javaRelease.version}. Signature URL: ${javaRelease.signatureUrl}. Error: ${(error as Error).message}`
        );
      }
    }

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
      const availableVersionStrings = manifest.map(item => item.version);
      throw this.createVersionNotFoundError(range, availableVersionStrings);
    }

    const file = foundRelease.files[0] as {
      download_url: string;
      signature_url?: string;
    };
    const signatureUrl = file.signature_url ?? `${file.download_url}.sig`;

    return {
      url: file.download_url,
      signatureUrl,
      version: foundRelease.version
    };
  }

  protected supportsSignatureVerification(): boolean {
    return true;
  }

  private async getAvailableVersions(): Promise<tc.IToolRelease[] | null> {
    const owner = 'microsoft';
    const repository = 'openjdk-adoptium-marketplace-data';
    const branch = 'main';
    const filePath = 'general_info/microsoft-openjdk-versions.json';
    let releases: tc.IToolRelease[] | null = null;
    const fileUrl = `https://raw.githubusercontent.com/${owner}/${repository}/refs/heads/${branch}/${filePath}`;

    let response: TypedResponse<tc.IToolRelease[]> | null = null;

    if (core.isDebug()) {
      console.time('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
    }

    try {
      response = await this.http.getJson<tc.IToolRelease[]>(fileUrl);
      if (!response.result) {
        return null;
      }
    } catch (err) {
      core.debug(
        `Http request for microsoft-openjdk-versions.json failed with status code: ${response?.statusCode}. Error: ${err}`
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

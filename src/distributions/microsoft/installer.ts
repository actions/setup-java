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
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';

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
    const learnUrl =
      'https://learn.microsoft.com/en-us/java/openjdk/download';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
    }

    try {
      const response = await this.http.get(learnUrl);
      const body = await response.readBody();

      const releases = this.parseVersionsFromHtml(body);

      if (core.isDebug() && releases) {
        core.startGroup('Print information about available versions');
        console.timeEnd('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
        core.debug(`Available versions: [${releases.length}]`);
        core.debug(releases.map(item => item.version).join(', '));
        core.endGroup();
      }

      return releases;
    } catch (err) {
      core.debug(
        `Failed to fetch versions from Microsoft Learn: ${err}`
      );
      return null;
    }
  }

  private parseVersionsFromHtml(html: string): tc.IToolRelease[] {
    const releases: tc.IToolRelease[] = [];
    
    // Pattern to match version headings like "OpenJDK 25.0.0 LTS", "OpenJDK 21.0.8 LTS", etc.
    const versionHeaderRegex = /OpenJDK\s+(\d+\.\d+\.\d+)(?:\s+LTS)?/gi;
    
    let match: RegExpExecArray | null;
    const versions = new Set<string>();
    
    while ((match = versionHeaderRegex.exec(html)) !== null) {
      const version = match[1];
      versions.add(version);
    }

    // Convert versions to releases with download URLs
    for (const version of versions) {
      const majorVersion = version.split('.')[0];
      
      releases.push({
        version: version,
        stable: true,
        release_url: 'https://aka.ms/download-jdk',
        files: this.generateDownloadFiles(version, majorVersion)
      });
    }

    // Sort releases by version (newest first)
    releases.sort((a, b) => {
      const aParts = a.version.split('.').map(Number);
      const bParts = b.version.split('.').map(Number);
      
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) {
          return bVal - aVal;
        }
      }
      return 0;
    });

    return releases;
  }

  private generateDownloadFiles(
    version: string,
    majorVersion: string
  ): Array<{
    filename: string;
    arch: string;
    platform: string;
    download_url: string;
  }> {
    const files = [];
    const platforms = [
      {platform: 'linux', archName: 'x64', extension: 'tar.gz'},
      {platform: 'darwin', archName: 'x64', extension: 'tar.gz'},
      {platform: 'win32', archName: 'x64', extension: 'zip'},
      {platform: 'linux', archName: 'aarch64', extension: 'tar.gz'},
      {platform: 'darwin', archName: 'aarch64', extension: 'tar.gz'},
      {platform: 'win32', archName: 'aarch64', extension: 'zip'}
    ];

    for (const {platform, archName, extension} of platforms) {
      const osName =
        platform === 'darwin'
          ? 'macos'
          : platform === 'win32'
          ? 'windows'
          : 'linux';
      
      const filename = `microsoft-jdk-${version}-${osName}-${archName}.${extension}`;
      const download_url = `https://aka.ms/download-jdk/${filename}`;

      files.push({
        filename,
        arch: archName,
        platform,
        download_url
      });
    }

    return files;
  }
}

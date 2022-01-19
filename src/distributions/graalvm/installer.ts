import * as tc from '@actions/tool-cache';
import fs from 'fs';
import path from 'path';
import { JavaDownloadRelease, JavaInstallerOptions, JavaInstallerResults } from '../base-models';
import * as semver from 'semver';
import { JavaBase } from '../base-installer';
import {
  GraalArchitecture,
  GraalPlatform,
  IGithubAsset,
  IGithubRelease,
  IGraalAsset
} from './models';
import { graalToJdk } from './version-mapping';
import { extractJdkFile, isVersionSatisfies } from '../../util';

const releasesUrl = 'https://api.github.com/repos/graalvm/graalvm-ce-builds/releases';

const jvmAssetRegex = /^graalvm-ce-java(?<javaMajor>\d\d?)-(?<platform>darwin|linux|windows)-(?<arch>amd64|aarch64)-.*(?:\.tar\.gz|\.zip)$/;
const nextPageRelRegex = /<(?<nextPage>[^>]*?)>; rel="next"/i;

export class GraalVMDistribution extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('GraalVM', installerOptions);
  }

  private getNextPage(headers: Object): string | null {
    const link = (headers as Record<string, string>).link;
    const nextPage = link?.match(nextPageRelRegex)?.groups?.nextPage;
    return nextPage ?? null;
  }

  private async getPaginatedResult<T = IGithubRelease>(url: string): Promise<T[]> {
    const results: T[] = [];

    let res = await this.http.getJson<T[]>(url);
    results.push(...(res.result ?? []));
    let nextPage = this.getNextPage(res.headers);

    while (nextPage) {
      res = await this.http.getJson<T[]>(nextPage);
      results.push(...(res.result ?? []));
      nextPage = this.getNextPage(res.headers);
    }

    return results;
  }

  private matchJvmAsset(asset: IGithubAsset, graalVersion: string): IGraalAsset | null {
    const { url, name } = asset;
    const match = name.match(jvmAssetRegex);
    if (match?.groups) {
      const { javaMajor, platform, arch } = match.groups;
      const javaVersion = graalToJdk?.[graalVersion]?.[javaMajor];

      if (javaVersion) {
        return {
          type: 'jvm',
          javaVersion,
          graalVersion,
          platform: platform as GraalPlatform,
          arch: arch as GraalArchitecture,
          url
        };
      }
    }

    return null;
  }

  private getPlatform(platform: NodeJS.Platform = process.platform): GraalPlatform {
    switch (platform) {
      case 'darwin':
        return 'darwin';
      case 'win32':
      case 'cygwin':
        return 'windows';
      case 'linux':
        return 'linux';
      default:
        throw new Error(`Unsupported platform: '${platform}'`);
    }
  }

  private getArchitectureOptions(): GraalArchitecture {
    switch (this.architecture) {
      case 'x86':
      case 'x64':
        return 'amd64';
      case 'armv7':
      case 'aarch64':
        return 'aarch64';
      default:
        throw new Error(`Unsupported architecture: '${this.architecture}'`);
    }
  }

  private getSuggestions(range: string): string[] {
    const result: string[] = [];
    const [javaMajor] = range.split('.');
    for (const [graalVersion, m] of Object.entries(graalToJdk)) {
      const javaVersion = m[javaMajor];
      if (javaVersion) {
        result.push(`${javaVersion}+${graalVersion}`);
      }
    }
    return result.sort((x, y) => -semver.compareBuild(x, y));
  }

  protected async findPackageForDownload(range: string): Promise<JavaDownloadRelease> {
    const [javaVersion, graalVersion] = range.split('+');

    const platform = this.getPlatform();
    const arch = this.getArchitectureOptions();

    const releases = await this.getPaginatedResult(releasesUrl);

    const graalAssets: IGraalAsset[] = [];
    for (const release of releases) {
      const assetGraalVersion = release.tag_name.replace(/^vm-/, '');
      for (const asset of release.assets) {
        const graalvmAsset = this.matchJvmAsset(asset, assetGraalVersion);
        if (
          graalvmAsset &&
          graalvmAsset.platform === platform &&
          graalvmAsset.arch === arch &&
          isVersionSatisfies(javaVersion, graalvmAsset.javaVersion)
        ) {
          if (!graalVersion || graalVersion === graalvmAsset.graalVersion) {
            graalAssets.push(graalvmAsset);
          }
        }
      }
    }

    graalAssets.sort((x, y) => {
      return -semver.compareBuild(
        `${x.javaVersion}+${x.graalVersion}`,
        `${y.javaVersion}+${y.graalVersion}`
      );
    });

    const [resolved] = graalAssets;
    if (!resolved) {
      const msg = `Could not find GraalVM with java ${range}.`;
      const suggested = this.getSuggestions(javaVersion);
      const errorMsg = suggested.length
        ? [msg, 'Available versions:', ...suggested].join('\n')
        : msg;
      throw new Error(errorMsg);
    }

    return {
      url: resolved.url,
      version: `${resolved.javaVersion}+${resolved.graalVersion}`
    };
  }

  protected async downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
    const token = process.env.GITHUB_TOKEN;
    const assetPath = await tc.downloadTool(javaRelease.url, undefined, token, {
      accept: 'application/octet-stream'
    });
    const ext = this.getPlatform() === 'windows' ? 'zip' : 'tar.gz';
    const extractedJavaPath = await extractJdkFile(assetPath, ext);
    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return { version: javaRelease.version, path: javaPath };
  }
}

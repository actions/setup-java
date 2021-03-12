import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import semver from 'semver';
import path from 'path';
import * as httpm from '@actions/http-client';
import { getToolcachePath, getVersionFromToolcachePath, isVersionSatisfies } from '../util';
import { JavaDownloadRelease, JavaInstallerOptions, JavaInstallerResults } from './base-models';

export abstract class JavaBase {
  protected http: httpm.HttpClient;
  protected version: string;
  protected architecture: string;
  protected packageType: string;
  protected stable: boolean;

  constructor(protected distribution: string, installerOptions: JavaInstallerOptions) {
    this.http = new httpm.HttpClient('actions/setup-java', undefined, {
      allowRetries: true,
      maxRetries: 3
    });

    ({ version: this.version, stable: this.stable } = this.normalizeVersion(
      installerOptions.version
    ));
    this.architecture = installerOptions.architecture;
    this.packageType = installerOptions.packageType;
  }

  protected abstract downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults>;
  protected abstract findPackageForDownload(range: string): Promise<JavaDownloadRelease>;

  public async setupJava(): Promise<JavaInstallerResults> {
    let foundJava = this.findInToolcache();
    if (foundJava) {
      core.info(`Resolved Java ${foundJava.version} from tool-cache`);
    } else {
      core.info(`Java ${this.version} was not found in tool-cache. Trying to download...`);
      const javaRelease = await this.findPackageForDownload(this.version);
      foundJava = await this.downloadTool(javaRelease);
      core.info(`Java ${foundJava.version} was downloaded`);
    }

    core.info(`Setting Java ${foundJava.version} as the default`);
    this.setJavaDefault(foundJava.version, foundJava.path);

    return foundJava;
  }

  protected get toolcacheFolderName(): string {
    return `Java_${this.distribution}_${this.packageType}`;
  }

  protected getToolcacheVersionName(version: string): string {
    if (!this.stable) {
      const cleanVersion = semver.clean(version);
      return `${cleanVersion}-ea`;
    }
    return version;
  }

  protected findInToolcache(): JavaInstallerResults | null {
    // we can't use tc.find directly because firstly, we need to filter versions by stability flag
    // if *-ea is provided, take only ea versions from toolcache, otherwise - only stable versions
    const availableVersions = tc
      .findAllVersions(this.toolcacheFolderName, this.architecture)
      .filter(item => item.endsWith('-ea') === !this.stable);

    const satisfiedVersions = availableVersions
      .filter(item => isVersionSatisfies(this.version, item.replace(/-ea$/, '')))
      .sort(semver.rcompare);
    if (!satisfiedVersions || satisfiedVersions.length === 0) {
      return null;
    }

    const javaPath = getToolcachePath(
      this.toolcacheFolderName,
      satisfiedVersions[0],
      this.architecture
    );
    if (!javaPath) {
      return null;
    }

    return {
      version: getVersionFromToolcachePath(javaPath),
      path: javaPath
    };
  }

  protected normalizeVersion(version: string) {
    let stable = true;

    if (version.endsWith('-ea')) {
      version = version.replace(/-ea$/, '');
      stable = false;
    } else if (version.includes('-ea.')) {
      // transform '11.0.3-ea.2' -> '11.0.3+2'
      version = version.replace('-ea.', '+');
      stable = false;
    }

    if (!semver.validRange(version)) {
      throw new Error(
        `The string '${version}' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information`
      );
    }

    return {
      version,
      stable
    };
  }

  protected setJavaDefault(version: string, toolPath: string) {
    core.exportVariable('JAVA_HOME', toolPath);
    core.addPath(path.join(toolPath, 'bin'));
    core.setOutput('distribution', this.distribution);
    core.setOutput('path', toolPath);
    core.setOutput('version', version);
  }
}

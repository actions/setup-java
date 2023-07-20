import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as fs from 'fs';
import semver from 'semver';
import path from 'path';
import * as httpm from '@actions/http-client';
import {getToolcachePath, isVersionSatisfies} from '../util';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from './base-models';
import {MACOS_JAVA_CONTENT_POSTFIX} from '../constants';
import os from 'os';

export abstract class JavaBase {
  protected http: httpm.HttpClient;
  protected version: string;
  protected architecture: string;
  protected packageType: string;
  protected stable: boolean;
  protected checkLatest: boolean;

  constructor(
    protected distribution: string,
    installerOptions: JavaInstallerOptions
  ) {
    this.http = new httpm.HttpClient('actions/setup-java', undefined, {
      allowRetries: true,
      maxRetries: 3
    });

    ({version: this.version, stable: this.stable} = this.normalizeVersion(
      installerOptions.version
    ));
    this.architecture = installerOptions.architecture || os.arch();
    this.packageType = installerOptions.packageType;
    this.checkLatest = installerOptions.checkLatest;
  }

  protected abstract downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults>;
  protected abstract findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease>;

  public async setupJava(): Promise<JavaInstallerResults> {
    let foundJava = this.findInToolcache();
    if (foundJava && !this.checkLatest) {
      core.info(`Resolved Java ${foundJava.version} from tool-cache`);
    } else {
      core.info('Trying to resolve the latest version from remote');
      const javaRelease = await this.findPackageForDownload(this.version);
      core.info(`Resolved latest version as ${javaRelease.version}`);
      if (foundJava?.version === javaRelease.version) {
        core.info(`Resolved Java ${foundJava.version} from tool-cache`);
      } else {
        core.info('Trying to download...');
        foundJava = await this.downloadTool(javaRelease);
        core.info(`Java ${foundJava.version} was downloaded`);
      }
    }

    // JDK folder may contain postfix "Contents/Home" on macOS
    const macOSPostfixPath = path.join(
      foundJava.path,
      MACOS_JAVA_CONTENT_POSTFIX
    );
    if (process.platform === 'darwin' && fs.existsSync(macOSPostfixPath)) {
      foundJava.path = macOSPostfixPath;
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
      if (version.includes('+')) {
        return version.replace('+', '-ea.');
      } else {
        return `${version}-ea`;
      }
    }

    // Kotlin and some Java dependencies don't work properly when Java path contains "+" sign
    // so replace "/hostedtoolcache/Java/11.0.3+4/x64" to "/hostedtoolcache/Java/11.0.3-4/x64" when saves to cache
    // related issue: https://github.com/actions/virtual-environments/issues/3014
    return version.replace('+', '-');
  }

  protected findInToolcache(): JavaInstallerResults | null {
    // we can't use tc.find directly because firstly, we need to filter versions by stability flag
    // if *-ea is provided, take only ea versions from toolcache, otherwise - only stable versions
    const availableVersions = tc
      .findAllVersions(this.toolcacheFolderName, this.architecture)
      .map(item => {
        return {
          version: item
            .replace('-ea.', '+')
            .replace(/-ea$/, '')
            // Kotlin and some Java dependencies don't work properly when Java path contains "+" sign
            // so replace "/hostedtoolcache/Java/11.0.3-4/x64" to "/hostedtoolcache/Java/11.0.3+4/x64" when retrieves  to cache
            // related issue: https://github.com/actions/virtual-environments/issues/3014
            .replace('-', '+'),
          path:
            getToolcachePath(
              this.toolcacheFolderName,
              item,
              this.architecture
            ) || '',
          stable: !item.includes('-ea')
        };
      })
      .filter(item => item.stable === this.stable);

    const satisfiedVersions = availableVersions
      .filter(item => isVersionSatisfies(this.version, item.version))
      .filter(item => item.path)
      .sort((a, b) => {
        return -semver.compareBuild(a.version, b.version);
      });
    if (!satisfiedVersions || satisfiedVersions.length === 0) {
      return null;
    }

    return {
      version: satisfiedVersions[0].version,
      path: satisfiedVersions[0].path
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
    const majorVersion = version.split('.')[0];
    core.exportVariable('JAVA_HOME', toolPath);
    core.addPath(path.join(toolPath, 'bin'));
    core.setOutput('distribution', this.distribution);
    core.setOutput('path', toolPath);
    core.setOutput('version', version);
    core.exportVariable(
      `JAVA_HOME_${majorVersion}_${this.architecture.toUpperCase()}`,
      toolPath
    );
  }

  protected distributionArchitecture(): string {
    // default mappings of config architectures to distribution architectures
    // override if a distribution uses any different names; see liberica for an example

    // node's os.arch() - which this defaults to - can return any of:
    // 'arm', 'arm64', 'ia32', 'mips', 'mipsel', 'ppc', 'ppc64', 's390', 's390x', and 'x64'
    // so we need to map these to java distribution architectures
    // 'amd64' is included here too b/c it's a common alias for 'x64' people might use explicitly
    switch (this.architecture) {
      case 'amd64':
        return 'x64';
      case 'ia32':
        return 'x86';
      case 'arm64':
        return 'aarch64';
      default:
        return this.architecture;
    }
  }
}

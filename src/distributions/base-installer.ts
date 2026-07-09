import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as fs from 'fs';
import semver from 'semver';
import path from 'path';
import * as httpm from '@actions/http-client';
import {
  convertVersionToSemver,
  getToolcachePath,
  isVersionSatisfies
} from '../util.js';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from './base-models.js';
import {MACOS_JAVA_CONTENT_POSTFIX} from '../constants.js';
import os from 'os';

export abstract class JavaBase {
  protected http: httpm.HttpClient;
  protected version: string;
  protected architecture: string;
  protected packageType: string;
  protected stable: boolean;
  protected latest: boolean;
  protected checkLatest: boolean;
  protected setDefault: boolean;
  protected verifySignature: boolean;
  protected verifySignaturePublicKey: string | undefined;

  constructor(
    protected distribution: string,
    installerOptions: JavaInstallerOptions
  ) {
    this.http = new httpm.HttpClient('actions/setup-java', undefined, {
      allowRetries: true,
      maxRetries: 3
    });

    ({
      version: this.version,
      stable: this.stable,
      latest: this.latest
    } = this.normalizeVersion(installerOptions.version));
    this.architecture = installerOptions.architecture || os.arch();
    this.packageType = installerOptions.packageType;
    this.checkLatest = installerOptions.checkLatest;
    this.setDefault =
      installerOptions.setDefault !== undefined
        ? installerOptions.setDefault
        : true;
    this.verifySignature = installerOptions.verifySignature ?? false;
    this.verifySignaturePublicKey = installerOptions.verifySignaturePublicKey;
  }

  protected abstract downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults>;
  protected abstract findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease>;

  public async setupJava(): Promise<JavaInstallerResults> {
    if (this.verifySignature && !this.supportsSignatureVerification()) {
      throw new Error(
        `Input 'verify-signature' is not supported for distribution '${this.distribution}'.`
      );
    }

    let foundJava = this.findInToolcache();
    if (foundJava && !this.checkLatest && !this.latest) {
      core.info(`Resolved Java ${foundJava.version} from tool-cache`);
    } else {
      core.info('Trying to resolve the latest version from remote');
      const MAX_RETRIES = 4;
      const RETRY_DELAY_MS = 2000;
      const retryableCodes = [
        'ETIMEDOUT',
        'ECONNRESET',
        'ENOTFOUND',
        'ECONNREFUSED'
      ];
      let retries = MAX_RETRIES;
      while (retries > 0) {
        try {
          // Clear console timers before each attempt to prevent conflicts
          if (retries < MAX_RETRIES && core.isDebug()) {
            const consoleAny = console as any;
            consoleAny._times?.clear?.();
          }
          const javaRelease = await this.findPackageForDownload(this.version);
          core.info(`Resolved latest version as ${javaRelease.version}`);
          if (foundJava?.version === javaRelease.version) {
            core.info(`Resolved Java ${foundJava.version} from tool-cache`);
          } else {
            core.info('Trying to download...');
            foundJava = await this.downloadTool(javaRelease);
            core.info(`Java ${foundJava.version} was downloaded`);
          }
          break;
        } catch (error: any) {
          retries--;
          // Check if error is retryable (including aggregate errors)
          const isRetryable =
            (error instanceof tc.HTTPError &&
              error.httpStatusCode &&
              [429, 502, 503, 504, 522].includes(error.httpStatusCode)) ||
            retryableCodes.includes(error?.code) ||
            (error?.errors &&
              Array.isArray(error.errors) &&
              error.errors.some((err: any) =>
                retryableCodes.includes(err?.code)
              ));
          if (retries > 0 && isRetryable) {
            core.debug(
              `Attempt failed due to network or timeout issues, initiating retry... (${retries} attempts left)`
            );
            await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
            continue;
          }
          if (error instanceof tc.HTTPError) {
            if (error.httpStatusCode === 403) {
              core.error('HTTP 403: Permission denied or access restricted.');
            } else if (error.httpStatusCode === 429) {
              core.warning(
                'HTTP 429: Rate limit exceeded. Please retry later.'
              );
            } else {
              core.error(`HTTP ${error.httpStatusCode}: ${error.message}`);
            }
          } else if (error && error.errors && Array.isArray(error.errors)) {
            core.error(
              `Java setup failed due to network or configuration error(s)`
            );
            if (error instanceof Error && error.stack) {
              core.debug(error.stack);
            }
            for (const err of error.errors) {
              const endpoint = err?.address || err?.hostname || '';
              const port = err?.port ? `:${err.port}` : '';
              const message = err?.message || 'Aggregate error';
              const endpointInfo = !message.includes(endpoint)
                ? ` ${endpoint}${port}`
                : '';
              const localInfo =
                err.localAddress && err.localPort
                  ? ` - Local (${err.localAddress}:${err.localPort})`
                  : '';
              const logMessage = `${message}${endpointInfo}${localInfo}`;
              core.error(logMessage);
              core.debug(`${err.stack || err.message}`);
              Object.entries(err).forEach(([key, value]) => {
                core.debug(`"${key}": ${JSON.stringify(value)}`);
              });
            }
          } else {
            const message =
              error instanceof Error ? error.message : JSON.stringify(error);
            core.error(`Java setup process failed due to: ${message}`);
            if (typeof error?.code === 'string') {
              core.debug(error.stack);
            }
            const errorDetails = {
              name: error.name,
              message: error.message,
              ...Object.getOwnPropertyNames(error)
                .filter(prop => !['name', 'message', 'stack'].includes(prop))
                .reduce<{[key: string]: any}>((acc, prop) => {
                  acc[prop] = error[prop];
                  return acc;
                }, {})
            };
            Object.entries(errorDetails).forEach(([key, value]) => {
              core.debug(`"${key}": ${JSON.stringify(value)}`);
            });
          }
          throw error;
        }
      }
    }
    if (!foundJava) {
      throw new Error('Failed to resolve Java version');
    }
    // JDK folder may contain postfix "Contents/Home" on macOS
    const macOSPostfixPath = path.join(
      foundJava.path,
      MACOS_JAVA_CONTENT_POSTFIX
    );
    if (process.platform === 'darwin' && fs.existsSync(macOSPostfixPath)) {
      foundJava.path = macOSPostfixPath;
    }

    if (this.setDefault) {
      core.info(`Setting Java ${foundJava.version} as the default`);
      this.setJavaDefault(foundJava.version, foundJava.path);
    } else {
      core.info(
        `Installing Java ${foundJava.version} (not setting as default)`
      );
      this.setJavaEnvironment(foundJava.version, foundJava.path);
    }

    return foundJava;
  }

  protected get toolcacheFolderName(): string {
    return `Java_${this.distribution}_${this.packageType}`;
  }

  protected supportsSignatureVerification(): boolean {
    return false;
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
    const latest = false;

    // Support the `latest` alias (case-insensitive), which floats to the newest
    // available stable/GA release. It is translated to the SemVer wildcard `x`
    // so the existing "newest satisfying version wins" resolution applies.
    const normalized = version.trim().toLowerCase();
    if (normalized === 'latest') {
      return {
        version: 'x',
        stable: true,
        latest: true
      };
    }

    // Reject `latest` combined with any qualifier (e.g. `latest-ea`). Such inputs
    // would otherwise have their `-ea` suffix stripped and fall through to the
    // generic SemVer check, which fails with a confusing "'latest' is not valid
    // SemVer" message even though `latest` is a supported value. Fail early with a
    // targeted explanation instead.
    if (normalized.startsWith('latest')) {
      throw new Error(
        `The 'latest' alias resolves stable (GA) releases only and cannot be combined with '-ea' or other qualifiers (received '${version}'). Use 'latest' on its own, or specify a concrete version.`
      );
    }

    if (version.endsWith('-ea')) {
      version = version.replace(/-ea$/, '');
      stable = false;
    } else if (version.includes('-ea.')) {
      // transform '11.0.3-ea.2' -> '11.0.3+2'
      version = version.replace('-ea.', '+');
      stable = false;
    }

    // Java uses a versioning scheme (JEP 322) that can contain more numeric
    // fields than SemVer allows, e.g. '18.0.1.1' or '11.0.9.1'. Convert such
    // exact versions to SemVer build notation ('18.0.1+1') so they are
    // accepted. Ranges and versions that already carry build metadata are
    // left untouched.
    if (/^\d+(\.\d+){3,}$/.test(version)) {
      version = convertVersionToSemver(version);
    }

    if (!semver.validRange(version)) {
      throw new Error(
        `The string '${version}' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information`
      );
    }

    return {
      version,
      stable,
      latest
    };
  }

  protected createVersionNotFoundError(
    versionOrRange: string,
    availableVersions?: string[],
    additionalContext?: string
  ): Error {
    const parts = [
      `No matching version found for SemVer '${versionOrRange}'.`,
      `Distribution: ${this.distribution}`,
      `Package type: ${this.packageType}`,
      `Architecture: ${this.architecture}`
    ];

    // Add additional context if provided (e.g., platform/OS info)
    if (additionalContext) {
      parts.push(additionalContext);
    }

    if (availableVersions && availableVersions.length > 0) {
      const maxVersionsToShow = core.isDebug() ? availableVersions.length : 50;
      const versionsToShow = availableVersions.slice(0, maxVersionsToShow);
      const truncated = availableVersions.length > maxVersionsToShow;

      parts.push(
        `Available versions: ${versionsToShow.join(', ')}${truncated ? ', ...' : ''}`
      );

      if (truncated) {
        parts.push(
          `(showing first ${maxVersionsToShow} of ${availableVersions.length} versions, enable debug mode to see all)`
        );
      }
    }

    const error = new Error(parts.join('\n'));
    error.name = 'VersionNotFoundError';
    return error;
  }

  protected setJavaDefault(version: string, toolPath: string) {
    core.exportVariable('JAVA_HOME', toolPath);
    core.addPath(path.join(toolPath, 'bin'));
    this.setJavaEnvironment(version, toolPath);
  }

  protected setJavaEnvironment(version: string, toolPath: string) {
    const majorVersion = version.split('.')[0];
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

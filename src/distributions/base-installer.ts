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
  ChecksumAlgorithm,
  ChecksumMetadata,
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from './base-models.js';
import {MACOS_JAVA_CONTENT_POSTFIX} from '../constants.js';
import {RetryingHttpClient} from '../retrying-http-client.js';
import os from 'os';
import {expectedDigestLength, verifyChecksum} from '../checksum.js';
import {
  getJavaPlatformIdentity,
  normalizeArchitecture
} from './platform-types.js';
import type {JdkCache} from '../jdk-cache.js';

export abstract class JavaBase {
  protected http: httpm.HttpClient;
  protected version: string;
  protected architecture: string;
  protected packageType: string;
  protected stable: boolean;
  protected latest: boolean;
  protected checkLatest: boolean;
  protected forceDownload: boolean;
  protected cacheJdk: boolean;
  protected setDefault: boolean;
  protected verifySignature: boolean;
  protected verifySignaturePublicKey: string | undefined;

  constructor(
    protected distribution: string,
    installerOptions: JavaInstallerOptions
  ) {
    this.http = new RetryingHttpClient('actions/setup-java');

    ({
      version: this.version,
      stable: this.stable,
      latest: this.latest
    } = this.normalizeVersion(installerOptions.version));
    this.architecture = normalizeArchitecture(
      installerOptions.architecture || os.arch()
    );
    this.packageType = installerOptions.packageType;
    this.checkLatest = installerOptions.checkLatest;
    this.forceDownload = installerOptions.forceDownload ?? false;
    this.cacheJdk = installerOptions.cacheJdk ?? false;
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

  protected async downloadAndVerify(
    javaRelease: JavaDownloadRelease
  ): Promise<string> {
    const archivePath = await tc.downloadTool(javaRelease.url);
    const checksum = javaRelease.checksum;
    if (!checksum || !checksum.value?.trim()) {
      core.debug(
        `No authoritative checksum is available for ${this.distribution} version ${javaRelease.version}; skipping checksum verification.`
      );
      return archivePath;
    }

    try {
      await verifyChecksum(archivePath, checksum, {
        distribution: this.distribution,
        version: javaRelease.version
      });
      core.debug(
        `Verified ${checksum.algorithm} checksum for ${this.distribution} version ${javaRelease.version}.`
      );
      return archivePath;
    } catch (error) {
      let cleanupError: unknown;
      let cleanupFailed = false;
      try {
        await fs.promises.rm(archivePath, {force: true});
      } catch (caughtCleanupError) {
        cleanupError = caughtCleanupError;
        cleanupFailed = true;
      }
      if (cleanupFailed) {
        throw new Error(
          `${(error as Error).message} Failed to remove the downloaded archive after verification failure: ${(cleanupError as Error).message}`,
          {cause: error}
        );
      }
      throw error;
    }
  }

  protected async fetchChecksum(
    checksumUrl: string,
    algorithm: ChecksumAlgorithm | ChecksumAlgorithm[]
  ): Promise<ChecksumMetadata | undefined> {
    // Some vendors (e.g. JetBrains) publish a single, generically-named
    // checksum sibling (`.checksum`) whose digest algorithm isn't disclosed
    // by the URL and has changed across releases. Accepting a list of
    // candidate algorithms lets callers pass every algorithm the vendor is
    // known to use; the actual algorithm is then inferred from the length of
    // the returned digest.
    const algorithms = Array.isArray(algorithm) ? algorithm : [algorithm];
    const algorithmLabel = algorithms.join(' or ');

    const response = await this.http.get(checksumUrl);
    const statusCode = response.message.statusCode;
    const source = (() => {
      try {
        const url = new URL(checksumUrl);
        return `${url.origin}${url.pathname}`;
      } catch {
        return 'an invalid checksum URL';
      }
    })();

    if (statusCode === httpm.HttpCodes.NotFound) {
      core.debug(
        `No authoritative ${algorithmLabel} checksum is available for ${this.distribution} from ${source}; skipping checksum verification.`
      );
      return undefined;
    }

    if (statusCode !== httpm.HttpCodes.OK) {
      throw new Error(
        `Failed to fetch the authoritative ${algorithmLabel} checksum for ${this.distribution} from ${source} (HTTP ${statusCode}).`
      );
    }

    const body = await response.readBody();
    const value = body.trim().split(/\s+/, 1)[0] ?? '';
    if (!value) {
      throw new Error(
        `Received an empty authoritative ${algorithmLabel} checksum for ${this.distribution} from ${source}.`
      );
    }

    // Prefer the strongest algorithm whose digest length matches what was
    // actually returned; fall back to the first candidate (preserving prior
    // behavior/error messages) when the digest doesn't match any of them.
    const resolvedAlgorithm =
      algorithms.find(algo => value.length === expectedDigestLength(algo)) ??
      algorithms[0];

    return {algorithm: resolvedAlgorithm, value, source: checksumUrl};
  }

  public async setupJava(): Promise<JavaInstallerResults> {
    if (this.verifySignature && !this.supportsSignatureVerification()) {
      throw new Error(
        `Input 'verify-signature' is not supported for distribution '${this.distribution}'.`
      );
    }

    let foundJava = this.forceDownload ? null : this.findInToolcache();
    if (foundJava && !this.checkLatest && !this.latest) {
      core.info(`Resolved Java ${foundJava.version} from tool-cache`);
    } else {
      core.info('Trying to resolve the latest version from remote');
      try {
        const javaRelease = await this.resolveJavaRelease();
        core.info(`Resolved latest version as ${javaRelease.version}`);
        if (!this.forceDownload && foundJava?.version === javaRelease.version) {
          core.info(`Resolved Java ${foundJava.version} from tool-cache`);
        } else {
          let jdkCache: JdkCache | undefined;
          if (this.cacheJdk) {
            const {getJdkVerificationIdentity} =
              await import('../jdk-cache.js');
            jdkCache = {
              distribution: this.distribution,
              packageType: this.packageType,
              architecture: this.architecture,
              version: javaRelease.version,
              source: this.getJdkReleaseIdentity(javaRelease),
              verification: getJdkVerificationIdentity(
                this.verifySignature,
                this.verifySignaturePublicKey
              ),
              path: this.getJdkCachePath(javaRelease.version)
            };
          }
          if (!this.forceDownload && jdkCache) {
            const {restoreJdk} = await import('../jdk-cache.js');
            const restored = await restoreJdk(jdkCache);
            if (restored) {
              const restoredPath = this.getRestoredJdkPath(javaRelease.version);
              if (restoredPath) {
                foundJava = {
                  version: javaRelease.version,
                  path: restoredPath
                };
              }
            }
          }
          if (!foundJava || foundJava.version !== javaRelease.version) {
            core.info('Trying to download...');
            foundJava = await this.downloadTool(javaRelease);
            core.info(`Java ${foundJava.version} was downloaded`);
            if (jdkCache) {
              // Register after the installation exists so its identity is
              // captured; the post-job save refuses to upload a path whose
              // installation was replaced afterwards.
              const {registerJdk} = await import('../jdk-cache.js');
              registerJdk(jdkCache);
            }
          }
        }
      } catch (error: any) {
        this.logSetupError(error);
        throw error;
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

  /**
   * Resolves the release to install, preferring a cached resolution over the
   * distribution's metadata API.
   *
   * Only Temurin is preinstalled on hosted runners, so for every other
   * distribution the tool-cache lookup misses and the vendor API becomes a
   * per-job dependency even when the JDK itself is already in the GitHub
   * Actions cache. A cached resolution removes that dependency, and because it
   * carries the download URL and checksum it also keeps a job working when the
   * vendor API is unavailable but the JDK still has to be downloaded.
   */
  private async resolveJavaRelease(): Promise<JavaDownloadRelease> {
    if (
      !this.cacheJdk ||
      this.checkLatest ||
      this.latest ||
      this.forceDownload
    ) {
      return this.findPackageForDownload(this.version);
    }

    const {restoreJdkResolution, registerJdkResolution} =
      await import('../jdk-resolution-cache.js');
    const request = {
      distribution: this.distribution,
      packageType: this.packageType,
      platform: getJavaPlatformIdentity(),
      architecture: this.architecture,
      versionSpec: this.version,
      stable: this.stable
    };

    const restored = await restoreJdkResolution(request);
    if (restored?.fresh) {
      core.info(
        `Resolved ${this.distribution} ${restored.release.version} from the resolution cache`
      );
      return restored.release;
    }

    try {
      const javaRelease = await this.findPackageForDownload(this.version);
      if (!javaRelease.floating) {
        registerJdkResolution(request, javaRelease);
      }
      return javaRelease;
    } catch (error) {
      if (!restored) {
        throw error;
      }
      // The cached resolution is older than the current bucket, but falling
      // back to it is strictly better than failing the job because the vendor
      // metadata API is down.
      core.warning(
        `Failed to resolve ${this.distribution} ${this.version} from remote (${
          error instanceof Error ? error.message : String(error)
        }); falling back to the cached resolution for ${restored.release.version}.`
      );
      return restored.release;
    }
  }

  private logSetupError(error: any): void {
    const httpStatusCode =
      error instanceof tc.HTTPError
        ? error.httpStatusCode
        : error instanceof httpm.HttpClientError
          ? error.statusCode
          : undefined;

    if (httpStatusCode) {
      if (httpStatusCode === 403) {
        core.error('HTTP 403: Permission denied or access restricted.');
      } else if (httpStatusCode === 429) {
        core.warning('HTTP 429: Rate limit exceeded. Please retry later.');
      } else {
        core.error(`HTTP ${httpStatusCode}: ${error.message}`);
      }
    } else if (error && error.errors && Array.isArray(error.errors)) {
      core.error(`Java setup failed due to network or configuration error(s)`);
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

  protected getJdkCachePath(version: string): string {
    const toolCache = process.env['RUNNER_TOOL_CACHE'];
    if (!toolCache) {
      return '';
    }
    return path.join(
      toolCache,
      this.toolcacheFolderName,
      this.getToolcacheVersionName(version)
    );
  }

  protected getRestoredJdkPath(version: string): string | null {
    const basePath = this.getJdkCachePath(version);
    if (!basePath) {
      return null;
    }
    const architecturePath = path.join(basePath, this.architecture);
    return fs.existsSync(architecturePath) &&
      fs.existsSync(`${architecturePath}.complete`)
      ? architecturePath
      : null;
  }

  private getJdkReleaseIdentity(javaRelease: JavaDownloadRelease): string {
    if (javaRelease.checksum) {
      return `${javaRelease.checksum.algorithm}:${javaRelease.checksum.value}`;
    }
    try {
      const url = new URL(javaRelease.url);
      return `${url.origin}${url.pathname}`;
    } catch {
      return javaRelease.url;
    }
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
    return this.architecture;
  }
}

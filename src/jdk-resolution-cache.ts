import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {
  ChecksumMetadata,
  JavaDownloadRelease
} from './distributions/base-models.js';

const STATE_JDK_RESOLUTIONS = 'jdk-resolutions';
const JDK_RESOLUTION_KEY_VERSION = 2;
const RESOLUTION_DIRECTORY = 'setup-java-jdk-resolution';
const RESOLUTION_FILE_NAME = 'release.json';

/**
 * Everything that identifies a resolution request before any remote metadata is
 * fetched. Distribution-specific inputs are already folded into `distribution`
 * (for example Temurin's `jvm-impl`) or `packageType` (`jdk+jmods`), so these
 * fields fully determine which artifact a distribution would resolve.
 */
export interface JdkResolutionRequest {
  distribution: string;
  packageType: string;
  platform: string;
  architecture: string;
  versionSpec: string;
  stable: boolean;
}

export interface RestoredJdkResolution {
  release: JavaDownloadRelease;
  /**
   * Whether the entry was written within the current freshness window. A stale
   * entry is only a fallback for the case where the vendor metadata API is
   * unreachable, so a floating version spec cannot be pinned indefinitely.
   */
  fresh: boolean;
}

interface JdkResolutionState {
  key: string;
  path: string;
  /**
   * The payload the key was computed for. A restore in a later step writes to
   * the same path, so the post-job save rewrites the file from state instead of
   * uploading whatever happens to be on disk.
   */
  release: string;
}

const pendingResolutions: JdkResolutionState[] = [];

/**
 * Restores a previously resolved release so a distribution can skip its vendor
 * metadata API.
 *
 * The cache path deliberately excludes the freshness window: `@actions/cache`
 * derives
 * a cache version by hashing the requested paths, so a bucket-independent path
 * is what allows the restore keys to fall back to an older bucket.
 */
export async function restoreJdkResolution(
  request: JdkResolutionRequest
): Promise<RestoredJdkResolution | undefined> {
  // Deliberately not `isCacheFeatureAvailable()`: this is an optional
  // optimization, and the JDK cache already warns once when the service is
  // unreachable.
  if (!cache.isFeatureAvailable()) {
    return undefined;
  }

  const cachePath = getResolutionCachePath(request);
  if (!cachePath) {
    return undefined;
  }

  const keyPrefix = getResolutionKeyPrefix(request);
  const primaryKey = `${keyPrefix}${getFreshnessBucket()}`;

  let matchedKey: string | undefined;
  try {
    matchedKey = await cache.restoreCache([cachePath], primaryKey, [keyPrefix]);
  } catch (error) {
    core.debug(
      `Failed to restore the JDK resolution cache: ${getErrorMessage(error)}`
    );
    return undefined;
  }

  if (!matchedKey) {
    return undefined;
  }

  let release: JavaDownloadRelease;
  try {
    const contents = fs.readFileSync(
      path.join(cachePath, RESOLUTION_FILE_NAME),
      'utf8'
    );
    release = parseResolvedRelease(contents);
  } catch (error) {
    core.debug(
      `Ignoring the JDK resolution cache entry ${matchedKey}: ${getErrorMessage(error)}`
    );
    return undefined;
  }

  return {release, fresh: matchedKey === primaryKey};
}

/**
 * Persists a freshly resolved release for later jobs. The entry is written to
 * disk immediately and uploaded by the post-job step.
 */
export function registerJdkResolution(
  request: JdkResolutionRequest,
  release: JavaDownloadRelease
): void {
  if (!cache.isFeatureAvailable()) {
    return;
  }

  const cachePath = getResolutionCachePath(request);
  if (!cachePath) {
    return;
  }

  const payload = JSON.stringify(release);
  try {
    fs.mkdirSync(cachePath, {recursive: true});
    fs.writeFileSync(path.join(cachePath, RESOLUTION_FILE_NAME), payload);
  } catch (error) {
    core.debug(
      `Failed to record the JDK resolution cache entry: ${getErrorMessage(error)}`
    );
    return;
  }

  const key = `${getResolutionKeyPrefix(request)}${getFreshnessBucket()}`;
  if (!pendingResolutions.some(item => item.key === key)) {
    pendingResolutions.push({key, path: cachePath, release: payload});
  }
  core.saveState(STATE_JDK_RESOLUTIONS, JSON.stringify(pendingResolutions));
}

export async function saveJdkResolutionCaches(): Promise<void> {
  const state = core.getState(STATE_JDK_RESOLUTIONS);
  if (!state) {
    return;
  }

  let resolutions: JdkResolutionState[];
  try {
    resolutions = parseJdkResolutionState(state);
  } catch (error) {
    core.debug(
      `Invalid JDK resolution cache state, not saving: ${getErrorMessage(error)}`
    );
    return;
  }

  for (const resolution of resolutions) {
    // A restore performed by a later step overwrites this path, so the payload
    // the key was computed for is written again rather than trusted to still be
    // on disk.
    try {
      fs.mkdirSync(resolution.path, {recursive: true});
      fs.writeFileSync(
        path.join(resolution.path, RESOLUTION_FILE_NAME),
        resolution.release
      );
    } catch (error) {
      core.debug(
        `Failed to write the JDK resolution cache entry for the key ${resolution.key}: ${getErrorMessage(error)}`
      );
      continue;
    }

    try {
      await cache.saveCache([resolution.path], resolution.key);
    } catch (error) {
      // A matrix of jobs resolving the same JDK races on the same daily key, so
      // an already-reserved key is the expected outcome rather than a problem.
      core.debug(
        `Failed to save the JDK resolution cache with the key ${resolution.key}: ${getErrorMessage(error)}`
      );
    }
  }
}

function getResolutionCachePath(
  request: JdkResolutionRequest
): string | undefined {
  const runnerTemp = process.env['RUNNER_TEMP'];
  if (!runnerTemp) {
    return undefined;
  }
  return path.join(
    runnerTemp,
    RESOLUTION_DIRECTORY,
    getResolutionIdentity(request)
  );
}

function getResolutionIdentity(request: JdkResolutionRequest): string {
  const identity = JSON.stringify({
    keyVersion: JDK_RESOLUTION_KEY_VERSION,
    runnerOs: getRunnerOs(),
    distribution: request.distribution.toLowerCase(),
    packageType: request.packageType.toLowerCase(),
    platform: request.platform.toLowerCase(),
    architecture: request.architecture.toLowerCase(),
    versionSpec: request.versionSpec,
    stable: request.stable
  });
  return createHash('sha256').update(identity).digest('hex');
}

function getResolutionKeyPrefix(request: JdkResolutionRequest): string {
  const architecture = request.architecture.toLowerCase();
  const digest = getResolutionIdentity(request);
  return `setup-java-jdkres-v${JDK_RESOLUTION_KEY_VERSION}-${getRunnerOs()}-${architecture}-${digest}-`;
}

function getRunnerOs(): string {
  return process.env['RUNNER_OS'] ?? process.platform;
}

/**
 * Start of the seven-day window the entry was resolved in, which bounds how long
 * a floating version spec such as `21` can keep resolving to an already known
 * release.
 *
 * Seven days is the longest usable window: GitHub evicts cache entries that have
 * not been accessed for seven days, so a longer one would mean the previous
 * entry is already gone when the window rolls over, taking the stale-fallback
 * path with it. It also comfortably covers the real release cadence, which is
 * monthly at its fastest and usually quarterly.
 */
function getFreshnessBucket(): string {
  const week = 7 * 24 * 60 * 60 * 1000;
  return new Date(Math.floor(Date.now() / week) * week)
    .toISOString()
    .slice(0, 10);
}

/**
 * The restored payload drives a download, so it is validated as untrusted input
 * rather than trusted because it came back from the cache service.
 */
function parseResolvedRelease(contents: string): JavaDownloadRelease {
  const value: unknown = JSON.parse(contents);
  if (typeof value !== 'object' || value === null) {
    throw new Error('The cached resolution is not an object.');
  }

  const candidate = value as Record<string, unknown>;
  const version = candidate['version'];
  const url = candidate['url'];
  const signatureUrl = candidate['signatureUrl'];

  if (typeof version !== 'string' || !version) {
    throw new Error('The cached resolution has no version.');
  }
  assertHttpsUrl(url, 'url');
  if (signatureUrl !== undefined) {
    assertHttpsUrl(signatureUrl, 'signatureUrl');
  }

  const release: JavaDownloadRelease = {
    version,
    url: url as string
  };
  if (signatureUrl !== undefined) {
    release.signatureUrl = signatureUrl as string;
  }

  const checksum = candidate['checksum'];
  if (checksum !== undefined) {
    release.checksum = parseChecksum(checksum);
  }

  return release;
}

function parseChecksum(value: unknown): ChecksumMetadata {
  if (typeof value !== 'object' || value === null) {
    throw new Error('The cached checksum is not an object.');
  }

  const candidate = value as Record<string, unknown>;
  const algorithm = candidate['algorithm'];
  const checksumValue = candidate['value'];
  const source = candidate['source'];

  if (algorithm !== 'sha256' && algorithm !== 'sha512') {
    throw new Error(`Unsupported cached checksum algorithm: ${algorithm}`);
  }
  if (typeof checksumValue !== 'string' || !checksumValue) {
    throw new Error('The cached checksum has no value.');
  }
  if (source !== undefined && typeof source !== 'string') {
    throw new Error('The cached checksum source is not a string.');
  }

  const checksum: ChecksumMetadata = {algorithm, value: checksumValue};
  if (source !== undefined) {
    checksum.source = source;
  }
  return checksum;
}

function assertHttpsUrl(value: unknown, field: string): void {
  if (typeof value !== 'string' || !value) {
    throw new Error(`The cached resolution has no ${field}.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`The cached resolution has a malformed ${field}.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(
      `The cached resolution ${field} does not use HTTPS: ${parsed.protocol}`
    );
  }
}

function parseJdkResolutionState(state: string): JdkResolutionState[] {
  const value: unknown = JSON.parse(state);
  if (
    !Array.isArray(value) ||
    !value.every(
      item =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as JdkResolutionState).key === 'string' &&
        typeof (item as JdkResolutionState).path === 'string' &&
        typeof (item as JdkResolutionState).release === 'string'
    )
  ) {
    throw new Error('Invalid JDK resolution information retrieved from state.');
  }
  return value as JdkResolutionState[];
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

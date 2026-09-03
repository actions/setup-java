import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {isCacheFeatureAvailable} from './cache-feature.js';
import type {SignatureVerificationKey} from './distributions/base-models.js';

const STATE_JDK_CACHES = 'jdk-caches';
const JDK_CACHE_KEY_VERSION = 1;

export interface JdkCache {
  distribution: string;
  packageType: string;
  architecture: string;
  version: string;
  source: string;
  verification: string;
  path: string;
}

interface JdkCacheState {
  key: string;
  path: string;
  architecture: string;
  matchedKey?: string;
  // Cheap identity of the installation that occupied `path` when the entry was
  // registered. The tool-cache path is shared per version/architecture, so a
  // later step (e.g. one using `force-download`) can replace those bytes; the
  // post-job save must not upload content that does not match the identity the
  // key was computed for.
  installation?: string;
}

const restoredCaches: JdkCacheState[] = [];

export async function restoreJdk(jdk: JdkCache): Promise<boolean> {
  if (!jdk.path || !isCacheFeatureAvailable()) {
    return false;
  }

  const key = buildJdkCacheKey(jdk);
  let matchedKey: string | undefined;
  try {
    matchedKey = await cache.restoreCache([jdk.path], key);
  } catch (error) {
    core.warning(`Failed to restore JDK cache: ${(error as Error).message}`);
  }

  const architecturePath = path.join(jdk.path, jdk.architecture);
  if (
    matchedKey &&
    (!fs.existsSync(architecturePath) ||
      !fs.existsSync(`${architecturePath}.complete`))
  ) {
    core.warning(
      `JDK cache key ${matchedKey} was restored without the expected tool-cache path; downloading the JDK instead.`
    );
    matchedKey = undefined;
  }

  recordJdkCache({
    key,
    path: jdk.path,
    architecture: jdk.architecture,
    matchedKey
  });

  if (matchedKey) {
    core.info(`JDK cache restored from key: ${matchedKey}`);
    return true;
  }

  core.info(`JDK cache is not found for ${jdk.distribution} ${jdk.version}`);
  return false;
}

export function registerJdk(jdk: JdkCache): void {
  if (!jdk.path) {
    return;
  }
  recordJdkCache({
    key: buildJdkCacheKey(jdk),
    path: jdk.path,
    architecture: jdk.architecture,
    installation: getInstallationIdentity(jdk.path, jdk.architecture)
  });
}

/**
 * Cheap fingerprint of the installation stored at a tool-cache path. The
 * `<architecture>.complete` marker is (re)created by `tc.cacheDir` every time an
 * installation is written, so its inode and timestamps change whenever the
 * installation is replaced. This avoids rehashing a multi-hundred-megabyte JDK
 * directory while still detecting that the bytes behind a key were swapped.
 */
function getInstallationIdentity(
  jdkPath: string,
  architecture: string
): string | undefined {
  const architecturePath = path.join(jdkPath, architecture);
  try {
    const marker = fs.statSync(`${architecturePath}.complete`);
    const installation = fs.statSync(architecturePath);
    return [
      marker.ino,
      marker.mtimeMs,
      marker.ctimeMs,
      marker.size,
      installation.ino,
      installation.mtimeMs,
      installation.ctimeMs
    ].join(':');
  } catch {
    return undefined;
  }
}

export function getJdkVerificationIdentity(
  verifySignature: boolean,
  enforceSignatureVerification: boolean,
  publicKey?: SignatureVerificationKey
): string {
  if (!verifySignature) {
    return 'disabled';
  }
  const verificationPolicy = enforceSignatureVerification
    ? 'enforced'
    : 'check-and-warn';
  if (!publicKey) {
    return `${verificationPolicy}:bundled`;
  }

  const publicKeys = Array.isArray(publicKey) ? publicKey : [publicKey];
  const normalizedKeys = publicKeys.map(key =>
    key.replace(/\r\n?/g, '\n').trim()
  );
  const fingerprintSource = Array.isArray(publicKey)
    ? normalizedKeys.map(key => `${Buffer.byteLength(key)}:${key}`).join('')
    : normalizedKeys[0];
  const fingerprint = createHash('sha256')
    .update(fingerprintSource)
    .digest('hex');
  return `${verificationPolicy}:custom:sha256:${fingerprint}`;
}

export async function saveJdkCaches(): Promise<void> {
  const state = core.getState(STATE_JDK_CACHES);
  if (!state) {
    return;
  }

  const caches = parseJdkCacheState(state);
  for (const jdk of caches) {
    if (jdk.matchedKey === jdk.key) {
      core.info(
        `Cache hit occurred on the JDK primary key ${jdk.key}, not saving cache.`
      );
      continue;
    }

    if (!fs.existsSync(jdk.path)) {
      core.debug(`JDK cache path does not exist, not saving: ${jdk.path}`);
      continue;
    }

    if (!jdk.installation) {
      core.debug(
        `No JDK installation was registered for the key ${jdk.key}, not saving cache.`
      );
      continue;
    }

    if (
      getInstallationIdentity(jdk.path, jdk.architecture) !== jdk.installation
    ) {
      core.warning(
        `The JDK installation in ${jdk.path} was replaced after it was registered for the key ${jdk.key}; not saving cache.`
      );
      continue;
    }

    try {
      const cacheId = await cache.saveCache([jdk.path], jdk.key);
      if (cacheId !== -1) {
        core.info(`JDK cache saved with the key: ${jdk.key}`);
      }
    } catch (error) {
      const err = error as Error;
      if (err.name === cache.ReserveCacheError.name) {
        core.info(err.message);
      } else {
        // Saving is best-effort and per entry: one failure must not suppress
        // the remaining JDK caches.
        core.warning(
          `Failed to save the JDK cache with the key ${jdk.key}: ${err.message}`
        );
      }
    }
  }
}

export function buildJdkCacheKey(jdk: JdkCache): string {
  const runnerOs = process.env['RUNNER_OS'] ?? process.platform;
  const normalizedArchitecture = jdk.architecture.toLowerCase();
  const identity = JSON.stringify({
    keyVersion: JDK_CACHE_KEY_VERSION,
    runnerOs,
    distribution: jdk.distribution.toLowerCase(),
    packageType: jdk.packageType.toLowerCase(),
    architecture: normalizedArchitecture,
    version: jdk.version,
    source: jdk.source,
    verification: jdk.verification
  });
  const digest = createHash('sha256').update(identity).digest('hex');
  return `setup-java-jdk-v${JDK_CACHE_KEY_VERSION}-${runnerOs}-${normalizedArchitecture}-${digest}`;
}

function recordJdkCache(jdk: JdkCacheState): void {
  const existing = restoredCaches.findIndex(
    item => item.key === jdk.key && item.path === jdk.path
  );
  if (existing === -1) {
    restoredCaches.push(jdk);
  } else {
    restoredCaches[existing] = {...restoredCaches[existing], ...jdk};
  }
  core.saveState(STATE_JDK_CACHES, JSON.stringify(restoredCaches));
}

function parseJdkCacheState(state: string): JdkCacheState[] {
  const value: unknown = JSON.parse(state);
  if (
    !Array.isArray(value) ||
    !value.every(
      item =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as JdkCacheState).key === 'string' &&
        typeof (item as JdkCacheState).path === 'string' &&
        typeof (item as JdkCacheState).architecture === 'string' &&
        ((item as JdkCacheState).matchedKey === undefined ||
          typeof (item as JdkCacheState).matchedKey === 'string') &&
        ((item as JdkCacheState).installation === undefined ||
          typeof (item as JdkCacheState).installation === 'string')
    )
  ) {
    throw new Error('Invalid JDK cache information retrieved from state.');
  }
  return value as JdkCacheState[];
}

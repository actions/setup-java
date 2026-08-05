import {createHash} from 'crypto';
import fs from 'fs';
import path from 'path';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {isCacheFeatureAvailable} from './cache-feature.js';

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
  matchedKey?: string;
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

  recordJdkCache({key, path: jdk.path, matchedKey});

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
  recordJdkCache({key: buildJdkCacheKey(jdk), path: jdk.path});
}

export function getJdkVerificationIdentity(
  verifySignature: boolean,
  publicKey?: string
): string {
  if (!verifySignature) {
    return 'unverified';
  }
  if (!publicKey) {
    return 'verified:bundled';
  }

  const normalizedKey = publicKey.replace(/\r\n?/g, '\n').trim();
  const fingerprint = createHash('sha256').update(normalizedKey).digest('hex');
  return `verified:custom:sha256:${fingerprint}`;
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
        throw error;
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
    restoredCaches[existing] = jdk;
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
        ((item as JdkCacheState).matchedKey === undefined ||
          typeof (item as JdkCacheState).matchedKey === 'string')
    )
  ) {
    throw new Error('Invalid JDK cache information retrieved from state.');
  }
  return value as JdkCacheState[];
}

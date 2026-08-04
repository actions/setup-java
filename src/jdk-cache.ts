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

  restoredCaches.push({key, path: jdk.path, matchedKey});
  core.saveState(STATE_JDK_CACHES, JSON.stringify(restoredCaches));

  if (matchedKey) {
    core.info(`JDK cache restored from key: ${matchedKey}`);
    return true;
  }

  core.info(`JDK cache is not found for ${jdk.distribution} ${jdk.version}`);
  return false;
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
  const identity = JSON.stringify({
    keyVersion: JDK_CACHE_KEY_VERSION,
    runnerOs: process.env['RUNNER_OS'] ?? process.platform,
    platform: process.platform,
    distribution: jdk.distribution.toLowerCase(),
    packageType: jdk.packageType.toLowerCase(),
    architecture: jdk.architecture.toLowerCase(),
    version: jdk.version,
    source: jdk.source
  });
  const digest = createHash('sha256').update(identity).digest('hex');
  return `setup-java-jdk-v${JDK_CACHE_KEY_VERSION}-${process.env['RUNNER_OS'] ?? process.platform}-${jdk.architecture}-${digest}`;
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

/**
 * @fileoverview this file provides methods handling dependency cache
 */

import {join} from 'path';
import os from 'os';
import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as glob from '@actions/glob';

const STATE_CACHE_PRIMARY_KEY = 'cache-primary-key';
const CACHE_MATCHED_KEY = 'cache-matched-key';
const CACHE_KEY_PREFIX = 'setup-java';

/**
 * An additional cache entry that is restored and saved independently of the
 * main dependency cache. Used for build-tool wrapper distributions that rarely
 * change (e.g. the Maven wrapper distribution) so that they are not evicted
 * every time a volatile dependency file such as pom.xml changes. See
 * https://github.com/actions/setup-java/issues/1095.
 */
interface AdditionalCache {
  /**
   * Short identifier for the cache, used to build its cache key and to scope
   * the state keys that carry information from restore to save.
   */
  name: string;
  /**
   * Paths that make up this cache entry.
   */
  path: string[];
  /**
   * Glob patterns whose hash forms the cache key. If no file matches, the
   * cache is skipped silently (the project simply does not use this feature).
   */
  pattern: string[];
}

interface PackageManager {
  id: 'maven' | 'gradle' | 'sbt';
  /**
   * Paths of the file that specify the files to cache.
   */
  path: string[];
  pattern: string[];
  /**
   * Additional caches keyed independently of the main dependency cache.
   */
  additionalCaches?: AdditionalCache[];
}
const supportedPackageManager: PackageManager[] = [
  {
    id: 'maven',
    path: [join(os.homedir(), '.m2', 'repository')],
    // https://github.com/actions/cache/blob/0638051e9af2c23d10bb70fa9beffcad6cff9ce3/examples.md#java---maven
    pattern: [
      '**/pom.xml',
      '**/.mvn/wrapper/maven-wrapper.properties',
      '**/.mvn/extensions.xml'
    ],
    // The Maven wrapper distribution only depends on the wrapper properties,
    // which change very rarely, so it is cached separately from the local
    // repository. This keeps it available across the frequent pom.xml changes
    // that rotate the main cache key. See issue #1095.
    additionalCaches: [
      {
        name: 'maven-wrapper',
        path: [join(os.homedir(), '.m2', 'wrapper', 'dists')],
        pattern: ['**/.mvn/wrapper/maven-wrapper.properties']
      }
    ]
  },
  {
    id: 'gradle',
    path: [join(os.homedir(), '.gradle', 'caches')],
    // https://github.com/actions/cache/blob/0638051e9af2c23d10bb70fa9beffcad6cff9ce3/examples.md#java---gradle
    pattern: [
      '**/*.gradle*',
      '**/gradle-wrapper.properties',
      'buildSrc/**/Versions.kt',
      'buildSrc/**/Dependencies.kt',
      'gradle/*.versions.toml',
      '**/versions.properties'
    ],
    // The Gradle wrapper distribution only depends on the wrapper properties,
    // which change very rarely, so it is cached separately from the Gradle
    // caches. This keeps it available across the frequent *.gradle* changes
    // that rotate the main cache key. See issue #1095.
    additionalCaches: [
      {
        name: 'gradle-wrapper',
        path: [join(os.homedir(), '.gradle', 'wrapper')],
        pattern: ['**/gradle-wrapper.properties']
      }
    ]
  },
  {
    id: 'sbt',
    path: [
      join(os.homedir(), '.ivy2', 'cache'),
      join(os.homedir(), '.sbt'),
      getCoursierCachePath(),
      // Some files should not be cached to avoid resolution problems.
      // In particular the resolution of snapshots (ideological gap between maven/ivy).
      '!' + join(os.homedir(), '.sbt', '*.lock'),
      '!' + join(os.homedir(), '**', 'ivydata-*.properties')
    ],
    pattern: [
      '**/*.sbt',
      '**/project/build.properties',
      '**/project/**.scala',
      '**/project/**.sbt'
    ]
  }
];

function getCoursierCachePath(): string {
  if (os.type() === 'Linux') return join(os.homedir(), '.cache', 'coursier');
  if (os.type() === 'Darwin')
    return join(os.homedir(), 'Library', 'Caches', 'Coursier');
  return join(os.homedir(), 'AppData', 'Local', 'Coursier', 'Cache');
}

function findPackageManager(id: string): PackageManager {
  const packageManager = supportedPackageManager.find(
    packageManager => packageManager.id === id
  );
  if (packageManager === undefined) {
    throw new Error(`unknown package manager specified: ${id}`);
  }
  return packageManager;
}

/**
 * State keys used to carry an additional cache's restore-time information over
 * to the post (save) action, scoped by the additional cache name.
 */
function additionalCachePrimaryKeyState(name: string): string {
  return `${STATE_CACHE_PRIMARY_KEY}-${name}`;
}
function additionalCacheMatchedKeyState(name: string): string {
  return `${CACHE_MATCHED_KEY}-${name}`;
}

function buildCacheKey(id: string, fileHash: string): string {
  return `${CACHE_KEY_PREFIX}-${process.env['RUNNER_OS']}-${process.arch}-${id}-${fileHash}`;
}

/**
 * A function that generates a cache key to use.
 * Format of the generated key will be "${{ platform }}-${{ id }}-${{ fileHash }}"".
 * @see {@link https://docs.github.com/en/actions/guides/caching-dependencies-to-speed-up-workflows#matching-a-cache-key|spec of cache key}
 */
async function computeCacheKey(
  packageManager: PackageManager,
  cacheDependencyPath: string
) {
  const pattern = cacheDependencyPath
    ? cacheDependencyPath.trim().split('\n')
    : packageManager.pattern;
  const fileHash = await glob.hashFiles(pattern.join('\n'));
  if (!fileHash) {
    throw new Error(
      `No file in ${process.cwd()} matched to [${pattern}], make sure you have checked out the target repository`
    );
  }
  return buildCacheKey(packageManager.id, fileHash);
}

/**
 * Computes the cache key for an additional cache. Unlike {@link computeCacheKey}
 * this returns undefined (instead of throwing) when no file matches the pattern,
 * because additional caches are optional features that many projects do not use.
 */
async function computeAdditionalCacheKey(
  additionalCache: AdditionalCache
): Promise<string | undefined> {
  const fileHash = await glob.hashFiles(additionalCache.pattern.join('\n'));
  if (!fileHash) {
    return undefined;
  }
  return buildCacheKey(additionalCache.name, fileHash);
}

/**
 * Restore the dependency cache
 * @param id ID of the package manager, should be "maven" or "gradle"
 * @param cacheDependencyPath The path to a dependency file
 */
export async function restore(id: string, cacheDependencyPath: string) {
  const packageManager = findPackageManager(id);
  const primaryKey = await computeCacheKey(packageManager, cacheDependencyPath);
  core.debug(`primary key is ${primaryKey}`);
  core.saveState(STATE_CACHE_PRIMARY_KEY, primaryKey);
  core.setOutput(STATE_CACHE_PRIMARY_KEY, primaryKey);

  // No "restoreKeys" is set, to start with a clear cache after dependency update (see https://github.com/actions/setup-java/issues/269)
  const matchedKey = await cache.restoreCache(packageManager.path, primaryKey);
  if (matchedKey) {
    core.saveState(CACHE_MATCHED_KEY, matchedKey);
    core.setOutput('cache-hit', matchedKey === primaryKey);
    core.info(`Cache restored from key: ${matchedKey}`);
  } else {
    core.setOutput('cache-hit', false);
    core.info(`${packageManager.id} cache is not found`);
  }

  for (const additionalCache of packageManager.additionalCaches ?? []) {
    await restoreAdditionalCache(additionalCache);
  }
}

/**
 * Restore an additional cache (e.g. a build-tool wrapper distribution) that is
 * keyed independently of the main dependency cache so that it survives changes
 * to volatile dependency files. Skips silently when the project does not use
 * the corresponding feature.
 */
async function restoreAdditionalCache(additionalCache: AdditionalCache) {
  const primaryKey = await computeAdditionalCacheKey(additionalCache);
  if (!primaryKey) {
    core.debug(
      `No file matched [${additionalCache.pattern}] for the ${additionalCache.name} cache, skipping.`
    );
    return;
  }
  core.debug(`${additionalCache.name} primary key is ${primaryKey}`);
  core.saveState(
    additionalCachePrimaryKeyState(additionalCache.name),
    primaryKey
  );

  const matchedKey = await cache.restoreCache(additionalCache.path, primaryKey);
  if (matchedKey) {
    core.saveState(
      additionalCacheMatchedKeyState(additionalCache.name),
      matchedKey
    );
    core.info(`${additionalCache.name} cache restored from key: ${matchedKey}`);
  }
}

/**
 * Save the dependency cache
 * @param id ID of the package manager, should be "maven" or "gradle"
 */
export async function save(id: string) {
  const packageManager = findPackageManager(id);
  const matchedKey = core.getState(CACHE_MATCHED_KEY);

  // Inputs are re-evaluated before the post action, so we want the original key used for restore
  const primaryKey = core.getState(STATE_CACHE_PRIMARY_KEY);

  for (const additionalCache of packageManager.additionalCaches ?? []) {
    await saveAdditionalCache(packageManager, additionalCache);
  }

  if (!primaryKey) {
    core.warning('Error retrieving key from state.');
    return;
  } else if (matchedKey === primaryKey) {
    // no change in target directories
    core.info(
      `Cache hit occurred on the primary key ${primaryKey}, not saving cache.`
    );
    return;
  }
  try {
    const cacheId = await cache.saveCache(packageManager.path, primaryKey);
    if (cacheId === -1) {
      // saveCache returns -1 without throwing when the cache was not saved,
      // e.g. a reserve collision or a read-only token (fork PR). @actions/cache
      // has already logged the reason at the appropriate severity, so just
      // trace it instead of misreporting that the cache was saved.
      core.debug(`Cache was not saved for the key: ${primaryKey}`);
      return;
    }
    core.info(`Cache saved with the key: ${primaryKey}`);
  } catch (error) {
    const err = error as Error;

    if (err.name === cache.ReserveCacheError.name) {
      core.info(err.message);
    } else {
      if (isProbablyGradleDaemonProblem(packageManager, err)) {
        core.warning(
          'Failed to save Gradle cache on Windows. If tar.exe reported "Permission denied", try to run Gradle with `--no-daemon` option. Refer to https://github.com/actions/cache/issues/454 for details.'
        );
      }
      throw error;
    }
  }
}

/**
 * Save an additional cache under its own key. Skips when no key was recorded at
 * restore time (feature unused) or when the exact key was already restored.
 */
async function saveAdditionalCache(
  packageManager: PackageManager,
  additionalCache: AdditionalCache
) {
  const primaryKey = core.getState(
    additionalCachePrimaryKeyState(additionalCache.name)
  );
  const matchedKey = core.getState(
    additionalCacheMatchedKeyState(additionalCache.name)
  );

  if (!primaryKey) {
    // The feature is not used by this project, nothing to save.
    core.debug(
      `No primary key for the ${additionalCache.name} cache, not saving cache.`
    );
    return;
  } else if (matchedKey === primaryKey) {
    core.info(
      `Cache hit occurred on the ${additionalCache.name} primary key ${primaryKey}, not saving cache.`
    );
    return;
  }
  try {
    const cacheId = await cache.saveCache(additionalCache.path, primaryKey);
    if (cacheId === -1) {
      core.debug(
        `${additionalCache.name} cache was not saved for the key: ${primaryKey}`
      );
      return;
    }
    core.info(`${additionalCache.name} cache saved with the key: ${primaryKey}`);
    const err = error as Error;

    if (err.name === cache.ReserveCacheError.name) {
      core.info(err.message);
    } else {
      if (isProbablyGradleDaemonProblem(packageManager, err)) {
        core.warning(
          'Failed to save Gradle cache on Windows. If tar.exe reported "Permission denied", try to run Gradle with `--no-daemon` option. Refer to https://github.com/actions/cache/issues/454 for details.'
        );
      }
      throw error;
    }
  }
}

/**
 * @param packageManager the specified package manager by user
 * @param error the error thrown by the saveCache
 * @returns true if the given error seems related to the {@link https://github.com/actions/cache/issues/454|running Gradle Daemon issue}.
 * @see {@link https://github.com/actions/cache/issues/454#issuecomment-840493935|why --no-daemon is necessary}
 */
function isProbablyGradleDaemonProblem(
  packageManager: PackageManager,
  error: Error
) {
  if (
    packageManager.id !== 'gradle' ||
    process.env['RUNNER_OS'] !== 'Windows'
  ) {
    return false;
  }
  const message = error.message || '';
  return message.startsWith('Tar failed with error: ');
}

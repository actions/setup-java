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

interface PackageManager {
  id: 'maven' | 'gradle' | 'sbt';
  /**
   * Paths of the file that specify the files to cache.
   */
  path: string[];
  pattern: string[];
}
const supportedPackageManager: PackageManager[] = [
  {
    id: 'maven',
    path: [join(os.homedir(), '.m2', 'repository')],
    // https://github.com/actions/cache/blob/0638051e9af2c23d10bb70fa9beffcad6cff9ce3/examples.md#java---maven
    pattern: ['**/pom.xml']
  },
  {
    id: 'gradle',
    path: [
      join(os.homedir(), '.gradle', 'caches'),
      join(os.homedir(), '.gradle', 'wrapper')
    ],
    // https://github.com/actions/cache/blob/0638051e9af2c23d10bb70fa9beffcad6cff9ce3/examples.md#java---gradle
    pattern: [
      '**/*.gradle*',
      '**/gradle-wrapper.properties',
      'buildSrc/**/Versions.kt',
      'buildSrc/**/Dependencies.kt',
      'gradle/*.versions.toml'
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
 * A function that generates a cache key to use.
 * Format of the generated key will be "${{ platform }}-${{ id }}-${{ fileHash }}"".
 * If there is no file matched to {@link PackageManager.path}, the generated key ends with a dash (-).
 * @see {@link https://docs.github.com/en/actions/guides/caching-dependencies-to-speed-up-workflows#matching-a-cache-key|spec of cache key}
 */
async function computeCacheKey(packageManager: PackageManager) {
  const hash = await glob.hashFiles(packageManager.pattern.join('\n'));
  return `${CACHE_KEY_PREFIX}-${process.env['RUNNER_OS']}-${packageManager.id}-${hash}`;
}

/**
 * Restore the dependency cache
 * @param id ID of the package manager, should be "maven" or "gradle"
 */
export async function restore(id: string) {
  const packageManager = findPackageManager(id);
  const primaryKey = await computeCacheKey(packageManager);

  core.debug(`primary key is ${primaryKey}`);
  core.saveState(STATE_CACHE_PRIMARY_KEY, primaryKey);
  if (primaryKey.endsWith('-')) {
    throw new Error(
      `No file in ${process.cwd()} matched to [${
        packageManager.pattern
      }], make sure you have checked out the target repository`
    );
  }

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
    await cache.saveCache(packageManager.path, primaryKey);
    core.info(`Cache saved with the key: ${primaryKey}`);
  } catch (error) {
    if (error.name === cache.ReserveCacheError.name) {
      core.info(error.message);
    } else {
      if (isProbablyGradleDaemonProblem(packageManager, error)) {
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

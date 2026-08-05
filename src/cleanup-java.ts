import * as core from '@actions/core';
import * as gpg from './gpg.js';
import * as constants from './constants.js';
import {
  getBooleanInput,
  isJdkCacheEnabled,
  isJobStatusSuccess
} from './util.js';
import {fileURLToPath} from 'url';

async function removeGpgHome() {
  const gpgHome = core.getState(constants.STATE_GPG_HOME);
  if (!gpgHome) {
    return;
  }

  core.info('Removing private key from isolated GPG home');
  try {
    await gpg.removeGpgHome(gpgHome);
  } catch (error) {
    core.setFailed(
      `Failed to remove isolated GPG home due to: ${(error as Error).message}`
    );
  }
}

/**
 * Check given input and run a save process for the specified package manager
 * @returns Promise that will be resolved when the save process finishes
 */
async function saveCaches() {
  const jobStatus = isJobStatusSuccess();
  const cache = core.getInput(constants.INPUT_CACHE);
  const cacheJdk = isJdkCacheEnabled(cache);
  if (!jobStatus || (!cache && !cacheJdk)) {
    return;
  }

  if (getBooleanInput(constants.INPUT_CACHE_READ_ONLY, false)) {
    core.info('Cache saving is skipped because cache-read-only is enabled.');
    return;
  }

  const saves: Promise<void>[] = [];
  if (cache) {
    const {save} = await import('./cache.js');
    saves.push(save(cache));
  }
  if (cacheJdk) {
    const {saveJdkCaches} = await import('./jdk-cache.js');
    const {saveJdkResolutionCaches} = await import('./jdk-resolution-cache.js');
    saves.push(saveJdkCaches());
    saves.push(saveJdkResolutionCaches());
  }
  await Promise.all(saves);
}

/**
 * The save process is best-effort, and it should not make the workflow fail
 * even though this process throws an error.
 * @param promise the promise to ignore error from
 * @returns Promise that will ignore error reported by the given promise
 */
async function ignoreError(promise: Promise<void>) {
  return new Promise(resolve => {
    promise
      .catch(error => {
        core.warning(error);
        resolve(void 0);
      })
      .then(resolve);
  });
}

export async function run() {
  await removeGpgHome();
  await ignoreError(saveCaches());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
} else {
  // https://nodejs.org/api/modules.html#modules_accessing_the_main_module
  core.info('the script is loaded as a module, so skipping the execution');
}

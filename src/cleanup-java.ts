import * as core from '@actions/core';
import * as gpg from './gpg.js';
import * as constants from './constants.js';
import {getBooleanInput, isJobStatusSuccess} from './util.js';
import {fileURLToPath} from 'url';

async function removePrivateKeyFromKeychain() {
  if (core.getInput(constants.INPUT_GPG_PRIVATE_KEY, {required: false})) {
    core.info('Removing private key from keychain');
    try {
      const keyFingerprint = core.getState(
        constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT
      );
      await gpg.deleteKey(keyFingerprint);
    } catch (error) {
      core.setFailed(
        `Failed to remove private key due to: ${(error as Error).message}`
      );
    }
  }
}

/**
 * Check given input and run a save process for the specified package manager
 * @returns Promise that will be resolved when the save process finishes
 */
async function saveCache() {
  const jobStatus = isJobStatusSuccess();
  const cache = core.getInput(constants.INPUT_CACHE);
  if (!jobStatus || !cache) {
    return;
  }

  if (getBooleanInput(constants.INPUT_CACHE_READ_ONLY, false)) {
    core.info('Cache saving is skipped because cache-read-only is enabled.');
    return;
  }

  const {save} = await import('./cache.js');
  await save(cache);
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
  await removePrivateKeyFromKeychain();
  await ignoreError(saveCache());
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
} else {
  // https://nodejs.org/api/modules.html#modules_accessing_the_main_module
  core.info('the script is loaded as a module, so skipping the execution');
}

import * as core from '@actions/core';
import * as gpg from './gpg';
import * as constants from './constants';
import {isJobStatusSuccess} from './util';
import {save} from './cache';

async function removePrivateKeyFromKeychain() {
  if (core.getInput(constants.INPUT_GPG_PRIVATE_KEY, {required: false})) {
    core.info('Removing private key from keychain');
    try {
      const keyFingerprint = core.getState(
        constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT
      );
      await gpg.deleteKey(keyFingerprint);
    } catch (error) {
      core.setFailed(`Failed to remove private key due to: ${error.message}`);
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
  return jobStatus && cache ? save(cache) : Promise.resolve();
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

if (require.main === module) {
  run();
} else {
  // https://nodejs.org/api/modules.html#modules_accessing_the_main_module
  core.info('the script is loaded as a module, so skipping the execution');
}

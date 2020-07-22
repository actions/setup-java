import * as core from '@actions/core';
import * as gpg from './gpg';
import * as constants from './constants';

async function run() {
  if (core.getInput(constants.INPUT_GPG_PRIVATE_KEY, {required: false})) {
    core.info('removing private key from keychain');
    try {
      const keyFingerprint = core.getState(
        constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT
      );
      await gpg.deleteKey(keyFingerprint);
    } catch (error) {
      core.setFailed('failed to remove private key');
    }
  }
}

run();

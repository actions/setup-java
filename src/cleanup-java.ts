import * as core from '@actions/core';
import * as gpg from './gpg';

async function run() {
  if (core.getInput('gpg-private-key', {required: false})) {
    console.log('removing private key from keychain');
    try {
      const keyFingerprint = core.getState('gpg-private-key-fingerprint');
      await gpg.deleteKey(keyFingerprint);
    } catch (error) {
      core.setFailed(error.message);
    }
  }
}

run();

import * as core from '@actions/core';
import * as installer from './installer';
import * as auth from './auth';
import * as gpg from './gpg';
import * as path from 'path';

const DEFAULT_ID = 'github';
const DEFAULT_USERNAME = 'GITHUB_ACTOR';
const DEFAULT_PASSWORD = 'GITHUB_TOKEN';
const DEFAULT_GPG_PRIVATE_KEY = undefined;
const DEFAULT_GPG_PASSPHRASE = 'GPG_PASSPHRASE';

async function run() {
  try {
    // Set secrets before use
    core.setSecret('gpg-private-key');

    let version = core.getInput('version');
    if (!version) {
      version = core.getInput('java-version', {required: true});
    }
    const arch = core.getInput('architecture', {required: true});
    const javaPackage = core.getInput('java-package', {required: true});
    const jdkFile = core.getInput('jdkFile', {required: false}) || '';

    await installer.getJava(version, arch, jdkFile, javaPackage);

    const matchersPath = path.join(__dirname, '..', '..', '.github');
    console.log(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    const id = core.getInput('server-id', {required: false}) || DEFAULT_ID;
    const username =
      core.getInput('server-username', {required: false}) || DEFAULT_USERNAME;
    const password =
      core.getInput('server-password', {required: false}) || DEFAULT_PASSWORD;
    const gpgPrivateKey =
      core.getInput('gpg-private-key', {required: false}) ||
      DEFAULT_GPG_PRIVATE_KEY;
    const gpgPassphrase =
      core.getInput('gpg-passphrase', {required: false}) ||
      (gpgPrivateKey ? DEFAULT_GPG_PASSPHRASE : undefined);

    await auth.configAuthentication(id, username, password, gpgPassphrase);

    if (gpgPrivateKey) {
      console.log('importing private key');
      const keyFingerprint = (await gpg.importKey(gpgPrivateKey)) || '';
      core.saveState('gpg-private-key-fingerprint', keyFingerprint);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

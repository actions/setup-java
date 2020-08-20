import * as core from '@actions/core';
import * as installer from './installer';
import * as auth from './auth';
import * as gpg from './gpg';
import * as constants from './constants';
import * as path from 'path';

async function run() {
  try {
    let version = core.getInput(constants.INPUT_VERSION);
    if (!version) {
      version = core.getInput(constants.INPUT_JAVA_VERSION, {required: true});
    }

    const arch = core.getInput(constants.INPUT_ARCHITECTURE, {required: true});
    if (!['x86', 'x64'].includes(arch)) {
      throw new Error(`architecture "${arch}" is not in [x86 | x64]`);
    }

    const javaPackage = core.getInput(constants.INPUT_JAVA_PACKAGE, {
      required: true
    });
    const jdkFile = core.getInput(constants.INPUT_JDK_FILE, {required: false});

    await installer.getJava(version, arch, jdkFile, javaPackage);

    const matchersPath = path.join(__dirname, '..', '..', '.github');
    core.info(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    const id = core.getInput(constants.INPUT_SERVER_ID, {required: false});
    const username = core.getInput(constants.INPUT_SERVER_USERNAME, {
      required: false
    });
    const password = core.getInput(constants.INPUT_SERVER_PASSWORD, {
      required: false
    });
    const gpgPrivateKey =
      core.getInput(constants.INPUT_GPG_PRIVATE_KEY, {required: false}) ||
      constants.INPUT_DEFAULT_GPG_PRIVATE_KEY;
    const gpgPassphrase =
      core.getInput(constants.INPUT_GPG_PASSPHRASE, {required: false}) ||
      (gpgPrivateKey ? constants.INPUT_DEFAULT_GPG_PASSPHRASE : undefined);

    if (gpgPrivateKey) {
      core.setSecret(gpgPrivateKey);
    }

    await auth.configAuthentication(id, username, password, gpgPassphrase);

    if (gpgPrivateKey) {
      core.info('importing private key');
      const keyFingerprint = (await gpg.importKey(gpgPrivateKey)) || '';
      core.saveState(
        constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT,
        keyFingerprint
      );
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

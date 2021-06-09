import * as core from '@actions/core';
import * as installer from './installer';
import * as auth from './auth';
import * as gpg from './gpg';
import * as constants from './constants';
import * as path from 'path';
import {MavenOpts, isValidOptions} from './maven';

async function run() {
  try {
    let version = core.getInput(constants.INPUT_VERSION);
    if (!version) {
      version = core.getInput(constants.INPUT_JAVA_VERSION, {required: true});
    }

    let mvnOpts: MavenOpts | undefined = {
      caCert: core.getInput(constants.INPUT_MAVEN_CA_CERT_B64),
      keystore: core.getInput(constants.INPUT_MAVEN_KEYSTORE_P12_B64),
      password: core.getInput(constants.INPUT_MAVEN_KEYSTORE_PASSWORD),
      settings: core.getInput(constants.INPUT_MAVEN_SETTINGS_B64),
      securitySettings: core.getInput(
        constants.INPUT_MAVEN_SECURITY_SETTINGS_B64
      ),
      javaPath: '',
      javaVersion: version
    };

    const mvnVersion = core.getInput(constants.INPUT_MAVEN_VERSION);

    const arch = core.getInput(constants.INPUT_ARCHITECTURE, {required: true});
    if (!['x86', 'x64'].includes(arch)) {
      throw new Error(`architecture "${arch}" is not in [x86 | x64]`);
    }

    const javaPackage = core.getInput(constants.INPUT_JAVA_PACKAGE, {
      required: true
    });
    const jdkFile = core.getInput(constants.INPUT_JDK_FILE, {required: false});

    const javaPath = await installer.getJava(
      version,
      arch,
      jdkFile,
      javaPackage
    );
    if (mvnVersion !== '') {
      if (!isValidOptions(mvnOpts)) {
        throw new Error(
          'Some of the Maven options is empty: please check maven-* parameters'
        );
      }
      mvnOpts.javaPath = javaPath;

      await installer.getMaven(mvnVersion);
    } else {
      mvnOpts = undefined;
    }

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

    await auth.configAuthentication(
      id,
      username,
      password,
      gpgPassphrase,
      mvnOpts
    );

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

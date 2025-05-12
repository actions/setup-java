import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

import * as fs from 'fs';
import * as os from 'os';

import {create as xmlCreate} from 'xmlbuilder2';
import * as constants from './constants';
import * as gpg from './gpg';
import {getBooleanInput} from './util';
import {MvnSettingDefinition} from './mvn.setting.definition';

export async function configureAuthentication() {
  const numMvnRepos = core.getInput(constants.INPUT_NUM_MVN_REPOS);
  const mvnSettings: Array<MvnSettingDefinition> = [];
  const settingsDirectory =
    core.getInput(constants.INPUT_SETTINGS_PATH) ||
    path.join(os.homedir(), constants.M2_DIR);
  const overwriteSettings = getBooleanInput(
    constants.INPUT_OVERWRITE_SETTINGS,
    true
  );
  let gpgPrivateKey;
  if (numMvnRepos === '' || core.getInput(constants.INPUT_GPG_PRIVATE_KEY)) {
    gpgPrivateKey = populateMvnSettings(mvnSettings);
  } else {
    for (let i = 0; i < parseInt(numMvnRepos); i++) {
      populateMvnSettings(mvnSettings, i);
    }
  }

  await createAuthenticationSettings(
    mvnSettings,
    settingsDirectory,
    overwriteSettings
  );

  if (gpgPrivateKey) {
    core.info('Importing private gpg key');
    const keyFingerprint = (await gpg.importKey(gpgPrivateKey)) || '';
    core.saveState(constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT, keyFingerprint);
  }
}

function populateMvnSettings(
  mvnSettings: Array<MvnSettingDefinition>,
  idx = -1
): string | undefined {
  const id = core.getInput(getIndexedInputName(constants.INPUT_SERVER_ID, idx));
  const username = core.getInput(
    getIndexedInputName(constants.INPUT_SERVER_USERNAME, idx)
  );
  const password = core.getInput(
    getIndexedInputName(constants.INPUT_SERVER_PASSWORD, idx)
  );
  if (username !== '' && password !== '') {
    mvnSettings.push({id: id, username: username, password: password});
  }

  if (idx === -1) {
    const gpgPrivateKey =
      core.getInput(
        getIndexedInputName(constants.INPUT_GPG_PRIVATE_KEY, idx)
      ) || constants.INPUT_DEFAULT_GPG_PRIVATE_KEY;
    const gpgPassphrase =
      core.getInput(getIndexedInputName(constants.INPUT_GPG_PASSPHRASE, idx)) ||
      (gpgPrivateKey ? constants.INPUT_DEFAULT_GPG_PASSPHRASE : undefined);

    if (gpgPrivateKey) {
      core.setSecret(gpgPrivateKey);
    }

    if (gpgPassphrase) {
      mvnSettings.push({id: 'gpg.passphrase', gpgPassphrase: gpgPassphrase});
      return gpgPrivateKey;
    }
  }

  return undefined;
}

function getIndexedInputName(inputName: string, idx: number): string {
  return inputName + (idx >= 0 ? '-' + idx : '');
}

export async function createAuthenticationSettings(
  mvnSettings: Array<MvnSettingDefinition>,
  settingsDirectory: string,
  overwriteSettings: boolean
) {
  core.info(`Creating ${constants.MVN_SETTINGS_FILE}`);
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  await io.mkdirP(settingsDirectory);
  await write(settingsDirectory, generate(mvnSettings), overwriteSettings);
}

// only exported for testing purposes
export function generate(mvnSettings: Array<MvnSettingDefinition>) {
  const xmlObj: {[key: string]: any} = {
    settings: {
      '@xmlns': 'http://maven.apache.org/SETTINGS/1.0.0',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation':
        'http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd',
      servers: {
        server: []
      }
    }
  };

  mvnSettings.forEach(mvnSetting => {
    if (mvnSetting.username && mvnSetting.password) {
      xmlObj.settings.servers.server.push({
        id: mvnSetting.id,
        username: `\${env.${mvnSetting.username}}`,
        password: `\${env.${mvnSetting.password}}`
      });
    }

    if (mvnSetting.gpgPassphrase) {
      xmlObj.settings.servers.server.push({
        id: mvnSetting.id,
        passphrase: `\${env.${mvnSetting.gpgPassphrase}}`
      });
    }
  });

  return xmlCreate(xmlObj).end({
    headless: true,
    prettyPrint: true,
    width: 80
  });
}

async function write(
  directory: string,
  settings: string,
  overwriteSettings: boolean
) {
  const location = path.join(directory, constants.MVN_SETTINGS_FILE);
  const settingsExists = fs.existsSync(location);
  if (settingsExists && overwriteSettings) {
    core.info(`Overwriting existing file ${location}`);
  } else if (!settingsExists) {
    core.info(`Writing to ${location}`);
  } else {
    core.info(
      `Skipping generation ${location} because file already exists and overwriting is not required`
    );
    return;
  }

  return fs.writeFileSync(location, settings, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

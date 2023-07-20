import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

import * as fs from 'fs';
import * as os from 'os';

import {create as xmlCreate} from 'xmlbuilder2';
import * as constants from './constants';
import * as gpg from './gpg';
import {getBooleanInput} from './util';

export async function configureAuthentication() {
  const id = core.getInput(constants.INPUT_SERVER_ID);
  const username = core.getInput(constants.INPUT_SERVER_USERNAME);
  const password = core.getInput(constants.INPUT_SERVER_PASSWORD);
  const settingsDirectory =
    core.getInput(constants.INPUT_SETTINGS_PATH) ||
    path.join(os.homedir(), constants.M2_DIR);
  const overwriteSettings = getBooleanInput(
    constants.INPUT_OVERWRITE_SETTINGS,
    true
  );
  const gpgPrivateKey =
    core.getInput(constants.INPUT_GPG_PRIVATE_KEY) ||
    constants.INPUT_DEFAULT_GPG_PRIVATE_KEY;
  const gpgPassphrase =
    core.getInput(constants.INPUT_GPG_PASSPHRASE) ||
    (gpgPrivateKey ? constants.INPUT_DEFAULT_GPG_PASSPHRASE : undefined);

  if (gpgPrivateKey) {
    core.setSecret(gpgPrivateKey);
  }

  await createAuthenticationSettings(
    id,
    username,
    password,
    settingsDirectory,
    overwriteSettings,
    gpgPassphrase
  );

  if (gpgPrivateKey) {
    core.info('Importing private gpg key');
    const keyFingerprint = (await gpg.importKey(gpgPrivateKey)) || '';
    core.saveState(constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT, keyFingerprint);
  }
}

export async function createAuthenticationSettings(
  id: string,
  username: string,
  password: string,
  settingsDirectory: string,
  overwriteSettings: boolean,
  gpgPassphrase: string | undefined = undefined
) {
  core.info(`Creating ${constants.MVN_SETTINGS_FILE} with server-id: ${id}`);
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  await io.mkdirP(settingsDirectory);
  await write(
    settingsDirectory,
    generate(id, username, password, gpgPassphrase),
    overwriteSettings
  );
}

// only exported for testing purposes
export function generate(
  id: string,
  username: string,
  password: string,
  gpgPassphrase?: string | undefined
) {
  const xmlObj: {[key: string]: any} = {
    settings: {
      '@xmlns': 'http://maven.apache.org/SETTINGS/1.0.0',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation':
        'http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd',
      servers: {
        server: [
          {
            id: id,
            username: `\${env.${username}}`,
            password: `\${env.${password}}`
          }
        ]
      }
    }
  };

  if (gpgPassphrase) {
    const gpgServer = {
      id: 'gpg.passphrase',
      passphrase: `\${env.${gpgPassphrase}}`
    };
    xmlObj.settings.servers.server.push(gpgServer);
  }

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

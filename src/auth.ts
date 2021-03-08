import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

import * as fs from 'fs';
import * as os from 'os';

import { create as xmlCreate } from 'xmlbuilder2';
import * as constants from './constants';
import * as gpg from './gpg';

export const M2_DIR = '.m2';
export const SETTINGS_FILE = 'settings.xml';

export async function configureAuthentication() {
  const id = core.getInput(constants.INPUT_SERVER_ID);
  const username = core.getInput(constants.INPUT_SERVER_USERNAME);
  const password = core.getInput(constants.INPUT_SERVER_PASSWORD);
  const gpgPrivateKey =
    core.getInput(constants.INPUT_GPG_PRIVATE_KEY) || constants.INPUT_DEFAULT_GPG_PRIVATE_KEY;
  const gpgPassphrase =
    core.getInput(constants.INPUT_GPG_PASSPHRASE) ||
    (gpgPrivateKey ? constants.INPUT_DEFAULT_GPG_PASSPHRASE : undefined);

  if (gpgPrivateKey) {
    core.setSecret(gpgPrivateKey);
  }

  await createAuthenticationSettings(id, username, password, gpgPassphrase);

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
  gpgPassphrase: string | undefined = undefined
) {
  core.info(
    `Creating ${SETTINGS_FILE} with server-id: ${id};
     environment variables:
     username=\$${username},
     password=\$${password},
     and gpg-passphrase=${gpgPassphrase ? '$' + gpgPassphrase : null}`
  );
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  const settingsDirectory: string = path.join(
    core.getInput(constants.INPUT_SETTINGS_PATH) || os.homedir(),
    core.getInput(constants.INPUT_SETTINGS_PATH) ? '' : M2_DIR
  );
  await io.mkdirP(settingsDirectory);
  await write(settingsDirectory, generate(id, username, password, gpgPassphrase));
}

// only exported for testing purposes
export function generate(
  id: string,
  username: string,
  password: string,
  gpgPassphrase?: string | undefined
) {
  const xmlObj: { [key: string]: any } = {
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

async function write(directory: string, settings: string) {
  const location = path.join(directory, SETTINGS_FILE);
  if (fs.existsSync(location)) {
    core.warning(`Overwriting existing file ${location}`);
  } else {
    core.info(`Writing ${location}`);
  }

  return fs.writeFileSync(location, settings, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

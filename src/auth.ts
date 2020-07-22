import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import {create as xmlCreate} from 'xmlbuilder2';
import * as constants from './constants';

export const M2_DIR = '.m2';
export const SETTINGS_FILE = 'settings.xml';

export async function configAuthentication(
  id: string,
  username: string,
  password: string,
  gpgPassphrase: string | undefined = undefined
) {
  console.log(
    `creating ${SETTINGS_FILE} with server-id: ${id};`,
    'environment variables:',
    `username=\$${username},`,
    `password=\$${password},`,
    `and gpg-passphrase=${gpgPassphrase ? '$' + gpgPassphrase : null}`
  );
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  const settingsDirectory: string = path.join(
    core.getInput(constants.INPUT_SETTINGS_PATH) || os.homedir(),
    core.getInput(constants.INPUT_SETTINGS_PATH) ? '' : M2_DIR
  );
  await io.mkdirP(settingsDirectory);
  core.debug(`created directory ${settingsDirectory}`);
  await write(
    settingsDirectory,
    generate(id, username, password, gpgPassphrase)
  );
}

// only exported for testing purposes
export function generate(
  id: string,
  username: string,
  password: string,
  gpgPassphrase: string | undefined = undefined
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

  return xmlCreate(xmlObj).end({headless: true, prettyPrint: true, width: 80});
}

async function write(directory: string, settings: string) {
  const location = path.join(directory, SETTINGS_FILE);
  if (fs.existsSync(location)) {
    console.warn(`overwriting existing file ${location}`);
  } else {
    console.log(`writing ${location}`);
  }

  return fs.writeFileSync(location, settings, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

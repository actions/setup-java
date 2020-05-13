import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as util from './util';
import {create as xmlCreate} from 'xmlbuilder2';

export const M2_DIR = '.m2';
export const TEMP_DIR = util.getTempDir();
export const GPG_HOME_DIR = path.join(TEMP_DIR, '.gnupg').replace(/\\/g, '/'); // Enforce posix path
export const SETTINGS_FILE = 'settings.xml';
export const PRIVATE_KEY_FILE = 'private-key.asc';

export const DEFAULT_ID = 'github';
export const DEFAULT_USERNAME = 'GITHUB_ACTOR';
export const DEFAULT_PASSWORD = 'GITHUB_TOKEN';
export const DEFAULT_GPG_PRIVATE_KEY = '';
export const DEFAULT_GPG_PASSPHRASE = 'GPG_PASSPHRASE';

export async function configAuthentication(
  id = DEFAULT_ID,
  username = DEFAULT_USERNAME,
  password = DEFAULT_PASSWORD,
  gpgPrivateKey = DEFAULT_GPG_PRIVATE_KEY,
  gpgPassphrase = DEFAULT_GPG_PASSPHRASE
) {
  console.log(
    `creating ${SETTINGS_FILE} with server-id: ${id};`,
    'environment variables:',
    `username=\$${username},`,
    `password=\$${password},`,
    `and gpg-passphrase=\$${gpgPassphrase}`
  );
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  const settingsDirectory: string = path.join(
    core.getInput('settings-path') || os.homedir(),
    core.getInput('settings-path') ? '' : M2_DIR
  );
  await io.mkdirP(settingsDirectory);
  core.debug(`created directory ${settingsDirectory}`);
  const isGpgEnabled = gpgPrivateKey !== DEFAULT_GPG_PRIVATE_KEY;
  await write(
    settingsDirectory,
    SETTINGS_FILE,
    generate(id, username, password, isGpgEnabled ? gpgPassphrase : null)
  );

  if (gpgPrivateKey !== DEFAULT_GPG_PRIVATE_KEY) {
    console.log('importing gpg key');
    await importGPG(gpgPrivateKey);
  }
}

// only exported for testing purposes
export function generate(
  id: string,
  username: string,
  password: string,
  gpgPassphrase: string | null = null
) {
  const xmlObj: any = {
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

  if (gpgPassphrase !== null) {
    const gpgServer = {
      id: 'gpg.passphrase',
      passphrase: `\${env.${gpgPassphrase}}`
    };
    xmlObj.settings.servers.server.push(gpgServer);

    xmlObj.settings.profiles = {
      profile: [
        {
          activation: {
            activeByDefault: true
          },
          properties: {
            'gpg.homedir': GPG_HOME_DIR
          }
        }
      ]
    };
  }

  return xmlCreate(xmlObj).end({headless: true, prettyPrint: true, width: 80});
}

async function write(directory: string, file: string, contents: string) {
  const location = path.join(directory, file);
  if (fs.existsSync(location)) {
    console.warn(`overwriting existing file ${location}`);
  } else {
    console.log(`writing ${location}`);
  }

  return fs.writeFileSync(location, contents, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

async function remove(path: string) {
  console.log(`removing ${path}`);
  return io.rmRF(path);
}

async function importGPG(gpgPrivateKey: string) {
  await write(TEMP_DIR, PRIVATE_KEY_FILE, gpgPrivateKey);
  await exec.exec(
    'gpg',
    ['--homedir', GPG_HOME_DIR, '--import', '--batch', PRIVATE_KEY_FILE],
    {
      cwd: TEMP_DIR
    }
  );
  await remove(path.join(TEMP_DIR, PRIVATE_KEY_FILE));
}

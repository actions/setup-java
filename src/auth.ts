import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';

export const M2_DIR = '.m2';
export const SETTINGS_FILE = 'settings.xml';
export const GPG_DIR = '.gpgtmp';
export const GPG_FILE = 'private.asc';

export const DEFAULT_ID = 'github';
export const DEFAULT_USERNAME = 'GITHUB_ACTOR';
export const DEFAULT_PASSWORD = 'GITHUB_TOKEN';
export const DEFAULT_GPG_PASSPHRASE = 'GPG_PASSPHRASE';
export const DEFAULT_GPG_PRIVATE_KEY = '';

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
  await write(
    settingsDirectory,
    SETTINGS_FILE,
    generate(id, username, password, gpgPassphrase)
  );

  if (gpgPrivateKey !== DEFAULT_GPG_PRIVATE_KEY) {
    console.log('importing gpg key');
    const gpgDirectory: string = path.join(os.homedir(), GPG_DIR);
    await io.mkdirP(gpgDirectory);
    core.debug(`created directory ${gpgDirectory}`);
    await write(gpgDirectory, GPG_FILE, gpgPrivateKey);
    await importGpgKey(gpgDirectory, GPG_FILE);
    await io.rmRF(gpgDirectory);
    core.debug(`removed directory ${gpgDirectory}`);
  }
}

function escapeXML(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// only exported for testing purposes
export function generate(
  id = DEFAULT_ID,
  username = DEFAULT_USERNAME,
  password = DEFAULT_PASSWORD,
  gpgPassphrase = DEFAULT_GPG_PASSPHRASE
) {
  return `
  <settings>
      <servers>
        <server>
          <id>${escapeXML(id)}</id>
          <username>\${env.${escapeXML(username)}}</username>
          <password>\${env.${escapeXML(password)}}</password>
        </server>
      </servers>
      <profiles>
        <profile>
          <activation>
            <activeByDefault>true</activeByDefault>
          </activation>
          <properties>
            <gpg.passphrase>\${env.${escapeXML(gpgPassphrase)}}</gpg.passphrase>
          </properties>
        </profile>
      </profiles>
  </settings>
  `;
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

async function importGpgKey(directory: string, file: string) {
  const location = path.join(directory, file);
  exec.exec(`gpg --import --batch ${location}`);
}

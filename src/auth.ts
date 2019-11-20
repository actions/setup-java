import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

export const M2_DIR = '.m2';
export const SETTINGS_FILE = 'settings.xml';

export async function configAuthentication(username: string, password: string) {
  if (username && password) {
    core.debug(`configAuthentication with ${username} and a password`);
    const directory: string = path.join(os.homedir(), M2_DIR);
    await io.mkdirP(directory);
    core.debug(`created directory ${directory}`);
    await write(directory, generate(username, password));
  } else {
    core.debug(
      `no auth without username: ${username} and password: ${password}`
    );
  }
}

// only exported for testing purposes
export function generate(username: string, password: string) {
  return `
  <settings>
      <servers>
        <server>
          <username>${username}</username>
          <password>${password}</password>
        </server>
      </servers>
  </settings>
  `;
}

async function write(directory: string, settings: string) {
  const options = {encoding: 'utf-8'};
  const location = path.join(directory, SETTINGS_FILE);
  core.debug(`writing ${location}`);
  return fs.writeFileSync(location, settings, options);
}

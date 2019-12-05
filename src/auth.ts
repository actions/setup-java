import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

export const M2_DIR = '.m2';
export const SETTINGS_FILE = 'settings.xml';

export async function configAuthentication(
  id: string,
  username: string,
  password: string
) {
  if (id && username && password) {
    console.log(
      `creating ${SETTINGS_FILE} with server-id: ${id}, username: ${username}, and a password`
    );
    const home: string = process.env['GITHUB_WORKSPACE'] || os.homedir();
    const directory: string = path.join(home, M2_DIR);
    await io.mkdirP(directory);
    core.debug(`created directory ${directory}`);
    await write(directory, generate(id, username, password));
  } else {
    core.debug(
      `no ${SETTINGS_FILE} without server-id: ${id}, username: ${username}, and a password`
    );
  }
}

// only exported for testing purposes
export function generate(id: string, username: string, password: string) {
  return `
  <settings>
      <servers>
        <server>
          <id>${id}</id>
          <username>${username}</username>
          <password>${password}</password>
        </server>
      </servers>
  </settings>
  `;
}

async function write(directory: string, settings: string) {
  const options = {encoding: 'utf-8', flag: 'wx'}; // 'wx': Like 'w' but fails if path exists
  const location = path.join(directory, SETTINGS_FILE);
  console.log(`writing ${location} with options ${options}`);
  try {
    fs.writeFileSync(location, settings, options);
  } catch (e) {
    if (e.code == fs.constants.O_EXCL) {
      console.log(`overwriting existing file ${location}`);
      // default flag is 'w'
      return fs.writeFileSync(location, settings, {encoding: 'utf-8'});
    }
    throw e;
  }
}

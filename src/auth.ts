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
    // when an alternate m2 location is specified use only that location (no .m2 directory)
    // otherwise use the home/.m2/ path
    const directory: string = path.join(
      core.getInput('m2-home') || os.homedir(),
      core.getInput('m2-home') ? '' : M2_DIR
    );
    await io.mkdirP(directory);
    core.debug(`created directory ${directory}`);
    await write(directory, generate(id, username, password));
  } else {
    core.debug(
      `no ${SETTINGS_FILE} without server-id: ${id}, username: ${username}, and a password`
    );
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
export function generate(id: string, username: string, password: string) {
  return `
  <settings>
      <servers>
        <server>
          <id>${escapeXML(id)}</id>
          <username>${escapeXML(username)}</username>
          <password>${escapeXML(password)}</password>
        </server>
      </servers>
  </settings>
  `;
}

async function write(directory: string, settings: string) {
  const options = {encoding: 'utf-8', flag: 'wx'}; // 'wx': Like 'w' but fails if path exists
  const location = path.join(directory, SETTINGS_FILE);
  console.log(`writing ${location}`);
  try {
    return fs.writeFileSync(location, settings, options);
  } catch (e) {
    if (e.code == 'EEXIST') {
      console.warn(`overwriting existing file ${location}`);
      return fs.writeFileSync(location, settings, {
        encoding: 'utf-8',
        flag: 'w'
      });
    }
    throw e;
  }
}

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

export async function configAuthentication(username: string, password: string) {
  const directory: string = path.join(os.homedir(), '.m2');
  await io.mkdirP(directory);
  await write(directory, generate(username, password));
}

// only exported for testing purposes
export function generate(
  username = '${actions.username}',
  password = '${actions.password}'
) {
  return `<settings>
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
  return fs.writeFileSync(path.join(directory, 'settings.xml'), settings);
}

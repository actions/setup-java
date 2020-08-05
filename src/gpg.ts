import * as fs from 'fs';
import * as path from 'path';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as util from './util';
import {ExecOptions} from '@actions/exec/lib/interfaces';

export const PRIVATE_KEY_FILE = path.join(util.getTempDir(), 'private-key.asc');

const PRIVATE_KEY_FINGERPRINT_REGEX = /\w{40}/;

export async function importKey(privateKey: string) {
  fs.writeFileSync(PRIVATE_KEY_FILE, privateKey, {
    encoding: 'utf-8',
    flag: 'w'
  });

  const keyFingerprint = await importKeyFromPath(PRIVATE_KEY_FILE);

  await io.rmRF(PRIVATE_KEY_FILE);

  return keyFingerprint;
}

export async function importKeyFromPath(privateKeyPath: string) {
  console.log(`from path: ${privateKeyPath}`);
  let output = '';

  const options: ExecOptions = {
    silent: true,
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      }
    }
  };

  await exec.exec(
    'gpg',
    ['--batch', '--import-options', 'import-show', '--import', privateKeyPath],
    options
  );

  const match = output.match(PRIVATE_KEY_FINGERPRINT_REGEX);
  return match && match[0];
}

export async function deleteKey(keyFingerprint: string) {
  await exec.exec(
    'gpg',
    ['--batch', '--yes', '--delete-secret-keys', keyFingerprint],
    {silent: true}
  );
  await exec.exec(
    'gpg',
    ['--batch', '--yes', '--delete-keys', keyFingerprint],
    {silent: true}
  );
}

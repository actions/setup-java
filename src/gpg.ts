import * as fs from 'fs';
import * as path from 'path';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as util from './util';
import {ExecOptions} from '@actions/exec/lib/interfaces';

export const PRIVATE_KEY_FILE = path.join(util.getTempDir(), 'private-key.asc');

const PRIVATE_KEY_FINGERPRINT_REGEX = /\w{40}/;

export async function importKey(privateKey: string) {
  fs.writeFileSync(PRIVATE_KEY_FILE, privateKey, {
    encoding: 'utf-8',
    flag: 'w'
  });

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
    [
      '--batch',
      '--import-options',
      'import-show',
      '--import',
      PRIVATE_KEY_FILE
    ],
    options
  );

  await io.rmRF(PRIVATE_KEY_FILE);

  const match = output.match(PRIVATE_KEY_FINGERPRINT_REGEX);
  return match && match[0];
}

export async function deleteKey(keyFingerprint: string) {
  await exec.exec(
    'gpg',
    ['--batch', '--yes', '--delete-secret-and-public-key', keyFingerprint],
    {
      silent: true
    }
  );
}

export async function verifyPackageSignature(
  archivePath: string,
  signatureUrl: string,
  publicKeyContent: string
) {
  const signaturePath = await tc.downloadTool(signatureUrl);
  let gpgHome: string;
  try {
    gpgHome = fs.mkdtempSync(
      path.join(util.getTempDir(), 'verify-signature-gpg-home-')
    );
  } catch (error) {
    throw new Error(
      `Failed to create temporary GPG home directory for signature verification: ${
        (error as Error).message
      }`
    );
  }
  const env = {...process.env, GNUPGHOME: gpgHome};
  const publicKeyFile = path.join(gpgHome, 'public-key.asc');

  try {
    fs.writeFileSync(publicKeyFile, publicKeyContent, {encoding: 'utf-8'});
    const options: ExecOptions = {silent: true, env};
    await exec.exec('gpg', ['--batch', '--import', publicKeyFile], options);
    await exec.exec(
      'gpg',
      ['--batch', '--verify', signaturePath, archivePath],
      options
    );
  } finally {
    await io.rmRF(signaturePath);
    await io.rmRF(gpgHome);
  }
}

import * as fs from 'fs';
import * as path from 'path';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as util from './util';
import {ExecOptions} from '@actions/exec/lib/interfaces';

export const PRIVATE_KEY_FILE = path.join(util.getTempDir(), 'private-key.asc');

const PRIVATE_KEY_FINGERPRINT_REGEX = /\w{40}/;

// Convert a Windows path (D:\a\_temp\...) to a POSIX path (/d/a/_temp/...).
// The Git-bundled GPG on Windows (MSYS2-based) uses POSIX path conventions
// internally. Passing Windows paths with backslashes can cause fatal GPG errors
// (exit code 2), so all paths passed to GPG must be in POSIX format on Windows.
export function toGpgPath(p: string): string {
  if (process.platform !== 'win32') return p;
  return p
    .replace(/\\/g, '/')
    .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
}

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
    try {
      await io.rmRF(signaturePath);
    } catch {
      // ignore cleanup failures
    }
    throw new Error(
      `Failed to create temporary GPG home directory for signature verification: ${
        (error as Error).message
      }`
    );
  }
  try {
    const publicKeyFile = path.join(gpgHome, 'public-key.asc');
    fs.writeFileSync(publicKeyFile, publicKeyContent, {encoding: 'utf-8'});
    const options: ExecOptions = {silent: true};
    await exec.exec(
      'gpg',
      [
        '--homedir',
        toGpgPath(gpgHome),
        '--batch',
        '--import',
        toGpgPath(publicKeyFile)
      ],
      options
    );
    await exec.exec(
      'gpg',
      [
        '--homedir',
        toGpgPath(gpgHome),
        '--batch',
        '--verify',
        toGpgPath(signaturePath),
        toGpgPath(archivePath)
      ],
      options
    );
  } finally {
    await io.rmRF(signaturePath);
    await io.rmRF(gpgHome);
  }
}

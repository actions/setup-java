import * as fs from 'fs';
import * as path from 'path';
import {randomUUID} from 'crypto';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as util from './util.js';
import {ExecOptions} from '@actions/exec';

export const GPG_HOME_PREFIX = 'setup-java-gpg-';
const VERIFY_GPG_HOME_PREFIX = 'verify-signature-gpg-home-';

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

function createGpgHome(prefix: string): string {
  const gpgHome = fs.mkdtempSync(path.join(util.getTempDir(), prefix));
  if (process.platform !== 'win32') {
    fs.chmodSync(gpgHome, 0o700);
  }
  return gpgHome;
}

export async function importKey(privateKey: string): Promise<string> {
  const gpgHome = createGpgHome(GPG_HOME_PREFIX);
  const privateKeyFile = path.join(gpgHome, `private-key-${randomUUID()}.asc`);

  try {
    fs.writeFileSync(privateKeyFile, privateKey, {
      encoding: 'utf-8',
      flag: 'wx',
      mode: 0o600
    });

    try {
      await exec.exec(
        'gpg',
        [
          '--homedir',
          toGpgPath(gpgHome),
          '--batch',
          '--import',
          toGpgPath(privateKeyFile)
        ],
        {silent: true}
      );
    } finally {
      fs.rmSync(privateKeyFile, {force: true});
    }

    return gpgHome;
  } catch (error) {
    await io.rmRF(gpgHome);
    throw error;
  }
}

export async function removeGpgHome(gpgHome: string): Promise<void> {
  if (!gpgHome) {
    return;
  }

  const resolvedGpgHome = path.resolve(gpgHome);
  const resolvedTempDir = path.resolve(util.getTempDir());
  if (
    path.dirname(resolvedGpgHome) !== resolvedTempDir ||
    !path.basename(resolvedGpgHome).startsWith(GPG_HOME_PREFIX)
  ) {
    throw new Error(`Refusing to remove unexpected GPG home: ${gpgHome}`);
  }

  await io.rmRF(resolvedGpgHome);
}

export async function verifyPackageSignature(
  archivePath: string,
  signatureUrl: string,
  publicKeyContent: string
) {
  const signaturePath = await tc.downloadTool(signatureUrl);
  let gpgHome: string;
  try {
    gpgHome = createGpgHome(VERIFY_GPG_HOME_PREFIX);
  } catch (error) {
    try {
      await io.rmRF(signaturePath);
    } catch {
      // ignore cleanup failures
    }
    throw new Error(
      `Failed to create temporary GPG home directory for signature verification: ${
        (error as Error).message
      }`,
      {cause: error}
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

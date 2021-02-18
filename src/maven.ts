import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as constants from './constants';
import * as os from 'os';
import * as io from '@actions/io';

export interface MavenOpts {
  caCert: string;
  keystore: string;
  password: string;
  settings: string;
  securitySettings: string;
}

export function validateOptions(opts: MavenOpts): boolean {
  if (
    (opts.caCert === '' ||
      opts.keystore === '' ||
      opts.password === '' ||
      opts.securitySettings === '',
    opts.settings === '')
  ) {
    core.debug('maven options set is not valid: some field is empty');
    return false;
  }
  return true;
}

export function isValidOptions(mvnOpts: MavenOpts): boolean {
  if (
    (mvnOpts.caCert !== '' ||
      mvnOpts.keystore !== '' ||
      mvnOpts.password !== '' ||
      mvnOpts.securitySettings !== '',
    mvnOpts.settings !== '') &&
    !validateOptions(mvnOpts)
  ) {
    return false;
  }

  return true;
}

export async function setupMaven(opts: MavenOpts): Promise<void> {
  const settingsDir = path.join(
    core.getInput(constants.INPUT_SETTINGS_PATH) || os.homedir(),
    core.getInput(constants.INPUT_SETTINGS_PATH) ? '' : '.m2'
  );
  const certDir = path.join(os.homedir(), 'certs');

  fs.writeFileSync(
    path.join(settingsDir, 'settings.xml'),
    btoa(opts.settings),
    {
      encoding: 'utf-8',
      flag: 'w'
    }
  );

  fs.writeFileSync(
    path.join(settingsDir, 'settings-security.xml'),
    btoa(opts.securitySettings),
    {
      encoding: 'utf-8',
      flag: 'w'
    }
  );

  await io.mkdirP(certDir);
  fs.writeFileSync(path.join(certDir, 'rootca.crt'), btoa(opts.caCert), {
    encoding: 'utf-8',
    flag: 'w'
  });

  const p12Path = path.join(certDir, 'certificate.p12');
  fs.writeFileSync(p12Path, btoa(opts.keystore), {
    encoding: 'utf-8',
    flag: 'w'
  });

  const password = btoa(opts.password);
  core.exportVariable(
    'MAVEN_OPTS',
    `-Djavax.net.ssl.keyStore=${p12Path} -Djavax.net.ssl.keyStoreType=pkcs12 -Djavax.net.ssl.keyStorePassword=${password}`
  );

  core.debug(`added maven opts for MTLS access`);
}

const btoa = function(str: string) {
  return Buffer.from(str, 'binary').toString('base64');
};

const atob = function(str: string) {
  return Buffer.from(str, 'base64').toString('binary');
};

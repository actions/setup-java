import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as constants from './constants';
import * as os from 'os';
import * as exec from '@actions/exec';
import * as io from '@actions/io';

export interface MavenOpts {
  caCert: string;
  keystore: string;
  password: string;
  settings: string;
  securitySettings: string;
  javaPath: string;
  javaVersion: string;
}

export function isValidOptions(mvnOpts: MavenOpts): boolean {
  return (
    mvnOpts.caCert !== '' &&
    mvnOpts.keystore !== '' &&
    mvnOpts.password !== '' &&
    mvnOpts.securitySettings !== '' &&
    mvnOpts.settings !== ''
  );
}

export async function setupMaven(opts: MavenOpts): Promise<void> {
  const settingsDir = path.join(
    core.getInput(constants.INPUT_SETTINGS_PATH) || os.homedir(),
    core.getInput(constants.INPUT_SETTINGS_PATH) ? '' : '.m2'
  );

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

  const certDir = path.join(os.homedir(), 'certs');
  const rooCaPath = path.join(certDir, 'rootca.crt');
  await io.mkdirP(certDir);
  fs.writeFileSync(rooCaPath, btoa(opts.caCert), {
    encoding: 'utf-8',
    flag: 'w'
  });

  const p12Path = path.join(certDir, 'certificate.p12');
  fs.writeFileSync(p12Path, Buffer.from(opts.keystore, 'base64'));

  core.exportVariable(
    'MAVEN_OPTS',
    `-Djavax.net.ssl.keyStore=${p12Path} -Djavax.net.ssl.keyStoreType=pkcs12 -Djavax.net.ssl.keyStorePassword=${opts.password}`
  );

  var caCertsParam = '-cacerts';
  if (opts.javaVersion === '8') {
    caCertsParam = '-trustcacerts';
  }

  try {
    await exec.exec(path.join(opts.javaPath, 'bin/keytool'), [
      '-importcert',
      caCertsParam,
      '-storepass',
      'changeit',
      '-noprompt',
      '-alias',
      'mycert',
      '-file',
      rooCaPath
    ]);
  } catch (e) {
    core.warning(`keytool return an error: ${(e as Error).message}`);
  }

  core.debug(`added maven opts for MTLS access`);
}

const atob = function(str: string) {
  return Buffer.from(str, 'binary').toString('base64');
};

const btoa = function(str: string) {
  return Buffer.from(str, 'base64').toString('binary');
};

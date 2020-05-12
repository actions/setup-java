import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');
import exec = require('@actions/exec');

// make the os.homedir() call be local to the tests
jest.doMock('os', () => {
  return {
    homedir: jest.fn(() => __dirname)
  };
});

jest.mock('@actions/exec', () => {
  return {
    exec: jest.fn()
  };
});

const tempDir = path.join(__dirname, 'runner', 'temp');
process.env['RUNNER_TEMP'] = tempDir;

import * as auth from '../src/auth';

const m2Dir = path.join(__dirname, auth.M2_DIR);
const settingsFile = path.join(m2Dir, auth.SETTINGS_FILE);
const privateKeyFile = path.join(tempDir, auth.PRIVATE_KEY_FILE);

describe('auth tests', () => {
  beforeEach(async () => {
    await io.rmRF(m2Dir);
    await io.mkdirP(tempDir);
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(m2Dir);
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('creates settings.xml in alternate locations', async () => {
    const id = 'packages';
    const username = 'UNAMI';
    const password = 'TOLKIEN';

    const altHome = path.join(__dirname, 'runner', 'settings');
    const altSettingsFile = path.join(altHome, auth.SETTINGS_FILE);
    process.env[`INPUT_SETTINGS-PATH`] = altHome;
    await io.rmRF(altHome); // ensure it doesn't already exist

    await auth.configAuthentication(id, username, password);

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    expect(fs.existsSync(altHome)).toBe(true);
    expect(fs.existsSync(altSettingsFile)).toBe(true);
    expect(fs.readFileSync(altSettingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );

    delete process.env[`INPUT_SETTINGS-PATH`];
    await io.rmRF(altHome);
  }, 100000);

  it('creates settings.xml with minimal configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';

    await auth.configAuthentication(id, username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );
  }, 100000);

  it('creates settings.xml with gpg data', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';
    const gpgPrivateKey = 'PRIVATE';
    const gpgPassphrase = 'GPG';

    await auth.configAuthentication(
      id,
      username,
      password,
      gpgPrivateKey,
      gpgPassphrase
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password, gpgPassphrase)
    );
  }, 100000);

  it('overwrites existing settings.xml files', async () => {
    const id = 'packages';
    const username = 'USERNAME';
    const password = 'PASSWORD';

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(settingsFile, 'FAKE FILE');
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);

    await auth.configAuthentication(id, username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );
  }, 100000);

  it('does not create settings.xml without required parameters', async () => {
    await auth.configAuthentication('FOO');

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate('FOO', auth.DEFAULT_USERNAME, auth.DEFAULT_PASSWORD)
    );

    await auth.configAuthentication(undefined, 'BAR', undefined);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(auth.DEFAULT_ID, 'BAR', auth.DEFAULT_PASSWORD)
    );

    await auth.configAuthentication(undefined, undefined, 'BAZ');

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(auth.DEFAULT_ID, auth.DEFAULT_USERNAME, 'BAZ')
    );

    await auth.configAuthentication();

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(
        auth.DEFAULT_ID,
        auth.DEFAULT_USERNAME,
        auth.DEFAULT_PASSWORD
      )
    );
  }, 100000);

  it('generates valid settings.xml', () => {
    const id = 'packages';
    const username = 'USER';
    const password = '&<>"\'\'"><&';
    const gpgPassphrase = 'PASSPHRASE';

    const expectedSettings = `<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>${id}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>gpg.passphrase</id>
      <passphrase>\${env.${gpgPassphrase}}</passphrase>
    </server>
  </servers>
  <profiles>
    <profile>
      <activation>
        <activeByDefault>true</activeByDefault>
      </activation>
      <properties>
        <gpg.homedir>${tempDir}</gpg.homedir>
      </properties>
    </profile>
  </profiles>
</settings>`;

    expect(auth.generate(id, username, password, gpgPassphrase)).toEqual(
      expectedSettings
    );
  });

  it('imports gpg private key', async () => {
    const id = 'packages';
    const username = 'USERNAME';
    const password = 'PASSWORD';
    const gpgPrivateKey = 'KEY CONTENTS';

    await auth.configAuthentication(id, username, password, gpgPrivateKey);

    expect(exec.exec).toHaveBeenCalledWith(
      'gpg',
      expect.anything(),
      expect.anything()
    );

    expect(fs.existsSync(privateKeyFile)).toBe(false);
  }, 100000);

  it('does not import gpg private key when private key is not set', async () => {
    const id = 'packages';
    const username = 'USERNAME';
    const password = 'PASSWORD';

    await auth.configAuthentication(id, username, password);

    expect(exec.exec).not.toHaveBeenCalledWith(
      'gpg',
      expect.anything(),
      expect.anything()
    );

    expect(fs.existsSync(privateKeyFile)).toBe(false);
  }, 100000);
});

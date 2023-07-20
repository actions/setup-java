import * as io from '@actions/io';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

import * as auth from '../src/auth';
import {M2_DIR, MVN_SETTINGS_FILE} from '../src/constants';

const m2Dir = path.join(__dirname, M2_DIR);
const settingsFile = path.join(m2Dir, MVN_SETTINGS_FILE);

describe('auth tests', () => {
  let spyOSHomedir: jest.SpyInstance;
  let spyInfo: jest.SpyInstance;

  beforeEach(async () => {
    await io.rmRF(m2Dir);
    spyOSHomedir = jest.spyOn(os, 'homedir');
    spyOSHomedir.mockReturnValue(__dirname);
    spyInfo = jest.spyOn(core, 'info');
    spyInfo.mockImplementation(() => null);
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(m2Dir);
    } catch {
      console.log('Failed to remove test directories');
    }
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  }, 100000);

  it('creates settings.xml in alternate locations', async () => {
    const id = 'packages';
    const username = 'UNAMI';
    const password = 'TOLKIEN';

    const altHome = path.join(__dirname, 'runner', 'settings');
    const altSettingsFile = path.join(altHome, MVN_SETTINGS_FILE);
    await io.rmRF(altHome); // ensure it doesn't already exist

    await auth.createAuthenticationSettings(
      id,
      username,
      password,
      altHome,
      true
    );

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    expect(fs.existsSync(altHome)).toBe(true);
    expect(fs.existsSync(altSettingsFile)).toBe(true);
    expect(fs.readFileSync(altSettingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );

    await io.rmRF(altHome);
  }, 100000);

  it('creates settings.xml with minimal configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';

    await auth.createAuthenticationSettings(
      id,
      username,
      password,
      m2Dir,
      true
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );
  }, 100000);

  it('creates settings.xml with additional configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';
    const gpgPassphrase = 'GPG';

    await auth.createAuthenticationSettings(
      id,
      username,
      password,
      m2Dir,
      true,
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

    await auth.createAuthenticationSettings(
      id,
      username,
      password,
      m2Dir,
      true
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );
  }, 100000);

  it('does not overwrite existing settings.xml files', async () => {
    const id = 'packages';
    const username = 'USERNAME';
    const password = 'PASSWORD';

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(settingsFile, 'FAKE FILE');
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);

    await auth.createAuthenticationSettings(
      id,
      username,
      password,
      m2Dir,
      false
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual('FAKE FILE');
  }, 100000);

  it('generates valid settings.xml with minimal configuration', () => {
    const id = 'packages';
    const username = 'USER';
    const password = '&<>"\'\'"><&';

    const expectedSettings = `<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>${id}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
  </servers>
</settings>`;

    expect(auth.generate(id, username, password)).toEqual(expectedSettings);
  });

  it('generates valid settings.xml with additional configuration', () => {
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
</settings>`;

    expect(auth.generate(id, username, password, gpgPassphrase)).toEqual(
      expectedSettings
    );
  });
});

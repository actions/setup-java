import io = require('@actions/io');
import fs = require('fs');
import os = require('os');
import path = require('path');

// make the os.homedir() call be local to the tests
jest.doMock('os', () => {
  return {
    homedir: jest.fn(() => __dirname)
  };
});

import * as auth from '../src/auth';

const m2Dir = path.join(__dirname, auth.M2_DIR);
const settingsFile = path.join(m2Dir, auth.SETTINGS_FILE);

describe('auth tests', () => {
  beforeEach(async () => {
    await io.rmRF(m2Dir);
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(m2Dir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('creates settings.xml with username and password', async () => {
    const id = 'packages';
    const username = 'bluebottle';
    const password = 'SingleOrigin';

    await auth.configAuthentication(id, username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(id, username, password)
    );
  }, 100000);

  it('overwrites existing settings.xml files', async () => {
    const id = 'packages';
    const username = 'bluebottle';
    const password = 'SingleOrigin';

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(settingsFile, "FAKE FILE");
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
    await auth.configAuthentication('FOO', '', '');

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    await auth.configAuthentication('', 'BAR', '');

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    await auth.configAuthentication('', '', 'BAZ');

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    await auth.configAuthentication('', '', '');

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);
  }, 100000);
});

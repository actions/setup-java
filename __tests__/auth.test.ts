import io = require('@actions/io');
import fs = require('fs');
import path = require('path');
import child_process = require('child_process');

const m2Dir = path.join(__dirname, '.m2');
const settingsFile = path.join(m2Dir, 'settings.xml');

import * as auth from '../src/auth';

describe('auth tests', () => {
  beforeAll(async () => {
    await io.rmRF(m2Dir);
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(m2Dir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('Creates settings.xml file with username and password', async () => {
    const username = 'bluebottle';
    const password = 'SingleOrigin';

    await auth.configAuthentication(username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(username, password)
    );
  }, 100000);
});

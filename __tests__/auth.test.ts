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

  it('creates settings.xml in alternate locations', async () => {
    const id = 'packages';
    const username = 'UNAMI';
    const password = 'TOLKIEN';

    const altHome = path.join(__dirname, 'runner', 'settings');
    const altSettingsFile = path.join(altHome, auth.SETTINGS_FILE);
    process.env[`INPUT_SETTINGS-PATH`] = altHome;
    await io.rmRF(altHome); // ensure it doesn't already exist

    await auth.configAuthentication([id], username, password);

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    expect(fs.existsSync(altHome)).toBe(true);
    expect(fs.existsSync(altSettingsFile)).toBe(true);
    expect(fs.readFileSync(altSettingsFile, 'utf-8')).toEqual(
      auth.generate([id], username, password)
    );

    delete process.env[`INPUT_SETTINGS-PATH`];
    await io.rmRF(altHome);
  }, 100000);

  it('creates settings.xml with minimal configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';

    await auth.configAuthentication([id], username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate([id], username, password)
    );
  }, 100000);

  it('creates settings.xml with minimal configuration and multiple servers', async () => {
    const id1 = 'packages-1';
    const id2 = 'packages-2';
    const username = 'UNAME';
    const password = 'TOKEN';

    await auth.configAuthentication([id1, id2], username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate([id1, id2], username, password)
    );
  }, 100000);

  it('creates settings.xml with additional configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';
    const gpgPassphrase = 'GPG';

    await auth.configAuthentication([id], username, password, gpgPassphrase);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate([id], username, password, gpgPassphrase)
    );
  }, 100000);

  it('creates settings.xml with additional configuration and multiple servers', async () => {
    const id1 = 'packages-1';
    const id2 = 'packages-2';
    const username = 'UNAME';
    const password = 'TOKEN';
    const gpgPassphrase = 'GPG';

    await auth.configAuthentication(
      [id1, id2],
      username,
      password,
      gpgPassphrase
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate([id1, id2], username, password, gpgPassphrase)
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

    await auth.configAuthentication([id], username, password);

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate([id], username, password)
    );
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

    expect(auth.generate([id], username, password)).toEqual(expectedSettings);
  });

  it('generates valid settings.xml with minimal configuration and multiple servers', () => {
    const id1 = 'packages-1';
    const id2 = 'packages-2';
    const username = 'USER';
    const password = '&<>"\'\'"><&';

    const expectedSettings = `<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>${id1}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>${id2}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
  </servers>
</settings>`;

    expect(auth.generate([id1, id2], username, password)).toEqual(
      expectedSettings
    );
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

    expect(auth.generate([id], username, password, gpgPassphrase)).toEqual(
      expectedSettings
    );
  });

  it('generates valid settings.xml with additional configuration and multiple servers', () => {
    const id1 = 'packages-1';
    const id2 = 'packages-2';
    const username = 'USER';
    const password = '&<>"\'\'"><&';
    const gpgPassphrase = 'PASSPHRASE';

    const expectedSettings = `<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>${id1}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>${id2}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>gpg.passphrase</id>
      <passphrase>\${env.${gpgPassphrase}}</passphrase>
    </server>
  </servers>
</settings>`;

    expect(
      auth.generate([id1, id2], username, password, gpgPassphrase)
    ).toEqual(expectedSettings);
  });

  it('generates valid settings.xml with additional configuration and multiple servers, sorting alphabetically and removing duplicates', () => {
    const id1 = 'packages-1';
    const id2 = 'packages-2';
    const id3 = 'packages-3';
    const username = 'USER';
    const password = '&<>"\'\'"><&';
    const gpgPassphrase = 'PASSPHRASE';

    const expectedSettings = `<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <servers>
    <server>
      <id>${id1}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>${id2}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>${id3}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
    <server>
      <id>gpg.passphrase</id>
      <passphrase>\${env.${gpgPassphrase}}</passphrase>
    </server>
  </servers>
</settings>`;

    expect(
      auth.generate(
        [id3, id3, id1, id2, id1, id2, id3],
        username,
        password,
        gpgPassphrase
      )
    ).toEqual(expectedSettings);
  });
});

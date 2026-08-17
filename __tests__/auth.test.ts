import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll
} from '@jest/globals';
import {fileURLToPath} from 'url';
import * as io from '@actions/io';
import * as fs from 'fs';
import * as path from 'path';
import os from 'os';
import {XMLParser} from 'fast-xml-parser';

// Mock @actions/core before importing source modules that depend on it
jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getMultilineInput: jest.fn(() => []),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  setSecret: jest.fn(),
  isDebug: jest.fn(() => false),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  group: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  toPlatformPath: jest.fn((p: string) => p),
  toWin32Path: jest.fn((p: string) => p),
  toPosixPath: jest.fn((p: string) => p)
}));

jest.unstable_mockModule('../src/gpg.js', () => ({
  importKey: jest.fn(),
  removeGpgHome: jest.fn(),
  toGpgPath: jest.fn()
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const gpg = await import('../src/gpg.js');
const auth = await import('../src/auth.js');
const {M2_DIR, MVN_SETTINGS_FILE, STATE_GPG_HOME} =
  await import('../src/constants.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const m2Dir = path.join(__dirname, M2_DIR);
const settingsFile = path.join(m2Dir, MVN_SETTINGS_FILE);
const credentials = (id: string, username: string, password: string) => [
  {id, usernameEnvVar: username, passwordEnvVar: password}
];

describe('auth tests', () => {
  let spyOSHomedir: any;
  let spyInfo: any;

  beforeEach(async () => {
    await io.rmRF(m2Dir);
    spyOSHomedir = jest.spyOn(os, 'homedir');
    spyOSHomedir.mockReturnValue(__dirname);
    spyInfo = core.info as jest.Mock;
    spyInfo.mockImplementation(() => null);
    (gpg.toGpgPath as jest.Mock<any>).mockImplementation((p: string) => p);
  }, 300000);

  afterEach(() => {
    (core.getInput as jest.Mock).mockReset();
    (core.getMultilineInput as jest.Mock).mockReset();
    (core.getMultilineInput as jest.Mock).mockReturnValue([]);
    (core.warning as jest.Mock).mockReset();
    (core.exportVariable as jest.Mock).mockReset();
    (gpg.importKey as jest.Mock).mockReset();
    (gpg.removeGpgHome as jest.Mock).mockReset();
    (gpg.toGpgPath as jest.Mock).mockReset();
  });

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
      credentials(id, username, password),
      altHome,
      true
    );

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(settingsFile)).toBe(false);

    expect(fs.existsSync(altHome)).toBe(true);
    expect(fs.existsSync(altSettingsFile)).toBe(true);
    expect(fs.readFileSync(altSettingsFile, 'utf-8')).toEqual(
      auth.generate(credentials(id, username, password))
    );

    await io.rmRF(altHome);
  }, 100000);

  it('creates settings.xml with minimal configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';

    await auth.createAuthenticationSettings(
      credentials(id, username, password),
      m2Dir,
      true
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(credentials(id, username, password))
    );
  }, 100000);

  it('creates settings.xml with additional configuration', async () => {
    const id = 'packages';
    const username = 'UNAME';
    const password = 'TOKEN';
    const gpgPassphrase = 'GPG';

    await auth.createAuthenticationSettings(
      credentials(id, username, password),
      m2Dir,
      true,
      gpgPassphrase
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(credentials(id, username, password), gpgPassphrase)
    );
  }, 100000);

  it('exports a GPG-compatible path and persists the native GPG home', async () => {
    const gpgHome = 'D:\\a\\_temp\\setup-java-gpg-1';
    const exportedGpgHome = '/d/a/_temp/setup-java-gpg-1';
    (gpg.importKey as jest.Mock<any>).mockResolvedValue(gpgHome);
    (gpg.toGpgPath as jest.Mock<any>).mockReturnValue(exportedGpgHome);
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'server-id': 'packages',
        'server-username-env-var': 'USERNAME',
        'server-password-env-var': 'PASSWORD',
        'settings-path': m2Dir,
        'gpg-private-key': 'KEY ONE\nKEY TWO'
      };
      return inputs[name] ?? '';
    });

    await auth.configureAuthentication();

    expect(gpg.importKey).toHaveBeenCalledWith('KEY ONE\nKEY TWO');
    expect(core.saveState).toHaveBeenCalledWith(STATE_GPG_HOME, gpgHome);
    expect(gpg.toGpgPath).toHaveBeenCalledWith(gpgHome);
    expect(core.exportVariable).toHaveBeenCalledWith(
      'GNUPGHOME',
      exportedGpgHome
    );
  });

  it('removes the isolated GPG home when environment export fails', async () => {
    const gpgHome = path.join(__dirname, 'runner', 'temp', 'setup-java-gpg-2');
    (gpg.importKey as jest.Mock<any>).mockResolvedValue(gpgHome);
    (core.exportVariable as jest.Mock<any>).mockImplementation(() => {
      throw new Error('environment file unavailable');
    });
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
      if (name === 'gpg-private-key') return 'KEY CONTENTS';
      if (name === 'settings-path') return m2Dir;
      return '';
    });

    await expect(auth.configureAuthentication()).rejects.toThrow(
      'environment file unavailable'
    );

    expect(gpg.removeGpgHome).toHaveBeenCalledWith(gpgHome);
  });

  it('overwrites existing settings.xml files', async () => {
    const id = 'packages';
    const username = 'USERNAME';
    const password = 'PASSWORD';

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(settingsFile, 'FAKE FILE');
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);

    await auth.createAuthenticationSettings(
      credentials(id, username, password),
      m2Dir,
      true
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(settingsFile)).toBe(true);
    expect(fs.readFileSync(settingsFile, 'utf-8')).toEqual(
      auth.generate(credentials(id, username, password))
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
      credentials(id, username, password),
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
  <interactiveMode>false</interactiveMode>
  <servers>
    <server>
      <id>${id}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
  </servers>
</settings>`;

    expect(auth.generate(credentials(id, username, password))).toEqual(
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
  <interactiveMode>false</interactiveMode>
  <servers>
    <server>
      <id>${id}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
  </servers>
  <profiles>
    <profile>
      <id>setup-java-gpg</id>
      <properties>
        <gpg.passphraseEnvName>${gpgPassphrase}</gpg.passphraseEnvName>
      </properties>
    </profile>
  </profiles>
  <activeProfiles>
    <activeProfile>setup-java-gpg</activeProfile>
  </activeProfiles>
</settings>`;

    expect(
      auth.generate(credentials(id, username, password), gpgPassphrase)
    ).toEqual(expectedSettings);
  });

  it('does not add a gpg profile when the passphrase env var is the maven-gpg-plugin default', () => {
    const id = 'packages';
    const username = 'USER';
    const password = '&<>"\'\'"><&';
    const gpgPassphrase = 'MAVEN_GPG_PASSPHRASE';

    const expectedSettings = `<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">
  <interactiveMode>false</interactiveMode>
  <servers>
    <server>
      <id>${id}</id>
      <username>\${env.${username}}</username>
      <password>\${env.&amp;&lt;&gt;"''"&gt;&lt;&amp;}</password>
    </server>
  </servers>
</settings>`;

    expect(
      auth.generate(credentials(id, username, password), gpgPassphrase)
    ).toEqual(expectedSettings);
  });

  it('escapes settings.xml values while preserving parsed semantics', () => {
    const id = `packages&<>"'é`;
    const username = `USER&<>"'é`;
    const password = `TOKEN&<>"'é`;
    const gpgPassphrase = `GPG&<>"'é`;

    const xml = auth.generate(
      credentials(id, username, password),
      gpgPassphrase
    );
    const parsed = parseXmlObject(xml) as any;

    expect(parsed.settings.interactiveMode).toBe('false');
    expect(xmlElementText(xml, 'id')).toBe(id);
    expect(xmlElementText(xml, 'username')).toBe(`\${env.${username}}`);
    expect(xmlElementText(xml, 'password')).toBe(`\${env.${password}}`);
    expect(xmlElementText(xml, 'gpg.passphraseEnvName')).toBe(gpgPassphrase);
    expect(parsed.settings.activeProfiles.activeProfile).toBe('setup-java-gpg');
  });

  it('generates ordered settings.xml entries for multiple servers', () => {
    const servers = [
      {
        id: 'releases',
        usernameEnvVar: 'RELEASES_USERNAME',
        passwordEnvVar: 'RELEASES_PASSWORD'
      },
      {
        id: 'snapshots',
        usernameEnvVar: 'SNAPSHOTS_USERNAME',
        passwordEnvVar: 'SNAPSHOTS_PASSWORD'
      }
    ];

    const parsed = parseXmlObject(auth.generate(servers)) as any;

    expect(parsed.settings.servers.server).toEqual([
      {
        id: 'releases',
        username: '${env.RELEASES_USERNAME}',
        password: '${env.RELEASES_PASSWORD}'
      },
      {
        id: 'snapshots',
        username: '${env.SNAPSHOTS_USERNAME}',
        password: '${env.SNAPSHOTS_PASSWORD}'
      }
    ]);
  });

  it('parses and trims multiline Maven server credentials', () => {
    expect(
      auth.parseMavenServerCredentials([
        '',
        ' releases : RELEASES_USERNAME : RELEASES_PASSWORD ',
        'snapshots:SNAPSHOTS_USERNAME:SNAPSHOTS_PASSWORD'
      ])
    ).toEqual([
      {
        id: 'releases',
        usernameEnvVar: 'RELEASES_USERNAME',
        passwordEnvVar: 'RELEASES_PASSWORD'
      },
      {
        id: 'snapshots',
        usernameEnvVar: 'SNAPSHOTS_USERNAME',
        passwordEnvVar: 'SNAPSHOTS_PASSWORD'
      }
    ]);
  });

  it.each([
    {
      entries: ['releases:RELEASES_USERNAME'],
      error:
        'Invalid mvn-server-credentials entry at line 1. Expected format: server-id:USERNAME_ENV:PASSWORD_ENV'
    },
    {
      entries: ['', 'releases:RELEASES_USERNAME:RELEASES_PASSWORD:EXTRA'],
      error:
        'Invalid mvn-server-credentials entry at line 2. Expected format: server-id:USERNAME_ENV:PASSWORD_ENV'
    },
    {
      entries: ['releases::RELEASES_PASSWORD'],
      error:
        'Invalid mvn-server-credentials entry at line 1. server-id, username environment variable, and password environment variable are required'
    }
  ])(
    'rejects malformed Maven server credentials: $entries',
    ({entries, error}) => {
      expect(() => auth.parseMavenServerCredentials(entries)).toThrow(error);
    }
  );

  it('rejects duplicate Maven server ids', () => {
    expect(() =>
      auth.parseMavenServerCredentials([
        'releases:RELEASES_USERNAME:RELEASES_PASSWORD',
        'releases:OTHER_USERNAME:OTHER_PASSWORD'
      ])
    ).toThrow("Duplicate server-id 'releases' in mvn-server-credentials input");
  });

  it('uses multiline Maven server credentials instead of single-server inputs', () => {
    (core.getMultilineInput as jest.Mock).mockReturnValue([
      'releases:RELEASES_USERNAME:RELEASES_PASSWORD',
      'snapshots:SNAPSHOTS_USERNAME:SNAPSHOTS_PASSWORD'
    ]);

    expect(auth.getMavenServerSettings()).toEqual([
      {
        id: 'releases',
        usernameEnvVar: 'RELEASES_USERNAME',
        passwordEnvVar: 'RELEASES_PASSWORD'
      },
      {
        id: 'snapshots',
        usernameEnvVar: 'SNAPSHOTS_USERNAME',
        passwordEnvVar: 'SNAPSHOTS_PASSWORD'
      }
    ]);
    expect(core.getInput).not.toHaveBeenCalled();
  });

  it('uses the existing single-server inputs when multiline credentials are absent', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) =>
      name === 'server-id' ? 'github' : ''
    );

    expect(auth.getMavenServerSettings()).toEqual([
      {
        id: 'github',
        usernameEnvVar: 'GITHUB_ACTOR',
        passwordEnvVar: 'GITHUB_TOKEN'
      }
    ]);
  });

  it('preserves deprecated single-server aliases as fallback inputs', () => {
    (core.getInput as jest.Mock).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'server-id': 'legacy',
        'server-username': 'LEGACY_USERNAME',
        'server-password': 'LEGACY_PASSWORD'
      };
      return inputs[name] ?? '';
    });

    expect(auth.getMavenServerSettings()).toEqual([
      {
        id: 'legacy',
        usernameEnvVar: 'LEGACY_USERNAME',
        passwordEnvVar: 'LEGACY_PASSWORD'
      }
    ]);
    expect(core.warning).toHaveBeenCalledTimes(2);
  });

  function xmlElementText(xml: string, tagName: string): string {
    const match = new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`).exec(xml);
    expect(match).not.toBeNull();
    return (parseXmlObject(`<value>${match?.[1]}</value>`) as {value: string})
      .value;
  }

  function parseXmlObject(xml: string): unknown {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      parseAttributeValue: false,
      parseTagValue: false,
      trimValues: true
    });
    return parser.parse(xml);
  }

  it('uses deprecated input aliases and warns', () => {
    const mockGetInput = core.getInput as jest.MockedFunction<
      typeof core.getInput
    >;
    const mockWarning = core.warning as jest.MockedFunction<
      typeof core.warning
    >;
    mockGetInput.mockImplementation(name =>
      name === 'server-username' ? 'LEGACY_USERNAME' : ''
    );

    expect(
      auth.getInputWithDeprecatedAlias(
        'server-username-env-var',
        'server-username',
        'GITHUB_ACTOR'
      )
    ).toBe('LEGACY_USERNAME');
    expect(mockWarning).toHaveBeenCalledWith(
      "The 'server-username' input is deprecated and may be removed in a future release. Please use 'server-username-env-var' instead."
    );

    mockGetInput.mockReset();
    mockWarning.mockReset();
  });

  it('prefers the replacement input over its deprecated alias', () => {
    const mockGetInput = core.getInput as jest.MockedFunction<
      typeof core.getInput
    >;
    mockGetInput.mockImplementation(name => {
      const inputs: Record<string, string> = {
        'server-password-env-var': 'NEW_PASSWORD',
        'server-password': 'LEGACY_PASSWORD'
      };
      return inputs[name] || '';
    });

    expect(
      auth.getInputWithDeprecatedAlias(
        'server-password-env-var',
        'server-password',
        'GITHUB_TOKEN'
      )
    ).toBe('NEW_PASSWORD');
    expect(core.warning).toHaveBeenCalled();

    mockGetInput.mockReset();
    (core.warning as jest.Mock).mockReset();
  });
});

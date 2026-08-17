import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

import * as fs from 'fs';
import * as os from 'os';
import * as constants from './constants.js';
import * as gpg from './gpg.js';
import {getBooleanInput} from './util.js';
import {escapeXmlText} from './xml.js';

export interface MavenServerCredentials {
  id: string;
  usernameEnvVar: string;
  passwordEnvVar: string;
}

export async function configureAuthentication() {
  const servers = getMavenServerSettings();
  const settingsDirectory =
    core.getInput(constants.INPUT_SETTINGS_PATH) ||
    path.join(os.homedir(), constants.M2_DIR);
  const overwriteSettings = getBooleanInput(
    constants.INPUT_OVERWRITE_SETTINGS,
    true
  );
  const gpgPrivateKey =
    core.getInput(constants.INPUT_GPG_PRIVATE_KEY) ||
    constants.INPUT_DEFAULT_GPG_PRIVATE_KEY;
  const gpgPassphraseEnvVar = getInputWithDeprecatedAlias(
    constants.INPUT_GPG_PASSPHRASE_ENV_VAR,
    constants.INPUT_GPG_PASSPHRASE_DEPRECATED,
    gpgPrivateKey ? constants.INPUT_DEFAULT_GPG_PASSPHRASE : undefined
  );

  if (gpgPrivateKey) {
    core.setSecret(gpgPrivateKey);
  }

  await createAuthenticationSettings(
    servers,
    settingsDirectory,
    overwriteSettings,
    gpgPassphraseEnvVar
  );

  if (gpgPrivateKey) {
    core.info('Importing private gpg key');
    const gpgHome = await gpg.importKey(gpgPrivateKey);
    try {
      core.saveState(constants.STATE_GPG_HOME, gpgHome);
      core.exportVariable('GNUPGHOME', gpg.toGpgPath(gpgHome));
    } catch (error) {
      await gpg.removeGpgHome(gpgHome);
      throw error;
    }
  }
}

export function getInputWithDeprecatedAlias(
  inputName: string,
  deprecatedInputName: string,
  defaultValue?: string
): string {
  const value = core.getInput(inputName);
  const deprecatedValue = core.getInput(deprecatedInputName);

  if (deprecatedValue) {
    core.warning(
      `The '${deprecatedInputName}' input is deprecated and may be removed in a future release. Please use '${inputName}' instead.`
    );
  }

  return value || deprecatedValue || defaultValue || '';
}

// only exported for testing purposes
export function getMavenServerSettings(): MavenServerCredentials[] {
  const entries = core.getMultilineInput(
    constants.INPUT_MVN_SERVER_CREDENTIALS
  );

  if (entries.some(entry => entry.trim())) {
    return parseMavenServerCredentials(entries);
  }

  return [
    {
      id: core.getInput(constants.INPUT_SERVER_ID),
      usernameEnvVar: getInputWithDeprecatedAlias(
        constants.INPUT_SERVER_USERNAME_ENV_VAR,
        constants.INPUT_SERVER_USERNAME_DEPRECATED,
        constants.INPUT_DEFAULT_SERVER_USERNAME
      ),
      passwordEnvVar: getInputWithDeprecatedAlias(
        constants.INPUT_SERVER_PASSWORD_ENV_VAR,
        constants.INPUT_SERVER_PASSWORD_DEPRECATED,
        constants.INPUT_DEFAULT_SERVER_PASSWORD
      )
    }
  ];
}

// only exported for testing purposes
export function parseMavenServerCredentials(
  entries: string[]
): MavenServerCredentials[] {
  const servers: MavenServerCredentials[] = [];
  const serverIds = new Set<string>();

  entries.forEach((entry, index) => {
    if (!entry.trim()) {
      return;
    }

    const fields = entry.split(':');
    if (fields.length !== 3) {
      throw new Error(
        `Invalid mvn-server-credentials entry at line ${index + 1}. Expected format: server-id:USERNAME_ENV:PASSWORD_ENV`
      );
    }

    const [id, usernameEnvVar, passwordEnvVar] = fields.map(field =>
      field.trim()
    );
    if (!id || !usernameEnvVar || !passwordEnvVar) {
      throw new Error(
        `Invalid mvn-server-credentials entry at line ${index + 1}. server-id, username environment variable, and password environment variable are required`
      );
    }
    if (serverIds.has(id)) {
      throw new Error(
        `Duplicate server-id '${id}' in mvn-server-credentials input`
      );
    }

    serverIds.add(id);
    servers.push({id, usernameEnvVar, passwordEnvVar});
  });

  return servers;
}

export async function createAuthenticationSettings(
  servers: MavenServerCredentials[],
  settingsDirectory: string,
  overwriteSettings: boolean,
  gpgPassphraseEnvVar: string | undefined = undefined
) {
  core.info(
    `Creating ${constants.MVN_SETTINGS_FILE} with server-id: ${servers.map(server => server.id).join(', ')}`
  );
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  await io.mkdirP(settingsDirectory);
  await write(
    settingsDirectory,
    generate(servers, gpgPassphraseEnvVar),
    overwriteSettings
  );
}

// only exported for testing purposes
export function generate(
  servers: MavenServerCredentials[],
  gpgPassphraseEnvVar?: string | undefined
) {
  // The maven-gpg-plugin reads the passphrase from the environment variable
  // named by the `gpg.passphraseEnvName` property (default MAVEN_GPG_PASSPHRASE).
  // Only configure it when the requested env var name differs from that default;
  // otherwise the plugin already reads the right variable and no extra settings
  // are needed. Writing `gpg.passphrase` to settings.xml is deprecated and fails
  // when the plugin's `bestPractices` mode is enabled.
  const includeGpgPassphraseProfile =
    gpgPassphraseEnvVar &&
    gpgPassphraseEnvVar !== constants.MAVEN_GPG_PASSPHRASE_DEFAULT_ENV;

  const lines = [
    '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">',
    '  <interactiveMode>false</interactiveMode>',
    '  <servers>'
  ];

  for (const server of servers) {
    lines.push(
      '    <server>',
      `      <id>${escapeXmlText(server.id)}</id>`,
      `      <username>${escapeXmlText(`\${env.${server.usernameEnvVar}}`)}</username>`,
      `      <password>${escapeXmlText(`\${env.${server.passwordEnvVar}}`)}</password>`,
      '    </server>'
    );
  }
  lines.push('  </servers>');

  if (includeGpgPassphraseProfile) {
    lines.push(
      '  <profiles>',
      '    <profile>',
      `      <id>${constants.GPG_PASSPHRASE_PROFILE_ID}</id>`,
      '      <properties>',
      `        <gpg.passphraseEnvName>${escapeXmlText(gpgPassphraseEnvVar)}</gpg.passphraseEnvName>`,
      '      </properties>',
      '    </profile>',
      '  </profiles>',
      '  <activeProfiles>',
      `    <activeProfile>${constants.GPG_PASSPHRASE_PROFILE_ID}</activeProfile>`,
      '  </activeProfiles>'
    );
  }

  lines.push('</settings>');
  return lines.join('\n');
}

async function write(
  directory: string,
  settings: string,
  overwriteSettings: boolean
) {
  const location = path.join(directory, constants.MVN_SETTINGS_FILE);
  const settingsExists = fs.existsSync(location);
  if (settingsExists && overwriteSettings) {
    core.info(`Overwriting existing file ${location}`);
  } else if (!settingsExists) {
    core.info(`Writing to ${location}`);
  } else {
    core.info(
      `Skipping generation ${location} because file already exists and overwriting is not required`
    );
    return;
  }

  return fs.writeFileSync(location, settings, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

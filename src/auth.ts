import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';

import * as fs from 'fs';
import * as os from 'os';

import {create as xmlCreate} from 'xmlbuilder2';
import * as constants from './constants.js';
import * as gpg from './gpg.js';
import {getBooleanInput} from './util.js';

export async function configureAuthentication() {
  const id = core.getInput(constants.INPUT_SERVER_ID);
  const usernameEnvVar = getInputWithDeprecatedAlias(
    constants.INPUT_SERVER_USERNAME_ENV_VAR,
    constants.INPUT_SERVER_USERNAME_DEPRECATED,
    constants.INPUT_DEFAULT_SERVER_USERNAME
  );
  const passwordEnvVar = getInputWithDeprecatedAlias(
    constants.INPUT_SERVER_PASSWORD_ENV_VAR,
    constants.INPUT_SERVER_PASSWORD_DEPRECATED,
    constants.INPUT_DEFAULT_SERVER_PASSWORD
  );
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
    id,
    usernameEnvVar,
    passwordEnvVar,
    settingsDirectory,
    overwriteSettings,
    gpgPassphraseEnvVar
  );

  if (gpgPrivateKey) {
    core.info('Importing private gpg key');
    const keyFingerprint = (await gpg.importKey(gpgPrivateKey)) || '';
    core.saveState(constants.STATE_GPG_PRIVATE_KEY_FINGERPRINT, keyFingerprint);
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

export async function createAuthenticationSettings(
  id: string,
  usernameEnvVar: string,
  passwordEnvVar: string,
  settingsDirectory: string,
  overwriteSettings: boolean,
  gpgPassphraseEnvVar: string | undefined = undefined
) {
  core.info(`Creating ${constants.MVN_SETTINGS_FILE} with server-id: ${id}`);
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  await io.mkdirP(settingsDirectory);
  await write(
    settingsDirectory,
    generate(id, usernameEnvVar, passwordEnvVar, gpgPassphraseEnvVar),
    overwriteSettings
  );
}

// only exported for testing purposes
export function generate(
  id: string,
  usernameEnvVar: string,
  passwordEnvVar: string,
  gpgPassphraseEnvVar?: string | undefined
) {
  const xmlObj: {[key: string]: any} = {
    settings: {
      '@xmlns': 'http://maven.apache.org/SETTINGS/1.0.0',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation':
        'http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd',
      interactiveMode: false,
      servers: {
        server: [
          {
            id: id,
            username: `\${env.${usernameEnvVar}}`,
            password: `\${env.${passwordEnvVar}}`
          }
        ]
      }
    }
  };

  // The maven-gpg-plugin reads the passphrase from the environment variable
  // named by the `gpg.passphraseEnvName` property (default MAVEN_GPG_PASSPHRASE).
  // Only configure it when the requested env var name differs from that default;
  // otherwise the plugin already reads the right variable and no extra settings
  // are needed. Writing `gpg.passphrase` to settings.xml is deprecated and fails
  // when the plugin's `bestPractices` mode is enabled.
  if (
    gpgPassphraseEnvVar &&
    gpgPassphraseEnvVar !== constants.MAVEN_GPG_PASSPHRASE_DEFAULT_ENV
  ) {
    xmlObj.settings.profiles = {
      profile: {
        id: constants.GPG_PASSPHRASE_PROFILE_ID,
        properties: {
          'gpg.passphraseEnvName': gpgPassphraseEnvVar
        }
      }
    };
    xmlObj.settings.activeProfiles = {
      activeProfile: constants.GPG_PASSPHRASE_PROFILE_ID
    };
  }

  return xmlCreate(xmlObj).end({
    headless: true,
    prettyPrint: true,
    width: 80
  });
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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as constants from './constants';

import {getBooleanInput} from './util';
import {create as xmlCreate} from 'xmlbuilder2';

interface JdkInfo {
  version: string;
  vendor: string;
  id: string;
  jdkHome: string;
}

export async function configureToolchains(
  version: string,
  distributionName: string,
  jdkHome: string,
  toolchainId?: string
) {
  const vendor =
    core.getInput(constants.INPUT_MVN_TOOLCHAIN_VENDOR) || distributionName;
  const id = toolchainId || `${vendor}_${version}`;
  const settingsDirectory =
    core.getInput(constants.INPUT_SETTINGS_PATH) ||
    path.join(os.homedir(), constants.M2_DIR);
  const overwriteSettings = getBooleanInput(
    constants.INPUT_OVERWRITE_SETTINGS,
    true
  );

  await createToolchainsSettings({
    jdkInfo: {
      version,
      vendor,
      id,
      jdkHome
    },
    settingsDirectory,
    overwriteSettings
  });
}

export async function createToolchainsSettings({
  jdkInfo,
  settingsDirectory,
  overwriteSettings
}: {
  jdkInfo: JdkInfo;
  settingsDirectory: string;
  overwriteSettings: boolean;
}) {
  core.info(
    `Creating ${constants.MVN_TOOLCHAINS_FILE} for JDK version ${jdkInfo.version} from ${jdkInfo.vendor}`
  );
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  await io.mkdirP(settingsDirectory);
  const originalToolchains = await readExistingToolchainsFile(
    settingsDirectory
  );
  const updatedToolchains = generateToolchainDefinition(
    originalToolchains,
    jdkInfo.version,
    jdkInfo.vendor,
    jdkInfo.id,
    jdkInfo.jdkHome
  );
  await writeToolchainsFileToDisk(
    settingsDirectory,
    updatedToolchains,
    overwriteSettings
  );
}

// only exported for testing purposes
export function generateToolchainDefinition(
  original: string,
  version: string,
  vendor: string,
  id: string,
  jdkHome: string
) {
  let xmlObj;
  if (original?.length) {
    xmlObj = xmlCreate(original)
      .root()
      .ele({
        toolchain: {
          type: 'jdk',
          provides: {
            version: `${version}`,
            vendor: `${vendor}`,
            id: `${id}`
          },
          configuration: {
            jdkHome: `${jdkHome}`
          }
        }
      });
  } else
    xmlObj = xmlCreate({
      toolchains: {
        '@xmlns': 'https://maven.apache.org/TOOLCHAINS/1.1.0',
        '@xmlns:xsi': 'https://www.w3.org/2001/XMLSchema-instance',
        '@xsi:schemaLocation':
          'https://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd',
        toolchain: [
          {
            type: 'jdk',
            provides: {
              version: `${version}`,
              vendor: `${vendor}`,
              id: `${id}`
            },
            configuration: {
              jdkHome: `${jdkHome}`
            }
          }
        ]
      }
    });

  return xmlObj.end({
    format: 'xml',
    wellFormed: false,
    headless: false,
    prettyPrint: true,
    width: 80
  });
}

async function readExistingToolchainsFile(directory: string) {
  const location = path.join(directory, constants.MVN_TOOLCHAINS_FILE);
  if (fs.existsSync(location)) {
    return fs.readFileSync(location, {
      encoding: 'utf-8',
      flag: 'r'
    });
  }
  return '';
}

async function writeToolchainsFileToDisk(
  directory: string,
  settings: string,
  overwriteSettings: boolean
) {
  const location = path.join(directory, constants.MVN_TOOLCHAINS_FILE);
  const settingsExists = fs.existsSync(location);
  if (settingsExists && overwriteSettings) {
    core.info(`Overwriting existing file ${location}`);
  } else if (!settingsExists) {
    core.info(`Writing to ${location}`);
  } else {
    core.info(
      `Skipping generation of ${location} because file already exists and overwriting is not enabled`
    );
    return;
  }

  return fs.writeFileSync(location, settings, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

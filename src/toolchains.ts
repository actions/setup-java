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
  let jsToolchains: Toolchain[] = [
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
  ];
  if (original?.length) {
    // convert existing toolchains into TS native objects for better handling
    // xmlbuilder2 will convert the document into a `{toolchains: { toolchain: [] | {} }}` structure
    // instead of the desired `toolchains: [{}]` one or simply `[{}]`
    const jsObj = xmlCreate(original)
      .root()
      .toObject() as unknown as ExtractedToolchains;
    if (jsObj.toolchains && jsObj.toolchains.toolchain) {
      // in case only a single child exists xmlbuilder2 will not create an array and using verbose = true equally doesn't work here
      // See https://oozcitak.github.io/xmlbuilder2/serialization.html#js-object-and-map-serializers for details
      if (Array.isArray(jsObj.toolchains.toolchain)) {
        jsToolchains.push(...jsObj.toolchains.toolchain);
      } else {
        jsToolchains.push(jsObj.toolchains.toolchain);
      }
    }

    // remove potential duplicates based on type & id (which should be a unique combination);
    // self.findIndex will only return the first occurrence, ensuring duplicates are skipped
    jsToolchains = jsToolchains.filter(
      (value, index, self) =>
        // ensure non-jdk toolchains are kept in the results, we must not touch them because they belong to the user
        value.type !== 'jdk' ||
        index ===
          self.findIndex(
            t => t.type === value.type && t.provides.id === value.provides.id
          )
    );
  }

  // TODO: technically bad because we shouldn't re-create the toolchains root node (with possibly different schema values) if it already exists, however, just overriding the toolchain array with xmlbuilder2 is … uh non-trivial
  return xmlCreate({
    toolchains: {
      '@xmlns': 'http://maven.apache.org/TOOLCHAINS/1.1.0',
      '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      '@xsi:schemaLocation':
        'http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd',
      toolchain: jsToolchains
    }
  }).end({
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

interface ExtractedToolchains {
  toolchains: {
    toolchain: Toolchain[] | Toolchain;
  };
}

// Toolchain type definition according to Maven Toolchains XSD 1.1.0
interface Toolchain {
  type: string;
  provides:
    | {
        version: string;
        vendor: string;
        id: string;
      }
    | any;
  configuration: any;
}

import fs from 'fs';
import * as core from '@actions/core';
import * as auth from './auth.js';
import {
  getBooleanInput,
  isCacheFeatureAvailable,
  getVersionFromFileContent
} from './util.js';
import * as toolchains from './toolchains.js';
import * as constants from './constants.js';
import {restore} from './cache.js';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {getJavaDistribution} from './distributions/distribution-factory.js';
import {JavaInstallerOptions} from './distributions/base-models.js';
import {configureMavenArgs} from './maven-args.js';

interface IInstallerInputsOptions {
  architecture: string;
  packageType: string;
  checkLatest: boolean;
  setDefault: boolean;
  overwriteSettings: boolean;
  addToolchainOnly: boolean;
  verifySignature: boolean;
  verifySignaturePublicKey: string | undefined;
  distributionName: string;
  jdkFile: string;
  toolchainIds: Array<string>;
}

async function run() {
  try {
    const versions = core.getMultilineInput(constants.INPUT_JAVA_VERSION);
    let distributionName = core.getInput(constants.INPUT_DISTRIBUTION);
    const versionFile = core.getInput(constants.INPUT_JAVA_VERSION_FILE);
    const architecture = core.getInput(constants.INPUT_ARCHITECTURE);
    const packageType = core.getInput(constants.INPUT_JAVA_PACKAGE);
    const jdkFile = getJdkFileInput();
    const cache = core.getInput(constants.INPUT_CACHE);
    const cacheDependencyPath = core.getInput(
      constants.INPUT_CACHE_DEPENDENCY_PATH
    );
    const checkLatest = getBooleanInput(constants.INPUT_CHECK_LATEST, false);
    const addToolchainOnly = getBooleanInput(
      constants.INPUT_ADD_TOOLCHAIN_ONLY,
      false
    );
    const setDefault = getBooleanInput(
      constants.INPUT_SET_DEFAULT,
      !addToolchainOnly
    );
    const overwriteSettings = getBooleanInput(
      constants.INPUT_OVERWRITE_SETTINGS,
      !addToolchainOnly
    );
    const verifySignature = getBooleanInput(
      constants.INPUT_VERIFY_SIGNATURE,
      false
    );
    const verifySignaturePublicKey =
      core.getInput(constants.INPUT_VERIFY_SIGNATURE_PUBLIC_KEY) || undefined;
    let toolchainIds = core.getMultilineInput(constants.INPUT_MVN_TOOLCHAIN_ID);

    core.startGroup('Installed distributions');

    if (versions.length !== toolchainIds.length) {
      toolchainIds = [];
    }

    if (!versions.length && !versionFile) {
      throw new Error('java-version or java-version-file input expected');
    }

    if (!versions.length) {
      core.debug(
        'java-version input is empty, looking for java-version-file input'
      );
      const content = fs.readFileSync(versionFile).toString().trim();

      const versionInfo = getVersionFromFileContent(
        content,
        distributionName,
        versionFile
      );
      core.debug(`Parsed version from file '${versionInfo?.version}'`);

      if (!versionInfo) {
        throw new Error(
          `No supported version was found in file ${versionFile}`
        );
      }

      // Use distribution from file if available, otherwise use the input
      if (versionInfo.distribution) {
        core.info(
          `Using distribution '${versionInfo.distribution}' from ${versionFile}`
        );
        distributionName = versionInfo.distribution;
      } else if (!distributionName) {
        throw new Error(
          'distribution input is required when not specified in the version file'
        );
      }

      const installerInputsOptions: IInstallerInputsOptions = {
        architecture: architecture,
        packageType: packageType,
        checkLatest: checkLatest,
        setDefault: setDefault,
        overwriteSettings: overwriteSettings,
        addToolchainOnly: addToolchainOnly,
        verifySignature: verifySignature,
        verifySignaturePublicKey: verifySignaturePublicKey,
        distributionName: distributionName,
        jdkFile: jdkFile,
        toolchainIds: toolchainIds
      };

      await installVersion(versionInfo.version, installerInputsOptions);
    } else {
      // When using java-version input, distribution is still required
      if (!distributionName) {
        throw new Error('distribution input is required');
      }

      const installerInputsOptions: IInstallerInputsOptions = {
        architecture: architecture,
        packageType: packageType,
        checkLatest: checkLatest,
        setDefault: setDefault,
        overwriteSettings: overwriteSettings,
        addToolchainOnly: addToolchainOnly,
        verifySignature: verifySignature,
        verifySignaturePublicKey: verifySignaturePublicKey,
        distributionName: distributionName,
        jdkFile: jdkFile,
        toolchainIds: toolchainIds
      };

      for (const [index, version] of versions.entries()) {
        await installVersion(version, installerInputsOptions, index);
      }
    }
    core.endGroup();
    const matchersPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '.github'
    );
    core.info(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    await auth.configureAuthentication(overwriteSettings);
    configureMavenArgs();
    if (cache && isCacheFeatureAvailable()) {
      await restore(cache, cacheDependencyPath);
    }
  } catch (error) {
    core.setFailed((error as Error).message);
  }
}

run();

function getJdkFileInput(): string {
  const jdkFile = core.getInput(constants.INPUT_JDK_FILE);
  const deprecatedJdkFile = core.getInput(constants.INPUT_JDK_FILE_DEPRECATED);

  if (deprecatedJdkFile) {
    core.warning(
      `The '${constants.INPUT_JDK_FILE_DEPRECATED}' input is deprecated and may be removed in a future release. Please use '${constants.INPUT_JDK_FILE}' instead.`
    );
  }

  return jdkFile || deprecatedJdkFile;
}

async function installVersion(
  version: string,
  options: IInstallerInputsOptions,
  toolchainId = 0
) {
  const installerOptions: JavaInstallerOptions = {
    architecture: options.architecture,
    packageType: options.packageType,
    checkLatest: options.checkLatest,
    setDefault: options.setDefault,
    verifySignature: options.verifySignature,
    verifySignaturePublicKey: options.verifySignaturePublicKey,
    version
  };

  const distribution = getJavaDistribution(
    options.distributionName,
    installerOptions,
    options.jdkFile
  );
  if (!distribution) {
    throw new Error(
      `No supported distribution was found for input ${options.distributionName}`
    );
  }

  const result = await distribution.setupJava();

  // When the `latest` alias is used, the literal input isn't a real version, so
  // pass the resolved version to the toolchains configuration instead.
  const isLatest = version.trim().toLowerCase() === 'latest';
  const toolchainVersion = isLatest ? result.version : version;

  await toolchains.configureToolchains(
    toolchainVersion,
    options.distributionName,
    result.path,
    options.overwriteSettings || options.addToolchainOnly,
    options.toolchainIds[toolchainId]
  );

  core.info('');
  core.info('Java configuration:');
  core.info(`  Distribution: ${options.distributionName}`);
  core.info(`  Version: ${result.version}`);
  core.info(`  Path: ${result.path}`);
  core.info('');
}

import fs from 'fs';
import * as core from '@actions/core';
import * as auth from './auth';
import { getBooleanInput, isCacheFeatureAvailable, getVersionFromFileContent } from './util';
import * as toolchains from './toolchains';
import * as constants from './constants';
import { restore } from './cache';
import * as path from 'path';
import { getJavaDistribution } from './distributions/distribution-factory';
import { JavaInstallerOptions } from './distributions/base-models';

async function run() {
  try {
    const versions = core.getMultilineInput(constants.INPUT_JAVA_VERSION);
    const distributionName = core.getInput(constants.INPUT_DISTRIBUTION, { required: true });
    const versionFile = core.getInput(constants.INPUT_JAVA_VERSION_FILE);
    const architecture = core.getInput(constants.INPUT_ARCHITECTURE);
    const packageType = core.getInput(constants.INPUT_JAVA_PACKAGE);
    const jdkFile = core.getInput(constants.INPUT_JDK_FILE);
    const cache = core.getInput(constants.INPUT_CACHE);
    const checkLatest = getBooleanInput(constants.INPUT_CHECK_LATEST, false);
    let toolchainIds = core.getMultilineInput(constants.INPUT_MVN_TOOLCHAIN_ID);

    core.startGroup('Installed distributions');

    if (versions.length !== toolchainIds.length) {
      toolchainIds = [];
    }

    if (!versions.length && !versionFile) {
      throw new Error('java-version or java-version-file input expected');
    }

    const installerInputsOptions: installerInputsOptions = {
      architecture,
      packageType,
      checkLatest,
      distributionName,
      jdkFile,
      toolchainIds
    };

    if (!versions.length) {
      core.debug('java-version input is empty, looking for java-version-file input');
      const content = fs
        .readFileSync(versionFile)
        .toString()
        .trim();

      const version = getVersionFromFileContent(content, distributionName);
      core.debug(`Parsed version from file '${version}'`);

      if (!version) {
        throw new Error(`No supported version was found in file ${versionFile}`);
      }

      await installVersion(version, installerInputsOptions);
    }

    for (const [index, version] of versions.entries()) {
      await installVersion(version, installerInputsOptions, index);
    }
    core.endGroup();
    const matchersPath = path.join(__dirname, '..', '..', '.github');
    core.info(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    await auth.configureAuthentication();
    if (cache && isCacheFeatureAvailable()) {
      await restore(cache);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

async function installVersion(version: string, options: installerInputsOptions, toolchainId = 0) {
  const {
    distributionName,
    jdkFile,
    architecture,
    packageType,
    checkLatest,
    toolchainIds
  } = options;

  const installerOptions: JavaInstallerOptions = {
    architecture,
    packageType,
    checkLatest,
    version
  };

  const distribution = getJavaDistribution(distributionName, installerOptions, jdkFile);
  if (!distribution) {
    throw new Error(`No supported distribution was found for input ${distributionName}`);
  }

  const result = await distribution.setupJava();
  await toolchains.configureToolchains(
    version,
    distributionName,
    result.path,
    toolchainIds[toolchainId]
  );

  core.info('');
  core.info('Java configuration:');
  core.info(`  Distribution: ${distributionName}`);
  core.info(`  Version: ${result.version}`);
  core.info(`  Path: ${result.path}`);
  core.info('');
}

interface installerInputsOptions {
  architecture: string;
  packageType: string;
  checkLatest: boolean;
  distributionName: string;
  jdkFile: string;
  toolchainIds: Array<string>;
}

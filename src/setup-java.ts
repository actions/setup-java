import * as core from '@actions/core';
import * as auth from './auth';
import { getBooleanInput, isCacheFeatureAvailable } from './util';
import * as toolchains from './toolchains';
import * as constants from './constants';
import { restore } from './cache';
import * as path from 'path';
import { getJavaDistribution } from './distributions/distribution-factory';
import { JavaInstallerOptions } from './distributions/base-models';

async function run() {
  try {
    const versions = core.getMultilineInput(constants.INPUT_JAVA_VERSION, { required: true });
    const distributionName = core.getInput(constants.INPUT_DISTRIBUTION, { required: true });
    const architecture = core.getInput(constants.INPUT_ARCHITECTURE);
    const packageType = core.getInput(constants.INPUT_JAVA_PACKAGE);
    const jdkFile = core.getInput(constants.INPUT_JDK_FILE);
    const cache = core.getInput(constants.INPUT_CACHE);
    const checkLatest = getBooleanInput(constants.INPUT_CHECK_LATEST, false);
    let toolchainIds = core.getMultilineInput(constants.INPUT_MVN_TOOLCHAIN_ID);

    if (versions.length !== toolchainIds.length) {
      toolchainIds = [];
    }

    core.startGroup('Installed distributions');
    for (const [index, version] of versions.entries()) {
      const installerOptions: JavaInstallerOptions = {
        architecture,
        packageType,
        version,
        checkLatest
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
        toolchainIds[index]
      );

      core.info('');
      core.info('Java configuration:');
      core.info(`  Distribution: ${distributionName}`);
      core.info(`  Version: ${result.version}`);
      core.info(`  Path: ${result.path}`);
      core.info('');
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

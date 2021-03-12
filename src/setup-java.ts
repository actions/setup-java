import * as core from '@actions/core';
import * as auth from './auth';

import * as constants from './constants';
import * as path from 'path';
import { getJavaDistribution } from './distributions/distribution-factory';
import { JavaInstallerOptions } from './distributions/base-models';

async function run() {
  try {
    const version = core.getInput(constants.INPUT_JAVA_VERSION, { required: true });
    const distributionName = core.getInput(constants.INPUT_DISTRIBUTION, { required: true });
    const architecture = core.getInput(constants.INPUT_ARCHITECTURE);
    const packageType = core.getInput(constants.INPUT_JAVA_PACKAGE);
    const jdkFile = core.getInput(constants.INPUT_JDK_FILE);

    const installerOptions: JavaInstallerOptions = {
      architecture,
      packageType,
      version
    };

    const distribution = getJavaDistribution(distributionName, installerOptions, jdkFile);
    if (!distribution) {
      throw new Error(`No supported distribution was found for input ${distributionName}`);
    }

    const result = await distribution.setupJava();

    core.info('');
    core.info('Java configuration:');
    core.info(`  Distribution: ${distributionName}`);
    core.info(`  Version: ${result.version}`);
    core.info(`  Path: ${result.path}`);
    core.info('');

    const matchersPath = path.join(__dirname, '..', '..', '.github');
    core.info(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    await auth.configureAuthentication();
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

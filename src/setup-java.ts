import * as core from '@actions/core';
import * as auth from './auth';
import { getBooleanInput } from './util';
import * as constants from './constants';
import { restore } from './cache';
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
    const cache = core.getInput(constants.INPUT_CACHE);
    const checkLatest = getBooleanInput(constants.INPUT_CHECK_LATEST, false);

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

    const restoreResult = cache ? restore(cache) : Promise.resolve();
    const result = await distribution.setupJava();

    core.info('');
    core.info('Java configuration:');
    core.info(`  Distribution: ${distributionName}`);
    core.info(`  Version: ${result.version}`);
    core.info(`  Path: ${result.path}`);
    core.info('');

    const matchersPath = path.join(__dirname, '..', '..', '.github');
    core.info(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    await Promise.all([restoreResult, auth.configureAuthentication()]);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

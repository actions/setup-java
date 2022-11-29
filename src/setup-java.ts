import fs from 'fs';
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
    const versions = core.getMultilineInput(constants.INPUT_JAVA_VERSION);
    const distributionName = core.getInput(constants.INPUT_DISTRIBUTION, { required: true });
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

    if (!versions.length) {
      core.debug('JAVA_VERSION input is empty, looking for .java-version file');
      const versionFileName = '.java-version';
      const contents = fs
        .readFileSync(versionFileName)
        .toString()
        .trim();
      const semverRegExp = /(?<version>(?<=(^|\s|\-))(\d+\S*))(\s|$)/;
      let version = contents.match(semverRegExp)?.groups?.version ? contents.match(semverRegExp)?.groups?.version as string : '';
      let installed = false;
      while (!installed && version != '') {
        try {
          core.debug(`Trying to install version ${version}`);
          await installVersion(version);
          installed = true;
        } catch (error) {
          core.debug(`${error.toString()}`);
          version = getHigherVersion(version);
        }
      }
      if (!installed) {
        throw new Error("Сan't install appropriate version from .java-version file");
      }
    }

    for (const [index, version] of versions.entries()) {
      await installVersion(version, index);
    }
    core.endGroup();
    const matchersPath = path.join(__dirname, '..', '..', '.github');
    core.info(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);

    await auth.configureAuthentication();
    if (cache && isCacheFeatureAvailable()) {
      await restore(cache);
    }

    async function installVersion(version: string, toolchainId = 0) {
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
        toolchainIds[toolchainId]
      );

      core.info('');
      core.info('Java configuration:');
      core.info(`  Distribution: ${distributionName}`);
      core.info(`  Version: ${result.version}`);
      core.info(`  Path: ${result.path}`);
      core.info('');
    }

    function getHigherVersion(version: string) {
      return version.split('-')[0] === version
        ? version.substring(0, version.lastIndexOf('.'))
        : version.split('-')[0];
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();

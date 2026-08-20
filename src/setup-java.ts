import fs from 'fs';
import * as core from '@actions/core';
import {
  getBooleanInput,
  getVersionFromFileContent,
  isJdkCacheEnabled
} from './util.js';
import * as constants from './constants.js';
import * as path from 'path';
import {fileURLToPath} from 'url';
import {getJavaDistribution} from './distributions/distribution-factory.js';
import {JavaInstallerOptions} from './distributions/base-models.js';
import {configureProblemMatcher} from './problem-matcher.js';
import {validateToolchainIds} from './toolchain-ids.js';

const SIGNATURE_VERIFICATION_DISTRIBUTIONS = new Set(['temurin', 'microsoft']);

export async function run() {
  const versions = core.getMultilineInput(constants.INPUT_JAVA_VERSION);
  let distributionName = core.getInput(constants.INPUT_DISTRIBUTION);
  const versionFile = core.getInput(constants.INPUT_JAVA_VERSION_FILE);
  const architecture = core.getInput(constants.INPUT_ARCHITECTURE);
  const packageType = core.getInput(constants.INPUT_JAVA_PACKAGE);
  const jdkFile = getJdkFileInput();
  const cache = core.getInput(constants.INPUT_CACHE);
  const cacheJdk = isJdkCacheEnabled(cache);
  const cacheDependencyPath = core.getInput(
    constants.INPUT_CACHE_DEPENDENCY_PATH
  );
  const cachePath = core.getMultilineInput(constants.INPUT_CACHE_PATH);
  const checkLatest = getBooleanInput(constants.INPUT_CHECK_LATEST, false);
  const forceDownload = getBooleanInput(constants.INPUT_FORCE_DOWNLOAD, false);
  const setDefault = getBooleanInput(constants.INPUT_SET_DEFAULT, true);
  const verifySignaturePublicKey =
    core.getInput(constants.INPUT_VERIFY_SIGNATURE_PUBLIC_KEY) || undefined;
  const toolchainIds = core.getMultilineInput(constants.INPUT_MVN_TOOLCHAIN_ID);
  let actionError: Error | undefined;
  let cacheRestore: Promise<PromiseSettledResult<void>> | undefined;
  const toolchainConfigurations: ToolchainConfiguration[] = [];

  try {
    core.startGroup('Installed distributions');

    if (!versions.length && !versionFile) {
      throw new Error('java-version or java-version-file input expected');
    }

    validateToolchainIds(versions, versionFile, toolchainIds);

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

      const verifySignature = getBooleanInput(
        constants.INPUT_VERIFY_SIGNATURE,
        SIGNATURE_VERIFICATION_DISTRIBUTIONS.has(distributionName)
      );

      const installerInputsOptions: installerInputsOptions = {
        architecture,
        packageType,
        checkLatest,
        forceDownload,
        cacheJdk,
        setDefault,
        verifySignature,
        verifySignaturePublicKey,
        distributionName,
        jdkFile,
        toolchainIds
      };

      await validateCacheInput(cache);
      cacheRestore = cache
        ? settle(startCacheRestore(cache, cacheDependencyPath, cachePath))
        : undefined;
      toolchainConfigurations.push(
        await installVersion(versionInfo.version, installerInputsOptions)
      );
    } else {
      // When using java-version input, distribution is still required
      if (!distributionName) {
        throw new Error('distribution input is required');
      }

      const verifySignature = getBooleanInput(
        constants.INPUT_VERIFY_SIGNATURE,
        SIGNATURE_VERIFICATION_DISTRIBUTIONS.has(distributionName)
      );

      const installerInputsOptions: installerInputsOptions = {
        architecture,
        packageType,
        checkLatest,
        forceDownload,
        cacheJdk,
        setDefault,
        verifySignature,
        verifySignaturePublicKey,
        distributionName,
        jdkFile,
        toolchainIds
      };

      await validateCacheInput(cache);
      cacheRestore = cache
        ? settle(startCacheRestore(cache, cacheDependencyPath, cachePath))
        : undefined;
      for (const [index, version] of versions.entries()) {
        toolchainConfigurations.push(
          await installVersion(version, installerInputsOptions, index)
        );
      }
    }
    core.endGroup();
    const matchersPath = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '.github'
    );
    configureProblemMatcher(path.join(matchersPath, 'java.json'));

    await configureMaven(toolchainConfigurations);
  } catch (error) {
    actionError = error as Error;
  }

  if (cacheRestore) {
    const cacheResult = await cacheRestore;
    if (cacheResult.status === 'rejected' && !actionError) {
      actionError = cacheResult.reason as Error;
    }
  }

  if (actionError) {
    core.setFailed(actionError.message);
  }
}

async function validateCacheInput(cache: string): Promise<void> {
  if (!cache) {
    return;
  }
  const {validatePackageManager} = await import('./cache.js');
  validatePackageManager(cache);
}

function settle<T>(promise: Promise<T>): Promise<PromiseSettledResult<T>> {
  return promise.then<PromiseFulfilledResult<T>, PromiseRejectedResult>(
    value => ({status: 'fulfilled', value}),
    reason => ({status: 'rejected', reason})
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  run();
} else {
  // https://nodejs.org/api/modules.html#modules_accessing_the_main_module
  core.info('the script is loaded as a module, so skipping the execution');
}

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
  options: installerInputsOptions,
  toolchainId = 0
): Promise<ToolchainConfiguration> {
  const {
    distributionName,
    jdkFile,
    architecture,
    packageType,
    checkLatest,
    forceDownload,
    cacheJdk,
    setDefault,
    verifySignature,
    verifySignaturePublicKey,
    toolchainIds
  } = options;

  const installerOptions: JavaInstallerOptions = {
    architecture,
    packageType,
    checkLatest,
    forceDownload,
    cacheJdk,
    setDefault,
    verifySignature,
    verifySignaturePublicKey,
    version
  };

  const distribution = await getJavaDistribution(
    distributionName,
    installerOptions,
    jdkFile
  );
  if (!distribution) {
    throw new Error(
      `No supported distribution was found for input ${distributionName}`
    );
  }

  const result = await distribution.setupJava();

  // When the `latest` alias is used, the literal input isn't a real version, so
  // pass the resolved version to the toolchains configuration instead.
  const isLatest = version.trim().toLowerCase() === 'latest';
  const toolchainVersion = isLatest ? result.version : version;

  core.info('');
  core.info('Java configuration:');
  core.info(`  Distribution: ${distributionName}`);
  core.info(`  Version: ${result.version}`);
  core.info(`  Path: ${result.path}`);
  core.info('');

  return {
    version: toolchainVersion,
    distributionName,
    path: result.path,
    toolchainId: toolchainIds[toolchainId]
  };
}

interface installerInputsOptions {
  architecture: string;
  packageType: string;
  checkLatest: boolean;
  forceDownload: boolean;
  cacheJdk: boolean;
  setDefault: boolean;
  verifySignature: boolean;
  verifySignaturePublicKey: string | undefined;
  distributionName: string;
  jdkFile: string;
  toolchainIds: Array<string>;
}

interface ToolchainConfiguration {
  version: string;
  distributionName: string;
  path: string;
  toolchainId?: string;
}

async function configureMaven(
  toolchainConfigurations: ToolchainConfiguration[]
): Promise<void> {
  const authentication = import('./auth.js').then(auth =>
    auth.configureAuthentication()
  );
  const toolchains = configureInstalledToolchains(toolchainConfigurations);

  const results = await Promise.allSettled([authentication, toolchains]);
  const failure = results.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failure) {
    throw failure.reason;
  }

  const {configureMavenArgs} = await import('./maven-args.js');
  configureMavenArgs();
}

async function configureInstalledToolchains(
  toolchainConfigurations: ToolchainConfiguration[]
): Promise<void> {
  const toolchains = await import('./toolchains.js');
  for (const configuration of toolchainConfigurations) {
    await toolchains.configureToolchains(
      configuration.version,
      configuration.distributionName,
      configuration.path,
      configuration.toolchainId
    );
  }
}

async function startCacheRestore(
  cache: string,
  cacheDependencyPath: string,
  cachePath: string[]
): Promise<void> {
  const {isCacheFeatureAvailable} = await import('./cache-feature.js');
  if (!isCacheFeatureAvailable()) {
    return;
  }

  const {restore} = await import('./cache.js');
  await restore(cache, cacheDependencyPath, cachePath);
}

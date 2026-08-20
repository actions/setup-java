import {jest, describe, it, expect, beforeEach} from '@jest/globals';

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getMultilineInput: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  setSecret: jest.fn(),
  isDebug: jest.fn(() => false),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  group: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  toPlatformPath: jest.fn((value: string) => value),
  toWin32Path: jest.fn((value: string) => value),
  toPosixPath: jest.fn((value: string) => value)
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    readFileSync: jest.fn()
  }
}));

jest.unstable_mockModule('../src/util.js', () => ({
  getBooleanInput: jest.fn(),
  getVersionFromFileContent: jest.fn(),
  isJdkCacheEnabled: jest.fn()
}));

jest.unstable_mockModule('../src/toolchains.js', () => ({
  validateToolchainIds: jest.fn(),
  configureToolchains: jest.fn()
}));

jest.unstable_mockModule('../src/toolchain-ids.js', () => ({
  validateToolchainIds: jest.fn()
}));

jest.unstable_mockModule('../src/cache.js', () => ({
  restore: jest.fn(),
  validatePackageManager: jest.fn()
}));

jest.unstable_mockModule('../src/cache-feature.js', () => ({
  isCacheFeatureAvailable: jest.fn()
}));

jest.unstable_mockModule(
  '../src/distributions/distribution-factory.js',
  () => ({
    getJavaDistribution: jest.fn()
  })
);

jest.unstable_mockModule('../src/auth.js', () => ({
  configureAuthentication: jest.fn()
}));

jest.unstable_mockModule('../src/maven-args.js', () => ({
  configureMavenArgs: jest.fn()
}));

jest.unstable_mockModule('../src/problem-matcher.js', () => ({
  configureProblemMatcher: jest.fn()
}));

const core = await import('@actions/core');
const fs = (await import('fs')).default;
const util = await import('../src/util.js');
const toolchains = await import('../src/toolchains.js');
const toolchainIds = await import('../src/toolchain-ids.js');
const cache = await import('../src/cache.js');
const cacheFeature = await import('../src/cache-feature.js');
const factory = await import('../src/distributions/distribution-factory.js');
const auth = await import('../src/auth.js');
const mavenArgs = await import('../src/maven-args.js');
const problemMatcher = await import('../src/problem-matcher.js');
const {run} = await import('../src/setup-java.js');

const inputCallsOnImport = (core.getInput as jest.Mock).mock.calls.length;
const multilineInputCallsOnImport = (core.getMultilineInput as jest.Mock).mock
  .calls.length;

describe('setup action orchestration', () => {
  const inputs = new Map<string, string>();
  const multilineInputs = new Map<string, string[]>();
  const booleanInputs = new Map<string, boolean>();

  beforeEach(() => {
    jest.resetAllMocks();
    inputs.clear();
    multilineInputs.clear();
    booleanInputs.clear();

    (core.getInput as jest.Mock).mockImplementation((name: unknown) => {
      return inputs.get(name as string) ?? '';
    });
    (core.getMultilineInput as jest.Mock).mockImplementation(
      (name: unknown) => {
        return multilineInputs.get(name as string) ?? [];
      }
    );
    (util.getBooleanInput as jest.Mock).mockImplementation(
      (name: unknown, defaultValue: unknown) => {
        return booleanInputs.get(name as string) ?? defaultValue;
      }
    );
    (util.isJdkCacheEnabled as jest.Mock).mockImplementation(
      (cache: string) => {
        const explicit = inputs.get('cache-jdk');
        return explicit
          ? (booleanInputs.get('cache-jdk') ?? explicit === 'true')
          : Boolean(cache);
      }
    );
    (cacheFeature.isCacheFeatureAvailable as jest.Mock).mockReturnValue(true);
    (toolchainIds.validateToolchainIds as jest.Mock).mockImplementation(
      () => undefined
    );
    (toolchains.configureToolchains as jest.Mock).mockResolvedValue(undefined);
    (auth.configureAuthentication as jest.Mock).mockResolvedValue(undefined);
    (cache.restore as jest.Mock).mockResolvedValue(undefined);
    (cache.validatePackageManager as jest.Mock).mockImplementation(
      () => undefined
    );
  });

  it('does not execute the action when imported', () => {
    expect(inputCallsOnImport).toBe(0);
    expect(multilineInputCallsOnImport).toBe(0);
  });

  it('requires java-version or java-version-file', async () => {
    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'java-version or java-version-file input expected'
    );
    expect(factory.getJavaDistribution).not.toHaveBeenCalled();
    expect(problemMatcher.configureProblemMatcher).not.toHaveBeenCalled();
  });

  it('requires distribution when java-version is provided', async () => {
    multilineInputs.set('java-version', ['21']);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'distribution input is required'
    );
    expect(factory.getJavaDistribution).not.toHaveBeenCalled();
  });

  it.each([
    ['temurin', undefined, true],
    ['microsoft', undefined, true],
    ['zulu', undefined, false],
    ['temurin', false, false]
  ])(
    'defaults signature verification for %s with explicit value %s to %s',
    async (distribution, explicitValue, expectedValue) => {
      inputs.set('distribution', distribution);
      multilineInputs.set('java-version', ['21']);
      if (explicitValue !== undefined) {
        booleanInputs.set('verify-signature', explicitValue);
      }
      (factory.getJavaDistribution as jest.Mock).mockReturnValue({
        setupJava: jest.fn(async () => ({
          version: '21.0.4+7',
          path: '/opt/java/21'
        }))
      });

      await run();

      expect(factory.getJavaDistribution).toHaveBeenCalledWith(
        distribution,
        expect.objectContaining({verifySignature: expectedValue}),
        ''
      );
    }
  );

  it('requires distribution when it cannot be inferred from the version file', async () => {
    inputs.set('java-version-file', '.java-version');
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('21'));
    (util.getVersionFromFileContent as jest.Mock).mockReturnValue({
      version: '21'
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'distribution input is required when not specified in the version file'
    );
    expect(factory.getJavaDistribution).not.toHaveBeenCalled();
  });

  it('fails when the version file has no supported version', async () => {
    inputs.set('java-version-file', '.java-version');
    inputs.set('distribution', 'temurin');
    (fs.readFileSync as jest.Mock).mockReturnValue(Buffer.from('invalid'));
    (util.getVersionFromFileContent as jest.Mock).mockReturnValue(undefined);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'No supported version was found in file .java-version'
    );
    expect(factory.getJavaDistribution).not.toHaveBeenCalled();
  });

  it('uses the distribution inferred from a version file', async () => {
    inputs.set('java-version-file', '.sdkmanrc');
    inputs.set('architecture', 'x64');
    inputs.set('java-package', 'jdk');
    inputs.set('distribution', 'zulu');
    inputs.set('jdk-file', '/tmp/java.tar.gz');
    multilineInputs.set('mvn-toolchain-id', ['file-jdk']);
    booleanInputs.set('check-latest', true);
    booleanInputs.set('force-download', true);
    booleanInputs.set('set-default', false);
    inputs.set('verify-signature-public-key', 'public-key');
    (fs.readFileSync as jest.Mock).mockReturnValue(
      Buffer.from('java=21.0.5-tem')
    );
    (util.getVersionFromFileContent as jest.Mock).mockReturnValue({
      version: '21.0.5',
      distribution: 'temurin'
    });
    const setupJava = jest.fn(async () => ({
      version: '21.0.5+11',
      path: '/opt/java/21'
    }));
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({setupJava});

    await run();

    expect(util.getVersionFromFileContent).toHaveBeenCalledWith(
      'java=21.0.5-tem',
      'zulu',
      '.sdkmanrc'
    );
    expect(factory.getJavaDistribution).toHaveBeenCalledWith(
      'temurin',
      {
        version: '21.0.5',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: true,
        forceDownload: true,
        cacheJdk: false,
        setDefault: false,
        verifySignature: true,
        verifySignaturePublicKey: 'public-key'
      },
      '/tmp/java.tar.gz'
    );
    expect(toolchainIds.validateToolchainIds).toHaveBeenCalledWith(
      [],
      '.sdkmanrc',
      ['file-jdk']
    );
    expect(toolchains.configureToolchains).toHaveBeenCalledWith(
      '21.0.5',
      'temurin',
      '/opt/java/21',
      'file-jdk'
    );
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('installs multiple JDKs in order with matching toolchain IDs', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('architecture', 'x64');
    inputs.set('java-package', 'jdk');
    multilineInputs.set('java-version', ['17', '21']);
    multilineInputs.set('mvn-toolchain-id', ['java-17', 'java-21']);

    const setupJava17 = jest.fn(async () => ({
      version: '17.0.12+7',
      path: '/opt/java/17'
    }));
    const setupJava21 = jest.fn(async () => ({
      version: '21.0.4+7',
      path: '/opt/java/21'
    }));
    (factory.getJavaDistribution as jest.Mock)
      .mockReturnValueOnce({setupJava: setupJava17})
      .mockReturnValueOnce({setupJava: setupJava21});

    await run();

    expect(factory.getJavaDistribution).toHaveBeenNthCalledWith(
      1,
      'temurin',
      expect.objectContaining({version: '17'}),
      ''
    );
    expect(factory.getJavaDistribution).toHaveBeenNthCalledWith(
      2,
      'temurin',
      expect.objectContaining({version: '21'}),
      ''
    );
    expect(toolchains.configureToolchains).toHaveBeenNthCalledWith(
      1,
      '17',
      'temurin',
      '/opt/java/17',
      'java-17'
    );
    expect(toolchains.configureToolchains).toHaveBeenNthCalledWith(
      2,
      '21',
      'temurin',
      '/opt/java/21',
      'java-21'
    );
    expect(setupJava17.mock.invocationCallOrder[0]).toBeLessThan(
      setupJava21.mock.invocationCallOrder[0]
    );
  });

  it('uses the resolved version for the latest Maven toolchain', async () => {
    inputs.set('distribution', 'temurin');
    multilineInputs.set('java-version', ['latest']);
    const setupJava = jest.fn(async () => ({
      version: '24.0.2+12',
      path: '/opt/java/24'
    }));
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({setupJava});

    await run();

    expect(toolchains.configureToolchains).toHaveBeenCalledWith(
      '24.0.2+12',
      'temurin',
      '/opt/java/24',
      undefined
    );
  });

  it('starts cache restoration before post-install steps and awaits it before finishing', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'maven');
    inputs.set('cache-dependency-path', '**/pom.xml');
    multilineInputs.set('java-version', ['21']);
    multilineInputs.set('cache-path', [
      '/custom/maven/repository',
      '!/custom/maven/repository/excluded'
    ]);
    const cacheRestore = deferred<void>();
    let resolveSetupJava: (() => void) | undefined;
    const setupJava = jest.fn(
      () =>
        new Promise<{version: string; path: string}>(resolve => {
          resolveSetupJava = () =>
            resolve({
              version: '21.0.4+7',
              path: '/opt/java/21'
            });
        })
    );
    (cache.restore as jest.Mock).mockReturnValue(cacheRestore.promise);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({setupJava});

    const runPromise = run();
    try {
      await tick();

      expect(cacheFeature.isCacheFeatureAvailable).toHaveBeenCalled();
      expect(cache.restore).toHaveBeenCalledWith('maven', '**/pom.xml', [
        '/custom/maven/repository',
        '!/custom/maven/repository/excluded'
      ]);
      expect(toolchains.configureToolchains).not.toHaveBeenCalled();

      resolveSetupJava?.();
      await tick();
      expect(problemMatcher.configureProblemMatcher).toHaveBeenCalledWith(
        expect.stringMatching(/\.github[/\\]java\.json$/)
      );

      expect(
        (problemMatcher.configureProblemMatcher as jest.Mock).mock
          .invocationCallOrder[0]
      ).toBeLessThan(
        (auth.configureAuthentication as jest.Mock).mock.invocationCallOrder[0]
      );
      expect(
        (problemMatcher.configureProblemMatcher as jest.Mock).mock
          .invocationCallOrder[0]
      ).toBeLessThan(
        (toolchains.configureToolchains as jest.Mock).mock
          .invocationCallOrder[0]
      );
      expect(
        (auth.configureAuthentication as jest.Mock).mock.invocationCallOrder[0]
      ).toBeLessThan(
        (mavenArgs.configureMavenArgs as jest.Mock).mock.invocationCallOrder[0]
      );
      expect(
        (toolchains.configureToolchains as jest.Mock).mock
          .invocationCallOrder[0]
      ).toBeLessThan(
        (mavenArgs.configureMavenArgs as jest.Mock).mock.invocationCallOrder[0]
      );

      let completed = false;
      runPromise.then(() => {
        completed = true;
      });
      await tick();
      expect(completed).toBe(false);
    } finally {
      resolveSetupJava?.();
      cacheRestore.resolve();
      await runPromise;
    }

    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('overlaps independent Maven settings and toolchains configuration', async () => {
    inputs.set('distribution', 'temurin');
    multilineInputs.set('java-version', ['21']);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({
      setupJava: jest.fn(async () => ({
        version: '21.0.4+7',
        path: '/opt/java/21'
      }))
    });
    const authentication = deferred<void>();
    const toolchainConfiguration = deferred<void>();
    (auth.configureAuthentication as jest.Mock).mockReturnValue(
      authentication.promise
    );
    (toolchains.configureToolchains as jest.Mock).mockReturnValue(
      toolchainConfiguration.promise
    );

    const runPromise = run();
    try {
      await tick();
      await tick();

      expect(auth.configureAuthentication).toHaveBeenCalled();
      expect(toolchains.configureToolchains).toHaveBeenCalledWith(
        '21',
        'temurin',
        '/opt/java/21',
        undefined
      );
      expect(mavenArgs.configureMavenArgs).not.toHaveBeenCalled();

      authentication.resolve();
      await tick();
      expect(mavenArgs.configureMavenArgs).not.toHaveBeenCalled();

      toolchainConfiguration.resolve();
      await runPromise;
    } finally {
      authentication.resolve();
      toolchainConfiguration.resolve();
      await runPromise;
    }

    expect(mavenArgs.configureMavenArgs).toHaveBeenCalled();
    expect(core.setFailed).not.toHaveBeenCalled();
  });

  it('skips cache restoration when the cache feature is unavailable', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'maven');
    multilineInputs.set('java-version', ['21']);
    (cacheFeature.isCacheFeatureAvailable as jest.Mock).mockReturnValue(false);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({
      setupJava: jest.fn(async () => ({
        version: '21.0.4+7',
        path: '/opt/java/21'
      }))
    });

    await run();

    expect(cache.restore).not.toHaveBeenCalled();
  });

  it('does not initialize cache modules when cache input is absent', async () => {
    inputs.set('distribution', 'temurin');
    multilineInputs.set('java-version', ['21']);
    booleanInputs.set('cache-jdk', false);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({
      setupJava: jest.fn(async () => ({
        version: '21.0.4+7',
        path: '/opt/java/21'
      }))
    });

    await run();

    expect(cacheFeature.isCacheFeatureAvailable).not.toHaveBeenCalled();
    expect(cache.restore).not.toHaveBeenCalled();
    expect(factory.getJavaDistribution).toHaveBeenCalledWith(
      'temurin',
      expect.objectContaining({cacheJdk: false}),
      ''
    );
  });

  it('fails invalid cache input before resolving a Java distribution', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'ant');
    multilineInputs.set('java-version', ['21']);
    const setupJava = jest.fn();
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({setupJava});
    (cache.validatePackageManager as jest.Mock).mockImplementation(() => {
      throw new Error('unknown package manager specified: ant');
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'unknown package manager specified: ant'
    );
    expect(factory.getJavaDistribution).not.toHaveBeenCalled();
    expect(setupJava).not.toHaveBeenCalled();
    expect(cache.restore).not.toHaveBeenCalled();
  });

  it('reports missing java-version before validating the cache input', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'ant');
    (cache.validatePackageManager as jest.Mock).mockImplementation(() => {
      throw new Error('unknown package manager specified: ant');
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'java-version or java-version-file input expected'
    );
    expect(cache.validatePackageManager).not.toHaveBeenCalled();
  });

  it.each([
    ['', '', false],
    ['', 'true', true],
    ['', 'false', false],
    ['maven', '', true],
    ['maven', 'true', true],
    ['maven', 'false', false]
  ])(
    'passes effective JDK caching for cache=%j and cache-jdk=%j',
    async (cacheInput, cacheJdkInput, expected) => {
      inputs.set('distribution', 'temurin');
      inputs.set('cache', cacheInput);
      inputs.set('cache-jdk', cacheJdkInput);
      multilineInputs.set('java-version', ['21']);
      if (cacheJdkInput) {
        booleanInputs.set('cache-jdk', cacheJdkInput === 'true');
      }
      (factory.getJavaDistribution as jest.Mock).mockReturnValue({
        setupJava: jest.fn(async () => ({
          version: '21.0.4+7',
          path: '/opt/java/21'
        }))
      });

      await run();

      expect(factory.getJavaDistribution).toHaveBeenCalledWith(
        'temurin',
        expect.objectContaining({cacheJdk: expected}),
        ''
      );
    }
  );

  it('reports unsupported distributions through core.setFailed', async () => {
    inputs.set('distribution', 'unsupported');
    multilineInputs.set('java-version', ['21']);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue(null);

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(
      'No supported distribution was found for input unsupported'
    );
    expect(toolchains.configureToolchains).not.toHaveBeenCalled();
    expect(problemMatcher.configureProblemMatcher).not.toHaveBeenCalled();
  });

  it('reports collaborator failures and stops post-install configuration', async () => {
    inputs.set('distribution', 'temurin');
    multilineInputs.set('java-version', ['21']);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({
      setupJava: jest.fn(async () => {
        throw new Error('download failed');
      })
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('download failed');
    expect(toolchains.configureToolchains).not.toHaveBeenCalled();
    expect(problemMatcher.configureProblemMatcher).not.toHaveBeenCalled();
    expect(auth.configureAuthentication).not.toHaveBeenCalled();
    expect(mavenArgs.configureMavenArgs).not.toHaveBeenCalled();
    expect(cache.restore).not.toHaveBeenCalled();
  });

  it('reports post-install failures and skips later collaborators', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'maven');
    multilineInputs.set('java-version', ['21']);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({
      setupJava: jest.fn(async () => ({
        version: '21.0.4+7',
        path: '/opt/java/21'
      }))
    });
    (auth.configureAuthentication as jest.Mock).mockRejectedValue(
      new Error('authentication failed')
    );

    await run();

    expect(problemMatcher.configureProblemMatcher).toHaveBeenCalled();
    expect(core.setFailed).toHaveBeenCalledWith('authentication failed');
    expect(mavenArgs.configureMavenArgs).not.toHaveBeenCalled();
    expect(cache.restore).toHaveBeenCalled();
  });

  it('keeps Java setup errors deterministic when cache restore also fails', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'maven');
    multilineInputs.set('java-version', ['21']);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({
      setupJava: jest.fn(async () => {
        throw new Error('download failed');
      })
    });
    (cache.restore as jest.Mock).mockRejectedValue(
      new Error('cache restore failed')
    );

    await run();

    expect(core.setFailed).toHaveBeenCalledWith('download failed');
  });

  it('observes cache failures while Java setup is still pending', async () => {
    inputs.set('distribution', 'temurin');
    inputs.set('cache', 'maven');
    multilineInputs.set('java-version', ['21']);
    const javaSetup = deferred<{version: string; path: string}>();
    const setupJava = jest.fn(() => javaSetup.promise);
    (factory.getJavaDistribution as jest.Mock).mockReturnValue({setupJava});
    const cacheRestore = deferred<void>();
    const cacheRestoreCalled = deferred<void>();
    (cache.restore as jest.Mock).mockImplementation(() => {
      cacheRestoreCalled.resolve();
      return cacheRestore.promise;
    });
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => {
      unhandledRejections.push(reason);
    };
    process.on('unhandledRejection', onUnhandledRejection);

    const runPromise = run();
    try {
      // Only reject once the restore has actually started and while the Java
      // installation is still pending, so the unfixed code would leave the
      // rejection unhandled.
      await cacheRestoreCalled.promise;
      cacheRestore.reject(new Error('cache restore failed'));
      await tick();

      expect(setupJava).toHaveBeenCalled();
      expect(unhandledRejections).toEqual([]);
      expect(core.setFailed).not.toHaveBeenCalled();
    } finally {
      javaSetup.resolve({version: '21.0.4+7', path: '/opt/java/21'});
      await runPromise;
      process.off('unhandledRejection', onUnhandledRejection);
    }

    expect(unhandledRejections).toEqual([]);
    expect(core.setFailed).toHaveBeenCalledWith('cache restore failed');
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
}

async function tick() {
  await new Promise(resolve => setTimeout(resolve, 0));
}

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll
} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Mock @actions/cache before importing source modules
const real_cache_module = await import('@actions/cache');
jest.unstable_mockModule('@actions/cache', () => ({
  ...real_cache_module,
  saveCache: jest.fn(),
  restoreCache: jest.fn()
}));

// Mock @actions/core before importing source modules that depend on it
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
  toPlatformPath: jest.fn((p: string) => p),
  toWin32Path: jest.fn((p: string) => p),
  toPosixPath: jest.fn((p: string) => p)
}));

const real_util_module = await import('../src/util.js');
jest.unstable_mockModule('../src/util.js', () => ({
  ...real_util_module,
  extractJdkFile: jest.fn(),
  getDownloadArchiveExtension: jest.fn(),
  getToolcachePath: jest.fn(),
  isJobStatusSuccess: jest.fn(),
  renameWinArchive: jest.fn(),
  isVersionSatisfies: real_util_module.isVersionSatisfies,
  getTempDir: real_util_module.getTempDir
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const cache = await import('@actions/cache');
const {run: cleanup} = await import('../src/cleanup-java.js');
const util = await import('../src/util.js');
const {registerJdk, buildJdkCacheKey} = await import('../src/jdk-cache.js');

const jdkTempRoots: string[] = [];

describe('cleanup', () => {
  let spyWarning: any;
  let spyInfo: any;
  let spyCacheSave: any;
  let spyJobStatusSuccess: any;
  let spyCoreError: any;

  beforeEach(() => {
    spyWarning = core.warning as jest.Mock;
    spyWarning.mockImplementation(() => null);

    spyInfo = core.info as jest.Mock;
    spyInfo.mockImplementation(() => null);

    spyCacheSave = cache.saveCache as jest.Mock;

    spyJobStatusSuccess = util.isJobStatusSuccess as jest.Mock;
    spyJobStatusSuccess.mockReturnValue(true);

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});

    createStateForSuccessfulRestore();
  });

  afterEach(() => {
    while (jdkTempRoots.length) {
      fs.rmSync(jdkTempRoots.pop()!, {recursive: true, force: true});
    }
    resetState();
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('does not warn/fail even when the save process throws a ReserveCacheError', async () => {
    spyCacheSave.mockImplementation((paths: string[], key: string) =>
      Promise.reject(
        new cache.ReserveCacheError(
          'Unable to reserve cache with key, another job may be creating this cache.'
        )
      )
    );
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
      return name === 'cache' ? 'gradle' : '';
    });
    await cleanup();
    expect(spyCacheSave).toHaveBeenCalled();
    expect(spyWarning).not.toHaveBeenCalled();
  });

  it('does not fail even though the save process throws error', async () => {
    spyCacheSave.mockImplementation((paths: string[], key: string) =>
      Promise.reject(new Error('Unexpected error'))
    );
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
      return name === 'cache' ? 'gradle' : '';
    });
    await cleanup();
    expect(spyCacheSave).toHaveBeenCalled();
  });

  it.each(['maven', 'gradle', 'sbt'])(
    'does not save the %s cache in read-only mode',
    async packageManager => {
      createStateForSuccessfulRestoreWithWrapper(packageManager);
      (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
        switch (name) {
          case 'cache':
            return packageManager;
          case 'cache-read-only':
            return 'true';
          default:
            return '';
        }
      });

      await cleanup();

      expect(spyCacheSave).not.toHaveBeenCalled();
      expect(core.getState).not.toHaveBeenCalled();
      expect(spyInfo).toHaveBeenCalledWith(
        'Cache saving is skipped because cache-read-only is enabled.'
      );
    }
  );

  it('saves the cache when read-only mode is explicitly disabled', async () => {
    spyCacheSave.mockResolvedValue(0);
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
      switch (name) {
        case 'cache':
          return 'maven';
        case 'cache-read-only':
          return 'false';
        default:
          return '';
      }
    });

    await cleanup();

    expect(spyCacheSave).toHaveBeenCalled();
  });

  it('saves the JDK cache without dependency caching', async () => {
    const {key, path: jdkPath, state} = createRegisteredJdk();
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'cache-jdk' ? 'true' : ''
    );
    (core.getState as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'jdk-caches' ? state : ''
    );
    spyCacheSave.mockResolvedValue(1);

    await cleanup();

    expect(spyCacheSave).toHaveBeenCalledWith([jdkPath], key);
  });

  it('does not save a JDK cache when cache-jdk is disabled', async () => {
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'cache-jdk' ? 'false' : ''
    );

    await cleanup();

    expect(spyCacheSave).not.toHaveBeenCalled();
  });

  it.each([
    ['', '', false],
    ['', 'true', true],
    ['', 'false', false],
    ['maven', '', true],
    ['maven', 'true', true],
    ['maven', 'false', false]
  ])(
    'uses effective JDK caching for cache=%j and cache-jdk=%j',
    async (cacheInput, cacheJdkInput, expectedJdkSave) => {
      const {key: jdkKey, path: jdkPath, state} = createRegisteredJdk();
      (core.getInput as jest.Mock<any>).mockImplementation((name: string) => {
        if (name === 'cache') return cacheInput;
        if (name === 'cache-jdk') return cacheJdkInput;
        return '';
      });
      (core.getState as jest.Mock<any>).mockImplementation((name: string) =>
        name === 'jdk-caches' ? state : ''
      );
      spyCacheSave.mockResolvedValue(1);

      await cleanup();

      const jdkSaveCalls = spyCacheSave.mock.calls.filter(
        ([, key]) => key === jdkKey
      );
      expect(jdkSaveCalls).toHaveLength(expectedJdkSave ? 1 : 0);
      if (expectedJdkSave) {
        expect(spyCacheSave).toHaveBeenCalledWith([jdkPath], jdkKey);
      }
    }
  );

  it('keeps saving the remaining JDK caches when one save fails', async () => {
    const first = createRegisteredJdk();
    const second = createRegisteredJdk('17.0.19+9');
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'cache-jdk' ? 'true' : ''
    );
    (core.getState as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'jdk-caches' ? second.state : ''
    );
    spyCacheSave.mockImplementation(async (paths: string[]) => {
      if (paths[0] === first.path) {
        throw new Error('Unexpected save failure');
      }
      return 1;
    });

    await cleanup();

    expect(spyCacheSave).toHaveBeenCalledWith([first.path], first.key);
    expect(spyCacheSave).toHaveBeenCalledWith([second.path], second.key);
    expect(spyCoreError).not.toHaveBeenCalled();
  });

  it('does not save a JDK installation that was replaced after registration', async () => {
    const {key, path: jdkPath, state, replace} = createRegisteredJdk();
    (core.getInput as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'cache-jdk' ? 'true' : ''
    );
    (core.getState as jest.Mock<any>).mockImplementation((name: string) =>
      name === 'jdk-caches' ? state : ''
    );
    spyCacheSave.mockResolvedValue(1);
    replace();

    await cleanup();

    expect(spyCacheSave).not.toHaveBeenCalledWith([jdkPath], key);
  });
});

function resetState() {
  (core.getState as jest.Mock).mockReset();
}

/**
 * Create states to emulate a successful restore process.
 */
function createStateForSuccessfulRestore() {
  (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
    switch (name) {
      case 'cache-primary-key':
        return 'setup-java-cache-primary-key';
      case 'cache-matched-key':
        return 'setup-java-cache-matched-key';
      default:
        return '';
    }
  });
}

function createStateForSuccessfulRestoreWithWrapper(packageManager: string) {
  (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
    switch (name) {
      case 'cache-primary-key':
        return 'setup-java-cache-primary-key';
      case 'cache-matched-key':
        return 'setup-java-cache-matched-key';
      case `cache-primary-key-${packageManager}-wrapper`:
        return `setup-java-${packageManager}-wrapper-primary-key`;
      default:
        return '';
    }
  });
}

/**
 * Register a real JDK installation in a temporary tool cache so the post-job
 * save sees the same installation identity that setup recorded.
 */
function createRegisteredJdk(version = '21.0.8+9') {
  const root = fs.mkdtempSync(
    path.join(os.tmpdir(), 'setup-java-cleanup-jdk-')
  );
  jdkTempRoots.push(root);
  const jdkPath = path.join(
    root,
    'Java_temurin_jdk',
    version.replace('+', '-')
  );
  const write = (marker: string) => {
    const architecturePath = path.join(jdkPath, 'x64');
    fs.rmSync(architecturePath, {recursive: true, force: true});
    fs.rmSync(`${architecturePath}.complete`, {force: true});
    fs.mkdirSync(architecturePath, {recursive: true});
    fs.writeFileSync(path.join(architecturePath, 'release'), marker);
    fs.writeFileSync(`${architecturePath}.complete`, marker);
  };
  write('installed');

  const jdk = {
    distribution: 'temurin',
    packageType: 'jdk',
    architecture: 'x64',
    version,
    source: `sha256:${path.basename(root)}`,
    verification: 'unverified',
    path: jdkPath
  };
  registerJdk(jdk);
  const state = (
    (core.saveState as jest.Mock).mock.calls.at(-1) as string[]
  )[1];

  return {
    key: buildJdkCacheKey(jdk),
    path: jdkPath,
    state,
    replace: () => write('replaced-by-a-later-step')
  };
}

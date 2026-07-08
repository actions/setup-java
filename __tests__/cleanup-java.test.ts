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

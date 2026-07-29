import {jest, describe, it, expect, afterEach} from '@jest/globals';

jest.unstable_mockModule('@actions/cache', () => ({
  isFeatureAvailable: jest.fn()
}));

jest.unstable_mockModule('@actions/core', () => ({
  warning: jest.fn(),
  debug: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getMultilineInput: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
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

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const {isCacheFeatureAvailable} = await import('../src/cache-feature.js');

describe('isCacheFeatureAvailable', () => {
  it('is disabled on GHES when cache feature is unavailable', () => {
    (cache.isFeatureAvailable as jest.Mock<any>).mockImplementation(
      () => false
    );
    const warningMock = core.warning as jest.Mock;
    const message =
      'Caching is only supported on GHES version >= 3.5. If you are on a version >= 3.5, please check with your GHES admin if the Actions cache service is enabled or not.';

    try {
      process.env['GITHUB_SERVER_URL'] = 'http://example.com';
      expect(isCacheFeatureAvailable()).toBe(false);
      expect(warningMock).toHaveBeenCalledWith(message);
    } finally {
      delete process.env['GITHUB_SERVER_URL'];
    }
  });

  it('is disabled on dotcom when cache feature is unavailable', () => {
    (cache.isFeatureAvailable as jest.Mock<any>).mockImplementation(
      () => false
    );
    const warningMock = core.warning as jest.Mock;
    const message =
      'The runner was not able to contact the cache service. Caching will be skipped';

    try {
      process.env['GITHUB_SERVER_URL'] = 'http://github.com';
      expect(isCacheFeatureAvailable()).toBe(false);
      expect(warningMock).toHaveBeenCalledWith(message);
    } finally {
      delete process.env['GITHUB_SERVER_URL'];
    }
  });

  it('is enabled when cache feature is available', () => {
    (cache.isFeatureAvailable as jest.Mock<any>).mockImplementation(() => true);
    expect(isCacheFeatureAvailable()).toBe(true);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
  });
});

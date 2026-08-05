import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import fs from 'fs';
import path from 'path';

jest.unstable_mockModule('@actions/cache', () => ({
  restoreCache: jest.fn(),
  saveCache: jest.fn(),
  ReserveCacheError: class ReserveCacheError extends Error {}
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn()
}));

jest.unstable_mockModule('../src/cache-feature.js', () => ({
  isCacheFeatureAvailable: jest.fn()
}));

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const cacheFeature = await import('../src/cache-feature.js');
const {
  buildJdkCacheKey,
  getJdkVerificationIdentity,
  registerJdk,
  restoreJdk,
  saveJdkCaches
} = await import('../src/jdk-cache.js');

const jdk = {
  distribution: 'temurin',
  packageType: 'jdk',
  architecture: 'x64',
  version: '21.0.8+9',
  source: 'sha256:abc123',
  verification: 'unverified',
  path: '/toolcache/Java_temurin_jdk/21.0.8-9'
};

describe('JDK cache', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (cacheFeature.isCacheFeatureAvailable as jest.Mock).mockReturnValue(true);
    process.env['RUNNER_OS'] = 'Linux';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env['RUNNER_OS'];
  });

  it('builds distinct keys for incompatible JDK identities', () => {
    const key = buildJdkCacheKey(jdk);

    expect(key).toMatch(/^setup-java-jdk-v1-linux-x64-[a-f0-9]{64}$/);
    expect(buildJdkCacheKey({...jdk, architecture: 'aarch64'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, distribution: 'zulu'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, packageType: 'jre'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, version: '21.0.7+6'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, source: 'sha256:def456'})).not.toBe(key);
  });

  it('normalizes runner OS casing and separates operating systems', () => {
    process.env['RUNNER_OS'] = 'LINUX';
    const upperCaseLinux = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'linux';
    const lowerCaseLinux = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'Windows';
    const windows = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'win32';
    const windowsAlias = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'macOS';
    const macos = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'darwin';
    const macosAlias = buildJdkCacheKey(jdk);

    expect(upperCaseLinux).toBe(lowerCaseLinux);
    expect(windowsAlias).toBe(windows);
    expect(macosAlias).toBe(macos);
    expect(new Set([lowerCaseLinux, windows, macos])).toHaveProperty('size', 3);
    expect(windows).toMatch(/^setup-java-jdk-v1-windows-x64-/);
    expect(macos).toMatch(/^setup-java-jdk-v1-macos-x64-/);
  });

  it('falls back to the normalized process platform without RUNNER_OS', () => {
    delete process.env['RUNNER_OS'];
    const expectedOs =
      process.platform === 'win32'
        ? 'windows'
        : process.platform === 'darwin'
          ? 'macos'
          : process.platform.toLowerCase();

    expect(buildJdkCacheKey(jdk)).toMatch(
      new RegExp(`^setup-java-jdk-v1-${expectedOs}-x64-`)
    );
  });

  it('separates unverified, bundled-key, and custom-key caches', () => {
    const unverified = getJdkVerificationIdentity(false);
    const bundled = getJdkVerificationIdentity(true);
    const customA = getJdkVerificationIdentity(
      true,
      '-----BEGIN PGP PUBLIC KEY BLOCK-----\r\nkey-a\r\n-----END PGP PUBLIC KEY BLOCK-----\r\n'
    );
    const customANormalized = getJdkVerificationIdentity(
      true,
      '-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey-a\n-----END PGP PUBLIC KEY BLOCK-----'
    );
    const customB = getJdkVerificationIdentity(true, 'different-key');

    expect(new Set([unverified, bundled, customA, customB])).toHaveProperty(
      'size',
      4
    );
    expect(customA).toBe(customANormalized);
    expect(customA).not.toContain('key-a');
    expect(
      new Set(
        [unverified, bundled, customA, customB].map(verification =>
          buildJdkCacheKey({...jdk, verification})
        )
      )
    ).toHaveProperty('size', 4);
  });

  it('restores and records an exact JDK cache hit', async () => {
    (cache.restoreCache as jest.Mock).mockResolvedValue(buildJdkCacheKey(jdk));
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    await expect(restoreJdk(jdk)).resolves.toBe(true);

    expect(cache.restoreCache).toHaveBeenCalledWith(
      [jdk.path],
      buildJdkCacheKey(jdk)
    );
    const architecturePath = path.join(jdk.path, 'x64');
    expect(fs.existsSync).toHaveBeenCalledWith(architecturePath);
    expect(fs.existsSync).toHaveBeenCalledWith(`${architecturePath}.complete`);
    expect(core.saveState).toHaveBeenCalledWith(
      'jdk-caches',
      expect.stringContaining(buildJdkCacheKey(jdk))
    );
  });

  it('falls back to download when restoration fails', async () => {
    (cache.restoreCache as jest.Mock).mockRejectedValue(
      new Error('cache unavailable')
    );

    await expect(restoreJdk(jdk)).resolves.toBe(false);
    expect(core.warning).toHaveBeenCalledWith(
      'Failed to restore JDK cache: cache unavailable'
    );
  });

  it('saves a downloaded JDK recorded during restore', async () => {
    const key = buildJdkCacheKey(jdk);
    (core.getState as jest.Mock).mockReturnValue(
      JSON.stringify([{key, path: jdk.path}])
    );
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    (cache.saveCache as jest.Mock).mockResolvedValue(1);

    await saveJdkCaches();

    expect(cache.saveCache).toHaveBeenCalledWith([jdk.path], key);
  });

  it('registers a force-downloaded JDK without restoring it', () => {
    registerJdk(jdk);

    expect(cache.restoreCache).not.toHaveBeenCalled();
    expect(core.saveState).toHaveBeenCalledWith(
      'jdk-caches',
      expect.stringContaining(buildJdkCacheKey(jdk))
    );
  });

  it('does not save an exact JDK cache hit again', async () => {
    const key = buildJdkCacheKey(jdk);
    (core.getState as jest.Mock).mockReturnValue(
      JSON.stringify([{key, path: jdk.path, matchedKey: key}])
    );

    await saveJdkCaches();

    expect(cache.saveCache).not.toHaveBeenCalled();
  });
});

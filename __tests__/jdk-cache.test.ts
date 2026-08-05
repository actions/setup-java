import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.unstable_mockModule('@actions/cache', () => ({
  restoreCache: jest.fn(),
  saveCache: jest.fn(),
  ReserveCacheError: class ReserveCacheError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ReserveCacheError';
    }
  }
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
  const tempRoots: string[] = [];

  const createInstallation = (marker = 'a'): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-java-jdk-'));
    tempRoots.push(root);
    const jdkPath = path.join(root, 'Java_temurin_jdk', '21.0.8-9');
    writeInstallation(jdkPath, marker);
    return jdkPath;
  };

  const writeInstallation = (jdkPath: string, marker: string): void => {
    const architecturePath = path.join(jdkPath, 'x64');
    fs.rmSync(architecturePath, {recursive: true, force: true});
    fs.rmSync(`${architecturePath}.complete`, {force: true});
    fs.mkdirSync(path.join(architecturePath, 'bin'), {recursive: true});
    fs.writeFileSync(path.join(architecturePath, 'bin', 'java'), marker);
    fs.writeFileSync(`${architecturePath}.complete`, marker);
  };

  const lastState = (): string =>
    ((core.saveState as jest.Mock).mock.calls.at(-1) as string[])[1];

  beforeEach(() => {
    jest.resetAllMocks();
    (cacheFeature.isCacheFeatureAvailable as jest.Mock).mockReturnValue(true);
    process.env['RUNNER_OS'] = 'Linux';
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env['RUNNER_OS'];
    while (tempRoots.length) {
      fs.rmSync(tempRoots.pop()!, {recursive: true, force: true});
    }
  });

  it('builds distinct keys for incompatible JDK identities', () => {
    const key = buildJdkCacheKey(jdk);

    expect(key).toMatch(/^setup-java-jdk-v1-Linux-x64-[a-f0-9]{64}$/);
    expect(buildJdkCacheKey({...jdk, architecture: 'aarch64'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, distribution: 'zulu'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, packageType: 'jre'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, version: '21.0.7+6'})).not.toBe(key);
    expect(buildJdkCacheKey({...jdk, source: 'sha256:def456'})).not.toBe(key);
  });

  it('preserves canonical runner OS values and separates operating systems', () => {
    process.env['RUNNER_OS'] = 'Linux';
    const linux = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'Windows';
    const windows = buildJdkCacheKey(jdk);
    process.env['RUNNER_OS'] = 'macOS';
    const macos = buildJdkCacheKey(jdk);

    expect(new Set([linux, windows, macos])).toHaveProperty('size', 3);
    expect(linux).toMatch(/^setup-java-jdk-v1-Linux-x64-/);
    expect(windows).toMatch(/^setup-java-jdk-v1-Windows-x64-/);
    expect(macos).toMatch(/^setup-java-jdk-v1-macOS-x64-/);
  });

  it('falls back to process.platform without RUNNER_OS', () => {
    delete process.env['RUNNER_OS'];

    expect(buildJdkCacheKey(jdk)).toMatch(
      new RegExp(`^setup-java-jdk-v1-${process.platform}-x64-`)
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

  it('saves a downloaded JDK registered after installation', async () => {
    const jdkPath = createInstallation();
    const installed = {...jdk, path: jdkPath};
    const key = buildJdkCacheKey(installed);
    (cache.restoreCache as jest.Mock).mockResolvedValue(undefined);

    await restoreJdk(installed);
    registerJdk(installed);
    (core.getState as jest.Mock).mockReturnValue(lastState());
    (cache.saveCache as jest.Mock).mockResolvedValue(1);

    await saveJdkCaches();

    expect(cache.saveCache).toHaveBeenCalledWith([jdkPath], key);
  });

  it('does not save an installation that was replaced after registration', async () => {
    const jdkPath = createInstallation();
    const installed = {...jdk, path: jdkPath};
    const key = buildJdkCacheKey(installed);

    registerJdk(installed);
    (core.getState as jest.Mock).mockReturnValue(lastState());
    writeInstallation(jdkPath, 'replaced-by-a-later-step');

    await saveJdkCaches();

    expect(cache.saveCache).not.toHaveBeenCalledWith([jdkPath], key);
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('was replaced after it was registered')
    );
  });

  it('saves only the key matching the installation that occupies the path', async () => {
    const jdkPath = createInstallation();
    const verified = {...jdk, path: jdkPath, verification: 'verified:bundled'};
    const unverified = {...jdk, path: jdkPath};

    registerJdk(verified);
    writeInstallation(jdkPath, 'force-downloaded-without-verification');
    registerJdk(unverified);
    (core.getState as jest.Mock).mockReturnValue(lastState());
    (cache.saveCache as jest.Mock).mockResolvedValue(1);

    await saveJdkCaches();

    expect(cache.saveCache).not.toHaveBeenCalledWith(
      [jdkPath],
      buildJdkCacheKey(verified)
    );
    expect(cache.saveCache).toHaveBeenCalledWith(
      [jdkPath],
      buildJdkCacheKey(unverified)
    );
  });

  it('does not save a path that was never registered as installed', async () => {
    const jdkPath = createInstallation();
    const installed = {...jdk, path: jdkPath};
    (cache.restoreCache as jest.Mock).mockResolvedValue(undefined);

    await restoreJdk(installed);
    (core.getState as jest.Mock).mockReturnValue(lastState());

    await saveJdkCaches();

    expect(cache.saveCache).not.toHaveBeenCalledWith(
      [jdkPath],
      buildJdkCacheKey(installed)
    );
  });

  it('keeps saving the remaining JDK caches when one save fails', async () => {
    const failingPath = createInstallation();
    const succeedingPath = createInstallation();
    const failing = {...jdk, path: failingPath};
    const succeeding = {...jdk, path: succeedingPath, version: '17.0.19+9'};

    registerJdk(failing);
    registerJdk(succeeding);
    (core.getState as jest.Mock).mockReturnValue(lastState());
    (cache.saveCache as jest.Mock).mockImplementation(
      async (paths: unknown) => {
        if ((paths as string[])[0] === failingPath) {
          throw new Error('cache service unavailable');
        }
        return 1;
      }
    );

    await expect(saveJdkCaches()).resolves.toBeUndefined();

    expect(cache.saveCache).toHaveBeenCalledWith(
      [succeedingPath],
      buildJdkCacheKey(succeeding)
    );
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('cache service unavailable')
    );
    expect(core.info).toHaveBeenCalledWith(
      `JDK cache saved with the key: ${buildJdkCacheKey(succeeding)}`
    );
  });

  it('reports a reserved cache key without failing the remaining saves', async () => {
    const reservedPath = createInstallation();
    const reserved = {...jdk, path: reservedPath};

    registerJdk(reserved);
    (core.getState as jest.Mock).mockReturnValue(lastState());
    (cache.saveCache as jest.Mock).mockRejectedValue(
      new cache.ReserveCacheError('Unable to reserve cache')
    );

    await expect(saveJdkCaches()).resolves.toBeUndefined();

    expect(core.info).toHaveBeenCalledWith('Unable to reserve cache');
  });

  it('registers a force-downloaded JDK without restoring it', () => {
    const jdkPath = createInstallation();
    registerJdk({...jdk, path: jdkPath});

    expect(cache.restoreCache).not.toHaveBeenCalled();
    expect(core.saveState).toHaveBeenCalledWith(
      'jdk-caches',
      expect.stringContaining(buildJdkCacheKey({...jdk, path: jdkPath}))
    );
  });

  it('does not save an exact JDK cache hit again', async () => {
    const key = buildJdkCacheKey(jdk);
    (core.getState as jest.Mock).mockReturnValue(
      JSON.stringify([
        {
          key,
          path: jdk.path,
          architecture: jdk.architecture,
          matchedKey: key
        }
      ])
    );

    await saveJdkCaches();

    expect(cache.saveCache).not.toHaveBeenCalled();
  });
});

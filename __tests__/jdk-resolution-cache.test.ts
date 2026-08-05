import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

jest.unstable_mockModule('@actions/cache', () => ({
  isFeatureAvailable: jest.fn(),
  restoreCache: jest.fn(),
  saveCache: jest.fn()
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn()
}));

const cache = await import('@actions/cache');
const core = await import('@actions/core');
const {restoreJdkResolution, registerJdkResolution, saveJdkResolutionCaches} =
  await import('../src/jdk-resolution-cache.js');

const request = {
  distribution: 'Temurin-Hotspot',
  packageType: 'jdk',
  platform: 'linux-glibc',
  architecture: 'x64',
  versionSpec: '21',
  stable: true
};

const release = {
  version: '21.0.8+9',
  url: 'https://example.com/jdk-21.0.8.tar.gz',
  checksum: {algorithm: 'sha256' as const, value: 'abc123'}
};

const WEEK = 7 * 24 * 60 * 60 * 1000;
const bucket = () =>
  new Date(Math.floor(Date.now() / WEEK) * WEEK).toISOString().slice(0, 10);

describe('JDK resolution cache', () => {
  const tempRoots: string[] = [];
  let originalTemp: string | undefined;
  let originalOs: string | undefined;

  const createRunnerTemp = (): string => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-java-res-'));
    tempRoots.push(root);
    process.env['RUNNER_TEMP'] = root;
    return root;
  };

  /** Emulates the cache service materializing the entry at the requested path. */
  const restoreWith = (contents: string, matchedKey: string) => {
    jest
      .mocked(cache.restoreCache)
      .mockImplementation(async (paths: string[]) => {
        fs.mkdirSync(paths[0], {recursive: true});
        fs.writeFileSync(path.join(paths[0], 'release.json'), contents);
        return matchedKey;
      });
  };

  beforeEach(() => {
    originalTemp = process.env['RUNNER_TEMP'];
    originalOs = process.env['RUNNER_OS'];
    process.env['RUNNER_OS'] = 'Linux';
    jest.mocked(cache.isFeatureAvailable).mockReturnValue(true);
    jest.mocked(cache.restoreCache).mockResolvedValue(undefined);
    jest.mocked(cache.saveCache).mockResolvedValue(1);
    jest.mocked(core.getState).mockReturnValue('');
  });

  afterEach(() => {
    process.env['RUNNER_TEMP'] = originalTemp;
    process.env['RUNNER_OS'] = originalOs;
    if (originalTemp === undefined) {
      delete process.env['RUNNER_TEMP'];
    }
    if (originalOs === undefined) {
      delete process.env['RUNNER_OS'];
    }
    while (tempRoots.length > 0) {
      fs.rmSync(tempRoots.pop()!, {recursive: true, force: true});
    }
    jest.resetAllMocks();
  });

  describe('restoreJdkResolution', () => {
    it('looks the entry up with a bucket-independent path', async () => {
      const runnerTemp = createRunnerTemp();
      await restoreJdkResolution(request);

      const [paths, primaryKey, restoreKeys] = jest.mocked(cache.restoreCache)
        .mock.calls[0] as [string[], string, string[]];
      expect(paths).toHaveLength(1);
      expect(
        paths[0].startsWith(path.join(runnerTemp, 'setup-java-jdk-resolution'))
      ).toBe(true);
      expect(paths[0]).not.toContain(bucket());
      expect(primaryKey).toBe(`${restoreKeys[0]}${bucket()}`);
      expect(restoreKeys[0]).toMatch(
        /^setup-java-jdkres-v2-Linux-x64-[0-9a-f]{64}-$/
      );
    });

    it('separates glibc and musl Linux resolutions', async () => {
      createRunnerTemp();
      await restoreJdkResolution(request);
      const [glibcPaths, glibcKey] = jest.mocked(cache.restoreCache).mock
        .calls[0] as [string[], string];

      await restoreJdkResolution({...request, platform: 'linux-musl'});
      const [muslPaths, muslKey] = jest.mocked(cache.restoreCache).mock
        .calls[1] as [string[], string];

      expect(muslKey).not.toBe(glibcKey);
      expect(muslPaths).not.toEqual(glibcPaths);
    });

    it('holds the key steady for a week and then rolls it', async () => {
      createRunnerTemp();
      const nowSpy = jest.spyOn(Date, 'now');
      const keyAt = async (ms: number) => {
        nowSpy.mockReturnValue(ms);
        await restoreJdkResolution(request);
        return jest.mocked(cache.restoreCache).mock.calls.at(-1)![1] as string;
      };

      // A window boundary, so the offsets below are unambiguous.
      const windowStart = 2900 * WEEK;

      const start = await keyAt(windowStart);
      const sameWindow = await keyAt(windowStart + 6 * 24 * 60 * 60 * 1000);
      const nextWindow = await keyAt(windowStart + WEEK);

      expect(sameWindow).toBe(start);
      expect(nextWindow).not.toBe(start);
      nowSpy.mockRestore();
    });

    it('reports a hit on the current bucket as fresh', async () => {
      createRunnerTemp();
      const key = `setup-java-jdkres-v2-Linux-x64-${'0'.repeat(64)}-${bucket()}`;
      restoreWith(JSON.stringify(release), key);

      // The key the module computes is the one it passes to restoreCache, so
      // echo it back to emulate an exact hit.
      jest
        .mocked(cache.restoreCache)
        .mockImplementation(async (paths: string[], primaryKey: string) => {
          fs.mkdirSync(paths[0], {recursive: true});
          fs.writeFileSync(
            path.join(paths[0], 'release.json'),
            JSON.stringify(release)
          );
          return primaryKey;
        });

      const restored = await restoreJdkResolution(request);
      expect(restored?.fresh).toBe(true);
      expect(restored?.release).toEqual(release);
    });

    it('reports a hit on an older bucket as stale', async () => {
      createRunnerTemp();
      restoreWith(JSON.stringify(release), 'setup-java-jdkres-v2-old');

      const restored = await restoreJdkResolution(request);
      expect(restored?.fresh).toBe(false);
      expect(restored?.release).toEqual(release);
    });

    it('returns nothing when the entry is missing', async () => {
      createRunnerTemp();
      await expect(restoreJdkResolution(request)).resolves.toBeUndefined();
    });

    it('returns nothing when the cache service is unavailable', async () => {
      createRunnerTemp();
      jest.mocked(cache.isFeatureAvailable).mockReturnValue(false);

      await expect(restoreJdkResolution(request)).resolves.toBeUndefined();
      expect(cache.restoreCache).not.toHaveBeenCalled();
    });

    it('returns nothing when RUNNER_TEMP is not set', async () => {
      delete process.env['RUNNER_TEMP'];

      await expect(restoreJdkResolution(request)).resolves.toBeUndefined();
      expect(cache.restoreCache).not.toHaveBeenCalled();
    });

    it('does not fail the job when the restore throws', async () => {
      createRunnerTemp();
      jest
        .mocked(cache.restoreCache)
        .mockRejectedValue(new Error('service unavailable'));

      await expect(restoreJdkResolution(request)).resolves.toBeUndefined();
    });

    it.each([
      ['malformed JSON', 'not json'],
      ['a non-object payload', '"nope"'],
      [
        'a missing version',
        JSON.stringify({url: 'https://example.com/a.tar.gz'})
      ],
      ['a missing url', JSON.stringify({version: '21.0.8+9'})],
      [
        'a non-HTTPS url',
        JSON.stringify({
          version: '21.0.8+9',
          url: 'http://example.com/a.tar.gz'
        })
      ],
      [
        'a malformed url',
        JSON.stringify({version: '21.0.8+9', url: 'not-a-url'})
      ],
      [
        'a non-HTTPS signature url',
        JSON.stringify({
          version: '21.0.8+9',
          url: 'https://example.com/a.tar.gz',
          signatureUrl: 'http://example.com/a.sig'
        })
      ],
      [
        'an unsupported checksum algorithm',
        JSON.stringify({
          version: '21.0.8+9',
          url: 'https://example.com/a.tar.gz',
          checksum: {algorithm: 'md5', value: 'abc'}
        })
      ],
      [
        'a checksum without a value',
        JSON.stringify({
          version: '21.0.8+9',
          url: 'https://example.com/a.tar.gz',
          checksum: {algorithm: 'sha256'}
        })
      ]
    ])('rejects an entry with %s', async (_name, contents) => {
      createRunnerTemp();
      restoreWith(contents, 'setup-java-jdkres-v2-old');

      await expect(restoreJdkResolution(request)).resolves.toBeUndefined();
    });

    it('keeps the optional fields of a valid entry', async () => {
      createRunnerTemp();
      const full = {
        version: '21.0.8+9',
        url: 'https://example.com/a.tar.gz',
        signatureUrl: 'https://example.com/a.sig',
        checksum: {
          algorithm: 'sha512',
          value: 'def456',
          source: 'https://example.com/a.sha512'
        }
      };
      restoreWith(JSON.stringify(full), 'setup-java-jdkres-v2-old');

      const restored = await restoreJdkResolution(request);
      expect(restored?.release).toEqual(full);
    });

    it('ignores unknown fields rather than passing them through', async () => {
      createRunnerTemp();
      restoreWith(
        JSON.stringify({...release, evil: 'payload'}),
        'setup-java-jdkres-v2-old'
      );

      const restored = await restoreJdkResolution(request);
      expect(restored?.release).toEqual(release);
    });
  });

  describe('registerJdkResolution', () => {
    it('writes the release and records it under the current bucket', () => {
      createRunnerTemp();
      registerJdkResolution(request, release);

      const state = JSON.parse(
        jest.mocked(core.saveState).mock.calls.at(-1)![1] as string
      );
      const entry = state.at(-1);
      expect(entry.key.endsWith(bucket())).toBe(true);
      expect(
        JSON.parse(
          fs.readFileSync(path.join(entry.path, 'release.json'), 'utf8')
        )
      ).toEqual(release);
    });

    it('does nothing when the cache service is unavailable', () => {
      createRunnerTemp();
      jest.mocked(cache.isFeatureAvailable).mockReturnValue(false);

      registerJdkResolution(request, release);
      expect(core.saveState).not.toHaveBeenCalled();
    });

    it('does nothing when RUNNER_TEMP is not set', () => {
      delete process.env['RUNNER_TEMP'];

      registerJdkResolution(request, release);
      expect(core.saveState).not.toHaveBeenCalled();
    });

    it('uses different keys for different requests', () => {
      createRunnerTemp();
      registerJdkResolution(request, release);
      registerJdkResolution({...request, distribution: 'zulu'}, release);

      const state = JSON.parse(
        jest.mocked(core.saveState).mock.calls.at(-1)![1] as string
      );
      expect(new Set(state.map((item: {key: string}) => item.key)).size).toBe(
        state.length
      );
    });
  });

  describe('saveJdkResolutionCaches', () => {
    const stateFor = (cachePath: string) =>
      JSON.stringify([
        {
          key: 'setup-java-jdkres-v2-key',
          path: cachePath,
          release: JSON.stringify(release)
        }
      ]);

    it('does nothing without state', async () => {
      await saveJdkResolutionCaches();
      expect(cache.saveCache).not.toHaveBeenCalled();
    });

    it('saves a recorded entry', async () => {
      const root = createRunnerTemp();
      jest.mocked(core.getState).mockReturnValue(stateFor(root));

      await saveJdkResolutionCaches();
      expect(cache.saveCache).toHaveBeenCalledWith(
        [root],
        'setup-java-jdkres-v2-key'
      );
    });

    it('saves the payload the key was computed for, not the file on disk', async () => {
      const root = createRunnerTemp();
      jest.mocked(core.getState).mockReturnValue(stateFor(root));
      // A restore performed by a later step replaces the file behind the key.
      fs.writeFileSync(
        path.join(root, 'release.json'),
        JSON.stringify({version: '8.0.1+1', url: 'https://example.com/stale'})
      );

      await saveJdkResolutionCaches();

      expect(
        JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'))
      ).toEqual(release);
      expect(cache.saveCache).toHaveBeenCalled();
    });

    it('does not fail the job when the payload cannot be written', async () => {
      const root = createRunnerTemp();
      const blocked = path.join(root, 'blocked');
      fs.writeFileSync(blocked, 'not a directory');
      jest.mocked(core.getState).mockReturnValue(stateFor(blocked));

      await expect(saveJdkResolutionCaches()).resolves.toBeUndefined();
      expect(cache.saveCache).not.toHaveBeenCalled();
    });

    it('does not fail the job when the save throws', async () => {
      const root = createRunnerTemp();
      jest.mocked(core.getState).mockReturnValue(stateFor(root));
      jest
        .mocked(cache.saveCache)
        .mockRejectedValue(new Error('already reserved'));

      await expect(saveJdkResolutionCaches()).resolves.toBeUndefined();
    });

    it('does not fail the job on invalid state', async () => {
      jest.mocked(core.getState).mockReturnValue('{}');

      await expect(saveJdkResolutionCaches()).resolves.toBeUndefined();
      expect(cache.saveCache).not.toHaveBeenCalled();
    });
  });
});

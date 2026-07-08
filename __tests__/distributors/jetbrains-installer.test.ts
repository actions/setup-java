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
import https from 'https';
import {HttpClient} from '@actions/http-client';

import manifestData from '../data/jetbrains.json' with {type: 'json'};
import os from 'os';

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

// Dynamic imports after mocking
const core = await import('@actions/core');
const {JetBrainsDistribution} =
  await import('../../src/distributions/jetbrains/installer.js');

describe('getAvailableVersions', () => {
  let spyHttpClient: any;
  let spyCoreError: any;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: []
    });

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('load available versions', async () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      })
      .mockReturnValue({
        statusCode: 200,
        headers: {},
        result: []
      });

    const distribution = new JetBrainsDistribution({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();

    const length =
      os.platform() === 'win32' ? manifestData.length : manifestData.length + 2;
    expect(availableVersions.length).toBe(length);
  }, 10_000);
});

describe('findPackageForDownload', () => {
  it.each([
    ['17', '17.0.11+1207.24'],
    ['11.0', '11.0.16+2043.64'],
    ['11.0.11', '11.0.11+1542.1'],
    ['21.0.2', '21.0.2+375.1'],
    ['21', '21.0.3+465.3'],
    ['x', '21.0.3+465.3']
  ])('version is resolved correctly %s -> %s', async (input, expected) => {
    const distribution = new JetBrainsDistribution({
      version: input,
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it.each(['17', '11.0', '11.0.11', '21.0.2', '21'])(
    'version %s can be downloaded',
    async input => {
      const distribution = new JetBrainsDistribution({
        version: input,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => manifestData as any;
      const resolvedVersion =
        await distribution['findPackageForDownload'](input);
      const url = resolvedVersion.url;
      const options = {method: 'HEAD'};

      await new Promise<void>((resolve, reject) => {
        const request = https.request(url, options, res => {
          let assertionError: unknown;

          try {
            // JetBrains uses 403 for non-existent packages
            expect(res.statusCode).not.toBe(403);
          } catch (error) {
            assertionError = error;
          }

          res.resume();
          res.once('error', reject);
          res.once('end', () =>
            assertionError ? reject(assertionError as Error) : resolve()
          );
        });

        request.on('error', reject);
        request.end();
      });
    }
  );

  it('version is not found', async () => {
    const distribution = new JetBrainsDistribution({
      version: '8.0.452',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(distribution['findPackageForDownload']('8.x')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new JetBrainsDistribution({
      version: '8',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });
});

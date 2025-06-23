import https from 'https';
import {HttpClient} from '@actions/http-client';
import {JetBrainsDistribution} from '../../src/distributions/jetbrains/installer';

import manifestData from '../data/jetbrains.json';
import os from 'os';

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: []
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('load available versions', async () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValueOnce({
      statusCode: 200,
      headers: {},
      result: manifestData as any
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
      const resolvedVersion = await distribution['findPackageForDownload'](
        input
      );
      const url = resolvedVersion.url;
      const options = {method: 'HEAD'};

      https.request(url, options, res => {
        // JetBrains uses 403 for inexistent packages
        expect(res.statusCode).not.toBe(403);
        res.resume();
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
      /Could not find satisfied version for SemVer */
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
      /Could not find satisfied version for SemVer */
    );
  });
});

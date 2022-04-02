import { HttpClient } from '@actions/http-client';

import { CorettoDistribution } from '../../src/distributions/corretto/installer';
import * as util from '../../src/util';

const manifestData = require('../data/corretto.json') as [];

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;
  let spyGetDownloadArchiveExtension: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData
    });
    spyGetDownloadArchiveExtension = jest.spyOn(util, 'getDownloadArchiveExtension');
    spyGetDownloadArchiveExtension.mockReturnValue('tar.gz');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('load available versions', async () => {
    const distribution = new CorettoDistribution({
      version: '11',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getPlatformOption'] = () => 'linux';

    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(6);
  });

  it('find package for download', async () => {
    const distribution = new CorettoDistribution({
      version: '15',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getPlatformOption'] = () => 'linux';

    const availableVersion = await distribution['findPackageForDownload']('15');
    expect(availableVersion).not.toBeNull();
  });
});

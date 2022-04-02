import { HttpClient } from '@actions/http-client';

import { CorettoDistribution } from '../../src/distributions/corretto/installer';
import { JavaInstallerOptions } from '../../src/distributions/base-models';

describe('getAvailableVersions', () => {
  beforeEach(() => {});

  afterEach(() => {});

  it('load available versions', async () => {
    const distribution = new CorettoDistribution({
      version: '11',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(6);
  });

  it('find package for download', async () => {
    const distribution = new CorettoDistribution({
      version: '11',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersion = await distribution['findPackageForDownload']('15');
    expect(availableVersion).not.toBeNull();
  });
});

import { HttpClient } from '@actions/http-client';

import { CorettoDistribution } from '../../src/distributions/coretto/installer';
import { JavaInstallerOptions } from '../../src/distributions/base-models';

describe('getAvailableVersions', () => {
  beforeEach(() => {});

  afterEach(() => {});

  it('load available versions', async () => {
    const distribution = new CorettoDistribution('coretto', {
      version: '11',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(24);
  });
});

import {HttpClient} from '@actions/http-client';
import {JavaInstallerOptions} from '../../src/distributions/base-models';

import {CorrettoDistribution} from '../../src/distributions/corretto/installer';
import * as util from '../../src/util';
import os from 'os';
import {isGeneratorFunction} from 'util/types';

import manifestData from '../data/corretto.json';

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
    spyGetDownloadArchiveExtension = jest.spyOn(
      util,
      'getDownloadArchiveExtension'
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('getAvailableVersions', () => {
    it('load available versions', async () => {
      const distribution = new CorrettoDistribution({
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');

      const availableVersions = await distribution['getAvailableVersions']();
      expect(availableVersions).not.toBeNull();
      expect(availableVersions.length).toBe(6);
    });

    it.each([
      [
        {
          version: '16',
          architecture: 'x64',
          packageType: 'jdk',
          checkLatest: false
        },
        'macos',
        6
      ],
      [
        {
          version: '16',
          architecture: 'x86',
          packageType: 'jdk',
          checkLatest: false
        },
        'macos',
        0
      ],
      [
        {
          version: '16',
          architecture: 'x64',
          packageType: 'jre',
          checkLatest: false
        },
        'macos',
        0
      ],
      [
        {
          version: '16',
          architecture: 'x64',
          packageType: 'jdk',
          checkLatest: false
        },
        'linux',
        6
      ],
      [
        {
          version: '18',
          architecture: 'x64',
          packageType: 'jdk',
          checkLatest: false
        },
        'windows',
        6
      ],
      [
        {
          version: '18',
          architecture: 'x64',
          packageType: 'jre',
          checkLatest: false
        },
        'windows',
        1
      ]
    ])(
      'fetch expected amount of available versions for %s',
      async (
        installerOptions: JavaInstallerOptions,
        platform: string,
        expectedAmountOfAvailableVersions
      ) => {
        const distribution = new CorrettoDistribution(installerOptions);
        mockPlatform(distribution, platform);

        const availableVersions = await distribution['getAvailableVersions']();
        expect(availableVersions).not.toBeNull();
        expect(availableVersions.length).toBe(
          expectedAmountOfAvailableVersions
        );
      }
    );
  });

  describe('findPackageForDownload', () => {
    it.each([
      [
        'macos',
        'https://corretto.aws/downloads/resources/18.0.0.37.1/amazon-corretto-18.0.0.37.1-macosx-x64.tar.gz'
      ],
      [
        'windows',
        'https://corretto.aws/downloads/resources/18.0.0.37.1/amazon-corretto-18.0.0.37.1-windows-x64-jdk.zip'
      ],
      [
        'linux',
        'https://corretto.aws/downloads/resources/18.0.0.37.1/amazon-corretto-18.0.0.37.1-linux-x64.tar.gz'
      ]
    ])('for os: %s', async (platform: string, expectedLink: string) => {
      const version = '18';
      const distribution = new CorrettoDistribution({
        version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, platform);

      const availableVersion = await distribution['findPackageForDownload'](
        version
      );
      expect(availableVersion).not.toBeNull();
      expect(availableVersion.url).toBe(expectedLink);
    });

    it('with unstable version expect to throw not supported error', async () => {
      const version = '18.0.1-ea';
      const distribution = new CorrettoDistribution({
        version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');

      await expect(
        distribution['findPackageForDownload'](version)
      ).rejects.toThrow('Early access versions are not supported');
    });

    it('with non major version expect to throw not supported error', async () => {
      const version = '18.0.1';
      const distribution = new CorrettoDistribution({
        version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');

      await expect(
        distribution['findPackageForDownload'](version)
      ).rejects.toThrow('Only major versions are supported');
    });

    it('with unfound version throw could not find error', async () => {
      const version = '4';
      const distribution = new CorrettoDistribution({
        version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');

      await expect(
        distribution['findPackageForDownload'](version)
      ).rejects.toThrow("Could not find satisfied version for SemVer '4'");
    });

    it.each([
      ['arm64', 'aarch64'],
      ['amd64', 'x64']
    ])(
      'defaults to os.arch(): %s mapped to distro arch: %s',
      async (osArch: string, distroArch: string) => {
        jest.spyOn(os, 'arch').mockReturnValue(osArch);

        const version = '17';
        const installerOptions: JavaInstallerOptions = {
          version,
          architecture: '', // to get default value
          packageType: 'jdk',
          checkLatest: false
        };

        const distribution = new CorrettoDistribution(installerOptions);
        mockPlatform(distribution, 'macos');

        const expectedLink = `https://corretto.aws/downloads/resources/17.0.2.8.1/amazon-corretto-17.0.2.8.1-macosx-${distroArch}.tar.gz`;

        const availableVersion = await distribution['findPackageForDownload'](
          version
        );
        expect(availableVersion).not.toBeNull();
        expect(availableVersion.url).toBe(expectedLink);
      }
    );
  });

  const mockPlatform = (
    distribution: CorrettoDistribution,
    platform: string
  ) => {
    distribution['getPlatformOption'] = () => platform;
    const mockedExtension = platform === 'windows' ? 'zip' : 'tar.gz';
    spyGetDownloadArchiveExtension.mockReturnValue(mockedExtension);
  };
});

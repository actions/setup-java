import {HttpClient} from '@actions/http-client';
import {SapMachineDistribution} from '../../src/distributions/sapmachine/installer';
import * as utils from '../../src/util';

import manifestData from '../data/sapmachine.json';

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;
  let spyUtilGetDownloadArchiveExtension: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData
    });

    spyUtilGetDownloadArchiveExtension = jest.spyOn(
      utils,
      'getDownloadArchiveExtension'
    );
    spyUtilGetDownloadArchiveExtension.mockReturnValue('tar.gz');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  const mockPlatform = (
    distribution: SapMachineDistribution,
    platform: string
  ) => {
    distribution['getPlatformOption'] = () => platform;
    const mockedExtension = platform == 'windows' ? 'zip' : 'tar.gz';
    spyUtilGetDownloadArchiveExtension.mockReturnValue(mockedExtension);
  };

  describe('shouldFallbackToBackupUrl', () => {
    it('should return correct release when the primary URL is not available', async () => {
      spyHttpClient.mockReturnValueOnce({
        statusCode: 404,
        headers: {},
        result: ''
      });
      spyHttpClient.mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData
      });

      const version = '17';
      const distribution = new SapMachineDistribution({
        version: version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });

      mockPlatform(distribution, 'linux');

      const availableVersion = await distribution['findPackageForDownload'](
        version
      );
      expect(availableVersion).not.toBeNull();
      expect(availableVersion.url).toBe(
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jdk-17.0.10_linux-x64_bin.tar.gz'
      );
    });
  });

  describe('getAvailableVersions', () => {
    it.each([
      ['11', 'x64', 'linux', 71],
      ['11', 'aarch64', 'linux', 54],
      ['17', 'riscv', 'linux', 0],
      ['16.0.1', 'x64', 'linux', 71],
      ['23-ea', 'x64', 'linux', 798],
      ['23-ea', 'aarch64', 'windows', 0],
      ['23-ea', 'x64', 'windows', 750]
    ])(
      'should get right number of available versions from JSON',
      async (
        jdkVersion: string,
        arch: string,
        platform: string,
        len: number
      ) => {
        const distribution = new SapMachineDistribution({
          version: jdkVersion,
          architecture: arch,
          packageType: 'jdk',
          checkLatest: false
        });
        mockPlatform(distribution, platform);

        const availableVersions = await distribution['getAvailableVersions']();
        expect(availableVersions).not.toBeNull();
        expect(availableVersions.length).toBe(len);
      }
    );
  });

  describe('findPackageForDownload', () => {
    it.each([
      [
        '11',
        'linux',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-11.0.22/sapmachine-jdk-11.0.22_linux-x64_bin.tar.gz'
      ],
      [
        '11',
        'linux',
        'aarch64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-11.0.22/sapmachine-jdk-11.0.22_linux-aarch64_bin.tar.gz'
      ],
      [
        '11',
        'windows',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-11.0.22/sapmachine-jdk-11.0.22_windows-x64_bin.zip'
      ],
      [
        '11.0.17',
        'linux',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-11.0.17/sapmachine-jdk-11.0.17_linux-x64_bin.tar.gz'
      ],
      [
        '17',
        'linux',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jdk-17.0.10_linux-x64_bin.tar.gz'
      ],
      [
        '17',
        'linux',
        'aarch64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jdk-17.0.10_linux-aarch64_bin.tar.gz'
      ],
      [
        '17',
        'windows',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jdk-17.0.10_windows-x64_bin.zip'
      ],
      [
        '17.0.4',
        'linux',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.4.1/sapmachine-jdk-17.0.4.1_linux-x64_bin.tar.gz'
      ],
      [
        '17',
        'linux',
        'x64',
        'jre',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jre-17.0.10_linux-x64_bin.tar.gz'
      ],
      [
        '17',
        'linux',
        'aarch64',
        'jre',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jre-17.0.10_linux-aarch64_bin.tar.gz'
      ],
      [
        '17',
        'windows',
        'x64',
        'jre',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jre-17.0.10_windows-x64_bin.zip'
      ],
      [
        '17.0.4',
        'linux',
        'x64',
        'jre',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.4.1/sapmachine-jre-17.0.4.1_linux-x64_bin.tar.gz'
      ],
      [
        '23-ea',
        'linux',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-23%2B15/sapmachine-jdk-23-ea.15_linux-x64_bin.tar.gz',
        '23'
      ],
      [
        '21.0.2+2-ea',
        'linux',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-21.0.2%2B2/sapmachine-jdk-21.0.2-ea.2_linux-x64_bin.tar.gz',
        '21.0.2+2'
      ],
      [
        '17',
        'linux-musl',
        'x64',
        'jdk',
        'https://github.com/SAP/SapMachine/releases/download/sapmachine-17.0.10/sapmachine-jdk-17.0.10_linux-x64-musl_bin.tar.gz'
      ]
    ])(
      'should return proper link according to the specified java-version, platform and arch',
      async (
        version: string,
        platform: string,
        arch: string,
        packageType: string,
        expectedLink: string,
        normalizedVersion: string = version
      ) => {
        const distribution = new SapMachineDistribution({
          version: version,
          architecture: arch,
          packageType: packageType,
          checkLatest: false
        });
        mockPlatform(distribution, platform);

        const availableVersion = await distribution['findPackageForDownload'](
          normalizedVersion
        );
        expect(availableVersion).not.toBeNull();
        expect(availableVersion.url).toBe(expectedLink);
      }
    );

    it.each([
      ['8', 'linux', 'x64'],
      ['8', 'macos', 'aarch64'],
      ['23', 'macos', 'aarch64'],
      ['17', 'linux', 'riscv'],
      ['23', 'linux', 'x64'],
      ['25-ea', 'linux', 'x64', '25'],
      ['8-ea', 'linux', 'x64', '8'],
      ['21.0.3+7', 'linux', 'x64', '21.0.3+7'],
      ['21.0.3+8-ea', 'linux', 'x64', '21.0.3+8'],
      ['17', 'linux-muse', 'aarch64']
    ])(
      'should throw when required version of JDK can not be found in the JSON',
      async (
        version: string,
        platform: string,
        arch: string,
        normalizedVersion: string = version
      ) => {
        const distribution = new SapMachineDistribution({
          version: version,
          architecture: arch,
          packageType: 'jdk',
          checkLatest: false
        });
        mockPlatform(distribution, platform);

        await expect(
          distribution['findPackageForDownload'](normalizedVersion)
        ).rejects.toThrow(
          `Couldn't find any satisfied version for the specified java-version: "${normalizedVersion}" and architecture: "${arch}".`
        );
      }
    );

    it('should throw when required package type is not supported', async () => {
      const jdkVersion = '17';
      const arch = 'x64';
      const platform = 'linux';
      const distribution = new SapMachineDistribution({
        version: jdkVersion,
        architecture: arch,
        packageType: 'jdk+fx',
        checkLatest: false
      });
      mockPlatform(distribution, platform);
      await expect(
        distribution['findPackageForDownload'](jdkVersion)
      ).rejects.toThrow(
        'SapMachine provides only the `jdk` and `jre` package type'
      );
    });
  });
});

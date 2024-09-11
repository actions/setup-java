import {HttpClient} from '@actions/http-client';
import {DragonwellDistribution} from '../../src/distributions/dragonwell/installer';
import * as utils from '../../src/util';

import manifestData from '../data/dragonwell.json';

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
    distribution: DragonwellDistribution,
    platform: string
  ) => {
    distribution['getPlatformOption'] = () => platform;
    const mockedExtension = platform == 'windows' ? 'zip' : 'tar.gz';
    spyUtilGetDownloadArchiveExtension.mockReturnValue(mockedExtension);
  };

  describe('getAvailableVersions', () => {
    it.each([
      ['8', 'x86', 'linux', 0],
      ['8', 'aarch64', 'linux', 28],
      ['8.6.6', 'x64', 'linux', 31],
      ['8', 'x86', 'anolis', 0],
      ['8', 'x86', 'windows', 0],
      ['8', 'x86', 'mac', 0],
      ['11', 'x64', 'linux', 31],
      ['11', 'aarch64', 'linux', 28],
      ['17', 'riscv', 'linux', 3],
      ['16.0.1', 'x64', 'linux', 31],
      ['21', 'x64', 'linux', 31]
    ])(
      'should get right number of available versions from JSON',
      async (
        jdkVersion: string,
        arch: string,
        platform: string,
        len: number
      ) => {
        const distribution = new DragonwellDistribution({
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
        '8',
        'linux',
        'x64',
        'https://github.com/alibaba/dragonwell8/releases/download/dragonwell-extended-8.13.14_jdk8u352-ga/Alibaba_Dragonwell_Extended_8.13.14_x64_linux.tar.gz'
      ],
      [
        '8',
        'linux',
        'aarch64',
        'https://github.com/alibaba/dragonwell8/releases/download/dragonwell-extended-8.13.14_jdk8u352-ga/Alibaba_Dragonwell_Extended_8.13.14_aarch64_linux.tar.gz'
      ],
      [
        '8',
        'windows',
        'x64',
        'https://github.com/alibaba/dragonwell8/releases/download/dragonwell-extended-8.13.14_jdk8u352-ga/Alibaba_Dragonwell_Extended_8.13.14_x64_windows.zip'
      ],
      [
        '8.13.14',
        'linux',
        'x64',
        'https://github.com/alibaba/dragonwell8/releases/download/dragonwell-extended-8.13.14_jdk8u352-ga/Alibaba_Dragonwell_Extended_8.13.14_x64_linux.tar.gz'
      ],
      [
        '11',
        'linux',
        'x64',
        'https://github.com/dragonwell-project/dragonwell11/releases/download/dragonwell-extended-11.0.23.20_jdk-11.0.23-ga/Alibaba_Dragonwell_Extended_11.0.23.20.9_x64_linux.tar.gz'
      ],
      [
        '11',
        'linux',
        'aarch64',
        'https://github.com/dragonwell-project/dragonwell11/releases/download/dragonwell-extended-11.0.23.20_jdk-11.0.23-ga/Alibaba_Dragonwell_Extended_11.0.23.20.9_aarch64_linux.tar.gz'
      ],
      [
        '11',
        'linux',
        'riscv',
        'https://github.com/dragonwell-project/dragonwell11/releases/download/dragonwell-extended-11.0.23.20_jdk-11.0.23-ga/Alibaba_Dragonwell_Extended_11.0.23.20.9_riscv64_linux.tar.gz'
      ],
      [
        '11',
        'windows',
        'x64',
        'https://github.com/dragonwell-project/dragonwell11/releases/download/dragonwell-extended-11.0.23.20_jdk-11.0.23-ga/Alibaba_Dragonwell_Extended_11.0.23.20.9_x64_windows.zip'
      ],
      [
        '11',
        'alpine-linux',
        'x64',
        'https://github.com/dragonwell-project/dragonwell11/releases/download/dragonwell-extended-11.0.23.20_jdk-11.0.23-ga/Alibaba_Dragonwell_Extended_11.0.23.20.9_x64_alpine-linux.tar.gz'
      ],
      [
        '11.0.17',
        'linux',
        'x64',
        'https://github.com/alibaba/dragonwell11/releases/download/dragonwell-extended-11.0.17.13_jdk-11.0.17-ga/Alibaba_Dragonwell_Extended_11.0.17.13.8_x64_linux.tar.gz'
      ],
      [
        '17',
        'linux',
        'x64',
        'https://github.com/alibaba/dragonwell17/releases/download/dragonwell-standard-17.0.5.0.5%2B8_jdk-17.0.5-ga/Alibaba_Dragonwell_Standard_17.0.5.0.5.8_x64_linux.tar.gz'
      ],
      [
        '17',
        'linux',
        'aarch64',
        'https://github.com/alibaba/dragonwell17/releases/download/dragonwell-standard-17.0.5.0.5%2B8_jdk-17.0.5-ga/Alibaba_Dragonwell_Standard_17.0.5.0.5.8_aarch64_linux.tar.gz'
      ],
      [
        '17',
        'windows',
        'x64',
        'https://github.com/alibaba/dragonwell17/releases/download/dragonwell-standard-17.0.5.0.5%2B8_jdk-17.0.5-ga/Alibaba_Dragonwell_Standard_17.0.5.0.5.8_x64_windows.zip'
      ],
      [
        '17',
        'alpine-linux',
        'x64',
        'https://github.com/alibaba/dragonwell17/releases/download/dragonwell-standard-17.0.5.0.5%2B8_jdk-17.0.5-ga/Alibaba_Dragonwell_Standard_17.0.5.0.5.8_x64_alpine-linux.tar.gz'
      ],
      [
        '17.0.4',
        'linux',
        'x64',
        'https://github.com/alibaba/dragonwell17/releases/download/dragonwell-standard-17.0.4.0.4%2B8_jdk-17.0.4-ga/Alibaba_Dragonwell_Standard_17.0.4.0.4%2B8_x64_linux.tar.gz'
      ],
      [
        '17.0.4+8',
        'linux',
        'x64',
        'https://github.com/alibaba/dragonwell17/releases/download/dragonwell-standard-17.0.4.0.4%2B8_jdk-17.0.4-ga/Alibaba_Dragonwell_Standard_17.0.4.0.4%2B8_x64_linux.tar.gz'
      ],
      [
        '21',
        'linux',
        'aarch64',
        'https://github.com/dragonwell-project/dragonwell21/releases/download/dragonwell-standard-21.0.3.0.3%2B9_jdk-21.0.3-ga/Alibaba_Dragonwell_Standard_21.0.3.0.3.9_aarch64_linux.tar.gz'
      ],
      [
        '21.0.3+9',
        'linux',
        'riscv',
        'https://github.com/dragonwell-project/dragonwell21/releases/download/dragonwell-standard-21.0.3.0.3%2B9_jdk-21.0.3-ga/Alibaba_Dragonwell_Standard_21.0.3.0.3.9_riscv64_linux.tar.gz'
      ],
      [
        '21.0.1+12',
        'linux',
        'x64',
        'https://github.com/dragonwell-project/dragonwell21/releases/download/dragonwell-standard-21.0.1.0.1%2B12_jdk-21.0.1-ga/Alibaba_Dragonwell_Standard_21.0.1.0.1.12_x64_linux.tar.gz'
      ]
    ])(
      'should return proper link according to the specified java-version, platform and arch',
      async (
        jdkVersion: string,
        platform: string,
        arch: string,
        expectedLink: string
      ) => {
        const distribution = new DragonwellDistribution({
          version: jdkVersion,
          architecture: arch,
          packageType: 'jdk',
          checkLatest: false
        });
        mockPlatform(distribution, platform);

        const availableVersion = await distribution['findPackageForDownload'](
          jdkVersion
        );
        expect(availableVersion).not.toBeNull();
        expect(availableVersion.url).toBe(expectedLink);
      }
    );

    it.each([
      ['8', 'alpine-linux', 'x64'],
      ['8', 'macos', 'aarch64'],
      ['11', 'macos', 'aarch64'],
      ['17', 'linux', 'riscv']
    ])(
      'should throw when required version of JDK can not be found in the JSON',
      async (jdkVersion: string, platform: string, arch: string) => {
        const distribution = new DragonwellDistribution({
          version: jdkVersion,
          architecture: arch,
          packageType: 'jdk',
          checkLatest: false
        });
        mockPlatform(distribution, platform);

        await expect(
          distribution['findPackageForDownload'](jdkVersion)
        ).rejects.toThrow(
          `Couldn't find any satisfied version for the specified java-version: "${jdkVersion}" and architecture: "${arch}".`
        );
      }
    );

    it('should throw when required package type is not jdk', async () => {
      const jdkVersion = '17';
      const arch = 'x64';
      const platform = 'linux';
      const distribution = new DragonwellDistribution({
        version: jdkVersion,
        architecture: arch,
        packageType: 'jre',
        checkLatest: false
      });
      mockPlatform(distribution, platform);
      await expect(
        distribution['findPackageForDownload'](jdkVersion)
      ).rejects.toThrow('Dragonwell provides only the `jdk` package type');
    });
  });
});

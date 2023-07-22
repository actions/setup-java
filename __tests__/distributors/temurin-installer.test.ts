import {HttpClient} from '@actions/http-client';
import os from 'os';
import {
  TemurinDistribution,
  TemurinImplementation
} from '../../src/distributions/temurin/installer';
import {JavaInstallerOptions} from '../../src/distributions/base-models';

import manifestData from '../data/temurin.json';

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

  it.each([
    [
      {
        version: '16',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '16',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot,
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '16',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      TemurinImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '16-ea',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ea&jvm_impl=hotspot&page_size=20&page=0'
    ]
  ])(
    'build correct url for %s',
    async (
      installerOptions: JavaInstallerOptions,
      impl: TemurinImplementation,
      expectedParameters
    ) => {
      const distribution = new TemurinDistribution(installerOptions, impl);
      const baseUrl =
        'https://api.adoptium.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=adoptium&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
      distribution['getPlatformOption'] = () => 'mac';

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(expectedUrl);
    }
  );

  it('load available versions', async () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: []
      });

    const distribution = new TemurinDistribution(
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot
    );
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(manifestData.length * 2);
  });

  it.each([
    [TemurinImplementation.Hotspot, 'jdk', 'Java_Temurin-Hotspot_jdk'],
    [TemurinImplementation.Hotspot, 'jre', 'Java_Temurin-Hotspot_jre']
  ])(
    'find right toolchain folder',
    (impl: TemurinImplementation, packageType: string, expected: string) => {
      const distribution = new TemurinDistribution(
        {
          version: '8',
          architecture: 'x64',
          packageType: packageType,
          checkLatest: false
        },
        impl
      );

      // @ts-ignore - because it is protected
      expect(distribution.toolcacheFolderName).toBe(expected);
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest.spyOn(os, 'arch').mockReturnValue(distroArch);

      const installerOptions: JavaInstallerOptions = {
        version: '17',
        architecture: '',
        packageType: 'jdk',
        checkLatest: false
      };

      const expectedParameters = `os=mac&architecture=${distroArch}&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0`;

      const distribution = new TemurinDistribution(
        installerOptions,
        TemurinImplementation.Hotspot
      );
      const baseUrl =
        'https://api.adoptium.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=adoptium&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
      distribution['getPlatformOption'] = () => 'mac';

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(expectedUrl);
    }
  );
});

describe('findPackageForDownload', () => {
  it.each([
    ['8', '8.0.302+8'],
    ['16', '16.0.2+7'],
    ['16.0', '16.0.2+7'],
    ['16.0.2', '16.0.2+7'],
    ['8.x', '8.0.302+8'],
    ['x', '16.0.2+7']
  ])('version is resolved correctly %s -> %s', async (input, expected) => {
    const distribution = new TemurinDistribution(
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData as any;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it('version is found but binaries list is empty', async () => {
    const distribution = new TemurinDistribution(
      {
        version: '9.0.8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(
      distribution['findPackageForDownload']('9.0.8')
    ).rejects.toThrow(/Could not find satisfied version for SemVer */);
  });

  it('version is not found', async () => {
    const distribution = new TemurinDistribution(
      {
        version: '7.x',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(distribution['findPackageForDownload']('7.x')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new TemurinDistribution(
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      TemurinImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });
});

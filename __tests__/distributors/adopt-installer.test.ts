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
import {HttpClient} from '@actions/http-client';
import os from 'os';

import manifestData from '../data/adopt.json' with {type: 'json'};

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
const {AdoptDistribution, AdoptImplementation} =
  await import('../../src/distributions/adopt/installer.js');
const {TemurinDistribution} =
  await import('../../src/distributions/temurin/installer.js');

import type {IAdoptAvailableVersions} from '../../src/distributions/adopt/models.js';
import type {AdoptImplementation as AdoptImplementationType} from '../../src/distributions/adopt/installer.js';
import type {JavaInstallerOptions} from '../../src/distributions/base-models.js';

describe('getAvailableVersions', () => {
  let spyHttpClient: any;
  let spyCoreError: any;
  let spyCoreWarning: any;

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
    spyCoreWarning = core.warning as jest.Mock;
    spyCoreWarning.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '11-ea',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ea&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      {
        version: '11-ea',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x64&image_type=jdk&release_type=ea&jvm_impl=openj9&page_size=20&page=0'
    ]
  ])(
    'build correct url for %s',
    async (
      installerOptions: JavaInstallerOptions,
      impl: AdoptImplementationType,
      expectedParameters
    ) => {
      const distribution = new AdoptDistribution(installerOptions, impl);
      const baseUrl =
        'https://api.adoptopenjdk.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=adoptopenjdk&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
      distribution['getPlatformOption'] = () => 'mac';

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(expectedUrl);
    }
  );

  it('load available versions', async () => {
    const nextPageUrl =
      'https://api.adoptopenjdk.net/v3/assets/version/%5B1.0,100.0%5D?page=1&page_size=20';
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {link: `<${nextPageUrl}>; rel="next"`},
        result: manifestData as any
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      });

    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot
    );
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(manifestData.length * 2);
    expect(spyHttpClient).toHaveBeenNthCalledWith(2, nextPageUrl);
  });

  it('stops pagination after 1000 pages as a safeguard', async () => {
    const nextPageUrl =
      'https://api.adoptopenjdk.net/v3/assets/version/%5B1.0,100.0%5D?page=2&page_size=20';
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {link: `<${nextPageUrl}>; rel="next"`},
      result: [{version_data: {semver: '17.0.1'}, binaries: []}] as any
    });

    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot
    );

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledTimes(1000);
    expect(spyCoreWarning).toHaveBeenCalledWith(
      expect.stringContaining('Reached pagination safeguard limit (1000 pages)')
    );
  });

  it.each([
    [AdoptImplementation.Hotspot, 'jdk', 'Java_Adopt_jdk'],
    [AdoptImplementation.Hotspot, 'jre', 'Java_Adopt_jre'],
    [AdoptImplementation.OpenJ9, 'jdk', 'Java_Adopt-OpenJ9_jdk'],
    [AdoptImplementation.OpenJ9, 'jre', 'Java_Adopt-OpenJ9_jre']
  ])(
    'find right toolchain folder',
    (impl: AdoptImplementationType, packageType: string, expected: string) => {
      const distribution = new AdoptDistribution(
        {
          version: '11',
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
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);

      const installerOptions: JavaInstallerOptions = {
        version: '17',
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      };

      const expectedParameters = `os=mac&architecture=${distroArch}&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0`;

      const distribution = new AdoptDistribution(
        installerOptions,
        AdoptImplementation.Hotspot
      );
      const baseUrl =
        'https://api.adoptopenjdk.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=adoptopenjdk&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
      distribution['getPlatformOption'] = () => 'mac';

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(expectedUrl);
    }
  );
});

describe('findPackageForDownload', () => {
  it('returns Temurin result and does not query Adopt API when Temurin succeeds', async () => {
    const temurinRelease = {
      version: '11.0.31+11',
      url: 'https://example.test/temurin-11.tar.gz'
    };
    const temurinFindPackageForDownload = jest
      .fn<any>()
      .mockResolvedValue(temurinRelease);
    const temurinDistribution = {
      findPackageForDownload: temurinFindPackageForDownload
    } as any;

    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot,
      temurinDistribution
    );
    const adoptLookupSpy = jest.fn<any>();
    distribution['getAvailableVersions'] = adoptLookupSpy;

    const resolvedVersion = await distribution['findPackageForDownload']('11');

    expect(resolvedVersion).toEqual(temurinRelease);
    expect(temurinFindPackageForDownload).toHaveBeenCalledWith('11');
    expect(adoptLookupSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['9', '9.0.7+10'],
    ['15', '15.0.2+7'],
    ['15.0', '15.0.2+7'],
    ['15.0.2', '15.0.2+7'],
    ['15.0.1', '15.0.1+9.1'],
    ['11.x', '11.0.10+9'],
    ['x', '15.0.2+7'],
    ['12', '12.0.2+10.3'], // make sure that '12.0.2+10.1', '12.0.2+10.3', '12.0.2+10.2' are sorted correctly
    ['12.0.2+10.1', '12.0.2+10.1'],
    ['15.0.1+9', '15.0.1+9'],
    ['15.0.1+9.1', '15.0.1+9.1']
  ])('version is resolved correctly %s -> %s', async (input, expected) => {
    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot
    );
    // Mock Temurin to fail so fallback to AdoptOpenJDK is tested
    distribution['temurinDistribution']!['findPackageForDownload'] =
      async () => {
        throw new Error('No matching version found for SemVer');
      };
    distribution['getAvailableVersions'] = async () => manifestData as any;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it('version is found but binaries list is empty', async () => {
    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot
    );
    // Mock Temurin to fail so fallback to AdoptOpenJDK is tested
    distribution['temurinDistribution']!['findPackageForDownload'] =
      async () => {
        throw new Error('No matching version found for SemVer');
      };
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(
      distribution['findPackageForDownload']('9.0.8')
    ).rejects.toThrow(/No matching version found for SemVer */);
  });

  it('version is not found', async () => {
    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot
    );
    // Mock Temurin to fail so fallback to AdoptOpenJDK is tested
    distribution['temurinDistribution']!['findPackageForDownload'] =
      async () => {
        throw new Error('No matching version found for SemVer');
      };
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(distribution['findPackageForDownload']('7.x')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new AdoptDistribution(
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      AdoptImplementation.Hotspot
    );
    // Mock Temurin to fail so fallback to AdoptOpenJDK is tested
    distribution['temurinDistribution']!['findPackageForDownload'] =
      async () => {
        throw new Error('No matching version found for SemVer');
      };
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('11')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });
});

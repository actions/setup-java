import { HttpClient } from '@actions/http-client';

import { AdoptDistribution, AdoptImplementation } from '../../src/distributions/adopt/installer';
import { JavaInstallerOptions } from '../../src/distributions/base-models';

let manifestData = require('../data/adopt.json') as [];

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
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '11', architecture: 'x86', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '11', architecture: 'x64', packageType: 'jre', checkLatest: false },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '11-ea', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot,
      'os=mac&architecture=x64&image_type=jdk&release_type=ea&jvm_impl=hotspot&page_size=20&page=0'
    ],
    [
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      { version: '11', architecture: 'x86', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      { version: '11', architecture: 'x64', packageType: 'jre', checkLatest: false },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      { version: '11-ea', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.OpenJ9,
      'os=mac&architecture=x64&image_type=jdk&release_type=ea&jvm_impl=openj9&page_size=20&page=0'
    ]
  ])(
    'build correct url for %s',
    async (
      installerOptions: JavaInstallerOptions,
      impl: AdoptImplementation,
      expectedParameters
    ) => {
      const distribution = new AdoptDistribution(installerOptions, impl);
      const baseUrl = 'https://api.adoptopenjdk.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=adoptopenjdk&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
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
        result: manifestData
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: []
      });

    const distribution = new AdoptDistribution(
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot
    );
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(manifestData.length * 2);
  });
});

describe('findPackageForDownload', () => {
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
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it('version is found but binaries list is empty', async () => {
    const distribution = new AdoptDistribution(
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData;
    await expect(distribution['findPackageForDownload']('9.0.8')).rejects.toThrowError(
      /Could not find satisfied version for SemVer */
    );
  });

  it('version is not found', async () => {
    const distribution = new AdoptDistribution(
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => manifestData;
    await expect(distribution['findPackageForDownload']('7.x')).rejects.toThrowError(
      /Could not find satisfied version for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new AdoptDistribution(
      { version: '11', architecture: 'x64', packageType: 'jdk', checkLatest: false },
      AdoptImplementation.Hotspot
    );
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('11')).rejects.toThrowError(
      /Could not find satisfied version for SemVer */
    );
  });
});

import {LibericaDistributions} from '../../src/distributions/liberica/installer';
import {
  ArchitectureOptions,
  LibericaVersion
} from '../../src/distributions/liberica/models';
import {HttpClient} from '@actions/http-client';
import os from 'os';

import manifestData from '../data/liberica.json';

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData as LibericaVersion[]
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
        version: '11.x',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      'bundle-type=jdk&bitness=32&arch=x86&build-type=all'
    ],
    [
      {
        version: '11-ea',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      'bundle-type=jdk&bitness=32&arch=x86&build-type=ea'
    ],
    [
      {
        version: '16.0.2',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'bundle-type=jdk&bitness=64&arch=x86&build-type=all'
    ],
    [
      {
        version: '16.0.2',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      'bundle-type=jre&bitness=64&arch=x86&build-type=all'
    ],
    [
      {
        version: '8',
        architecture: 'armv7',
        packageType: 'jdk+fx',
        checkLatest: false
      },
      'bundle-type=jdk-full&bitness=32&arch=arm&build-type=all'
    ],
    [
      {
        version: '8',
        architecture: 'aarch64',
        packageType: 'jre+fx',
        checkLatest: false
      },
      'bundle-type=jre-full&bitness=64&arch=arm&build-type=all'
    ]
  ])('build correct url for %s -> %s', async (input, urlParams) => {
    const additionalParams =
      '&installation-type=archive&fields=downloadUrl%2Cversion%2CfeatureVersion%2CinterimVersion%2C' +
      'updateVersion%2CbuildVersion';
    const distribution = new LibericaDistributions(input);
    distribution['getPlatformOption'] = () => 'macos';
    const buildUrl = `https://api.bell-sw.com/v1/liberica/releases?os=macos&${urlParams}${additionalParams}`;

    await distribution['getAvailableVersions']();

    expect(spyHttpClient.mock.calls).toHaveLength(1);
    expect(spyHttpClient.mock.calls[0][0]).toBe(buildUrl);
  });

  type DistroArch = {
    bitness: string;
    arch: string;
  };
  it.each([
    ['amd64', {bitness: '64', arch: 'x86'}],
    ['arm64', {bitness: '64', arch: 'arm'}]
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: DistroArch) => {
      jest.spyOn(os, 'arch').mockReturnValue(osArch);

      const distribution = new LibericaDistributions({
        version: '17',
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const additionalParams =
        '&installation-type=archive&fields=downloadUrl%2Cversion%2CfeatureVersion%2CinterimVersion%2C' +
        'updateVersion%2CbuildVersion';
      distribution['getPlatformOption'] = () => 'macos';

      const buildUrl = `https://api.bell-sw.com/v1/liberica/releases?os=macos&bundle-type=jdk&bitness=${distroArch.bitness}&arch=${distroArch.arch}&build-type=all${additionalParams}`;

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(buildUrl);
    }
  );

  it('load available versions', async () => {
    const distribution = new LibericaDistributions({
      version: '11',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).toEqual(manifestData);
  });
});

describe('getArchitectureOptions', () => {
  it.each([
    ['x86', {bitness: '32', arch: 'x86'}],
    ['x64', {bitness: '64', arch: 'x86'}],
    ['armv7', {bitness: '32', arch: 'arm'}],
    ['aarch64', {bitness: '64', arch: 'arm'}],
    ['ppc64le', {bitness: '64', arch: 'ppc'}]
  ] as [string, ArchitectureOptions][])(
    'parse architecture %s -> %s',
    (input, expected) => {
      const distributions = new LibericaDistributions({
        architecture: input,
        checkLatest: false,
        packageType: '',
        version: ''
      });

      expect(distributions['getArchitectureOptions']()).toEqual(expected);
    }
  );

  it.each(['armv6', 's390x'])('not support architecture %s', input => {
    const distributions = new LibericaDistributions({
      architecture: input,
      checkLatest: false,
      packageType: '',
      version: ''
    });

    expect(() => distributions['getArchitectureOptions']()).toThrow(
      /Architecture '\w+' is not supported\. Supported architectures: .*/
    );
  });
});

describe('findPackageForDownload', () => {
  let distribution: LibericaDistributions;

  beforeEach(() => {
    distribution = new LibericaDistributions({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData;
  });

  it.each([
    ['8', '8.0.302+8'],
    ['11.x', '11.0.12+7'],
    ['8.0', '8.0.302+8'],
    ['11.0.x', '11.0.12+7'],
    ['15', '15.0.2+10'],
    ['15.0', '15.0.2+10'],
    ['15.0.0', '15.0.0+36'],
    ['8.0.232', '8.0.232+10'],
    ['8.0.232+9', '8.0.232+9'],
    ['15.0.2+8', '15.0.2+8'],
    ['15.0.2+10', '15.0.2+10']
  ])('version is %s -> %s', async (input, expected) => {
    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expected);
  });

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('17')).rejects.toThrow(
      /Could not find satisfied version for semver */
    );
  });
});

describe('getPlatformOption', () => {
  const distributions = new LibericaDistributions({
    architecture: 'x64',
    version: '11',
    packageType: 'jdk',
    checkLatest: false
  });

  it.each([
    ['linux', 'linux'],
    ['darwin', 'macos'],
    ['win32', 'windows'],
    ['cygwin', 'windows'],
    ['sunos', 'solaris']
  ])('os version %s -> %s', (input, expected) => {
    const actual = distributions['getPlatformOption'](input as NodeJS.Platform);

    expect(actual).toEqual(expected);
  });

  it.each(['aix', 'android', 'freebsd', 'openbsd', 'netbsd'])(
    'not support os version %s',
    input => {
      expect(() =>
        distributions['getPlatformOption'](input as NodeJS.Platform)
      ).toThrow(/Platform '\w+' is not supported\. Supported platforms: .+/);
    }
  );
});

describe('convertVersionToSemver', () => {
  const distributions = new LibericaDistributions({
    architecture: 'x64',
    version: '11',
    packageType: 'jdk',
    checkLatest: false
  });

  it.each([
    [
      {
        featureVersion: 11,
        interimVersion: 0,
        updateVersion: 12,
        buildVersion: 7
      },
      '11.0.12+7'
    ],
    [
      {
        featureVersion: 11,
        interimVersion: 0,
        updateVersion: 12,
        buildVersion: 0
      },
      '11.0.12'
    ],
    [
      {
        featureVersion: 11,
        interimVersion: 0,
        updateVersion: 0,
        buildVersion: 13
      },
      '11.0.0+13'
    ]
  ])('%s -> %s', (input, expected) => {
    const actual = distributions['convertVersionToSemver']({
      downloadUrl: '',
      version: '',
      ...input
    });

    expect(actual).toEqual(expected);
  });
});

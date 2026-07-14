import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import type {
  ArchitectureOptions,
  NikVersion
} from '../../src/distributions/liberica-nik/models.js';
import {HttpClient} from '@actions/http-client';

import manifestData from '../data/liberica-nik.json' with {type: 'json'};

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
const {LibericaNikDistributions} =
  await import('../../src/distributions/liberica-nik/installer.js');

const ADDITIONAL_PARAMS =
  '&installation-type=archive&fields=downloadUrl%2Cversion%2Ccomponents%2Ccomponent%2Cembedded';

describe('getAvailableVersions', () => {
  let spyHttpClient: any;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData as NikVersion[]
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      {version: '21', architecture: 'x64', packageType: 'jdk'},
      'bundle-type=standard&bitness=64&arch=x86&build-type=all'
    ],
    [
      {version: '21-ea', architecture: 'x64', packageType: 'jdk'},
      'bundle-type=standard&bitness=64&arch=x86&build-type=ea'
    ],
    [
      {version: '21', architecture: 'aarch64', packageType: 'jdk'},
      'bundle-type=standard&bitness=64&arch=arm&build-type=all'
    ],
    [
      {version: '21', architecture: 'x64', packageType: 'jdk+fx'},
      'bundle-type=full&bitness=64&arch=x86&build-type=all'
    ]
  ])('build correct url for %s -> %s', async (input, urlParams) => {
    const distribution = new LibericaNikDistributions({
      ...input,
      checkLatest: false
    });
    distribution['getPlatformOption'] = () => 'linux';
    const buildUrl = `https://api.bell-sw.com/v1/nik/releases?os=linux&${urlParams}${ADDITIONAL_PARAMS}`;

    await distribution['getAvailableVersions']();

    expect(spyHttpClient.mock.calls).toHaveLength(1);
    expect(spyHttpClient.mock.calls[0][0]).toBe(buildUrl);
  });

  it('load available versions', async () => {
    const distribution = new LibericaNikDistributions({
      version: '21',
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
    ['x64', {bitness: '64', arch: 'x86'}],
    ['aarch64', {bitness: '64', arch: 'arm'}]
  ] as [string, ArchitectureOptions][])(
    'parse architecture %s -> %s',
    (input, expected) => {
      const distributions = new LibericaNikDistributions({
        architecture: input,
        checkLatest: false,
        packageType: 'jdk',
        version: '21'
      });

      expect(distributions['getArchitectureOptions']()).toEqual(expected);
    }
  );

  it.each(['x86', 'armv7', 's390x'])('not support architecture %s', input => {
    const distributions = new LibericaNikDistributions({
      architecture: input,
      checkLatest: false,
      packageType: 'jdk',
      version: '21'
    });

    expect(() => distributions['getArchitectureOptions']()).toThrow(
      /Architecture '\w+' is not supported\. Supported architectures: .*/
    );
  });
});

describe('findPackageForDownload', () => {
  let distribution: InstanceType<typeof LibericaNikDistributions>;

  beforeEach(() => {
    distribution = new LibericaNikDistributions({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData;
  });

  // The user's java-version resolves against the embedded JDK version, not
  // NIK's own GraalVM version.
  it.each([
    ['21', '21.0.11+12'],
    ['17', '17.0.19+12'],
    ['25', '25.0.3+12'],
    ['11', '11.0.22+12'],
    ['21.0.2', '21.0.2+14'],
    ['23', '23.0.2+9'],
    ['20.x', '20.0.2+10'],
    ['25.0.1', '25.0.1+16']
  ])('version is %s -> %s', async (input, expected) => {
    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expected);
  });

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('7')).rejects.toThrow(
      /No matching version found for SemVer/
    );
  });
});

describe('getPlatformOption', () => {
  const distributions = new LibericaNikDistributions({
    architecture: 'x64',
    version: '21',
    packageType: 'jdk',
    checkLatest: false
  });

  it.each([
    ['linux', 'linux'],
    ['darwin', 'macos'],
    ['win32', 'windows'],
    ['cygwin', 'windows']
  ])('os version %s -> %s', (input, expected) => {
    const actual = distributions['getPlatformOption'](input as NodeJS.Platform);

    expect(actual).toEqual(expected);
  });

  it.each(['sunos', 'aix', 'android', 'freebsd'])(
    'not support os version %s',
    input => {
      expect(() =>
        distributions['getPlatformOption'](input as NodeJS.Platform)
      ).toThrow(/Platform '\w+' is not supported\. Supported platforms: .+/);
    }
  );
});

describe('convertVersionToSemver', () => {
  const distributions = new LibericaNikDistributions({
    architecture: 'x64',
    version: '21',
    packageType: 'jdk',
    checkLatest: false
  });

  it.each([
    ['25.0.1+16', '25.0.1+16'],
    ['21+37', '21.0.0+37'],
    ['23+38', '23.0.0+38'],
    ['11.0.15.1+2', '11.0.15+1.2'],
    ['17.0.5', '17.0.5']
  ])('%s -> %s', (input, expected) => {
    const actual = distributions['convertVersionToSemver'](input);
    expect(actual).toEqual(expected);
  });
});

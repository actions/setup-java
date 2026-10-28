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
import fs from 'fs';
import type {
  ArchitectureOptions,
  LibericaVersion
} from '../../src/distributions/liberica/models.js';
import {HttpClient} from '@actions/http-client';
import os from 'os';
import path from 'path';

import manifestData from '../data/liberica.json' with {type: 'json'};

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
const {LibericaDistributions} =
  await import('../../src/distributions/liberica/installer.js');

describe('getAvailableVersions', () => {
  let spyHttpClient: any;
  let spyCoreError: any;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData as LibericaVersion[]
    });

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
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
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);

      const distributions = new LibericaDistributions({
        version: '17',
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const additionalParams =
        '&installation-type=archive&fields=downloadUrl%2Cversion%2CfeatureVersion%2CinterimVersion%2C' +
        'updateVersion%2CbuildVersion';
      distributions['getPlatformOption'] = () => 'macos';

      const buildUrl = `https://api.bell-sw.com/v1/liberica/releases?os=macos&bundle-type=jdk&bitness=${distroArch.bitness}&arch=${distroArch.arch}&build-type=all${additionalParams}`;

      await distributions['getAvailableVersions']();

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
  let distribution: InstanceType<typeof LibericaDistributions>;

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

  describe.each([
    [17, 20],
    [25, 4]
  ])('patch releases for Java %s.0.%s', (featureVersion, updateVersion) => {
    const mainVersion = `${featureVersion}.0.${updateVersion}`;

    beforeEach(() => {
      distribution['getAvailableVersions'] = async () =>
        ['+1', '+10', '.1+1', '.1+2', '.1+10', '.2+1', '.10+1'].map(suffix => ({
          featureVersion,
          interimVersion: 0,
          updateVersion,
          buildVersion: Number(suffix.split('+')[1]),
          version: `${mainVersion}${suffix}`,
          downloadUrl: `https://download.bell-sw.com/java/${mainVersion}${suffix}/bellsoft-jdk${mainVersion}${suffix}-macos-aarch64.tar.gz`
        }));
    });

    it.each([
      [`${mainVersion}+1.1`, `${mainVersion}+1.1`, '.1+1'],
      [`${mainVersion}+1.2`, `${mainVersion}+1.2`, '.1+2'],
      [`${mainVersion}+1.10`, `${mainVersion}+1.10`, '.1+10'],
      [`${mainVersion}+1`, `${mainVersion}+1`, '+1'],
      [mainVersion, `${mainVersion}+10.1`, '.10+1'],
      [`${featureVersion}`, `${mainVersion}+10.1`, '.10+1']
    ])('version is %s -> %s', async (input, expected, suffix) => {
      const result = await distribution['findPackageForDownload'](input);
      expect(result).toEqual({
        version: expected,
        url: `https://download.bell-sw.com/java/${mainVersion}${suffix}/bellsoft-jdk${mainVersion}${suffix}-macos-aarch64.tar.gz`
      });
    });

    it('sorts builds within the same patch numerically', async () => {
      const versions = await distribution['getAvailableVersions']();
      distribution['getAvailableVersions'] = async () =>
        versions.filter(item => item.version.startsWith(`${mainVersion}.1+`));

      const result = await distribution['findPackageForDownload'](mainVersion);
      expect(result.version).toBe(`${mainVersion}+1.10`);
    });

    it('selects the newest build for a four-component patch-only request', async () => {
      const patchDistribution = new LibericaDistributions({
        version: `${mainVersion}.1`,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      patchDistribution['getAvailableVersions'] =
        distribution['getAvailableVersions'];

      await expect(
        patchDistribution['findPackageForDownload'](
          patchDistribution['version']
        )
      ).resolves.toMatchObject({version: `${mainVersion}+1.10`});
    });

    it('does not substitute a different compound build', async () => {
      await expect(
        distribution['findPackageForDownload'](`${mainVersion}+1.3`)
      ).rejects.toThrow(/No matching version found for SemVer/);
    });
  });

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('17')).rejects.toThrow(
      /No matching version found for SemVer/
    );
  });
});

describe('patch request resolution from the constructor', () => {
  const releases: LibericaVersion[] = ['17.0.20+10', '17.0.20.1+1'].map(
    version => ({
      featureVersion: 17,
      interimVersion: 0,
      updateVersion: 20,
      buildVersion: Number(version.split('+')[1]),
      version,
      downloadUrl: `https://download.bell-sw.com/java/${version}/jdk.tar.gz`
    })
  );
  let cacheRoot: string;
  let previousToolcache: string | undefined;

  beforeEach(async () => {
    previousToolcache = process.env['RUNNER_TOOL_CACHE'];
    cacheRoot = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'liberica-'));
    process.env['RUNNER_TOOL_CACHE'] = cacheRoot;
    for (const version of ['17.0.20-10', '17.0.20-1.1']) {
      const javaPath = path.join(
        cacheRoot,
        'Java_Liberica_jdk',
        version,
        'x64'
      );
      await fs.promises.mkdir(javaPath, {recursive: true});
      await fs.promises.writeFile(`${javaPath}.complete`, '');
    }
  });

  afterEach(async () => {
    if (previousToolcache === undefined) {
      delete process.env['RUNNER_TOOL_CACHE'];
    } else {
      process.env['RUNNER_TOOL_CACHE'] = previousToolcache;
    }
    await fs.promises.rm(cacheRoot, {recursive: true, force: true});
  });

  it.each([
    ['17', '17.0.20+1.1', '17.0.20.1+1'],
    ['17.0.20', '17.0.20+1.1', '17.0.20.1+1'],
    ['17.0.20+10', '17.0.20+10', '17.0.20+10'],
    ['17.0.20+1.1', '17.0.20+1.1', '17.0.20.1+1'],
    ['17.0.20.1', '17.0.20+1.1', '17.0.20.1+1'],
    ['17.0.20.1+1', '17.0.20+1.1', '17.0.20.1+1'],
    ['17.0.20.0', '17.0.20+10', '17.0.20+10']
  ])(
    'resolves %s consistently remotely and in cache',
    async (input, expected, apiVersion) => {
      const distribution = new LibericaDistributions({
        version: input,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => releases;

      await expect(
        distribution['findPackageForDownload'](distribution['version'])
      ).resolves.toEqual({
        version: expected,
        url: `https://download.bell-sw.com/java/${apiVersion}/jdk.tar.gz`
      });
      expect(distribution['findInToolcache']()).toEqual({
        version: expected,
        path: path.join(
          cacheRoot,
          'Java_Liberica_jdk',
          expected.replace('+', '-'),
          'x64'
        )
      });
    }
  );

  it.each(['17.0.20.2', '17.0.20+1.2'])(
    'does not substitute a different patch or exact build for %s',
    async version => {
      const distribution = new LibericaDistributions({
        version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => releases;

      await expect(
        distribution['findPackageForDownload'](distribution['version'])
      ).rejects.toThrow(/No matching version found/);
      expect(distribution['findInToolcache']()).toBeNull();
    }
  );

  it('keeps patch-only and exact-build resolution cache identities distinct', () => {
    const distribution = new LibericaDistributions({
      version: '17.0.20.1',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    expect(distribution['version']).toBe('17.0.20.1');
  });

  it('orders main versions, patches, and builds consistently in cache', async () => {
    for (const version of ['17.0.20-1.2', '17.0.20-1.10', '17.0.21-1']) {
      const javaPath = path.join(
        cacheRoot,
        'Java_Liberica_jdk',
        version,
        'x64'
      );
      await fs.promises.mkdir(javaPath, {recursive: true});
      await fs.promises.writeFile(`${javaPath}.complete`, '');
    }

    for (const [version, expected] of [
      ['17', '17.0.21+1'],
      ['17.0.20', '17.0.20+1.10'],
      ['17.0.20.1', '17.0.20+1.10']
    ]) {
      const distribution = new LibericaDistributions({
        version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      expect(distribution['findInToolcache']()?.version).toBe(expected);
    }
  });

  it('preserves early-access handling for patch-only requests', async () => {
    const javaPath = path.join(
      cacheRoot,
      'Java_Liberica_jdk',
      '17.0.20-ea.1.2',
      'x64'
    );
    await fs.promises.mkdir(javaPath, {recursive: true});
    await fs.promises.writeFile(`${javaPath}.complete`, '');
    const distribution = new LibericaDistributions({
      version: '17.0.20.1-ea',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    expect(distribution['stable']).toBe(false);
    expect(distribution['findInToolcache']()).toEqual({
      version: '17.0.20+1.2',
      path: javaPath
    });
  });
});

describe('getPlatformOption', () => {
  beforeEach(() => {
    // The linux row below is glibc, so pin the Alpine probe rather than
    // letting it depend on the machine running the suite.
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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
    ],
    [
      {
        version: '17.0.20.1+1',
        featureVersion: 17,
        interimVersion: 0,
        updateVersion: 20,
        buildVersion: 1
      },
      '17.0.20+1.1'
    ],
    [
      {
        version: '25.0.4.1+1',
        featureVersion: 25,
        interimVersion: 0,
        updateVersion: 4,
        buildVersion: 1
      },
      '25.0.4+1.1'
    ],
    [
      {
        version: '17.0.20.1+2',
        featureVersion: 17,
        interimVersion: 0,
        updateVersion: 20,
        buildVersion: 2
      },
      '17.0.20+1.2'
    ],
    [
      {
        version: '25.0.4+1.1',
        featureVersion: 25,
        interimVersion: 0,
        updateVersion: 4,
        buildVersion: 1
      },
      '25.0.4+1.1'
    ],
    [
      {
        version: '25+36',
        featureVersion: 25,
        interimVersion: 0,
        updateVersion: 0,
        buildVersion: 36
      },
      '25.0.0+36'
    ],
    [
      {
        version: '8u202',
        featureVersion: 8,
        interimVersion: 0,
        updateVersion: 202,
        buildVersion: 8
      },
      '8.0.202+8'
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

describe('Liberica getPlatformOption libc selection', () => {
  const distributions = new LibericaDistributions({
    architecture: 'x64',
    version: '11',
    packageType: 'jdk',
    checkLatest: false
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('selects the musl artifacts on Alpine', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    expect(distributions['getPlatformOption']('linux')).toBe('linux-musl');
  });

  it('selects the glibc artifacts on other Linux runners', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(distributions['getPlatformOption']('linux')).toBe('linux');
  });

  it('does not probe for Alpine off Linux', () => {
    const existsSync = jest.spyOn(fs, 'existsSync');

    expect(distributions['getPlatformOption']('darwin')).toBe('macos');
    expect(existsSync).not.toHaveBeenCalled();
  });
});

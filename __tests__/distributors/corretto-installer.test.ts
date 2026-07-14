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
import type {JavaInstallerOptions} from '../../src/distributions/base-models.js';
import {HttpClient} from '@actions/http-client';

import os from 'os';

import manifestData from '../data/corretto.json' with {type: 'json'};

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

const real_util_module = await import('../../src/util.js');
jest.unstable_mockModule('../../src/util.js', () => ({
  ...real_util_module,
  getDownloadArchiveExtension: jest.fn()
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const {CorrettoDistribution} =
  await import('../../src/distributions/corretto/installer.js');
const util = await import('../../src/util.js');

describe('getAvailableVersions', () => {
  let spyHttpClient: ReturnType<typeof jest.spyOn>;
  let spyGetDownloadArchiveExtension: any;
  let spyCoreError: any;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData
    });
    spyGetDownloadArchiveExtension =
      util.getDownloadArchiveExtension as jest.Mock;

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
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

      const availableVersion =
        await distribution['findPackageForDownload'](version);
      expect(availableVersion).not.toBeNull();
      expect(availableVersion.url).toBe(expectedLink);
    });

    it('with latest resolves to the newest available major version', async () => {
      const distribution = new CorrettoDistribution({
        version: 'latest',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');

      const availableVersion =
        await distribution['findPackageForDownload']('x');
      expect(availableVersion).not.toBeNull();
      // 18 is the newest major present in the mocked Corretto index
      expect(availableVersion.url).toBe(
        'https://corretto.aws/downloads/resources/18.0.0.37.1/amazon-corretto-18.0.0.37.1-linux-x64.tar.gz'
      );
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
      ).rejects.toThrow("No matching version found for SemVer '4'");
    });

    it.each([
      ['amd64', 'x64'],
      ['arm64', 'aarch64']
    ])(
      'defaults to os.arch(): %s mapped to distro arch: %s',
      async (osArch: string, distroArch: string) => {
        jest
          .spyOn(os, 'arch')
          .mockReturnValue(osArch as ReturnType<typeof os.arch>);

        const distribution = new CorrettoDistribution({
          version: '17',
          architecture: '', // to get default value
          packageType: 'jdk',
          checkLatest: false
        });
        mockPlatform(distribution, 'macos');

        const expectedLink = `https://corretto.aws/downloads/resources/17.0.2.8.1/amazon-corretto-17.0.2.8.1-macosx-${distroArch}.tar.gz`;

        const availableVersion =
          await distribution['findPackageForDownload']('17');
        expect(availableVersion).not.toBeNull();
        expect(availableVersion.url).toBe(expectedLink);
      }
    );
  });

  const mockPlatform = (
    distribution: InstanceType<typeof CorrettoDistribution>,
    platform: string
  ) => {
    distribution['getPlatformOption'] = () => platform;
    const mockedExtension = platform === 'windows' ? 'zip' : 'tar.gz';
    spyGetDownloadArchiveExtension.mockReturnValue(mockedExtension);
  };
});

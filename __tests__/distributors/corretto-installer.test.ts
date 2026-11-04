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
      expect(availableVersion.checksum).toEqual({
        algorithm: 'sha256',
        value: expect.stringMatching(/^[a-f0-9]{64}$/),
        source:
          'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json'
      });
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

    it.each(['18.0.1', '17.0.13.11', '17.0.13.11.1.1'])(
      'rejects partial or malformed release %s',
      async version => {
        const distribution = new CorrettoDistribution({
          version,
          architecture: 'x64',
          packageType: 'jdk',
          checkLatest: false
        });
        mockPlatform(distribution, 'linux');

        await expect(
          distribution['findPackageForDownload'](version)
        ).rejects.toThrow(
          'Specify a major version or a full Corretto release, such as 25.0.5.0.10'
        );
      }
    );

    it.each([
      [
        '25.0.5.0.10',
        'linux',
        'x64',
        'jdk',
        '25.0.5+0.10',
        'https://corretto.aws/downloads/resources/25.0.5.0.10/amazon-corretto-25.0.5.0.10-linux-x64.tar.gz'
      ],
      [
        '25.0.5+0.10',
        'macos',
        'arm64',
        'jdk',
        '25.0.5+0.10',
        'https://corretto.aws/downloads/resources/25.0.5.0.10/amazon-corretto-25.0.5.0.10-macosx-aarch64.tar.gz'
      ],
      [
        '17.0.2.8.1',
        'windows',
        'x64',
        'jdk',
        '17.0.2+8.1',
        'https://corretto.aws/downloads/resources/17.0.2.8.1/amazon-corretto-17.0.2.8.1-windows-x64-jdk.zip'
      ],
      [
        '25.0.5.0.10',
        'alpine',
        'aarch64',
        'jdk',
        '25.0.5+0.10',
        'https://corretto.aws/downloads/resources/25.0.5.0.10/amazon-corretto-25.0.5.0.10-alpine-linux-aarch64.tar.gz'
      ],
      [
        '11.0.14.10.1',
        'linux',
        'armv7',
        'jdk',
        '11.0.14+10.1',
        'https://corretto.aws/downloads/resources/11.0.14.10.1/amazon-corretto-11.0.14.10.1-linux-armv7.tar.gz'
      ],
      [
        '8.472.8+1',
        'linux',
        'x64',
        'jdk',
        '8.472.8+1',
        'https://corretto.aws/downloads/resources/8.472.08.1/amazon-corretto-8.472.08.1-linux-x64.tar.gz'
      ],
      [
        '8.472.08.1',
        'linux',
        'x64',
        'jdk',
        '8.472.8+1',
        'https://corretto.aws/downloads/resources/8.472.08.1/amazon-corretto-8.472.08.1-linux-x64.tar.gz'
      ],
      [
        '8.472.08.1',
        'windows',
        'x86',
        'jre',
        '8.472.8+1',
        'https://corretto.aws/downloads/resources/8.472.08.1/amazon-corretto-8.472.08.1-windows-x86-jre.zip'
      ]
    ])(
      'resolves exact release %s on %s/%s (%s)',
      async (
        requestedVersion,
        platform,
        architecture,
        packageType,
        expectedVersion,
        url
      ) => {
        const checksum = 'a'.repeat(64);
        spyHttpClient.mockResolvedValue({
          statusCode: 200,
          headers: {},
          result: {
            body: `|JDK|[archive](${url})|\`md5\` /<br /> \`${checksum}\`|`
          }
        });
        const distribution = new CorrettoDistribution({
          version: requestedVersion,
          architecture,
          packageType,
          checkLatest: false
        });
        mockPlatform(distribution, platform);

        const release = await distribution['findPackageForDownload'](
          distribution['version']
        );
        const rawVersion = new URL(url).pathname.split('/')[3];
        const source = `https://api.github.com/repos/corretto/corretto-${rawVersion.split('.')[0]}/releases/tags/${rawVersion}`;
        expect(release).toEqual({
          version: expectedVersion,
          url,
          checksum: {algorithm: 'sha256', value: checksum, source}
        });
        expect(spyHttpClient).toHaveBeenCalledTimes(1);
        expect(spyHttpClient).toHaveBeenCalledWith(
          source,
          expect.objectContaining({accept: 'application/vnd.github+json'})
        );
      }
    );

    it('rejects exact releases without an archive for the requested platform', async () => {
      spyHttpClient.mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        result: {
          body:
            '|[other archive](https://example.com/archive)|`' +
            'a'.repeat(64) +
            '`|'
        }
      });
      const distribution = new CorrettoDistribution({
        version: '25.0.5.0.10',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');
      await expect(
        distribution['findPackageForDownload'](distribution['version'])
      ).rejects.toThrow(
        'No linux/x64 jdk archive is listed for Corretto 25.0.5.0.10'
      );
    });

    it('rejects historical archives with only an MD5 checksum', async () => {
      spyHttpClient.mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        result: {
          body:
            '|[archive](https://corretto.aws/downloads/resources/17.0.1.12.1/amazon-corretto-17.0.1.12.1-linux-x64.tar.gz)|`' +
            'a'.repeat(32) +
            '`|'
        }
      });
      const distribution = new CorrettoDistribution({
        version: '17.0.1.12.1',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');
      await expect(
        distribution['findPackageForDownload'](distribution['version'])
      ).rejects.toThrow(
        'No SHA-256 checksum is published for Corretto 17.0.1.12.1 (linux, x64, jdk)'
      );
    });

    it('does not substitute a JDK for an exact Linux JRE request', async () => {
      const distribution = new CorrettoDistribution({
        version: '25.0.5.0.10',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');
      await expect(
        distribution['findPackageForDownload'](distribution['version'])
      ).rejects.toThrow('Corretto JRE archives are only available for Windows');
      expect(spyHttpClient).not.toHaveBeenCalled();
    });

    it('resolves catalog-only releases without a GitHub release', async () => {
      spyHttpClient.mockResolvedValueOnce({
        statusCode: 404,
        headers: {},
        result: null
      });
      const distribution = new CorrettoDistribution({
        version: '15.0.2.7.1',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');
      expect(
        await distribution['findPackageForDownload'](distribution['version'])
      ).toEqual({
        version: '15.0.2+7.1',
        url: 'https://corretto.aws/downloads/resources/15.0.2.7.1/amazon-corretto-15.0.2.7.1-linux-x64.tar.gz',
        checksum: {
          algorithm: 'sha256',
          value: manifestData.linux.x64.jdk['15']['tar.gz'].checksum_sha256,
          source:
            'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json'
        }
      });
    });

    it('falls back to the catalog when the GitHub lookup fails', async () => {
      spyHttpClient.mockRejectedValueOnce(new Error('GitHub rate limit'));
      const distribution = new CorrettoDistribution({
        version: '15.0.2.7.1',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');

      expect(
        await distribution['findPackageForDownload'](distribution['version'])
      ).toEqual({
        version: '15.0.2+7.1',
        url: 'https://corretto.aws/downloads/resources/15.0.2.7.1/amazon-corretto-15.0.2.7.1-linux-x64.tar.gz',
        checksum: {
          algorithm: 'sha256',
          value: manifestData.linux.x64.jdk['15']['tar.gz'].checksum_sha256,
          source:
            'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json'
        }
      });
      expect(spyHttpClient).toHaveBeenCalledTimes(2);
    });

    it('reports missing release metadata without substituting the latest release', async () => {
      spyHttpClient.mockResolvedValueOnce({
        statusCode: 404,
        headers: {},
        result: null
      });
      const distribution = new CorrettoDistribution({
        version: '17.0.0.0.999',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      mockPlatform(distribution, 'linux');
      await expect(
        distribution['findPackageForDownload'](distribution['version'])
      ).rejects.toThrow(
        "Corretto release 17.0.0.0.999 was not found in Amazon's GitHub releases or current download catalog"
      );
    });

    it('does not normalize zero-padded major-only inputs', () => {
      expect(
        () =>
          new CorrettoDistribution({
            version: '08',
            architecture: 'x64',
            packageType: 'jdk',
            checkLatest: false
          })
      ).toThrow(
        "The string '08' is not valid SemVer notation for a Java version"
      );
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

    it('keeps the canonical ARM runner value separate from the vendor value', () => {
      jest.spyOn(os, 'arch').mockReturnValue('arm');
      const distribution = new CorrettoDistribution({
        version: '11',
        architecture: '',
        packageType: 'jdk',
        checkLatest: false
      });

      expect(distribution['architecture']).toBe('armv7');
      expect(distribution['distributionArchitecture']()).toBe('arm');
    });
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

describe('Corretto getPlatformOption libc selection', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(
    process,
    'platform'
  ) as PropertyDescriptor;

  const setPlatform = (platform: NodeJS.Platform) =>
    Object.defineProperty(process, 'platform', {
      ...originalPlatform,
      value: platform
    });

  const distribution = new CorrettoDistribution({
    version: '21',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', originalPlatform);
    jest.restoreAllMocks();
  });

  it('selects the musl artifacts on Alpine', () => {
    setPlatform('linux');
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);

    expect(distribution['getPlatformOption']()).toBe('alpine');
  });

  it('selects the glibc artifacts on other Linux runners', () => {
    setPlatform('linux');
    jest.spyOn(fs, 'existsSync').mockReturnValue(false);

    expect(distribution['getPlatformOption']()).toBe('linux');
  });

  it('does not probe for Alpine off Linux', () => {
    setPlatform('darwin');
    const existsSync = jest.spyOn(fs, 'existsSync');

    expect(distribution['getPlatformOption']()).toBe('macos');
    expect(existsSync).not.toHaveBeenCalled();
  });
});

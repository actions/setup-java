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
import type {TemurinImplementation as TemurinImplementationType} from '../../src/distributions/temurin/installer.js';
import {HttpClient} from '@actions/http-client';
import fs from 'fs';
import os from 'os';

import manifestData from '../data/temurin.json' with {type: 'json'};

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

jest.unstable_mockModule('@actions/tool-cache', () => ({
  find: jest.fn(),
  findAllVersions: jest.fn(),
  downloadTool: jest.fn(),
  extractZip: jest.fn(),
  extractTar: jest.fn(),
  extract7z: jest.fn(),
  extractXar: jest.fn(),
  cacheDir: jest.fn(),
  cacheFile: jest.fn(),
  getManifestFromRepo: jest.fn(),
  findFromManifest: jest.fn(),
  evaluateVersions: jest.fn()
}));

const real_util_module = await import('../../src/util.js');
jest.unstable_mockModule('../../src/util.js', () => ({
  ...real_util_module,
  extractJdkFile: jest.fn(),
  getDownloadArchiveExtension: jest.fn(),
  getToolcachePath: jest.fn(),
  isJobStatusSuccess: jest.fn(),
  renameWinArchive: jest.fn(),
  isVersionSatisfies: real_util_module.isVersionSatisfies,
  getTempDir: real_util_module.getTempDir
}));

jest.unstable_mockModule('../../src/gpg.js', () => ({
  importKey: jest.fn(),
  deleteKey: jest.fn(),
  verifyPackageSignature: jest.fn()
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const gpg = await import('../../src/gpg.js');
const tc = await import('@actions/tool-cache');
const {TemurinDistribution, TemurinImplementation, ADOPTIUM_PUBLIC_KEY} =
  await import('../../src/distributions/temurin/installer.js');
const util = await import('../../src/util.js');

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
      impl: TemurinImplementationType,
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
    const nextPageUrl =
      'https://api.adoptium.net/v3/assets/version/%5B1.0,100.0%5D?page=1&page_size=20';
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
    expect(spyHttpClient).toHaveBeenNthCalledWith(2, nextPageUrl);
  });

  it('stops pagination after 1000 pages as a safeguard', async () => {
    const nextPageUrl =
      'https://api.adoptium.net/v3/assets/version/%5B1.0,100.0%5D?page=2&page_size=20';
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {link: `<${nextPageUrl}>; rel="next"`},
      result: [{version_data: {semver: '17.0.1'}, binaries: []}] as any
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

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledTimes(1000);
    expect(spyCoreWarning).toHaveBeenCalledWith(
      expect.stringContaining('Reached pagination safeguard limit (1000 pages)')
    );
  });

  it.each([
    [TemurinImplementation.Hotspot, 'jdk', 'Java_Temurin-Hotspot_jdk'],
    [TemurinImplementation.Hotspot, 'jre', 'Java_Temurin-Hotspot_jre']
  ])(
    'find right toolchain folder',
    (
      impl: TemurinImplementationType,
      packageType: string,
      expected: string
    ) => {
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
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);

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
    expect(resolvedVersion.signatureUrl).toBeDefined();
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
    ).rejects.toThrow(/No matching version found for SemVer */);
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
      /No matching version found for SemVer */
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
      /No matching version found for SemVer */
    );
  });
});

describe('downloadTool', () => {
  let spyDownloadTool: any;
  let spyVerifySignature: any;
  let spyExtractJdkFile: any;
  let spyCacheDir: any;
  let spyReadDirSync: any;
  let spyRenameWinArchive: any;

  beforeEach(() => {
    spyDownloadTool = tc.downloadTool as jest.Mock;
    spyDownloadTool.mockResolvedValue('/tmp/jdk.tar.gz');
    spyVerifySignature = gpg.verifyPackageSignature as jest.Mock;
    spyVerifySignature.mockResolvedValue(undefined);
    spyExtractJdkFile = util.extractJdkFile as jest.Mock;
    spyExtractJdkFile.mockResolvedValue('/tmp/extracted');
    spyCacheDir = tc.cacheDir as jest.Mock;
    spyCacheDir.mockResolvedValue('/tmp/toolcache');
    spyReadDirSync = jest.spyOn(fs, 'readdirSync');
    spyReadDirSync.mockReturnValue(['jdk-17'] as any);
    spyRenameWinArchive = util.renameWinArchive as jest.Mock;
    spyRenameWinArchive.mockReturnValue('/tmp/jdk.tar.gz.zip');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('verifies signature when enabled', async () => {
    const distribution = new TemurinDistribution(
      {
        version: '17',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false,
        verifySignature: true
      },
      TemurinImplementation.Hotspot
    );

    await distribution['downloadTool']({
      version: '17.0.14+7',
      url: 'https://example.com/jdk.tar.gz',
      signatureUrl: 'https://example.com/jdk.tar.gz.sig'
    });

    expect(spyVerifySignature).toHaveBeenCalledWith(
      '/tmp/jdk.tar.gz',
      'https://example.com/jdk.tar.gz.sig',
      ADOPTIUM_PUBLIC_KEY
    );
  });

  it('fails when signature is missing and verification is enabled', async () => {
    const distribution = new TemurinDistribution(
      {
        version: '17',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false,
        verifySignature: true
      },
      TemurinImplementation.Hotspot
    );

    await expect(
      distribution['downloadTool']({
        version: '17.0.14+7',
        url: 'https://example.com/jdk.tar.gz'
      })
    ).rejects.toThrow(
      "Input 'verify-signature' is enabled, but no signature URL was found"
    );
    expect(spyVerifySignature).not.toHaveBeenCalled();
  });

  it('uses custom public key when verifySignaturePublicKey is provided', async () => {
    const customKey =
      '-----BEGIN PGP PUBLIC KEY BLOCK-----\ncustom\n-----END PGP PUBLIC KEY BLOCK-----';
    const distribution = new TemurinDistribution(
      {
        version: '17',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false,
        verifySignature: true,
        verifySignaturePublicKey: customKey
      },
      TemurinImplementation.Hotspot
    );

    await distribution['downloadTool']({
      version: '17.0.14+7',
      url: 'https://example.com/jdk.tar.gz',
      signatureUrl: 'https://example.com/jdk.tar.gz.sig'
    });

    expect(spyVerifySignature).toHaveBeenCalledWith(
      '/tmp/jdk.tar.gz',
      'https://example.com/jdk.tar.gz.sig',
      customKey
    );
  });
});

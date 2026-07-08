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
import data from '../data/microsoft.json' with {type: 'json'};

const mockOsArch = jest.fn(() => 'x64');
const mockOsPlatform = jest.fn(() => 'linux');

const real_os_module = await import('os');
jest.unstable_mockModule('os', () => ({
  ...real_os_module,
  default: {
    ...real_os_module.default,
    arch: mockOsArch,
    platform: mockOsPlatform,
    homedir: real_os_module.default.homedir
  },
  arch: mockOsArch,
  platform: mockOsPlatform
}));

const real_fs_module = await import('fs');
const mockReaddirSync = jest.fn();
jest.unstable_mockModule('fs', () => ({
  ...real_fs_module,
  default: {
    ...real_fs_module.default,
    readdirSync: mockReaddirSync
  },
  readdirSync: mockReaddirSync
}));

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

const real_tc_module = await import('@actions/tool-cache');
jest.unstable_mockModule('@actions/tool-cache', () => ({
  ...real_tc_module,
  downloadTool: jest.fn(),
  cacheDir: jest.fn(),
  cacheFile: jest.fn()
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
const os = (await import('os')).default;
const fs = (await import('fs')).default;
const {MicrosoftDistributions, MICROSOFT_PUBLIC_KEY} =
  await import('../../src/distributions/microsoft/installer.js');
const util = await import('../../src/util.js');

describe('findPackageForDownload', () => {
  let distribution: InstanceType<typeof MicrosoftDistributions>;
  let spyGetManifestFromRepo: any;
  let spyDebug: any;
  let spyCoreError: any;

  beforeEach(() => {
    mockOsArch.mockReturnValue('x64');
    mockOsPlatform.mockReturnValue(process.platform);

    distribution = new MicrosoftDistributions({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyGetManifestFromRepo = jest.spyOn(HttpClient.prototype, 'getJson');
    spyGetManifestFromRepo.mockReturnValue({
      result: data,
      statusCode: 200,
      headers: {}
    });

    spyDebug = core.debug as jest.Mock;
    spyDebug.mockImplementation(() => {});

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  it.each([
    [
      '25.x',
      '25.0.0',
      'https://aka.ms/download-jdk/microsoft-jdk-25.0.0-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '21.x',
      '21.0.0',
      'https://aka.ms/download-jdk/microsoft-jdk-21.0.0-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.x',
      '17.0.18',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.18-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.0.7',
      '17.0.7',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.7-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.0.1',
      '17.0.1+12.1',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.1.12.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '16.0.x',
      '16.0.2+7.1',
      'https://aka.ms/download-jdk/microsoft-jdk-16.0.2.7.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.0.13',
      '11.0.13+8.1',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.13.8.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.0.15',
      '11.0.15',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.15-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.x',
      '11.0.19',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.19-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ]
  ])('version is %s -> %s', async (input, expectedVersion, expectedUrl) => {
    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expectedVersion);
    let os: string;
    let archive: string;
    switch (process.platform) {
      case 'darwin':
        os = 'macos';
        archive = 'tar.gz';
        break;
      case 'win32':
        os = 'windows';
        archive = 'zip';
        break;
      default:
        os = process.platform.toString();
        archive = 'tar.gz';
        break;
    }
    const url = expectedUrl
      .replace('{{OS_TYPE}}', os)
      .replace('{{ARCHIVE_TYPE}}', archive);
    expect(result.url).toBe(url);
    expect(result.signatureUrl).toBe(`${url}.sig`);
  });

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      mockOsArch.mockReturnValue(osArch);
      mockOsPlatform.mockReturnValue('darwin');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.18-macos-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      mockOsArch.mockReturnValue(osArch);
      mockOsPlatform.mockReturnValue('linux');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.18-linux-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      mockOsArch.mockReturnValue(osArch);
      mockOsPlatform.mockReturnValue('win32');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.18-windows-${distroArch}.zip`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });

  it('uses manifest-provided signature URL when available', async () => {
    spyGetManifestFromRepo.mockReturnValue({
      result: [
        {
          version: '17.0.10',
          stable: true,
          release_url: 'https://example.test',
          files: [
            {
              filename: 'microsoft-jdk-17.0.10-linux-x64.tar.gz',
              arch: 'x64',
              platform: 'linux',
              download_url: 'https://example.test/jdk.tar.gz',
              signature_url: 'https://example.test/jdk.tar.gz.custom.sig'
            }
          ]
        }
      ],
      statusCode: 200,
      headers: {}
    });
    mockOsPlatform.mockReturnValue('linux');

    const result = await distribution['findPackageForDownload']('17.0.10');

    expect(result.signatureUrl).toBe(
      'https://example.test/jdk.tar.gz.custom.sig'
    );
  });
});

describe('downloadTool', () => {
  let spyDownloadTool: any;
  let spyExtractJdkFile: any;
  let spyCacheDir: any;
  let spyVerifySignature: any;
  let distribution: InstanceType<typeof MicrosoftDistributions>;

  beforeEach(() => {
    mockOsPlatform.mockReturnValue(process.platform);

    distribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyDownloadTool = tc.downloadTool as jest.Mock;
    spyDownloadTool.mockImplementation(async () => {
      return '/tmp/jdk.tar.gz';
    });

    spyExtractJdkFile = util.extractJdkFile as jest.Mock;
    spyExtractJdkFile.mockImplementation(async () => {
      return '/tmp/unpacked';
    });

    mockReaddirSync.mockReturnValue(['jdk'] as any);
    spyCacheDir = tc.cacheDir as jest.Mock;
    spyCacheDir.mockImplementation(async () => {
      return '/tmp/cached';
    });

    (util.renameWinArchive as jest.Mock<any>).mockImplementation(
      (archivePath: string) => `${archivePath}.zip`
    );

    spyVerifySignature = gpg.verifyPackageSignature as jest.Mock;
    spyVerifySignature.mockImplementation(async () => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies signature when enabled', async () => {
    const signedDistribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true
    });

    await signedDistribution['downloadTool']({
      version: '17.0.14+7',
      url: 'https://example.com/jdk.tar.gz',
      signatureUrl: 'https://example.com/jdk.tar.gz.sig'
    });

    expect(spyVerifySignature).toHaveBeenCalledWith(
      '/tmp/jdk.tar.gz',
      'https://example.com/jdk.tar.gz.sig',
      MICROSOFT_PUBLIC_KEY
    );
  });

  it('uses custom public key when verifySignaturePublicKey is provided', async () => {
    const customKey =
      '-----BEGIN PGP PUBLIC KEY BLOCK-----\ncustom\n-----END PGP PUBLIC KEY BLOCK-----';
    const signedDistribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true,
      verifySignaturePublicKey: customKey
    });

    await signedDistribution['downloadTool']({
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

  it('fails when signature is missing and verification is enabled', async () => {
    const signedDistribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true
    });

    await expect(
      signedDistribution['downloadTool']({
        version: '17.0.14+7',
        url: 'https://example.com/jdk.tar.gz'
      })
    ).rejects.toThrow(
      "Input 'verify-signature' is enabled, but no signature URL was found for Microsoft Build of OpenJDK version 17.0.14+7."
    );
    expect(spyVerifySignature).not.toHaveBeenCalled();
  });

  it('supports signature verification', () => {
    expect(distribution['supportsSignatureVerification']()).toBe(true);
  });
});

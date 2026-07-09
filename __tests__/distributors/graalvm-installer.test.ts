import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  beforeAll,
  afterAll
} from '@jest/globals';
import path from 'path';

// Mock @actions modules
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

jest.unstable_mockModule('@actions/http-client', () => ({
  HttpClient: jest.fn().mockImplementation(() => ({
    getJson: jest.fn(),
    head: jest.fn(),
    get: jest.fn()
  })),
  HttpClientError: class HttpClientError extends Error {
    statusCode: number;
    constructor(message: string, statusCode: number) {
      super(message);
      this.statusCode = statusCode;
    }
  },
  HttpCodes: {OK: 200, NotFound: 404, Unauthorized: 401, Forbidden: 403}
}));

// Get real util first, then mock specific functions
const realUtil = await import('../../src/util.js');
jest.unstable_mockModule('../../src/util.js', () => ({
  ...realUtil,
  extractJdkFile: jest.fn(),
  getDownloadArchiveExtension: jest.fn(),
  renameWinArchive: jest.fn(),
  getGitHubHttpHeaders: jest.fn().mockReturnValue({Accept: 'application/json'})
}));

const real_fs_module = await import('fs');
jest.unstable_mockModule('fs', () => ({
  ...real_fs_module,
  default: {
    ...real_fs_module.default,
    readdirSync: jest.fn(),
    existsSync: jest.fn()
  },
  readdirSync: jest.fn(),
  existsSync: jest.fn()
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const tc = await import('@actions/tool-cache');
const http = await import('@actions/http-client');
const fs = (await import('fs')).default;
const util = await import('../../src/util.js');
const {GraalVMCommunityDistribution, GraalVMDistribution} =
  await import('../../src/distributions/graalvm/installer.js');
const {getJavaDistribution} =
  await import('../../src/distributions/distribution-factory.js');

import type {JavaInstallerOptions} from '../../src/distributions/base-models.js';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  console.log('✅ All external dependencies are properly mocked');
});

describe('GraalVMDistribution', () => {
  let distribution: InstanceType<typeof GraalVMDistribution>;
  let communityDistribution: InstanceType<typeof GraalVMCommunityDistribution>;
  let mockHttpClient: any;
  let spyCoreError: any;

  const defaultOptions: JavaInstallerOptions = {
    version: '17',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  };

  beforeEach(() => {
    jest.clearAllMocks();

    distribution = new GraalVMDistribution(defaultOptions);
    communityDistribution = new GraalVMCommunityDistribution(defaultOptions);

    mockHttpClient = new (http.HttpClient as any)();
    (distribution as any).http = mockHttpClient;
    (communityDistribution as any).http = mockHttpClient;

    (util.getDownloadArchiveExtension as jest.Mock<any>).mockReturnValue(
      'tar.gz'
    );

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe('getPlatform', () => {
    it('should map darwin to macos', () => {
      const result = distribution.getPlatform('darwin');
      expect(result).toBe('macos');
    });

    it('should map win32 to windows', () => {
      const result = distribution.getPlatform('win32');
      expect(result).toBe('windows');
    });

    it('should map linux to linux', () => {
      const result = distribution.getPlatform('linux');
      expect(result).toBe('linux');
    });

    it('should throw error for unsupported platform', () => {
      expect(() => distribution.getPlatform('aix' as NodeJS.Platform)).toThrow(
        "Platform 'aix' is not supported. Supported platforms: 'linux', 'macos', 'windows'"
      );
    });
  });

  describe('downloadTool', () => {
    const javaRelease = {
      version: '17.0.5',
      url: 'https://example.com/graalvm.tar.gz'
    };

    beforeEach(() => {
      (tc.downloadTool as any).mockResolvedValue('/tmp/archive.tar.gz');
      (tc.cacheDir as any).mockResolvedValue('/cached/java/path');

      (util.extractJdkFile as any).mockResolvedValue('/tmp/extracted');

      // Mock renameWinArchive - it returns the same path (no renaming)
      (util.renameWinArchive as any).mockImplementation((p: string) => p);

      (util.getDownloadArchiveExtension as jest.Mock<any>).mockReturnValue(
        'tar.gz'
      );

      // Mock fs.existsSync to return true for extracted path
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);

      (fs.readdirSync as jest.Mock<any>).mockReturnValue([
        'graalvm-jdk-17.0.5'
      ]);

      jest
        .spyOn(distribution as any, 'getToolcacheVersionName')
        .mockImplementation(version => version);
    });

    it('should download, extract and cache the tool successfully', async () => {
      const result = await (distribution as any).downloadTool(javaRelease);

      // Verify the download was initiated
      expect(tc.downloadTool).toHaveBeenCalledWith(javaRelease.url);

      // The implementation uses the original path for extraction
      expect(util.extractJdkFile).toHaveBeenCalledWith(
        '/tmp/archive.tar.gz', // Original path
        'tar.gz'
      );

      // Verify path existence check
      expect(fs.existsSync).toHaveBeenCalledWith('/tmp/extracted');

      // Verify directory reading
      expect(fs.readdirSync).toHaveBeenCalledWith('/tmp/extracted');

      // Verify caching with correct parameters
      expect(tc.cacheDir).toHaveBeenCalledWith(
        path.join('/tmp/extracted', 'graalvm-jdk-17.0.5'),
        'Java_GraalVM_jdk',
        '17.0.5',
        'x64'
      );

      // Verify the result
      expect(result).toEqual({
        version: '17.0.5',
        path: '/cached/java/path'
      });

      // Verify logging
      expect(core.info).toHaveBeenCalledWith(
        'Downloading Java 17.0.5 (GraalVM) from https://example.com/graalvm.tar.gz ...'
      );
      expect(core.info).toHaveBeenCalledWith('Extracting Java archive...');
    });

    it('should throw error when extracted path does not exist', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(false);

      await expect(
        (distribution as any).downloadTool(javaRelease)
      ).rejects.toThrow(
        'Extraction failed: path /tmp/extracted does not exist'
      );

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download and extract GraalVM:')
      );
    });

    it('should throw error when extracted directory is empty', async () => {
      (fs.existsSync as jest.Mock<any>).mockReturnValue(true);
      (fs.readdirSync as jest.Mock<any>).mockReturnValue([]);

      await expect(
        (distribution as any).downloadTool(javaRelease)
      ).rejects.toThrow(
        'Extraction failed: no files found in extracted directory'
      );

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to download and extract GraalVM:')
      );
    });

    it('should handle download errors', async () => {
      const downloadError = new Error('Network error during download');
      (tc.downloadTool as any).mockRejectedValue(downloadError);

      await expect(
        (distribution as any).downloadTool(javaRelease)
      ).rejects.toThrow('Network error during download');

      expect(core.error).toHaveBeenCalledWith(
        'Failed to download and extract GraalVM: Error: Network error during download'
      );
    });

    it('should handle extraction errors', async () => {
      const extractError = new Error('Failed to extract archive');
      (util.extractJdkFile as any).mockRejectedValue(extractError);

      await expect(
        (distribution as any).downloadTool(javaRelease)
      ).rejects.toThrow('Failed to extract archive');

      expect(core.error).toHaveBeenCalledWith(
        'Failed to download and extract GraalVM: Error: Failed to extract archive'
      );
    });

    it('should handle different archive extensions', async () => {
      // Test with a .zip file
      (util.getDownloadArchiveExtension as jest.Mock<any>).mockReturnValue(
        'zip'
      );
      (tc.downloadTool as any).mockResolvedValue('/tmp/archive.zip');

      const zipRelease = {
        version: '17.0.5',
        url: 'https://example.com/graalvm.zip'
      };

      const result = await (distribution as any).downloadTool(zipRelease);

      expect(util.extractJdkFile).toHaveBeenCalledWith(
        '/tmp/archive.zip',
        'zip'
      );

      expect(result).toEqual({
        version: '17.0.5',
        path: '/cached/java/path'
      });
    });

    it('should use a dedicated toolcache folder for GraalVM Community', async () => {
      const result = await (communityDistribution as any).downloadTool(
        javaRelease
      );

      expect(tc.cacheDir).toHaveBeenCalledWith(
        path.join('/tmp/extracted', 'graalvm-jdk-17.0.5'),
        'Java_GraalVM_Community_jdk',
        '17.0.5',
        'x64'
      );
      expect(result).toEqual({
        version: '17.0.5',
        path: '/cached/java/path'
      });
    });
  });

  describe('findPackageForDownload', () => {
    beforeEach(() => {
      jest.spyOn(distribution, 'getPlatform').mockReturnValue('linux');
    });

    describe('input validation', () => {
      it('should throw error for null version range', async () => {
        await expect(
          (distribution as any).findPackageForDownload(null)
        ).rejects.toThrow('Version range is required and must be a string');
      });

      it('should throw error for undefined version range', async () => {
        await expect(
          (distribution as any).findPackageForDownload(undefined)
        ).rejects.toThrow('Version range is required and must be a string');
      });

      it('should throw error for empty string version range', async () => {
        await expect(
          (distribution as any).findPackageForDownload('')
        ).rejects.toThrow('Version range is required and must be a string');
      });

      it('should throw error for non-string version range', async () => {
        await expect(
          (distribution as any).findPackageForDownload(123)
        ).rejects.toThrow('Version range is required and must be a string');
      });

      it('should throw error for invalid version format', async () => {
        await expect(
          (distribution as any).findPackageForDownload('abc')
        ).rejects.toThrow('Invalid version format: abc');
      });
    });

    describe('stable builds', () => {
      it('should construct correct URL for specific version', async () => {
        const mockResponse = {
          message: {statusCode: 200}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        const result = await (distribution as any).findPackageForDownload(
          '17.0.5'
        );

        expect(result).toEqual({
          url: 'https://download.oracle.com/graalvm/17/archive/graalvm-jdk-17.0.5_linux-x64_bin.tar.gz',
          version: '17.0.5'
        });
        expect(mockHttpClient.head).toHaveBeenCalledWith(result.url);
      });

      it('should construct correct URL for major version (latest)', async () => {
        const mockResponse = {
          message: {statusCode: 200}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        const result = await (distribution as any).findPackageForDownload('21');

        expect(result).toEqual({
          url: 'https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_linux-x64_bin.tar.gz',
          version: '21'
        });
      });

      it('should throw error for unsupported architecture', async () => {
        distribution = new GraalVMDistribution({
          ...defaultOptions,
          architecture: 'x86'
        });
        (distribution as any).http = mockHttpClient;

        await expect(
          (distribution as any).findPackageForDownload('17')
        ).rejects.toThrow(
          'Unsupported architecture: x86. Supported architectures are: x64, aarch64'
        );
      });

      describe('latest alias', () => {
        it('resolves the newest major version from the Adoptium API', async () => {
          const latestDistribution = new GraalVMDistribution({
            ...defaultOptions,
            version: 'latest'
          });
          (latestDistribution as any).http = mockHttpClient;
          jest
            .spyOn(latestDistribution, 'getPlatform')
            .mockReturnValue('linux');
          mockHttpClient.getJson.mockResolvedValue({
            statusCode: 200,
            result: {most_recent_feature_release: 25},
            headers: {}
          });
          mockHttpClient.head.mockResolvedValue({
            message: {statusCode: 200}
          });

          const result = await (
            latestDistribution as any
          ).findPackageForDownload('x');

          expect(result).toEqual({
            url: 'https://download.oracle.com/graalvm/25/latest/graalvm-jdk-25_linux-x64_bin.tar.gz',
            version: '25'
          });
        });

        it('throws an actionable error when the latest major is not yet available', async () => {
          const latestDistribution = new GraalVMDistribution({
            ...defaultOptions,
            version: 'latest'
          });
          (latestDistribution as any).http = mockHttpClient;
          jest
            .spyOn(latestDistribution, 'getPlatform')
            .mockReturnValue('linux');
          mockHttpClient.getJson.mockResolvedValue({
            statusCode: 200,
            result: {most_recent_feature_release: 25},
            headers: {}
          });
          mockHttpClient.head.mockResolvedValue({
            message: {statusCode: 404}
          });

          await expect(
            (latestDistribution as any).findPackageForDownload('x')
          ).rejects.toThrow(
            /is not yet available for the GraalVM distribution/
          );
        });
      });

      it('should throw error for JDK versions less than 17', async () => {
        await expect(
          (distribution as any).findPackageForDownload('11')
        ).rejects.toThrow(
          'GraalVM is only supported for JDK 17 and later. Requested version: 11'
        );
      });

      it('should throw error for non-jdk package types', async () => {
        distribution = new GraalVMDistribution({
          ...defaultOptions,
          packageType: 'jre'
        });
        (distribution as any).http = mockHttpClient;

        await expect(
          (distribution as any).findPackageForDownload('17')
        ).rejects.toThrow('GraalVM provides only the `jdk` package type');
      });

      it('should throw error when file not found (404)', async () => {
        const mockResponse = {
          message: {statusCode: 404}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        // Verify the error is thrown with the expected message
        await expect(
          (distribution as any).findPackageForDownload('17.0.99')
        ).rejects.toThrow("No matching version found for SemVer '17.0.99'");
        // Verify distribution info is included
        await expect(
          (distribution as any).findPackageForDownload('17.0.99')
        ).rejects.toThrow('GraalVM');

        // Verify the hint about checking the base URL is included
        await expect(
          (distribution as any).findPackageForDownload('17.0.99')
        ).rejects.toThrow('https://www.graalvm.org/downloads/');
      });

      it('should throw error for unauthorized access (401)', async () => {
        const mockResponse = {
          message: {statusCode: 401}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        await expect(
          (distribution as any).findPackageForDownload('17')
        ).rejects.toThrow(
          'Access denied when downloading GraalVM. Status code: 401. Please check your credentials or permissions.'
        );
      });

      it('should throw error for forbidden access (403)', async () => {
        const mockResponse = {
          message: {statusCode: 403}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        await expect(
          (distribution as any).findPackageForDownload('17')
        ).rejects.toThrow(
          'Access denied when downloading GraalVM. Status code: 403. Please check your credentials or permissions.'
        );
      });

      it('should throw error for other HTTP errors with status message', async () => {
        const mockResponse = {
          message: {
            statusCode: 500,
            statusMessage: 'Internal Server Error'
          }
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        await expect(
          (distribution as any).findPackageForDownload('17')
        ).rejects.toThrow(
          'HTTP request for GraalVM failed with status code: 500 (Internal Server Error)'
        );
      });

      it('should throw error for other HTTP errors without status message', async () => {
        const mockResponse = {
          message: {statusCode: 500}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        await expect(
          (distribution as any).findPackageForDownload('17')
        ).rejects.toThrow(
          'HTTP request for GraalVM failed with status code: 500 (Unknown error)'
        );
      });
    });

    describe('EA builds', () => {
      beforeEach(() => {
        distribution = new GraalVMDistribution(defaultOptions);
        (distribution as any).http = mockHttpClient;
        (distribution as any).stable = false;
      });

      it('should delegate to findEABuildDownloadUrl for unstable versions', async () => {
        const currentPlatform =
          process.platform === 'win32' ? 'windows' : process.platform;

        const mockEAVersions = [
          {
            version: '23-ea-20240716',
            latest: true,
            download_base_url: 'https://example.com/download/',
            files: [
              {
                arch: 'x64',
                platform: currentPlatform,
                filename: 'graalvm-jdk-23_linux-x64_bin.tar.gz'
              },
              {
                arch: 'aarch64',
                platform: currentPlatform,
                filename: 'graalvm-jdk-23_linux-aarch64_bin.tar.gz'
              }
            ]
          }
        ];

        mockHttpClient.getJson.mockResolvedValue({
          result: mockEAVersions,
          statusCode: 200,
          headers: {}
        });

        jest
          .spyOn(distribution as any, 'distributionArchitecture')
          .mockReturnValue('x64');

        const result = await (distribution as any).findPackageForDownload('23');

        expect(result).toEqual({
          url: 'https://example.com/download/graalvm-jdk-23_linux-x64_bin.tar.gz',
          version: '23-ea-20240716'
        });

        expect(mockHttpClient.getJson).toHaveBeenCalledWith(
          'https://api.github.com/repos/graalvm/oracle-graalvm-ea-builds/contents/versions/23-ea.json?ref=main',
          {Accept: 'application/json'}
        );
      });

      it('should throw error when no latest EA version found', async () => {
        const currentPlatform =
          process.platform === 'win32' ? 'windows' : process.platform;

        const mockEAVersions = [
          {
            version: '23-ea-20240716',
            latest: false,
            download_base_url: 'https://example.com/download/',
            files: [
              {
                arch: 'x64',
                platform: currentPlatform,
                filename: 'graalvm-jdk-23_linux-x64_bin.tar.gz'
              }
            ]
          }
        ];

        mockHttpClient.getJson.mockResolvedValue({
          result: mockEAVersions,
          statusCode: 200,
          headers: {}
        });

        jest
          .spyOn(distribution as any, 'distributionArchitecture')
          .mockReturnValue('x64');

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow("No matching version found for SemVer '23-ea'");

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow(
          'Note: No EA build is marked as latest for this version.'
        );

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow('23-ea-20240716');

        // Verify error logging - removed as we now use the helper method which doesn't call core.error
      });

      it('should throw error when no matching file for architecture in EA build', async () => {
        const currentPlatform =
          process.platform === 'win32' ? 'windows' : process.platform;

        const mockEAVersions = [
          {
            version: '23-ea-20240716',
            latest: true,
            download_base_url: 'https://example.com/download/',
            files: [
              {
                arch: 'arm64',
                platform: currentPlatform,
                filename: 'graalvm-jdk-23_linux-arm64_bin.tar.gz'
              }
            ]
          }
        ];

        mockHttpClient.getJson.mockResolvedValue({
          result: mockEAVersions,
          statusCode: 200,
          headers: {}
        });

        jest
          .spyOn(distribution as any, 'distributionArchitecture')
          .mockReturnValue('x64');

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow(
          `Unable to find file for architecture 'x64' and platform '${currentPlatform}'`
        );

        // Verify error logging
        expect(core.error).toHaveBeenCalledWith(
          expect.stringContaining('Available files for architecture x64:')
        );
      });

      it('should throw error when no matching platform in EA build', async () => {
        const mockEAVersions = [
          {
            version: '23-ea-20240716',
            latest: true,
            download_base_url: 'https://example.com/download/',
            files: [
              {
                arch: 'x64',
                platform: 'different-platform',
                filename: 'graalvm-jdk-23_different-x64_bin.tar.gz'
              }
            ]
          }
        ];

        mockHttpClient.getJson.mockResolvedValue({
          result: mockEAVersions,
          statusCode: 200,
          headers: {}
        });

        jest
          .spyOn(distribution as any, 'distributionArchitecture')
          .mockReturnValue('x64');

        const currentPlatform =
          process.platform === 'win32' ? 'windows' : process.platform;

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow(
          `Unable to find file for architecture 'x64' and platform '${currentPlatform}'`
        );
      });

      it('should throw error when filename does not start with graalvm-jdk-', async () => {
        const currentPlatform =
          process.platform === 'win32' ? 'windows' : process.platform;

        const mockEAVersions = [
          {
            version: '23-ea-20240716',
            latest: true,
            download_base_url: 'https://example.com/download/',
            files: [
              {
                arch: 'x64',
                platform: currentPlatform,
                filename: 'wrong-prefix-23_linux-x64_bin.tar.gz'
              }
            ]
          }
        ];

        mockHttpClient.getJson.mockResolvedValue({
          result: mockEAVersions,
          statusCode: 200,
          headers: {}
        });

        jest
          .spyOn(distribution as any, 'distributionArchitecture')
          .mockReturnValue('x64');

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow(
          "Invalid filename format: wrong-prefix-23_linux-x64_bin.tar.gz. Expected to start with 'graalvm-jdk-'"
        );
      });

      it('should throw error when EA version JSON is not found', async () => {
        mockHttpClient.getJson.mockResolvedValue({
          result: null,
          statusCode: 404,
          headers: {}
        });

        await expect(
          (distribution as any).findPackageForDownload('23')
        ).rejects.toThrow(
          "No GraalVM EA build found for version '23-ea'. Please check if the version is correct."
        );
      });
    });
  });

  describe('findEABuildDownloadUrl', () => {
    const currentPlatform =
      process.platform === 'win32' ? 'windows' : process.platform;

    const mockEAVersions = [
      {
        version: '23-ea-20240716',
        latest: true,
        download_base_url: 'https://example.com/download/',
        files: [
          {
            arch: 'x64',
            platform: currentPlatform,
            filename: 'graalvm-jdk-23_linux-x64_bin.tar.gz'
          },
          {
            arch: 'aarch64',
            platform: currentPlatform,
            filename: 'graalvm-jdk-23_linux-aarch64_bin.tar.gz'
          }
        ]
      },
      {
        version: '23-ea-20240709',
        latest: false,
        download_base_url: 'https://example.com/old/',
        files: [
          {
            arch: 'x64',
            platform: currentPlatform,
            filename: 'graalvm-jdk-23_linux-x64_bin.tar.gz'
          }
        ]
      }
    ];

    let fetchEASpy: any;

    beforeEach(() => {
      fetchEASpy = jest.spyOn(distribution as any, 'fetchEAJson');
      jest
        .spyOn(distribution as any, 'distributionArchitecture')
        .mockReturnValue('x64');
    });

    it('should find latest version and return correct URL', async () => {
      fetchEASpy.mockResolvedValue(mockEAVersions);

      const result = await (distribution as any).findEABuildDownloadUrl(
        '23-ea'
      );

      expect(fetchEASpy).toHaveBeenCalledWith('23-ea');
      expect(result).toEqual({
        url: 'https://example.com/download/graalvm-jdk-23_linux-x64_bin.tar.gz',
        version: '23-ea-20240716'
      });

      // Verify debug logging
      expect(core.debug).toHaveBeenCalledWith('Searching for EA build: 23-ea');
      expect(core.debug).toHaveBeenCalledWith('Found 2 EA versions');
      expect(core.debug).toHaveBeenCalledWith(
        'Latest version found: 23-ea-20240716'
      );
      expect(core.debug).toHaveBeenCalledWith(
        'Download URL: https://example.com/download/graalvm-jdk-23_linux-x64_bin.tar.gz'
      );
    });

    it('should throw error when no latest version found', async () => {
      const noLatestVersions = mockEAVersions.map(v => ({...v, latest: false}));
      fetchEASpy.mockResolvedValue(noLatestVersions);

      await expect(
        (distribution as any).findEABuildDownloadUrl('23-ea')
      ).rejects.toThrow("No matching version found for SemVer '23-ea'");

      await expect(
        (distribution as any).findEABuildDownloadUrl('23-ea')
      ).rejects.toThrow(
        'Note: No EA build is marked as latest for this version.'
      );

      await expect(
        (distribution as any).findEABuildDownloadUrl('23-ea')
      ).rejects.toThrow('23-ea-20240716');

      // Verify error logging - removed as we now use the helper method which doesn't call core.error
    });

    it('should throw error when no matching file for architecture', async () => {
      const wrongArchVersions = [
        {
          version: '23-ea-20240716',
          latest: true,
          download_base_url: 'https://example.com/download/',
          files: [
            {
              arch: 'arm',
              platform: currentPlatform,
              filename: 'graalvm-jdk-23_linux-arm_bin.tar.gz'
            }
          ]
        }
      ];
      fetchEASpy.mockResolvedValue(wrongArchVersions);

      await expect(
        (distribution as any).findEABuildDownloadUrl('23-ea')
      ).rejects.toThrow(
        `Unable to find file for architecture 'x64' and platform '${currentPlatform}'`
      );

      expect(core.error).toHaveBeenCalledWith(
        expect.stringContaining('Available files for architecture x64:')
      );
    });

    it('should throw error when filename does not start with graalvm-jdk-', async () => {
      const badFilenameVersions = [
        {
          version: '23-ea-20240716',
          latest: true,
          download_base_url: 'https://example.com/download/',
          files: [
            {
              arch: 'x64',
              platform: currentPlatform,
              filename: 'wrong-name.tar.gz'
            }
          ]
        }
      ];
      fetchEASpy.mockResolvedValue(badFilenameVersions);

      await expect(
        (distribution as any).findEABuildDownloadUrl('23-ea')
      ).rejects.toThrow(
        "Invalid filename format: wrong-name.tar.gz. Expected to start with 'graalvm-jdk-'"
      );
    });

    it('should work with aarch64 architecture', async () => {
      jest
        .spyOn(distribution as any, 'distributionArchitecture')
        .mockReturnValue('aarch64');

      fetchEASpy.mockResolvedValue(mockEAVersions);

      const result = await (distribution as any).findEABuildDownloadUrl(
        '23-ea'
      );

      expect(result).toEqual({
        url: 'https://example.com/download/graalvm-jdk-23_linux-aarch64_bin.tar.gz',
        version: '23-ea-20240716'
      });
    });

    it('should throw error when platform does not match', async () => {
      const wrongPlatformVersions = [
        {
          version: '23-ea-20240716',
          latest: true,
          download_base_url: 'https://example.com/download/',
          files: [
            {
              arch: 'x64',
              platform: 'different-platform',
              filename: 'graalvm-jdk-23_different-x64_bin.tar.gz'
            }
          ]
        }
      ];
      fetchEASpy.mockResolvedValue(wrongPlatformVersions);

      await expect(
        (distribution as any).findEABuildDownloadUrl('23-ea')
      ).rejects.toThrow(
        `Unable to find file for architecture 'x64' and platform '${currentPlatform}'`
      );
    });
  });

  describe('fetchEAJson', () => {
    it('should fetch and return EA version data', async () => {
      const mockData = [{version: '23-ea', files: []}];
      mockHttpClient.getJson.mockResolvedValue({
        result: mockData,
        statusCode: 200,
        headers: {}
      });

      const result = await (distribution as any).fetchEAJson('23-ea');

      expect(mockHttpClient.getJson).toHaveBeenCalledWith(
        'https://api.github.com/repos/graalvm/oracle-graalvm-ea-builds/contents/versions/23-ea.json?ref=main',
        {Accept: 'application/json'}
      );
      expect(result).toEqual(mockData);
      expect(core.debug).toHaveBeenCalled();
    });

    it('should throw error when no data returned', async () => {
      mockHttpClient.getJson.mockResolvedValue({
        result: null,
        statusCode: 200,
        headers: {}
      });

      await expect((distribution as any).fetchEAJson('23-ea')).rejects.toThrow(
        "No GraalVM EA build found for version '23-ea'. Please check if the version is correct."
      );
    });

    it('should handle 404 errors with specific message', async () => {
      const error404 = new Error('Not Found: 404');
      mockHttpClient.getJson.mockRejectedValue(error404);

      await expect((distribution as any).fetchEAJson('23-ea')).rejects.toThrow(
        "GraalVM EA version '23-ea' not found. Please verify the version exists in the EA builds repository."
      );
    });

    it('should handle generic HTTP errors with context', async () => {
      const networkError = new Error('Network timeout');
      mockHttpClient.getJson.mockRejectedValue(networkError);

      await expect((distribution as any).fetchEAJson('23-ea')).rejects.toThrow(
        "Failed to fetch GraalVM EA version information for '23-ea': Network timeout"
      );
    });

    it('should handle non-Error exceptions', async () => {
      mockHttpClient.getJson.mockRejectedValue('String error');

      await expect((distribution as any).fetchEAJson('23-ea')).rejects.toThrow(
        "Failed to fetch GraalVM EA version information for '23-ea'"
      );
    });
  });

  describe('Integration tests', () => {
    it('should handle different architectures correctly', async () => {
      const architectures = ['x64', 'aarch64'];

      for (const arch of architectures) {
        distribution = new GraalVMDistribution({
          ...defaultOptions,
          architecture: arch
        });
        (distribution as any).http = mockHttpClient;

        const mockResponse = {
          message: {statusCode: 200}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        const result = await (distribution as any).findPackageForDownload('17');
        expect(result.url).toContain(arch);
      }
    });

    it('should handle different platforms correctly', async () => {
      const platforms = [
        {process: 'darwin', expected: 'macos'},
        {process: 'win32', expected: 'windows'},
        {process: 'linux', expected: 'linux'}
      ];

      const originalPlatform = process.platform;

      for (const {process: proc, expected} of platforms) {
        Object.defineProperty(process, 'platform', {
          value: proc,
          configurable: true
        });

        distribution = new GraalVMDistribution(defaultOptions);
        (distribution as any).http = mockHttpClient;

        const mockResponse = {
          message: {statusCode: 200}
        } as any;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        const result = await (distribution as any).findPackageForDownload('17');
        expect(result.url).toContain(expected);
      }

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });

    describe('GraalVMCommunityDistribution', () => {
      beforeEach(() => {
        jest
          .spyOn(communityDistribution, 'getPlatform')
          .mockReturnValue('linux');
      });

      it('should resolve an exact GraalVM Community version from GitHub releases', async () => {
        mockHttpClient.getJson.mockResolvedValue({
          result: [
            {
              draft: false,
              prerelease: false,
              assets: [
                {
                  name: 'graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz',
                  browser_download_url:
                    'https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-21.0.2/graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz'
                }
              ]
            }
          ],
          statusCode: 200,
          headers: {}
        });

        const result = await (
          communityDistribution as any
        ).findPackageForDownload('21.0.2');

        expect(result).toEqual({
          url: 'https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-21.0.2/graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz',
          version: '21.0.2'
        });
      });

      it('should resolve the latest GraalVM Community release for a major version', async () => {
        mockHttpClient.getJson.mockResolvedValue({
          result: [
            {
              draft: false,
              prerelease: false,
              assets: [
                {
                  name: 'graalvm-community-jdk-21.0.1_linux-x64_bin.tar.gz',
                  browser_download_url:
                    'https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-21.0.1/graalvm-community-jdk-21.0.1_linux-x64_bin.tar.gz'
                }
              ]
            },
            {
              draft: false,
              prerelease: false,
              assets: [
                {
                  name: 'graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz',
                  browser_download_url:
                    'https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-21.0.2/graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz'
                }
              ]
            }
          ],
          statusCode: 200,
          headers: {}
        });

        const result = await (
          communityDistribution as any
        ).findPackageForDownload('21');

        expect(result).toEqual({
          url: 'https://github.com/graalvm/graalvm-ce-builds/releases/download/jdk-21.0.2/graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz',
          version: '21.0.2'
        });
      });

      it('should reject GraalVM Community early access requests', async () => {
        (communityDistribution as any).stable = false;

        await expect(
          (communityDistribution as any).findPackageForDownload('23')
        ).rejects.toThrow(
          'GraalVM Community does not provide early access builds'
        );
      });

      it('should surface an error when the releases listing is not an array', async () => {
        mockHttpClient.getJson.mockResolvedValue({
          result: {message: 'API rate limit exceeded'},
          statusCode: 403,
          headers: {}
        });

        await expect(
          (communityDistribution as any).findPackageForDownload('21')
        ).rejects.toThrow(
          /Unexpected response while listing GraalVM Community releases.*HTTP status code: 403/s
        );
      });
    });
  });
});

describe('distribution factory', () => {
  const defaultOptions: JavaInstallerOptions = {
    version: '17',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  };

  it('should map graalvm-community to the community installer', () => {
    const community = getJavaDistribution('graalvm-community', defaultOptions);

    expect(community).toBeInstanceOf(GraalVMCommunityDistribution);
  });
});

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as http from '@actions/http-client';
import fs from 'fs';
import path from 'path';
import {GraalVMDistribution} from '../../src/distributions/graalvm/installer';
import {JavaInstallerOptions} from '../../src/distributions/base-models';
import * as util from '../../src/util';

jest.mock('@actions/core');
jest.mock('@actions/tool-cache');
jest.mock('@actions/http-client');

jest.mock('../../src/util', () => ({
  ...jest.requireActual('../../src/util'),
  extractJdkFile: jest.fn(),
  getDownloadArchiveExtension: jest.fn(),
  renameWinArchive: jest.fn(),
  getGitHubHttpHeaders: jest.fn().mockReturnValue({Accept: 'application/json'})
}));

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
  existsSync: jest.fn()
}));

beforeAll(() => {
  process.env.NODE_ENV = 'test';

  if (!jest.isMockFunction(http.HttpClient)) {
    throw new Error('HTTP client must be mocked in tests!');
  }

  if (!jest.isMockFunction(tc.downloadTool)) {
    throw new Error('Tool cache downloadTool must be mocked in tests!');
  }

  console.log('✅ All external dependencies are properly mocked');
});

describe('GraalVMDistribution', () => {
  let distribution: GraalVMDistribution;
  let mockHttpClient: jest.Mocked<http.HttpClient>;

  const defaultOptions: JavaInstallerOptions = {
    version: '17',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  };

  beforeEach(() => {
    jest.clearAllMocks();

    distribution = new GraalVMDistribution(defaultOptions);

    mockHttpClient = new http.HttpClient() as jest.Mocked<http.HttpClient>;
    (distribution as any).http = mockHttpClient;

    (util.getDownloadArchiveExtension as jest.Mock).mockReturnValue('tar.gz');
  });

  afterAll(() => {
    expect(jest.isMockFunction(http.HttpClient)).toBe(true);

    expect(jest.isMockFunction(tc.downloadTool)).toBe(true);
    expect(jest.isMockFunction(tc.cacheDir)).toBe(true);

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
      (tc.downloadTool as jest.Mock).mockResolvedValue('/tmp/archive.tar.gz');
      (tc.cacheDir as jest.Mock).mockResolvedValue('/cached/java/path');

      (util.extractJdkFile as jest.Mock).mockResolvedValue('/tmp/extracted');

      // Mock renameWinArchive - it returns the same path (no renaming)
      (util.renameWinArchive as jest.Mock).mockImplementation((p: string) => p);

      (util.getDownloadArchiveExtension as jest.Mock).mockReturnValue('tar.gz');

      // Mock fs.existsSync to return true for extracted path
      (fs.existsSync as jest.Mock).mockReturnValue(true);

      (fs.readdirSync as jest.Mock).mockReturnValue(['graalvm-jdk-17.0.5']);

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
      (fs.existsSync as jest.Mock).mockReturnValue(false);

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
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readdirSync as jest.Mock).mockReturnValue([]);

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
      (tc.downloadTool as jest.Mock).mockRejectedValue(downloadError);

      await expect(
        (distribution as any).downloadTool(javaRelease)
      ).rejects.toThrow('Network error during download');

      expect(core.error).toHaveBeenCalledWith(
        'Failed to download and extract GraalVM: Error: Network error during download'
      );
    });

    it('should handle extraction errors', async () => {
      const extractError = new Error('Failed to extract archive');
      (util.extractJdkFile as jest.Mock).mockRejectedValue(extractError);

      await expect(
        (distribution as any).downloadTool(javaRelease)
      ).rejects.toThrow('Failed to extract archive');

      expect(core.error).toHaveBeenCalledWith(
        'Failed to download and extract GraalVM: Error: Failed to extract archive'
      );
    });

    it('should handle different archive extensions', async () => {
      // Test with a .zip file
      (util.getDownloadArchiveExtension as jest.Mock).mockReturnValue('zip');
      (tc.downloadTool as jest.Mock).mockResolvedValue('/tmp/archive.zip');

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
        } as http.HttpClientResponse;
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
        } as http.HttpClientResponse;
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
        } as http.HttpClientResponse;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        await expect(
          (distribution as any).findPackageForDownload('17.0.99')
        ).rejects.toThrow(
          'Could not find GraalVM for SemVer 17.0.99. Please check if this version is available at https://download.oracle.com/graalvm'
        );
      });

      it('should throw error for unauthorized access (401)', async () => {
        const mockResponse = {
          message: {statusCode: 401}
        } as http.HttpClientResponse;
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
        } as http.HttpClientResponse;
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
        } as http.HttpClientResponse;
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
        } as http.HttpClientResponse;
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
        ).rejects.toThrow("Unable to find latest version for '23-ea'");

        // Verify error logging
        expect(core.error).toHaveBeenCalledWith(
          'Available versions: 23-ea-20240716'
        );
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

    let fetchEASpy: jest.SpyInstance;

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
      ).rejects.toThrow("Unable to find latest version for '23-ea'");

      expect(core.error).toHaveBeenCalledWith(
        'Available versions: 23-ea-20240716, 23-ea-20240709'
      );
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
        } as http.HttpClientResponse;
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
        } as http.HttpClientResponse;
        mockHttpClient.head.mockResolvedValue(mockResponse);

        const result = await (distribution as any).findPackageForDownload('17');
        expect(result.url).toContain(expected);
      }

      Object.defineProperty(process, 'platform', {
        value: originalPlatform,
        configurable: true
      });
    });
  });
});

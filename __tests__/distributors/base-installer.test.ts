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
import type {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../../src/distributions/base-models.js';

import path from 'path';
import * as semver from 'semver';
import fs from 'fs';
import {createHash} from 'crypto';
import {HttpClient} from '@actions/http-client';

import os from 'os';

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
  evaluateVersions: jest.fn(),
  HTTPError: class HTTPError extends Error {
    httpStatusCode: number;
    constructor(statusCode: number) {
      super(`HTTP Error: ${statusCode}`);
      this.httpStatusCode = statusCode;
    }
  }
}));

jest.unstable_mockModule('../../src/jdk-cache.js', () => ({
  getJdkVerificationIdentity: jest.fn((verified: boolean, key?: string) =>
    verified ? (key ? 'verified:custom' : 'verified:bundled') : 'unverified'
  ),
  registerJdk: jest.fn(),
  restoreJdk: jest.fn()
}));

jest.unstable_mockModule('../../src/jdk-resolution-cache.js', () => ({
  registerJdkResolution: jest.fn(),
  restoreJdkResolution: jest.fn()
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

// Dynamic imports after mocking
const core = await import('@actions/core');
const tc = await import('@actions/tool-cache');
const util = await import('../../src/util.js');
const jdkCache = await import('../../src/jdk-cache.js');
const jdkResolutionCache = await import('../../src/jdk-resolution-cache.js');
const {JavaBase} = await import('../../src/distributions/base-installer.js');

class EmptyJavaBase extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Empty', installerOptions);
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    return {
      version: '11.0.9',
      path: path.join(
        'toolcache',
        this.toolcacheFolderName,
        '11.0.9',
        this.architecture
      )
    };
  }

  protected async findPackageForDownload(
    range: string
  ): Promise<JavaDownloadRelease> {
    const availableVersion = '11.0.9';
    if (!semver.satisfies(availableVersion, range)) {
      throw this.createVersionNotFoundError(range, [availableVersion]);
    }

    return {
      version: availableVersion,
      url: `some/random_url/java/${availableVersion}`
    };
  }

  public downloadRelease(javaRelease: JavaDownloadRelease): Promise<string> {
    return this.downloadAndVerify(javaRelease);
  }

  public fetchChecksumForTest(
    checksumUrl: string,
    algorithm: 'sha256' | 'sha512' | ('sha256' | 'sha512')[]
  ) {
    return this.fetchChecksum(checksumUrl, algorithm);
  }
}

describe('findInToolcache', () => {
  const actualJavaVersion = '11.0.8';
  const javaPath = path.join('Java_Empty_jdk', actualJavaVersion, 'x64');

  let mockJavaBase: EmptyJavaBase;
  let spyGetToolcachePath: any;
  let spyTcFindAllVersions: any;

  beforeEach(() => {
    spyGetToolcachePath = util.getToolcachePath as jest.Mock;
    spyTcFindAllVersions = tc.findAllVersions as jest.Mock;
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      {version: actualJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11.0',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      {version: actualJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11.0.8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      {version: actualJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: actualJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11.0',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: actualJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11.0.8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: actualJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      null
    ],
    [
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      null
    ],
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      null
    ],
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jre',
        checkLatest: false
      },
      null
    ]
  ])(`should find java for path %s -> %s`, (input, expected) => {
    spyTcFindAllVersions.mockReturnValue([actualJavaVersion]);
    spyGetToolcachePath.mockImplementation(
      (toolname: string, javaVersion: string, architecture: string) => {
        const semverVersion = new semver.Range(javaVersion);

        if (
          path.basename(javaPath) !== architecture ||
          !javaPath.includes(toolname)
        ) {
          return '';
        }

        return semver.satisfies(actualJavaVersion, semverVersion)
          ? javaPath
          : '';
      }
    );
    mockJavaBase = new EmptyJavaBase(input);
    expect(mockJavaBase['findInToolcache']()).toEqual(expected);
  });

  it.each([
    ['11', {version: '11.0.3+2', versionInPath: '11.0.3-2'}],
    ['11.0', {version: '11.0.3+2', versionInPath: '11.0.3-2'}],
    ['11.0.1', {version: '11.0.1', versionInPath: '11.0.1'}],
    ['11.0.3', {version: '11.0.3+2', versionInPath: '11.0.3-2'}],
    ['15', {version: '15.0.2+4', versionInPath: '15.0.2-4'}],
    ['x', {version: '15.0.2+4', versionInPath: '15.0.2-4'}],
    ['x-ea', {version: '17.4.4', versionInPath: '17.4.4-ea'}],
    [
      '11-ea',
      {version: '11.3.3+5.2.1231421', versionInPath: '11.3.3-ea.5.2.1231421'}
    ],
    ['11.2-ea', {version: '11.2.1', versionInPath: '11.2.1-ea'}],
    ['11.2.1-ea', {version: '11.2.1', versionInPath: '11.2.1-ea'}]
  ])(
    'should choose correct java from tool-cache for input %s',
    (input, expected) => {
      spyTcFindAllVersions.mockReturnValue([
        '17.4.4-ea',
        '11.0.2',
        '15.0.2-4',
        '11.0.3-2',
        '11.2.1-ea',
        '11.3.2-ea',
        '11.3.2-ea.5',
        '11.3.3-ea.5.2.1231421',
        '12.3.2-0',
        '11.0.1'
      ]);
      spyGetToolcachePath.mockImplementation(
        (toolname: string, javaVersion: string, architecture: string) =>
          `/hostedtoolcache/${toolname}/${javaVersion}/${architecture}`
      );
      mockJavaBase = new EmptyJavaBase({
        version: input,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      const foundVersion = mockJavaBase['findInToolcache']();
      expect(foundVersion).toEqual({
        version: expected.version,
        path: `/hostedtoolcache/Java_Empty_jdk/${expected.versionInPath}/x64`
      });
    }
  );
});

describe('setupJava', () => {
  const actualJavaVersion = '11.0.9';
  const installedJavaVersion = '11.0.8';
  const javaPath = path.join('Java_Empty_jdk', installedJavaVersion, 'x86');
  const javaPathInstalled = path.join(
    'toolcache',
    'Java_Empty_jdk',
    actualJavaVersion,
    'x86'
  );

  let mockJavaBase: EmptyJavaBase;

  let spyGetToolcachePath: any;
  let spyTcFindAllVersions: any;
  let spyCoreDebug: any;
  let spyCoreInfo: any;
  let spyCoreExportVariable: any;
  let spyCoreAddPath: any;
  let spyCoreSetOutput: any;
  let spyCoreError: any;

  beforeEach(() => {
    (jdkCache.getJdkVerificationIdentity as jest.Mock).mockImplementation(
      (verified: boolean, key?: string) =>
        verified ? (key ? 'verified:custom' : 'verified:bundled') : 'unverified'
    );
    spyGetToolcachePath = util.getToolcachePath as jest.Mock;
    spyGetToolcachePath.mockImplementation(
      (toolname: string, javaVersion: string, architecture: string) => {
        const semverVersion = new semver.Range(javaVersion);

        if (
          path.basename(javaPath) !== architecture ||
          !javaPath.includes(toolname)
        ) {
          return '';
        }

        return semver.satisfies(installedJavaVersion, semverVersion)
          ? javaPath
          : '';
      }
    );

    spyTcFindAllVersions = tc.findAllVersions as jest.Mock;
    spyTcFindAllVersions.mockReturnValue([installedJavaVersion]);

    // Spy on core methods
    spyCoreDebug = core.debug as jest.Mock;
    spyCoreDebug.mockImplementation(() => undefined);

    spyCoreInfo = core.info as jest.Mock;
    spyCoreInfo.mockImplementation(() => undefined);

    spyCoreAddPath = core.addPath as jest.Mock;
    spyCoreAddPath.mockImplementation(() => undefined);

    spyCoreExportVariable = core.exportVariable as jest.Mock;
    spyCoreExportVariable.mockImplementation(() => undefined);

    spyCoreSetOutput = core.setOutput as jest.Mock;
    spyCoreSetOutput.mockImplementation(() => undefined);

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => undefined);

    jest.spyOn(os, 'arch').mockReturnValue('x86' as ReturnType<typeof os.arch>);
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      {version: installedJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11.0',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      {version: installedJavaVersion, path: javaPath}
    ],
    [
      {
        version: '11.0.8',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      {version: installedJavaVersion, path: javaPath}
    ],
    [
      {version: '11', architecture: '', packageType: 'jdk', checkLatest: false},
      {version: installedJavaVersion, path: javaPath}
    ]
  ])('should find java locally for %s', async (input, expected) => {
    mockJavaBase = new EmptyJavaBase(input);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Resolved Java ${expected.version} from tool-cache`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Setting Java ${expected.version} as the default`
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      'Trying to resolve the latest version from remote'
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith('Trying to download...');
  });

  it('should resolve the latest version from remote when java-version is "latest", even if a version is cached', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: 'latest',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    });

    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: actualJavaVersion,
      path: javaPathInstalled
    });

    // `latest` must bypass the tool-cache short-circuit and always resolve remotely
    expect(spyCoreInfo).toHaveBeenCalledWith(
      'Trying to resolve the latest version from remote'
    );
    expect(spyCoreInfo).toHaveBeenCalledWith('Trying to download...');
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Resolved Java ${installedJavaVersion} from tool-cache`
    );
  });

  it('should download java when force-download is enabled, even if the version is cached', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: actualJavaVersion,
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false,
      forceDownload: true,
      cacheJdk: true
    });

    const findInToolcache = jest.fn(() => ({
      version: actualJavaVersion,
      path: javaPathInstalled
    }));
    mockJavaBase['findInToolcache'] = findInToolcache;

    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: actualJavaVersion,
      path: javaPathInstalled
    });

    expect(findInToolcache).not.toHaveBeenCalled();
    expect(spyCoreInfo).toHaveBeenCalledWith('Trying to download...');
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Java ${actualJavaVersion} was downloaded`
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(jdkCache.restoreJdk).not.toHaveBeenCalled();
    expect(jdkCache.registerJdk).toHaveBeenCalledWith(
      expect.objectContaining({
        version: actualJavaVersion,
        verification: 'unverified'
      })
    );
  });

  it.each([
    [false, false, false, false],
    [false, true, true, true],
    [true, false, false, false],
    [true, true, false, true]
  ])(
    'handles force-download=%s and cache-jdk=%s',
    async (forceDownload, cacheJdkEnabled, restores, registers) => {
      mockJavaBase = new EmptyJavaBase({
        version: actualJavaVersion,
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: true,
        forceDownload,
        cacheJdk: cacheJdkEnabled
      });
      (jdkCache.restoreJdk as jest.Mock).mockResolvedValue(false);

      await mockJavaBase.setupJava();

      expect(jdkCache.restoreJdk).toHaveBeenCalledTimes(restores ? 1 : 0);
      expect(jdkCache.registerJdk).toHaveBeenCalledTimes(registers ? 1 : 0);
    }
  );

  it('restores the exact resolved JDK before downloading', async () => {
    const toolCachePath = path.join('toolcache');
    jest.replaceProperty(process, 'env', {
      ...process.env,
      RUNNER_TOOL_CACHE: toolCachePath
    });
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: true,
      cacheJdk: true
    });
    const downloadTool = jest.spyOn(mockJavaBase as any, 'downloadTool');
    (jdkCache.restoreJdk as jest.Mock).mockResolvedValue(true);
    jest
      .spyOn(mockJavaBase as any, 'getRestoredJdkPath')
      .mockReturnValue(javaPathInstalled);

    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: actualJavaVersion,
      path: javaPathInstalled
    });

    expect(jdkCache.restoreJdk).toHaveBeenCalledWith({
      distribution: 'Empty',
      packageType: 'jdk',
      architecture: 'x86',
      version: actualJavaVersion,
      source: `some/random_url/java/${actualJavaVersion}`,
      verification: 'unverified',
      path: path.join(toolCachePath, 'Java_Empty_jdk', actualJavaVersion)
    });
    expect(downloadTool).not.toHaveBeenCalled();
    expect(spyCoreInfo).not.toHaveBeenCalledWith('Trying to download...');
    // A restored entry is already stored under its key; it must not be
    // re-registered for a post-job save.
    expect(jdkCache.registerJdk).not.toHaveBeenCalled();
  });

  it('registers the downloaded JDK identity after a JDK cache miss', async () => {
    const toolCachePath = path.join('toolcache');
    jest.replaceProperty(process, 'env', {
      ...process.env,
      RUNNER_TOOL_CACHE: toolCachePath
    });
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: true,
      cacheJdk: true
    });
    (jdkCache.restoreJdk as jest.Mock).mockResolvedValue(false);

    await mockJavaBase.setupJava();

    const expectedIdentity = {
      distribution: 'Empty',
      packageType: 'jdk',
      architecture: 'x86',
      version: actualJavaVersion,
      source: `some/random_url/java/${actualJavaVersion}`,
      verification: 'unverified',
      path: path.join(toolCachePath, 'Java_Empty_jdk', actualJavaVersion)
    };
    expect(jdkCache.restoreJdk).toHaveBeenCalledWith(expectedIdentity);
    // Registration happens after the installation exists, so the post-job save
    // can detect a later step replacing it.
    expect(jdkCache.registerJdk).toHaveBeenCalledWith(expectedIdentity);
    expect(spyCoreInfo).toHaveBeenCalledWith('Trying to download...');
  });

  it.each([
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jre',
        checkLatest: false
      },
      {
        path: path.join('toolcache', 'Java_Empty_jre', '11.0.9', 'x86'),
        version: '11.0.9'
      }
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      {
        path: path.join('toolcache', 'Java_Empty_jdk', '11.0.9', 'x64'),
        version: '11.0.9'
      }
    ],
    [
      {
        version: '11',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      {
        path: path.join('toolcache', 'Java_Empty_jre', '11.0.9', 'x64'),
        version: '11.0.9'
      }
    ],
    [
      {version: '11', architecture: '', packageType: 'jre', checkLatest: false},
      {
        path: path.join('toolcache', 'Java_Empty_jre', '11.0.9', 'x86'),
        version: '11.0.9'
      }
    ]
  ])('download java with configuration %s', async (input, expected) => {
    mockJavaBase = new EmptyJavaBase(input);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
    expect(spyCoreAddPath).toHaveBeenCalled();
    expect(spyCoreExportVariable).toHaveBeenCalled();
    expect(spyCoreExportVariable).toHaveBeenCalledWith(
      `JAVA_HOME_${input.version}_${(
        input.architecture || 'x86'
      ).toLocaleUpperCase()}`,
      expected.path
    );
    expect(spyCoreSetOutput).toHaveBeenCalled();
    expect(spyCoreInfo).toHaveBeenCalledWith(
      'Trying to resolve the latest version from remote'
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Resolved latest version as ${expected.version}`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith('Trying to download...');
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Java ${expected.version} was downloaded`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Setting Java ${expected.version} as the default`
    );
  });

  it.each([
    [
      {
        version: '11.0.9',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: '11.0.9', path: javaPathInstalled}
    ],
    [
      {
        version: '11.0.9',
        architecture: '',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: '11.0.9', path: javaPathInstalled}
    ]
  ])(
    'should check the latest java version for %s and resolve locally',
    async (input, expected) => {
      mockJavaBase = new EmptyJavaBase(input);
      mockJavaBase['findInToolcache'] = () => ({
        version: '11.0.9',
        path: expected.path
      });
      await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
      expect(spyCoreInfo).toHaveBeenCalledWith(
        'Trying to resolve the latest version from remote'
      );
      expect(spyCoreInfo).toHaveBeenCalledWith(
        `Resolved latest version as ${expected.version}`
      );
      expect(spyCoreInfo).toHaveBeenCalledWith(
        `Resolved Java ${expected.version} from tool-cache`
      );
      expect(spyCoreInfo).toHaveBeenCalledWith(
        `Setting Java ${expected.version} as the default`
      );
    }
  );

  it('should fail when verify-signature is enabled for unsupported distributions', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true
    });

    await expect(mockJavaBase.setupJava()).rejects.toThrow(
      "Input 'verify-signature' is not supported for distribution 'Empty'."
    );
    expect(spyTcFindAllVersions).not.toHaveBeenCalled();
    expect(spyCoreAddPath).not.toHaveBeenCalled();
    expect(spyCoreExportVariable).not.toHaveBeenCalled();
    expect(spyCoreSetOutput).not.toHaveBeenCalled();
  });

  it('should not repeat version resolution when downloadTool fails', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false,
      forceDownload: true
    });
    const findPackageForDownload = jest.fn(async () => ({
      version: '11.0.9',
      url: 'https://example.com/jdk.tar.gz'
    }));
    const downloadError = new Error('download failed');
    const downloadTool = jest.fn(async () => {
      throw downloadError;
    });
    mockJavaBase['findPackageForDownload'] = findPackageForDownload;
    mockJavaBase['downloadTool'] = downloadTool;

    await expect(mockJavaBase.setupJava()).rejects.toBe(downloadError);

    expect(findPackageForDownload).toHaveBeenCalledTimes(1);
    expect(downloadTool).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: actualJavaVersion, path: javaPathInstalled}
    ],
    [
      {
        version: '11.0',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: actualJavaVersion, path: javaPathInstalled}
    ],
    [
      {
        version: '11.0.x',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: true
      },
      {version: actualJavaVersion, path: javaPathInstalled}
    ],
    [
      {version: '11', architecture: '', packageType: 'jdk', checkLatest: true},
      {version: actualJavaVersion, path: javaPathInstalled}
    ]
  ])(
    'should check the latest java version for %s and download',
    async (input, expected) => {
      mockJavaBase = new EmptyJavaBase(input);
      await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
      expect(spyGetToolcachePath).toHaveBeenCalled();
      expect(spyCoreInfo).toHaveBeenCalledWith(
        'Trying to resolve the latest version from remote'
      );
      expect(spyCoreInfo).toHaveBeenCalledWith(
        `Resolved latest version as ${actualJavaVersion}`
      );
      expect(spyCoreInfo).toHaveBeenCalledWith('Trying to download...');
      expect(spyCoreInfo).toHaveBeenCalledWith(
        `Java ${actualJavaVersion} was downloaded`
      );
      expect(spyCoreInfo).toHaveBeenCalledWith(
        `Setting Java ${expected.version} as the default`
      );
    }
  );

  it.each([
    [
      {
        version: '15',
        architecture: 'x86',
        packageType: 'jre',
        checkLatest: false
      }
    ],
    [
      {
        version: '11.0.7',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      }
    ]
  ])('should throw an error for version not found for %s', async input => {
    mockJavaBase = new EmptyJavaBase(input);
    await expect(mockJavaBase.setupJava()).rejects.toThrow(
      `No matching version found for SemVer '${input.version}'`
    );
    expect(spyTcFindAllVersions).toHaveBeenCalled();
    expect(spyCoreAddPath).not.toHaveBeenCalled();
    expect(spyCoreExportVariable).not.toHaveBeenCalled();
    expect(spyCoreSetOutput).not.toHaveBeenCalled();
  });

  it('should not set JAVA_HOME and PATH when setDefault is false', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false,
      setDefault: false
    });
    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: installedJavaVersion,
      path: javaPath
    });
    expect(spyCoreExportVariable).not.toHaveBeenCalledWith(
      'JAVA_HOME',
      expect.anything()
    );
    expect(spyCoreAddPath).not.toHaveBeenCalled();
    expect(spyCoreExportVariable).toHaveBeenCalledWith(
      'JAVA_HOME_11_X86',
      javaPath
    );
    expect(spyCoreSetOutput).toHaveBeenCalledWith(
      'version',
      installedJavaVersion
    );
    expect(spyCoreSetOutput).toHaveBeenCalledWith('path', javaPath);
    expect(spyCoreSetOutput).toHaveBeenCalledWith('distribution', 'Empty');
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Installing Java ${installedJavaVersion} (not setting as default)`
    );
  });

  it('should set JAVA_HOME and PATH when setDefault is true', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false,
      setDefault: true
    });
    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: installedJavaVersion,
      path: javaPath
    });
    expect(spyCoreExportVariable).toHaveBeenCalledWith('JAVA_HOME', javaPath);
    expect(spyCoreAddPath).toHaveBeenCalledWith(path.join(javaPath, 'bin'));
    expect(spyCoreExportVariable).toHaveBeenCalledWith(
      'JAVA_HOME_11_X86',
      javaPath
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Setting Java ${installedJavaVersion} as the default`
    );
  });

  it('should default to setting as default when setDefault is not specified', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    });
    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: installedJavaVersion,
      path: javaPath
    });
    expect(spyCoreExportVariable).toHaveBeenCalledWith('JAVA_HOME', javaPath);
    expect(spyCoreAddPath).toHaveBeenCalledWith(path.join(javaPath, 'bin'));
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Setting Java ${installedJavaVersion} as the default`
    );
  });

  it('should download and not set default when setDefault is false', async () => {
    mockJavaBase = new EmptyJavaBase({
      version: '11',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      setDefault: false
    });
    await expect(mockJavaBase.setupJava()).resolves.toEqual({
      version: '11.0.9',
      path: path.join('toolcache', 'Java_Empty_jdk', '11.0.9', 'x64')
    });
    expect(spyCoreExportVariable).not.toHaveBeenCalledWith(
      'JAVA_HOME',
      expect.anything()
    );
    expect(spyCoreAddPath).not.toHaveBeenCalled();
    expect(spyCoreExportVariable).toHaveBeenCalledWith(
      'JAVA_HOME_11_X64',
      path.join('toolcache', 'Java_Empty_jdk', '11.0.9', 'x64')
    );
    expect(spyCoreSetOutput).toHaveBeenCalledWith('version', '11.0.9');
    expect(spyCoreSetOutput).toHaveBeenCalledWith(
      'path',
      path.join('toolcache', 'Java_Empty_jdk', '11.0.9', 'x64')
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      'Installing Java 11.0.9 (not setting as default)'
    );
  });

  describe('resolution cache', () => {
    // 11.0.9 is not in the mocked tool-cache, so the tool-cache short-circuit
    // misses and the release has to be resolved, exactly as it does for every
    // distribution that is not preinstalled on hosted runners.
    const options: JavaInstallerOptions = {
      version: '11.0.9',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false,
      cacheJdk: true
    };
    const cachedRelease = {
      version: '11.0.9',
      url: 'https://example.com/java/11.0.9'
    };

    const expectedRequest = {
      distribution: 'Empty',
      packageType: 'jdk',
      architecture: 'x86',
      versionSpec: '11.0.9',
      stable: true
    };

    beforeEach(() => {
      (jdkCache.restoreJdk as jest.Mock).mockResolvedValue(false);
      (jdkResolutionCache.restoreJdkResolution as jest.Mock).mockResolvedValue(
        undefined
      );
    });

    it('skips the metadata API on a fresh cached resolution', async () => {
      mockJavaBase = new EmptyJavaBase(options);
      const findPackageForDownload = jest.spyOn(
        mockJavaBase as any,
        'findPackageForDownload'
      );
      (jdkResolutionCache.restoreJdkResolution as jest.Mock).mockResolvedValue({
        release: cachedRelease,
        fresh: true
      });

      await mockJavaBase.setupJava();

      expect(jdkResolutionCache.restoreJdkResolution).toHaveBeenCalledWith(
        expectedRequest
      );
      expect(findPackageForDownload).not.toHaveBeenCalled();
      expect(jdkResolutionCache.registerJdkResolution).not.toHaveBeenCalled();
      expect(spyCoreInfo).toHaveBeenCalledWith(
        'Resolved Empty 11.0.9 from the resolution cache'
      );
    });

    it('re-resolves and records the release on a miss', async () => {
      mockJavaBase = new EmptyJavaBase(options);

      await mockJavaBase.setupJava();

      expect(jdkResolutionCache.registerJdkResolution).toHaveBeenCalledWith(
        expectedRequest,
        {version: '11.0.9', url: 'some/random_url/java/11.0.9'}
      );
    });

    it('re-resolves when the cached resolution is stale', async () => {
      mockJavaBase = new EmptyJavaBase(options);
      const findPackageForDownload = jest.spyOn(
        mockJavaBase as any,
        'findPackageForDownload'
      );
      (jdkResolutionCache.restoreJdkResolution as jest.Mock).mockResolvedValue({
        release: cachedRelease,
        fresh: false
      });

      await mockJavaBase.setupJava();

      expect(findPackageForDownload).toHaveBeenCalled();
      expect(jdkResolutionCache.registerJdkResolution).toHaveBeenCalled();
    });

    it('falls back to a stale resolution when the metadata API fails', async () => {
      mockJavaBase = new EmptyJavaBase(options);
      const downloadTool = jest
        .spyOn(mockJavaBase as any, 'downloadTool')
        .mockResolvedValue({version: '11.0.9', path: javaPathInstalled});
      jest
        .spyOn(mockJavaBase as any, 'findPackageForDownload')
        .mockRejectedValue(new Error('503 Service Unavailable'));
      (jdkResolutionCache.restoreJdkResolution as jest.Mock).mockResolvedValue({
        release: cachedRelease,
        fresh: false
      });

      await expect(mockJavaBase.setupJava()).resolves.toEqual({
        version: '11.0.9',
        path: javaPathInstalled
      });

      expect(downloadTool).toHaveBeenCalledWith(cachedRelease);
      expect(jdkResolutionCache.registerJdkResolution).not.toHaveBeenCalled();
      expect(core.warning).toHaveBeenCalledWith(
        expect.stringContaining('falling back to the cached resolution')
      );
    });

    it('fails when the metadata API fails and nothing was cached', async () => {
      mockJavaBase = new EmptyJavaBase(options);
      jest
        .spyOn(mockJavaBase as any, 'findPackageForDownload')
        .mockRejectedValue(new Error('503 Service Unavailable'));

      await expect(mockJavaBase.setupJava()).rejects.toThrow(
        '503 Service Unavailable'
      );
    });

    it('does not record a floating release', async () => {
      mockJavaBase = new EmptyJavaBase(options);
      jest
        .spyOn(mockJavaBase as any, 'findPackageForDownload')
        .mockResolvedValue({
          version: '11.0.9',
          url: 'https://example.com/java/11/latest/jdk-11.tar.gz',
          checksum: {algorithm: 'sha256', value: 'abc'},
          floating: true
        });

      await mockJavaBase.setupJava();

      expect(jdkResolutionCache.registerJdkResolution).not.toHaveBeenCalled();
    });

    it.each([
      ['cache-jdk is disabled', {cacheJdk: false}],
      ['check-latest is enabled', {checkLatest: true}],
      ['force-download is enabled', {forceDownload: true}],
      ['java-version is "latest"', {version: 'latest'}]
    ])('is bypassed when %s', async (_name, overrides) => {
      mockJavaBase = new EmptyJavaBase({...options, ...overrides});

      await mockJavaBase.setupJava();

      expect(jdkResolutionCache.restoreJdkResolution).not.toHaveBeenCalled();
      expect(jdkResolutionCache.registerJdkResolution).not.toHaveBeenCalled();
    });
  });
});

describe('downloadAndVerify', () => {
  const options: JavaInstallerOptions = {
    version: '21',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  };
  let temporaryDirectory: string;
  let archivePath: string;

  beforeEach(async () => {
    temporaryDirectory = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'setup-java-base-')
    );
    archivePath = path.join(temporaryDirectory, 'archive');
    await fs.promises.writeFile(archivePath, 'downloaded archive');
    (tc.downloadTool as jest.Mock<any>).mockResolvedValue(archivePath);
  });

  afterEach(async () => {
    await fs.promises.rm(temporaryDirectory, {recursive: true, force: true});
    jest.resetAllMocks();
  });

  it('returns a download after successful verification', async () => {
    const distribution = new EmptyJavaBase(options);
    const result = await distribution.downloadRelease({
      version: '21.0.8',
      url: 'https://vendor.example/jdk.tar.gz',
      checksum: {
        algorithm: 'sha256',
        value: createHash('sha256').update('downloaded archive').digest('hex')
      }
    });

    expect(result).toBe(archivePath);
    expect(fs.existsSync(archivePath)).toBe(true);
    expect(core.debug).toHaveBeenCalledWith(
      'Verified sha256 checksum for Empty version 21.0.8.'
    );
  });

  it('removes the download after verification failure', async () => {
    const distribution = new EmptyJavaBase(options);

    await expect(
      distribution.downloadRelease({
        version: '21.0.8',
        url: 'https://vendor.example/jdk.tar.gz?token=secret',
        checksum: {algorithm: 'sha256', value: 'a'.repeat(64)}
      })
    ).rejects.toThrow('Checksum verification failed for Empty version 21.0.8');

    expect(fs.existsSync(archivePath)).toBe(false);
  });

  it('preserves the verification error when removing the download fails', async () => {
    const distribution = new EmptyJavaBase(options);
    const cleanupError = new Error('cleanup failed');
    jest.spyOn(fs.promises, 'rm').mockRejectedValueOnce(cleanupError);

    const result = distribution.downloadRelease({
      version: '21.0.8',
      url: 'https://vendor.example/jdk.tar.gz',
      checksum: {algorithm: 'sha256', value: 'a'.repeat(64)}
    });

    await expect(result).rejects.toMatchObject({
      message: expect.stringContaining(
        'Failed to remove the downloaded archive after verification failure: cleanup failed'
      ),
      cause: expect.objectContaining({
        message: expect.stringContaining(
          'Checksum verification failed for Empty version 21.0.8'
        )
      })
    });
  });

  it('logs when authoritative checksum metadata is unavailable', async () => {
    const distribution = new EmptyJavaBase(options);

    await expect(
      distribution.downloadRelease({
        version: '21.0.8',
        url: 'https://vendor.example/jdk.tar.gz'
      })
    ).resolves.toBe(archivePath);

    expect(core.debug).toHaveBeenCalledWith(
      'No authoritative checksum is available for Empty version 21.0.8; skipping checksum verification.'
    );
  });

  it.each([undefined, '', '   '])(
    'skips verification when the vendor digest is %p',
    async value => {
      const distribution = new EmptyJavaBase(options);

      await expect(
        distribution.downloadRelease({
          version: '21.0.8',
          url: 'https://vendor.example/jdk.tar.gz',
          checksum: {
            algorithm: 'sha256',
            value
          } as JavaDownloadRelease['checksum']
        })
      ).resolves.toBe(archivePath);

      expect(core.debug).toHaveBeenCalledWith(
        'No authoritative checksum is available for Empty version 21.0.8; skipping checksum verification.'
      );
    }
  );
});

describe('fetchChecksum', () => {
  const options: JavaInstallerOptions = {
    version: '21',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function mockGet(statusCode: number, body: string) {
    return jest.spyOn(HttpClient.prototype, 'get').mockResolvedValue({
      message: {statusCode},
      readBody: async () => body
    } as any);
  }

  it('parses a bare hex digest', async () => {
    const digest = 'a'.repeat(64);
    const spy = mockGet(200, digest);
    const distribution = new EmptyJavaBase(options);

    const checksum = await distribution.fetchChecksumForTest(
      'https://vendor.example/jdk.tar.gz.sha256',
      'sha256'
    );

    expect(spy).toHaveBeenCalledWith(
      'https://vendor.example/jdk.tar.gz.sha256'
    );
    expect(checksum).toEqual({
      algorithm: 'sha256',
      value: digest,
      source: 'https://vendor.example/jdk.tar.gz.sha256'
    });
  });

  it('parses only the first token of a GNU-style checksum file', async () => {
    const digest = 'b'.repeat(128);
    mockGet(200, `${digest}  jbrsdk-21.0.3-linux-x64-b465.3.tar.gz\n`);
    const distribution = new EmptyJavaBase(options);

    const checksum = await distribution.fetchChecksumForTest(
      'https://vendor.example/jdk.tar.gz.checksum',
      'sha512'
    );

    expect(checksum).toEqual({
      algorithm: 'sha512',
      value: digest,
      source: 'https://vendor.example/jdk.tar.gz.checksum'
    });
  });

  it('trims surrounding whitespace and newlines', async () => {
    const digest = 'c'.repeat(64);
    mockGet(200, `\n  ${digest}  \n`);
    const distribution = new EmptyJavaBase(options);

    const checksum = await distribution.fetchChecksumForTest(
      'https://vendor.example/jdk.tar.gz.sha256',
      'sha256'
    );

    expect(checksum.value).toBe(digest);
  });

  it('skips verification when the sibling checksum is not published', async () => {
    mockGet(404, 'Not Found');
    const distribution = new EmptyJavaBase(options);

    await expect(
      distribution.fetchChecksumForTest(
        'https://vendor.example/jdk.tar.gz.sha256',
        'sha256'
      )
    ).resolves.toBeUndefined();
    expect(core.debug).toHaveBeenCalledWith(
      'No authoritative sha256 checksum is available for Empty from https://vendor.example/jdk.tar.gz.sha256; skipping checksum verification.'
    );
  });

  it('surfaces unexpected HTTP failures without query parameters', async () => {
    mockGet(500, 'Server Error');
    const distribution = new EmptyJavaBase(options);

    await expect(
      distribution.fetchChecksumForTest(
        'https://vendor.example/jdk.tar.gz.sha256?token=secret',
        'sha256'
      )
    ).rejects.toThrow(
      'Failed to fetch the authoritative sha256 checksum for Empty from https://vendor.example/jdk.tar.gz.sha256 (HTTP 500).'
    );
  });

  it('rejects an empty successful checksum response', async () => {
    mockGet(200, '  \n');
    const distribution = new EmptyJavaBase(options);

    await expect(
      distribution.fetchChecksumForTest(
        'https://vendor.example/jdk.tar.gz.sha256',
        'sha256'
      )
    ).rejects.toThrow(
      'Received an empty authoritative sha256 checksum for Empty from https://vendor.example/jdk.tar.gz.sha256.'
    );
  });

  describe('with a list of candidate algorithms', () => {
    it('infers sha512 when the digest is 128 hex characters', async () => {
      const digest = 'd'.repeat(128);
      mockGet(200, `${digest}  jbrsdk.tar.gz\n`);
      const distribution = new EmptyJavaBase(options);

      const checksum = await distribution.fetchChecksumForTest(
        'https://vendor.example/jbrsdk.tar.gz.checksum',
        ['sha512', 'sha256']
      );

      expect(checksum).toEqual({
        algorithm: 'sha512',
        value: digest,
        source: 'https://vendor.example/jbrsdk.tar.gz.checksum'
      });
    });

    it('infers sha256 when the digest is 64 hex characters, even though sha512 was preferred', async () => {
      // Reproduces older JetBrains JBR builds (e.g. JBR 11), which publish a
      // SHA-256 digest at the generic `.checksum` sibling instead of SHA-512.
      const digest = 'e'.repeat(64);
      mockGet(200, `${digest}  jbrsdk_nomod-11_0_16-osx-x64-b2043.64.tar.gz\n`);
      const distribution = new EmptyJavaBase(options);

      const checksum = await distribution.fetchChecksumForTest(
        'https://vendor.example/jbrsdk_nomod-11_0_16-osx-x64-b2043.64.tar.gz.checksum',
        ['sha512', 'sha256']
      );

      expect(checksum).toEqual({
        algorithm: 'sha256',
        value: digest,
        source:
          'https://vendor.example/jbrsdk_nomod-11_0_16-osx-x64-b2043.64.tar.gz.checksum'
      });
    });

    it('falls back to the first candidate algorithm when the digest length matches none of them', async () => {
      const digest = 'f'.repeat(40); // e.g. sha1, not supported
      mockGet(200, `${digest}  jbrsdk.tar.gz\n`);
      const distribution = new EmptyJavaBase(options);

      const checksum = await distribution.fetchChecksumForTest(
        'https://vendor.example/jbrsdk.tar.gz.checksum',
        ['sha512', 'sha256']
      );

      // No candidate algorithm matches, so the first-listed one is kept;
      // downstream verification will reject it as malformed.
      expect(checksum.algorithm).toBe('sha512');
      expect(checksum.value).toBe(digest);
    });

    it('reports the checksum as unavailable using a combined algorithm label on 404', async () => {
      mockGet(404, 'Not Found');
      const distribution = new EmptyJavaBase(options);

      await expect(
        distribution.fetchChecksumForTest(
          'https://vendor.example/jbrsdk.tar.gz.checksum',
          ['sha512', 'sha256']
        )
      ).resolves.toBeUndefined();
      expect(core.debug).toHaveBeenCalledWith(
        'No authoritative sha512 or sha256 checksum is available for Empty from https://vendor.example/jbrsdk.tar.gz.checksum; skipping checksum verification.'
      );
    });
  });
});

describe('normalizeVersion', () => {
  const DummyJavaBase = JavaBase as any;

  it.each([
    ['11', {version: '11', stable: true, latest: false}],
    ['11.0', {version: '11.0', stable: true, latest: false}],
    ['11.0.10', {version: '11.0.10', stable: true, latest: false}],
    ['11-ea', {version: '11', stable: false, latest: false}],
    ['11.0.2-ea', {version: '11.0.2', stable: false, latest: false}],
    ['18.0.1.1', {version: '18.0.1+1', stable: true, latest: false}],
    ['11.0.9.1', {version: '11.0.9+1', stable: true, latest: false}],
    ['12.0.2.1.0', {version: '12.0.2+1.0', stable: true, latest: false}],
    ['18.0.1.1-ea', {version: '18.0.1+1', stable: false, latest: false}],
    ['latest', {version: 'x', stable: true, latest: true}],
    ['LATEST', {version: 'x', stable: true, latest: true}],
    ['  Latest  ', {version: 'x', stable: true, latest: true}]
  ])('normalizeVersion from %s to %s', (input, expected) => {
    expect(DummyJavaBase.prototype.normalizeVersion.call(null, input)).toEqual(
      expected
    );
  });

  it('normalizeVersion should throw an error for non semver', () => {
    const version = '11g';
    expect(
      DummyJavaBase.prototype.normalizeVersion.bind(null, version)
    ).toThrow(
      `The string '${version}' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information`
    );
  });

  it.each(['latest-ea', 'latest.1', 'LATEST-EA', '  latest-ea  '])(
    'normalizeVersion should throw a targeted error for latest combined with a qualifier (%s)',
    version => {
      expect(
        DummyJavaBase.prototype.normalizeVersion.bind(null, version)
      ).toThrow(
        `The 'latest' alias resolves stable (GA) releases only and cannot be combined with '-ea' or other qualifiers (received '${version}'). Use 'latest' on its own, or specify a concrete version.`
      );
    }
  );
});

describe('createVersionNotFoundError', () => {
  it('should include all required fields in error message without available versions', () => {
    const mockJavaBase = new EmptyJavaBase({
      version: '17.0.5',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const error = (mockJavaBase as any).createVersionNotFoundError('17.0.5');

    expect(error.message).toContain(
      "No matching version found for SemVer '17.0.5'"
    );
    expect(error.message).toContain('Distribution: Empty');
    expect(error.message).toContain('Package type: jdk');
    expect(error.message).toContain('Architecture: x64');
  });

  it('should include available versions when provided', () => {
    const mockJavaBase = new EmptyJavaBase({
      version: '17.0.5',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = ['11.0.1', '11.0.2', '17.0.1', '17.0.2'];
    const error = (mockJavaBase as any).createVersionNotFoundError(
      '17.0.5',
      availableVersions
    );

    expect(error.message).toContain(
      "No matching version found for SemVer '17.0.5'"
    );
    expect(error.message).toContain('Distribution: Empty');
    expect(error.message).toContain('Package type: jdk');
    expect(error.message).toContain('Architecture: x64');
    expect(error.message).toContain(
      'Available versions: 11.0.1, 11.0.2, 17.0.1, 17.0.2'
    );
  });

  it('should truncate available versions when there are many', () => {
    const mockJavaBase = new EmptyJavaBase({
      version: '17.0.5',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    // Create 60 versions to test truncation
    const availableVersions = Array.from({length: 60}, (_, i) => `11.0.${i}`);
    const error = (mockJavaBase as any).createVersionNotFoundError(
      '17.0.5',
      availableVersions
    );

    expect(error.message).toContain('Available versions:');
    expect(error.message).toContain('...');
    expect(error.message).toContain('(showing first 50 of 60 versions');
  });

  it('should include additional context when provided', () => {
    const mockJavaBase = new EmptyJavaBase({
      version: '17.0.5',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = ['11.0.1', '11.0.2'];
    const additionalContext = 'Platform: linux';
    const error = (mockJavaBase as any).createVersionNotFoundError(
      '17.0.5',
      availableVersions,
      additionalContext
    );

    expect(error.message).toContain(
      "No matching version found for SemVer '17.0.5'"
    );
    expect(error.message).toContain('Distribution: Empty');
    expect(error.message).toContain('Package type: jdk');
    expect(error.message).toContain('Architecture: x64');
    expect(error.message).toContain('Platform: linux');
    expect(error.message).toContain('Available versions: 11.0.1, 11.0.2');
  });
});

describe('getToolcacheVersionName', () => {
  const DummyJavaBase = JavaBase as any;

  it.each([
    [{version: '11', stable: true}, '11'],
    [{version: '11.0.2', stable: true}, '11.0.2'],
    [{version: '11.0.2+4', stable: true}, '11.0.2-4'],
    [{version: '11.0.2+4.1.2563234', stable: true}, '11.0.2-4.1.2563234'],
    [{version: '11.0', stable: false}, '11.0-ea'],
    [{version: '11.0.3', stable: false}, '11.0.3-ea'],
    [{version: '11.0.3+4', stable: false}, '11.0.3-ea.4'],
    [{version: '11.0.3+4.2.256', stable: false}, '11.0.3-ea.4.2.256']
  ])('returns correct version name for %s', (input, expected) => {
    const inputVersion = input.stable ? '11' : '11-ea';
    const mockJavaBase = new EmptyJavaBase({
      version: inputVersion,
      packageType: 'jdk',
      architecture: 'x64',
      checkLatest: false
    });
    const actual = mockJavaBase['getToolcacheVersionName'](input.version);
    expect(actual).toBe(expected);
  });
});

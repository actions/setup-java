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

import path from 'path';
import * as semver from 'semver';

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

// Dynamic imports after mocking
const core = await import('@actions/core');
const tc = await import('@actions/tool-cache');
const util = await import('../../src/util.js');
const {LocalDistribution} =
  await import('../../src/distributions/local/installer.js');

describe('setupJava', () => {
  const actualJavaVersion = '11.1.10';
  const javaPath = path.join('Java_jdkfile_jdk', actualJavaVersion, 'x86');

  let mockJavaBase: InstanceType<typeof LocalDistribution>;

  let spyGetToolcachePath: any;
  let spyTcCacheDir: any;
  let spyTcFindAllVersions: any;
  let spyCoreDebug: any;
  let spyCoreInfo: any;
  let spyCoreExportVariable: any;
  let spyCoreAddPath: any;
  let spyCoreSetOutput: any;
  let spyFsStat: any;
  let spyFsReadDir: any;
  let spyUtilsExtractJdkFile: any;
  let spyPathResolve: any;
  let spyCoreError: any;
  const expectedJdkFile = 'JavaLocalJdkFile';

  beforeEach(() => {
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

        return semver.satisfies(actualJavaVersion, semverVersion)
          ? javaPath
          : '';
      }
    );

    spyTcCacheDir = tc.cacheDir as jest.Mock;
    spyTcCacheDir.mockImplementation(
      (
        archivePath: string,
        toolcacheFolderName: string,
        version: string,
        architecture: string
      ) => path.join(toolcacheFolderName, version, architecture)
    );

    spyTcFindAllVersions = tc.findAllVersions as jest.Mock;
    spyTcFindAllVersions.mockReturnValue([actualJavaVersion]);

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

    // Spy on fs methods
    spyFsReadDir = jest.spyOn(fs, 'readdirSync');
    spyFsReadDir.mockImplementation(() => ['JavaTest']);

    spyFsStat = jest.spyOn(fs, 'statSync');
    spyFsStat.mockImplementation((file: string) => {
      return {isFile: () => file === expectedJdkFile};
    });

    // Spy on util methods
    spyUtilsExtractJdkFile = util.extractJdkFile as jest.Mock;
    spyUtilsExtractJdkFile.mockImplementation(() => 'some/random/path/');

    // Spy on path methods
    spyPathResolve = jest.spyOn(path, 'resolve');
    spyPathResolve.mockImplementation((path: string) => path);

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('java is resolved from toolcache, jdkfile is untouched', async () => {
    const inputs = {
      version: actualJavaVersion,
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    };
    const jdkFile = 'not_existing_one';
    const expected = {
      version: actualJavaVersion,
      path: path.join('Java_jdkfile_jdk', inputs.version, inputs.architecture)
    };

    mockJavaBase = new LocalDistribution(inputs, jdkFile);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Java ${inputs.version} was not found in tool-cache. Trying to unpack JDK file...`
    );
  });

  it("java is resolved from toolcache, jdkfile doesn't exist", async () => {
    const inputs = {
      version: actualJavaVersion,
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    };
    const jdkFile = undefined;
    const expected = {
      version: actualJavaVersion,
      path: path.join('Java_jdkfile_jdk', inputs.version, inputs.architecture)
    };

    mockJavaBase = new LocalDistribution(inputs, jdkFile);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Java ${inputs.version} was not found in tool-cache. Trying to unpack JDK file...`
    );
  });

  it('java is unpacked from jdkfile', async () => {
    const inputs = {
      version: '11.0.289',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    };
    const jdkFile = expectedJdkFile;
    const expected = {
      version: '11.0.289',
      path: path.join('Java_jdkfile_jdk', inputs.version, inputs.architecture)
    };

    mockJavaBase = new LocalDistribution(inputs, jdkFile);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyTcFindAllVersions).toHaveBeenCalled();
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Extracting Java from '${jdkFile}'`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Java ${inputs.version} was not found in tool-cache. Trying to unpack JDK file...`
    );
  });

  it('jdk file is not found', async () => {
    const inputs = {
      version: '11.0.289',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    };
    const jdkFile = 'not_existing_one';
    const expected = {
      javaVersion: '11.0.289',
      javaPath: path.join(
        'Java_jdkfile_jdk',
        inputs.version,
        inputs.architecture
      )
    };

    mockJavaBase = new LocalDistribution(inputs, jdkFile);
    expected.javaPath = path.join(
      'Java_jdkfile_jdk',
      inputs.version,
      inputs.architecture
    );
    await expect(mockJavaBase.setupJava()).rejects.toThrow(
      "JDK file was not found in path 'not_existing_one'"
    );
    expect(spyTcFindAllVersions).toHaveBeenCalled();
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Extracting Java from '${jdkFile}'`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Java ${inputs.version} was not found in tool-cache. Trying to unpack JDK file...`
    );
  });

  it('java is resolved from toolcache including Contents/Home on macOS', async () => {
    const inputs = {
      version: actualJavaVersion,
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    };
    const jdkFile = 'not_existing_one';
    const expected = {
      version: actualJavaVersion,
      path: path.join(
        'Java_jdkfile_jdk',
        inputs.version,
        inputs.architecture,
        'Contents',
        'Home'
      )
    };
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });

    spyFsStat = jest.spyOn(fs, 'existsSync');
    spyFsStat.mockImplementation((file: string) => {
      return file.endsWith('Home');
    });

    mockJavaBase = new LocalDistribution(inputs, jdkFile);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Java ${inputs.version} was not found in tool-cache. Trying to unpack JDK file...`
    );

    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  it('java is unpacked from jdkfile including Contents/Home on macOS', async () => {
    const inputs = {
      version: '11.0.289',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    };
    const jdkFile = expectedJdkFile;
    const expected = {
      version: '11.0.289',
      path: path.join(
        'Java_jdkfile_jdk',
        inputs.version,
        inputs.architecture,
        'Contents',
        'Home'
      )
    };
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', {
      value: 'darwin'
    });
    spyFsStat = jest.spyOn(fs, 'existsSync');
    spyFsStat.mockImplementation((file: string) => {
      return file.endsWith('Home');
    });

    mockJavaBase = new LocalDistribution(inputs, jdkFile);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyTcFindAllVersions).toHaveBeenCalled();
    expect(spyCoreInfo).not.toHaveBeenCalledWith(
      `Resolved Java ${actualJavaVersion} from tool-cache`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Extracting Java from '${jdkFile}'`
    );
    expect(spyCoreInfo).toHaveBeenCalledWith(
      `Java ${inputs.version} was not found in tool-cache. Trying to unpack JDK file...`
    );
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  it.each([
    [
      {
        version: '8.0.289',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'otherJdkFile'
    ],
    [
      {
        version: '11.0.289',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'otherJdkFile'
    ],
    [
      {
        version: '12.0.289',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'otherJdkFile'
    ],
    [
      {
        version: '11.1.11',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'not_existing_one'
    ]
  ])(
    `Throw an error if jdkfile has wrong path, inputs %s, jdkfile %s, real name ${expectedJdkFile}`,
    async (inputs, jdkFile) => {
      mockJavaBase = new LocalDistribution(inputs, jdkFile);
      await expect(mockJavaBase.setupJava()).rejects.toThrow(
        /JDK file was not found in path */
      );
      expect(spyTcFindAllVersions).toHaveBeenCalled();
    }
  );

  it.each([
    [
      {
        version: '8.0.289',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      ''
    ],
    [
      {
        version: '7.0.289',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      undefined
    ],
    [
      {
        version: '11.0.289',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      undefined
    ]
  ])(
    'Throw an error if jdkfile is not specified, inputs %s',
    async (inputs, jdkFile) => {
      mockJavaBase = new LocalDistribution(inputs, jdkFile);
      await expect(mockJavaBase.setupJava()).rejects.toThrow(
        "'jdkFile' is not specified"
      );
      expect(spyTcFindAllVersions).toHaveBeenCalled();
    }
  );
});

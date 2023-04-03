import fs from 'fs';

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';

import path from 'path';
import * as semver from 'semver';
import * as util from '../../src/util';

import {LocalDistribution} from '../../src/distributions/local/installer';

describe('setupJava', () => {
  const actualJavaVersion = '11.1.10';
  const javaPath = path.join('Java_jdkfile_jdk', actualJavaVersion, 'x86');

  let mockJavaBase: LocalDistribution;

  let spyGetToolcachePath: jest.SpyInstance;
  let spyTcCacheDir: jest.SpyInstance;
  let spyTcFindAllVersions: jest.SpyInstance;
  let spyCoreDebug: jest.SpyInstance;
  let spyCoreInfo: jest.SpyInstance;
  let spyCoreExportVariable: jest.SpyInstance;
  let spyCoreAddPath: jest.SpyInstance;
  let spyCoreSetOutput: jest.SpyInstance;
  let spyFsStat: jest.SpyInstance;
  let spyFsReadDir: jest.SpyInstance;
  let spyUtilsExtractJdkFile: jest.SpyInstance;
  let spyPathResolve: jest.SpyInstance;
  const expectedJdkFile = 'JavaLocalJdkFile';

  beforeEach(() => {
    spyGetToolcachePath = jest.spyOn(util, 'getToolcachePath');
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

    spyTcCacheDir = jest.spyOn(tc, 'cacheDir');
    spyTcCacheDir.mockImplementation(
      (
        archivePath: string,
        toolcacheFolderName: string,
        version: string,
        architecture: string
      ) => path.join(toolcacheFolderName, version, architecture)
    );

    spyTcFindAllVersions = jest.spyOn(tc, 'findAllVersions');
    spyTcFindAllVersions.mockReturnValue([actualJavaVersion]);

    // Spy on core methods
    spyCoreDebug = jest.spyOn(core, 'debug');
    spyCoreDebug.mockImplementation(() => undefined);

    spyCoreInfo = jest.spyOn(core, 'info');
    spyCoreInfo.mockImplementation(() => undefined);

    spyCoreAddPath = jest.spyOn(core, 'addPath');
    spyCoreAddPath.mockImplementation(() => undefined);

    spyCoreExportVariable = jest.spyOn(core, 'exportVariable');
    spyCoreExportVariable.mockImplementation(() => undefined);

    spyCoreSetOutput = jest.spyOn(core, 'setOutput');
    spyCoreSetOutput.mockImplementation(() => undefined);

    // Spy on fs methods
    spyFsReadDir = jest.spyOn(fs, 'readdirSync');
    spyFsReadDir.mockImplementation(() => ['JavaTest']);

    spyFsStat = jest.spyOn(fs, 'statSync');
    spyFsStat.mockImplementation((file: string) => {
      return {isFile: () => file === expectedJdkFile};
    });

    // Spy on util methods
    spyUtilsExtractJdkFile = jest.spyOn(util, 'extractJdkFile');
    spyUtilsExtractJdkFile.mockImplementation(() => 'some/random/path/');

    // Spy on path methods
    spyPathResolve = jest.spyOn(path, 'resolve');
    spyPathResolve.mockImplementation((path: string) => path);
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

  it('java is resolved from toolcache including Contents/Home on MacOS', async () => {
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

  it('java is unpacked from jdkfile including Contents/Home on MacOS', async () => {
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

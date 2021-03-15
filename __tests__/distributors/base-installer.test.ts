import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as util from '../../src/util';

import path from 'path';
import * as semver from 'semver';

import { JavaBase } from '../../src/distributions/base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../../src/distributions/base-models';

class EmptyJavaBase extends JavaBase {
  constructor(installerOptions: JavaInstallerOptions) {
    super('Empty', installerOptions);
  }

  protected async downloadTool(javaRelease: JavaDownloadRelease): Promise<JavaInstallerResults> {
    return {
      version: '11.0.8',
      path: `/toolcache/${this.toolcacheFolderName}/11.0.8/${this.architecture}`
    };
  }

  protected async findPackageForDownload(range: string): Promise<JavaDownloadRelease> {
    const availableVersion = '11.0.8';
    if (!semver.satisfies(availableVersion, range)) {
      throw new Error('Available version not found');
    }

    return {
      version: availableVersion,
      url: `some/random_url/java/${availableVersion}`
    };
  }
}

describe('findInToolcache', () => {
  const actualJavaVersion = '11.1.10';
  const javaPath = path.join('Java_Empty_jdk', actualJavaVersion, 'x64');

  let mockJavaBase: EmptyJavaBase;
  let spyGetToolcachePath: jest.SpyInstance;
  let spyTcFindAllVersions: jest.SpyInstance;

  beforeEach(() => {
    spyGetToolcachePath = jest.spyOn(util, 'getToolcachePath');
    spyTcFindAllVersions = jest.spyOn(tc, 'findAllVersions');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      { version: '11', architecture: 'x64', packageType: 'jdk' },
      { version: actualJavaVersion, path: javaPath }
    ],
    [
      { version: '11.1', architecture: 'x64', packageType: 'jdk' },
      { version: actualJavaVersion, path: javaPath }
    ],
    [
      { version: '11.1.10', architecture: 'x64', packageType: 'jdk' },
      { version: actualJavaVersion, path: javaPath }
    ],
    [{ version: '11', architecture: 'x64', packageType: 'jre' }, null],
    [{ version: '8', architecture: 'x64', packageType: 'jdk' }, null],
    [{ version: '11', architecture: 'x86', packageType: 'jdk' }, null],
    [{ version: '11', architecture: 'x86', packageType: 'jre' }, null]
  ])(`should find java for path %s -> %s`, (input, expected) => {
    spyTcFindAllVersions.mockReturnValue([actualJavaVersion]);
    spyGetToolcachePath.mockImplementation(
      (toolname: string, javaVersion: string, architecture: string) => {
        const semverVersion = new semver.Range(javaVersion);

        if (path.basename(javaPath) !== architecture || !javaPath.includes(toolname)) {
          return '';
        }

        return semver.satisfies(actualJavaVersion, semverVersion) ? javaPath : '';
      }
    );
    mockJavaBase = new EmptyJavaBase(input);
    expect(mockJavaBase['findInToolcache']()).toEqual(expected);
  });

  it.each([
    ['11', '11.0.3'],
    ['11.0', '11.0.3'],
    ['11.0.1', '11.0.1'],
    ['11.0.3', '11.0.3'],
    ['15', '15.0.2'],
    ['x', '15.0.2'],
    ['x-ea', '17.4.4-ea'],
    ['11-ea', '11.3.2-ea'],
    ['11.2-ea', '11.2.1-ea'],
    ['11.2.1-ea', '11.2.1-ea']
  ])('should choose correct java from tool-cache for input %s', (input, expected) => {
    spyTcFindAllVersions.mockReturnValue([
      '17.4.4-ea',
      '11.0.2',
      '15.0.2',
      '11.0.3',
      '11.2.1-ea',
      '11.3.2-ea',
      '11.0.1'
    ]);
    spyGetToolcachePath.mockImplementation(
      (toolname: string, javaVersion: string, architecture: string) =>
        `/hostedtoolcache/${toolname}/${javaVersion}/${architecture}`
    );
    mockJavaBase = new EmptyJavaBase({ version: input, architecture: 'x64', packageType: 'jdk' });
    const foundVersion = mockJavaBase['findInToolcache']();
    expect(foundVersion?.version).toEqual(expected);
  });
});

describe('setupJava', () => {
  const actualJavaVersion = '11.1.10';
  const javaPath = path.join('Java_Empty_jdk', actualJavaVersion, 'x86');

  let mockJavaBase: EmptyJavaBase;

  let spyGetToolcachePath: jest.SpyInstance;
  let spyTcFindAllVersions: jest.SpyInstance;
  let spyCoreDebug: jest.SpyInstance;
  let spyCoreInfo: jest.SpyInstance;
  let spyCoreExportVariable: jest.SpyInstance;
  let spyCoreAddPath: jest.SpyInstance;
  let spyCoreSetOutput: jest.SpyInstance;

  beforeEach(() => {
    spyGetToolcachePath = jest.spyOn(util, 'getToolcachePath');
    spyGetToolcachePath.mockImplementation(
      (toolname: string, javaVersion: string, architecture: string) => {
        const semverVersion = new semver.Range(javaVersion);

        if (path.basename(javaPath) !== architecture || !javaPath.includes(toolname)) {
          return '';
        }

        return semver.satisfies(actualJavaVersion, semverVersion) ? javaPath : '';
      }
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
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      { version: '11', architecture: 'x86', packageType: 'jdk' },
      { version: actualJavaVersion, path: javaPath }
    ],
    [
      { version: '11.1', architecture: 'x86', packageType: 'jdk' },
      { version: actualJavaVersion, path: javaPath }
    ],
    [
      { version: '11.1.10', architecture: 'x86', packageType: 'jdk' },
      { version: actualJavaVersion, path: javaPath }
    ]
  ])('should find java locally for %s', (input, expected) => {
    mockJavaBase = new EmptyJavaBase(input);
    expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
  });

  it.each([
    [
      { version: '11', architecture: 'x86', packageType: 'jre' },
      { path: `/toolcache/Java_Empty_jre/11.0.8/x86`, version: '11.0.8' }
    ],
    [
      { version: '11', architecture: 'x64', packageType: 'jdk' },
      { path: `/toolcache/Java_Empty_jdk/11.0.8/x64`, version: '11.0.8' }
    ],
    [
      { version: '11', architecture: 'x64', packageType: 'jre' },
      { path: `/toolcache/Java_Empty_jre/11.0.8/x64`, version: '11.0.8' }
    ]
  ])('download java with configuration %s', async (input, expected) => {
    mockJavaBase = new EmptyJavaBase(input);
    await expect(mockJavaBase.setupJava()).resolves.toEqual(expected);
    expect(spyGetToolcachePath).toHaveBeenCalled();
    expect(spyCoreAddPath).toHaveBeenCalled();
    expect(spyCoreExportVariable).toHaveBeenCalled();
    expect(spyCoreSetOutput).toHaveBeenCalled();
  });

  it.each([
    [{ version: '15', architecture: 'x86', packageType: 'jre' }],
    [{ version: '11.0.7', architecture: 'x64', packageType: 'jre' }]
  ])('should throw an error for Available version not found for %s', async input => {
    mockJavaBase = new EmptyJavaBase(input);
    await expect(mockJavaBase.setupJava()).rejects.toThrowError('Available version not found');
    expect(spyTcFindAllVersions).toHaveBeenCalled();
    expect(spyCoreAddPath).not.toHaveBeenCalled();
    expect(spyCoreExportVariable).not.toHaveBeenCalled();
    expect(spyCoreSetOutput).not.toHaveBeenCalled();
  });
});

describe('normalizeVersion', () => {
  const DummyJavaBase = JavaBase as any;

  it.each([
    ['11', { version: '11', stable: true }],
    ['11.0', { version: '11.0', stable: true }],
    ['11.0.10', { version: '11.0.10', stable: true }],
    ['11-ea', { version: '11', stable: false }],
    ['11.0.2-ea', { version: '11.0.2', stable: false }]
  ])('normalizeVersion from %s to %s', (input, expected) => {
    expect(DummyJavaBase.prototype.normalizeVersion.call(null, input)).toEqual(expected);
  });

  it('normalizeVersion should throw an error for non semver', () => {
    const version = '11g';
    expect(DummyJavaBase.prototype.normalizeVersion.bind(null, version)).toThrowError(
      `The string '${version}' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information`
    );
  });
});

import * as tc from '@actions/tool-cache';
import * as core from '@actions/core';
import * as util from '../../src/util';

import path from 'path';
import * as semver from 'semver';

import {JavaBase} from '../../src/distributions/base-installer';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../../src/distributions/base-models';

import os from 'os';

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
      throw new Error('Available version not found');
    }

    return {
      version: availableVersion,
      url: `some/random_url/java/${availableVersion}`
    };
  }
}

describe('findInToolcache', () => {
  const actualJavaVersion = '11.0.8';
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

    spyTcFindAllVersions = jest.spyOn(tc, 'findAllVersions');
    spyTcFindAllVersions.mockReturnValue([installedJavaVersion]);

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

    jest.spyOn(os, 'arch').mockReturnValue('x86');
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
  ])(
    'should throw an error for Available version not found for %s',
    async input => {
      mockJavaBase = new EmptyJavaBase(input);
      await expect(mockJavaBase.setupJava()).rejects.toThrow(
        'Available version not found'
      );
      expect(spyTcFindAllVersions).toHaveBeenCalled();
      expect(spyCoreAddPath).not.toHaveBeenCalled();
      expect(spyCoreExportVariable).not.toHaveBeenCalled();
      expect(spyCoreSetOutput).not.toHaveBeenCalled();
    }
  );
});

describe('normalizeVersion', () => {
  const DummyJavaBase = JavaBase as any;

  it.each([
    ['11', {version: '11', stable: true}],
    ['11.0', {version: '11.0', stable: true}],
    ['11.0.10', {version: '11.0.10', stable: true}],
    ['11-ea', {version: '11', stable: false}],
    ['11.0.2-ea', {version: '11.0.2', stable: false}]
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

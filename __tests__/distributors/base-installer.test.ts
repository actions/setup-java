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
});

describe('normalizeVersion', () => {
  const DummyJavaBase = JavaBase as any;

  it.each([
    ['11', {version: '11', stable: true}],
    ['11.0', {version: '11.0', stable: true}],
    ['11.0.10', {version: '11.0.10', stable: true}],
    ['11-ea', {version: '11', stable: false}],
    ['11.0.2-ea', {version: '11.0.2', stable: false}],
    ['18.0.1.1', {version: '18.0.1+1', stable: true}],
    ['11.0.9.1', {version: '11.0.9+1', stable: true}],
    ['12.0.2.1.0', {version: '12.0.2+1.0', stable: true}],
    ['18.0.1.1-ea', {version: '18.0.1+1', stable: false}]
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

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
import {mkdtempSync} from 'fs';
import {tmpdir} from 'os';
import {join} from 'path';
import * as fs from 'fs';
import * as os from 'os';

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

jest.unstable_mockModule('@actions/cache', () => ({
  restoreCache: jest.fn(),
  saveCache: jest.fn(),
  isFeatureAvailable: jest.fn(),
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ValidationError';
    }
  },
  ReserveCacheError: class ReserveCacheError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ReserveCacheError';
    }
  }
}));

jest.unstable_mockModule('@actions/glob', () => ({
  hashFiles: jest.fn(),
  create: jest.fn()
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const cache = await import('@actions/cache');
const glob = await import('@actions/glob');
const {restore, save} = await import('../src/cache.js');

describe('dependency cache', () => {
  const ORIGINAL_RUNNER_OS = process.env['RUNNER_OS'];
  const ORIGINAL_GITHUB_WORKSPACE = process.env['GITHUB_WORKSPACE'];
  const ORIGINAL_CWD = process.cwd();
  let workspace: string;
  let spyInfo: any;
  let spyWarning: any;
  let spyDebug: any;
  let spySaveState: any;
  let spyCoreError: any;

  beforeEach(() => {
    workspace = mkdtempSync(join(tmpdir(), 'setup-java-cache-'));
    switch (os.platform()) {
      case 'darwin':
        process.env['RUNNER_OS'] = 'macOS';
        break;
      case 'win32':
        process.env['RUNNER_OS'] = 'Windows';
        break;
      case 'linux':
        process.env['RUNNER_OS'] = 'Linux';
        break;
      default:
        throw new Error(`unknown platform: ${os.platform()}`);
    }
    process.chdir(workspace);
    // This hack is necessary because @actions/glob ignores files not in the GITHUB_WORKSPACE
    // https://git.io/Jcxig
    process.env['GITHUB_WORKSPACE'] = projectRoot(workspace);
  });

  beforeEach(() => {
    spyInfo = core.info as jest.Mock;
    spyInfo.mockImplementation(() => null);

    spyWarning = core.warning as jest.Mock;
    spyWarning.mockImplementation(() => null);

    spyDebug = core.debug as jest.Mock;
    spyDebug.mockImplementation(() => null);

    spySaveState = core.saveState as jest.Mock;
    spySaveState.mockImplementation(() => null);

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    process.env['GITHUB_WORKSPACE'] = ORIGINAL_GITHUB_WORKSPACE;
    process.env['RUNNER_OS'] = ORIGINAL_RUNNER_OS;
    resetState();

    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('restore', () => {
    let spyCacheRestore: any;
    let spyGlobHashFiles: any;
    let spySetOutput: any;

    beforeEach(() => {
      spyCacheRestore = (cache.restoreCache as any).mockImplementation(
        (paths: string[], primaryKey: string) => Promise.resolve(undefined)
      );
      spyGlobHashFiles = glob.hashFiles as jest.Mock;
      spyGlobHashFiles.mockResolvedValue('hash-stub');
      spySetOutput = core.setOutput as jest.Mock;
      spySetOutput.mockImplementation(() => null);
      spyWarning.mockImplementation(() => null);
    });

    it('throws error if unsupported package manager specified', () => {
      return expect(restore('ant', '')).rejects.toThrow(
        'unknown package manager specified: ant'
      );
    });

    describe('for maven', () => {
      it('throws error if no pom.xml, maven-wrapper.properties, or extensions.xml found', async () => {
        spyGlobHashFiles.mockResolvedValue('');
        await expect(restore('maven', '')).rejects.toThrow(
          `No file in ${projectRoot(
            workspace
          )} matched to [**/pom.xml,**/.mvn/wrapper/maven-wrapper.properties,**/.mvn/extensions.xml], make sure you have checked out the target repository`
        );
      });
      it('downloads cache based on pom.xml', async () => {
        createFile(join(workspace, 'pom.xml'));

        await restore('maven', '');
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [
            join(os.homedir(), '.m2', 'repository'),
            join(os.homedir(), '.m2', 'wrapper', 'dists')
          ],
          expect.any(String)
        );
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/pom.xml\n**/.mvn/wrapper/maven-wrapper.properties\n**/.mvn/extensions.xml'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('maven cache is not found');
      });
      it('sets the cache-primary-key output', async () => {
        createFile(join(workspace, 'pom.xml'));

        await restore('maven', '');
        expect(spySetOutput).toHaveBeenCalledWith(
          'cache-primary-key',
          expect.stringContaining('setup-java-')
        );
      });
      it('downloads cache based on maven-wrapper.properties', async () => {
        createDirectory(join(workspace, '.mvn'));
        createDirectory(join(workspace, '.mvn', 'wrapper'));
        createFile(
          join(workspace, '.mvn', 'wrapper', 'maven-wrapper.properties')
        );

        await restore('maven', '');
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [
            join(os.homedir(), '.m2', 'repository'),
            join(os.homedir(), '.m2', 'wrapper', 'dists')
          ],
          expect.any(String)
        );
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/pom.xml\n**/.mvn/wrapper/maven-wrapper.properties\n**/.mvn/extensions.xml'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('maven cache is not found');
      });
      it('downloads cache based on extensions.xml', async () => {
        createDirectory(join(workspace, '.mvn'));
        createFile(join(workspace, '.mvn', 'extensions.xml'));

        await restore('maven', '');
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [
            join(os.homedir(), '.m2', 'repository'),
            join(os.homedir(), '.m2', 'wrapper', 'dists')
          ],
          expect.any(String)
        );
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/pom.xml\n**/.mvn/wrapper/maven-wrapper.properties\n**/.mvn/extensions.xml'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('maven cache is not found');
      });
    });
    describe('for gradle', () => {
      it('throws error if no build.gradle found', async () => {
        spyGlobHashFiles.mockResolvedValue('');
        await expect(restore('gradle', '')).rejects.toThrow(
          `No file in ${projectRoot(
            workspace
          )} matched to [**/*.gradle*,**/gradle-wrapper.properties,buildSrc/**/Versions.kt,buildSrc/**/Dependencies.kt,gradle/*.versions.toml,**/versions.properties], make sure you have checked out the target repository`
        );
      });
      it('downloads cache based on build.gradle', async () => {
        createFile(join(workspace, 'build.gradle'));

        await restore('gradle', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.gradle*\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
      it('downloads cache based on build.gradle.kts', async () => {
        createFile(join(workspace, 'build.gradle.kts'));

        await restore('gradle', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.gradle*\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
      it('downloads cache based on libs.versions.toml', async () => {
        createDirectory(join(workspace, 'gradle'));
        createFile(join(workspace, 'gradle', 'libs.versions.toml'));

        await restore('gradle', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.gradle*\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
      it('downloads cache based on buildSrc/Versions.kt', async () => {
        createDirectory(join(workspace, 'buildSrc'));
        createFile(join(workspace, 'buildSrc', 'Versions.kt'));

        await restore('gradle', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.gradle*\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
    });
    describe('for sbt', () => {
      it('throws error if no build.sbt found', async () => {
        spyGlobHashFiles.mockResolvedValue('');
        await expect(restore('sbt', '')).rejects.toThrow(
          `No file in ${projectRoot(
            workspace
          )} matched to [**/*.sbt,**/project/build.properties,**/project/**.scala,**/project/**.sbt], make sure you have checked out the target repository`
        );
      });
      it('downloads cache', async () => {
        createFile(join(workspace, 'build.sbt'));

        await restore('sbt', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.sbt\n**/project/build.properties\n**/project/**.scala\n**/project/**.sbt'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('sbt cache is not found');
      });
      it('detects scala and sbt changes under **/project/ folder', async () => {
        let callCount = 0;
        spyGlobHashFiles.mockImplementation(async () => {
          callCount++;
          // Return same hash for first two calls, different for third
          return callCount <= 2 ? 'hash-v1' : 'hash-v2';
        });

        createFile(join(workspace, 'build.sbt'));
        createDirectory(join(workspace, 'project'));
        createFile(join(workspace, 'project/DependenciesV1.scala'));

        await restore('sbt', '');
        const firstCall = spySaveState.mock.calls.toString();

        spySaveState.mockClear();
        await restore('sbt', '');
        const secondCall = spySaveState.mock.calls.toString();

        // Make sure multiple restores produce the same cache
        expect(firstCall).toBe(secondCall);

        spySaveState.mockClear();
        createFile(join(workspace, 'project/DependenciesV2.scala'));
        await restore('sbt', '');
        const thirdCall = spySaveState.mock.calls.toString();

        expect(firstCall).not.toBe(thirdCall);
      });
    });
    it('downloads cache based on versions.properties', async () => {
      createFile(join(workspace, 'versions.properties'));

      await restore('gradle', '');
      expect(spyCacheRestore).toHaveBeenCalled();
      expect(spyGlobHashFiles).toHaveBeenCalledWith(
        '**/*.gradle*\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
      );
      expect(spyWarning).not.toHaveBeenCalled();
      expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
    });
    describe('cache-dependency-path', () => {
      it('throws error if no matching dependency file found', async () => {
        spyGlobHashFiles.mockResolvedValue('');
        createFile(join(workspace, 'build.gradle.kts'));
        await expect(
          restore('gradle', 'sub-project/**/build.gradle.kts')
        ).rejects.toThrow(
          `No file in ${projectRoot(
            workspace
          )} matched to [sub-project/**/build.gradle.kts], make sure you have checked out the target repository`
        );
      });
      it('downloads cache based on the specified pattern', async () => {
        createFile(join(workspace, 'build.gradle.kts'));
        createDirectory(join(workspace, 'sub-project1'));
        createFile(join(workspace, 'sub-project1', 'build.gradle.kts'));
        createDirectory(join(workspace, 'sub-project2'));
        createFile(join(workspace, 'sub-project2', 'build.gradle.kts'));

        await restore('gradle', 'build.gradle.kts');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith('build.gradle.kts');
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');

        await restore('gradle', 'sub-project1/**/*.gradle*\n');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          'sub-project1/**/*.gradle*'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');

        await restore('gradle', '*.gradle*\nsub-project2/**/*.gradle*\n');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '*.gradle*\nsub-project2/**/*.gradle*'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
    });
  });
  describe('save', () => {
    let spyCacheSave: any;

    beforeEach(() => {
      spyCacheSave = (cache.saveCache as any).mockImplementation(
        (paths: string[], key: string) => Promise.resolve(0)
      );
      spyWarning.mockImplementation(() => null);
    });

    it('throws error if unsupported package manager specified', () => {
      return expect(save('ant')).rejects.toThrow(
        'unknown package manager specified: ant'
      );
    });

    it('save with -1 cacheId , should not fail workflow', async () => {
      spyCacheSave.mockImplementation(() => Promise.resolve(-1));
      createStateForMissingBuildFile();

      await save('maven');
      expect(spyCacheSave).toHaveBeenCalled();
      expect(spyWarning).not.toHaveBeenCalled();
      expect(spyInfo).not.toHaveBeenCalledWith(
        expect.stringMatching(/^Cache saved with the key:.*/)
      );
      expect(spyDebug).toHaveBeenCalledWith(
        expect.stringMatching(/^Cache was not saved for the key:.*/)
      );
    });

    it('saves with error from toolkit, should fail workflow', async () => {
      spyCacheSave.mockImplementation(() =>
        Promise.reject(new cache.ValidationError('Validation failed'))
      );
      createStateForMissingBuildFile();

      expect.assertions(1);
      await expect(save('maven')).rejects.toEqual(
        new cache.ValidationError('Validation failed')
      );
    });

    describe('for maven', () => {
      it('uploads cache even if no pom.xml found', async () => {
        createStateForMissingBuildFile();
        await save('maven');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
      });
      it('does not upload cache if no restore run before', async () => {
        createFile(join(workspace, 'pom.xml'));

        await save('maven');
        expect(spyCacheSave).not.toHaveBeenCalled();
        expect(spyWarning).toHaveBeenCalledWith(
          'Error retrieving key from state.'
        );
      });
      it('uploads cache', async () => {
        createFile(join(workspace, 'pom.xml'));
        createStateForSuccessfulRestore();

        await save('maven');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith(
          expect.stringMatching(/^Cache saved with the key:.*/)
        );
      });
    });
    describe('for gradle', () => {
      it('uploads cache even if no build.gradle found', async () => {
        createStateForMissingBuildFile();

        await save('gradle');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
      });
      it('does not upload cache if no restore run before', async () => {
        createFile(join(workspace, 'build.gradle'));

        await save('gradle');
        expect(spyCacheSave).not.toHaveBeenCalled();
        expect(spyWarning).toHaveBeenCalledWith(
          'Error retrieving key from state.'
        );
      });
      it('uploads cache based on build.gradle', async () => {
        createFile(join(workspace, 'build.gradle'));
        createStateForSuccessfulRestore();

        await save('gradle');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith(
          expect.stringMatching(/^Cache saved with the key:.*/)
        );
      });
      it('uploads cache based on build.gradle.kts', async () => {
        createFile(join(workspace, 'build.gradle.kts'));
        createStateForSuccessfulRestore();

        await save('gradle');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith(
          expect.stringMatching(/^Cache saved with the key:.*/)
        );
      });
      it('uploads cache based on buildSrc/Versions.kt', async () => {
        createDirectory(join(workspace, 'buildSrc'));
        createFile(join(workspace, 'buildSrc', 'Versions.kt'));
        createStateForSuccessfulRestore();

        await save('gradle');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith(
          expect.stringMatching(/^Cache saved with the key:.*/)
        );
      });
    });
    describe('for sbt', () => {
      it('uploads cache even if no build.sbt found', async () => {
        createStateForMissingBuildFile();
        await save('sbt');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
      });
      it('does not upload cache if no restore run before', async () => {
        createFile(join(workspace, 'build.sbt'));

        await save('sbt');
        expect(spyCacheSave).not.toHaveBeenCalled();
        expect(spyWarning).toHaveBeenCalledWith(
          'Error retrieving key from state.'
        );
      });
      it('uploads cache', async () => {
        createFile(join(workspace, 'build.sbt'));
        createStateForSuccessfulRestore();

        await save('sbt');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith(
          expect.stringMatching(/^Cache saved with the key:.*/)
        );
      });
      it('uploads cache based on versions.properties', async () => {
        createFile(join(workspace, 'versions.properties'));
        createStateForSuccessfulRestore();

        await save('gradle');
        expect(spyCacheSave).toHaveBeenCalled();
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith(
          expect.stringMatching(/^Cache saved with the key:.*/)
        );
      });
    });
  });
});

function resetState() {
  (core.getState as jest.Mock).mockReset();
}

/**
 * Create states to emulate a restore process without build file.
 */
function createStateForMissingBuildFile() {
  (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
    switch (name) {
      case 'cache-primary-key':
        return 'setup-java-cache-';
      default:
        return '';
    }
  });
}

/**
 * Create states to emulate a successful restore process.
 */
function createStateForSuccessfulRestore() {
  (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
    switch (name) {
      case 'cache-primary-key':
        return 'setup-java-cache-primary-key';
      case 'cache-matched-key':
        return 'setup-java-cache-matched-key';
      default:
        return '';
    }
  });
}

function createFile(path: string) {
  core.info(`created a file at ${path}`);
  fs.writeFileSync(path, '');
}

function createDirectory(path: string) {
  core.info(`created a directory at ${path}`);
  fs.mkdirSync(path);
}

function projectRoot(workspace: string): string {
  if (os.platform() === 'darwin') {
    return `/private${workspace}`;
  } else {
    return workspace;
  }
}

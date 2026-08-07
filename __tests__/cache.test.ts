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
import {createHash} from 'crypto';
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
const {restore, save, validatePackageManager} = await import('../src/cache.js');

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

  describe('validatePackageManager', () => {
    it('accepts supported package managers', () => {
      expect(() => validatePackageManager('maven')).not.toThrow();
      expect(() => validatePackageManager('gradle')).not.toThrow();
      expect(() => validatePackageManager('sbt')).not.toThrow();
    });

    it('throws the targeted error for unsupported package managers', () => {
      expect(() => validatePackageManager('ant')).toThrow(
        'unknown package manager specified: ant'
      );
    });
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
          [join(os.homedir(), '.m2', 'repository')],
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
          [join(os.homedir(), '.m2', 'repository')],
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
          [join(os.homedir(), '.m2', 'repository')],
          expect.any(String)
        );
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/pom.xml\n**/.mvn/wrapper/maven-wrapper.properties\n**/.mvn/extensions.xml'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('maven cache is not found');
      });
      it('restores the maven wrapper distribution cache independently of the main cache', async () => {
        createDirectory(join(workspace, '.mvn'));
        createDirectory(join(workspace, '.mvn', 'wrapper'));
        createFile(
          join(workspace, '.mvn', 'wrapper', 'maven-wrapper.properties')
        );

        await restore('maven', '', ['/custom/maven/repository']);
        // Main dependency cache no longer carries the wrapper dists path.
        expect(spyCacheRestore).toHaveBeenCalledWith(
          ['/custom/maven/repository'],
          expect.any(String)
        );
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [join(os.homedir(), '.m2', 'wrapper', 'dists')],
          expect.stringContaining('maven-wrapper')
        );
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/.mvn/wrapper/maven-wrapper.properties'
        );
        expect(spyInfo).toHaveBeenCalledWith(
          'maven-wrapper cache is not found'
        );
      });
      it('starts maven dependency and wrapper restores before either completes', async () => {
        createDirectory(join(workspace, '.mvn'));
        createDirectory(join(workspace, '.mvn', 'wrapper'));
        createFile(
          join(workspace, '.mvn', 'wrapper', 'maven-wrapper.properties')
        );
        const dependencyRestore = deferred<string | undefined>();
        const wrapperRestore = deferred<string | undefined>();
        const bothRestoresStarted = deferred<void>();
        let restoreCount = 0;
        spyCacheRestore.mockImplementation((paths: string[]) => {
          restoreCount++;
          if (restoreCount === 2) {
            bothRestoresStarted.resolve();
          }
          return paths.includes(join(os.homedir(), '.m2', 'repository'))
            ? dependencyRestore.promise
            : wrapperRestore.promise;
        });

        const restorePromise = restore('maven', '');
        await bothRestoresStarted.promise;

        expect(spyCacheRestore).toHaveBeenCalledTimes(2);
        expect(spySaveState).toHaveBeenCalledWith(
          'cache-primary-key',
          expect.any(String)
        );
        expect(spySaveState).toHaveBeenCalledWith(
          'cache-primary-key-maven-wrapper',
          expect.any(String)
        );

        wrapperRestore.resolve('maven-wrapper-hit');
        dependencyRestore.resolve('maven-dependency-hit');
        await restorePromise;

        expect(spySaveState).toHaveBeenCalledWith(
          'cache-matched-key-maven-wrapper',
          'maven-wrapper-hit'
        );
        expect(spySaveState).toHaveBeenCalledWith(
          'cache-matched-key',
          'maven-dependency-hit'
        );
        expect(spySetOutput).toHaveBeenCalledWith('cache-hit', false);
      });
      it('propagates a wrapper restore failure after starting both restores', async () => {
        createDirectory(join(workspace, '.mvn'));
        createDirectory(join(workspace, '.mvn', 'wrapper'));
        createFile(
          join(workspace, '.mvn', 'wrapper', 'maven-wrapper.properties')
        );
        const dependencyRestore = deferred<string | undefined>();
        const wrapperRestore = deferred<string | undefined>();
        const bothRestoresStarted = deferred<void>();
        let restoreCount = 0;
        spyCacheRestore.mockImplementation((paths: string[]) => {
          restoreCount++;
          if (restoreCount === 2) {
            bothRestoresStarted.resolve();
          }
          return paths.includes(join(os.homedir(), '.m2', 'repository'))
            ? dependencyRestore.promise
            : wrapperRestore.promise;
        });

        const restorePromise = restore('maven', '');
        await bothRestoresStarted.promise;
        wrapperRestore.reject(new Error('wrapper restore failed'));
        dependencyRestore.resolve(undefined);

        await expect(restorePromise).rejects.toThrow('wrapper restore failed');
      });
      it('skips the maven wrapper cache when no wrapper properties exist', async () => {
        createFile(join(workspace, 'pom.xml'));
        spyGlobHashFiles.mockImplementation((pattern: string) =>
          Promise.resolve(
            pattern === '**/.mvn/wrapper/maven-wrapper.properties'
              ? ''
              : 'hash-stub'
          )
        );

        await restore('maven', '');
        // Only the main dependency cache is restored; the wrapper cache path is
        // never touched because the project does not use mvnw.
        expect(spyCacheRestore).toHaveBeenCalledTimes(1);
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [join(os.homedir(), '.m2', 'repository')],
          expect.any(String)
        );
        expect(spyWarning).not.toHaveBeenCalled();
      });
    });
    describe('for gradle', () => {
      it('throws error if no build.gradle found', async () => {
        spyGlobHashFiles.mockResolvedValue('');
        await expect(restore('gradle', '')).rejects.toThrow(
          `No file in ${projectRoot(
            workspace
          )} matched to [**/*.gradle*,**/gradle.properties,**/gradle-wrapper.properties,buildSrc/**/Versions.kt,buildSrc/**/Dependencies.kt,gradle/*.versions.toml,**/versions.properties], make sure you have checked out the target repository`
        );
      });
      it('downloads cache based on build.gradle', async () => {
        createFile(join(workspace, 'build.gradle'));

        await restore('gradle', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.gradle*\n**/gradle.properties\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
      it('downloads cache based on build.gradle.kts', async () => {
        createFile(join(workspace, 'build.gradle.kts'));

        await restore('gradle', '');
        expect(spyCacheRestore).toHaveBeenCalled();
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/*.gradle*\n**/gradle.properties\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
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
          '**/*.gradle*\n**/gradle.properties\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
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
          '**/*.gradle*\n**/gradle.properties\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
        );
        expect(spyWarning).not.toHaveBeenCalled();
        expect(spyInfo).toHaveBeenCalledWith('gradle cache is not found');
      });
      it('changes the cache key when gradle.properties changes', async () => {
        const buildFile = join(workspace, 'build.gradle');
        const propertiesFile = join(workspace, 'gradle.properties');
        createFile(buildFile);
        createFile(propertiesFile, 'dependencyVersion=1.0.0');
        spyGlobHashFiles.mockImplementation(async (pattern: string) => {
          if (pattern === '**/gradle-wrapper.properties') {
            return '';
          }

          const files = [buildFile];
          if (pattern.split('\n').includes('**/gradle.properties')) {
            files.push(propertiesFile);
          }
          const hash = createHash('sha256');
          files.forEach(file => hash.update(fs.readFileSync(file)));
          return hash.digest('hex');
        });

        await restore('gradle', '');
        const firstKey = spyCacheRestore.mock.calls[0][1];

        fs.writeFileSync(propertiesFile, 'dependencyVersion=2.0.0');
        await restore('gradle', '');
        const secondKey = spyCacheRestore.mock.calls[1][1];

        expect(secondKey).not.toBe(firstKey);
      });
      it('restores the gradle wrapper distribution cache independently of the main cache', async () => {
        createFile(join(workspace, 'build.gradle'));

        await restore('gradle', '', ['/custom/gradle/caches']);
        // Main dependency cache no longer carries the wrapper path.
        expect(spyCacheRestore).toHaveBeenCalledWith(
          ['/custom/gradle/caches'],
          expect.any(String)
        );
        // Wrapper distribution is restored on its own, keyed only on the
        // wrapper properties file.
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [join(os.homedir(), '.gradle', 'wrapper')],
          expect.stringContaining('setup-java-')
        );
        expect(spyGlobHashFiles).toHaveBeenCalledWith(
          '**/gradle-wrapper.properties'
        );
      });
      it('starts gradle dependency and wrapper restores before either completes', async () => {
        createFile(join(workspace, 'build.gradle'));
        createFile(join(workspace, 'gradle-wrapper.properties'));
        const dependencyRestore = deferred<string | undefined>();
        const wrapperRestore = deferred<string | undefined>();
        const bothRestoresStarted = deferred<void>();
        let restoreCount = 0;
        spyCacheRestore.mockImplementation((paths: string[]) => {
          restoreCount++;
          if (restoreCount === 2) {
            bothRestoresStarted.resolve();
          }
          return paths.includes(join(os.homedir(), '.gradle', 'caches'))
            ? dependencyRestore.promise
            : wrapperRestore.promise;
        });

        const restorePromise = restore('gradle', '');
        await bothRestoresStarted.promise;

        expect(spyCacheRestore).toHaveBeenCalledTimes(2);
        expect(spySaveState).toHaveBeenCalledWith(
          'cache-primary-key',
          expect.any(String)
        );
        expect(spySaveState).toHaveBeenCalledWith(
          'cache-primary-key-gradle-wrapper',
          expect.any(String)
        );

        dependencyRestore.resolve('gradle-dependency-hit');
        wrapperRestore.resolve('gradle-wrapper-hit');
        await restorePromise;

        expect(spySaveState).toHaveBeenCalledWith(
          'cache-matched-key',
          'gradle-dependency-hit'
        );
        expect(spySaveState).toHaveBeenCalledWith(
          'cache-matched-key-gradle-wrapper',
          'gradle-wrapper-hit'
        );
        expect(spySetOutput).toHaveBeenCalledWith('cache-hit', false);
      });
      it('skips the gradle wrapper cache when no wrapper properties exist', async () => {
        createFile(join(workspace, 'build.gradle'));
        spyGlobHashFiles.mockImplementation((pattern: string) =>
          Promise.resolve(
            pattern === '**/gradle-wrapper.properties' ? '' : 'hash-stub'
          )
        );

        await restore('gradle', '');
        // Only the main dependency cache is restored; the wrapper cache path is
        // never touched because the project does not use the gradle wrapper.
        expect(spyCacheRestore).toHaveBeenCalledTimes(1);
        expect(spyCacheRestore).toHaveBeenCalledWith(
          [join(os.homedir(), '.gradle', 'caches')],
          expect.any(String)
        );
        expect(spyWarning).not.toHaveBeenCalled();
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
        '**/*.gradle*\n**/gradle.properties\n**/gradle-wrapper.properties\nbuildSrc/**/Versions.kt\nbuildSrc/**/Dependencies.kt\ngradle/*.versions.toml\n**/versions.properties'
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
    describe('cache-path', () => {
      it.each([
        ['maven', ['/custom/maven/repository']],
        ['gradle', ['/custom/gradle/caches']],
        [
          'sbt',
          [
            '/custom/ivy/cache',
            '/custom/coursier/cache',
            '!/custom/ivy/cache/*.lock'
          ]
        ]
      ])(
        'restores and persists custom paths for %s',
        async (packageManager, cachePaths) => {
          await restore(packageManager, '', cachePaths);

          expect(spyCacheRestore).toHaveBeenCalledWith(
            cachePaths,
            expect.any(String)
          );
          expect(spySaveState).toHaveBeenCalledWith(
            'cache-paths',
            JSON.stringify(cachePaths)
          );
        }
      );
    });
  });
  describe('save', () => {
    let spyCacheSave: any;
    let spyGlobCreate: jest.Mock;

    beforeEach(() => {
      spyCacheSave = (cache.saveCache as any).mockImplementation(
        (paths: string[], key: string) => Promise.resolve(0)
      );
      spyGlobCreate = glob.create as jest.Mock;
      spyGlobCreate.mockResolvedValue({
        glob: jest.fn(() => Promise.resolve(['wrapper-path']))
      });
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

    it.each([
      ['maven', ['/custom/maven/repository']],
      ['gradle', ['/custom/gradle/caches']],
      [
        'sbt',
        [
          '/custom/ivy/cache',
          '/custom/coursier/cache',
          '!/custom/ivy/cache/*.lock'
        ]
      ]
    ])(
      'saves the persisted custom paths for %s',
      async (packageManager, cachePaths) => {
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-paths':
              return JSON.stringify(cachePaths);
            default:
              return '';
          }
        });

        await save(packageManager);

        expect(spyCacheSave).toHaveBeenCalledWith(
          cachePaths,
          'setup-java-cache-primary-key'
        );
      }
    );

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
      it('saves the maven wrapper distribution cache under its own key', async () => {
        createFile(join(workspace, 'pom.xml'));
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-maven-wrapper':
              return 'setup-java-maven-wrapper-key';
            default:
              return '';
          }
        });

        await save('maven');
        expect(spyCacheSave).toHaveBeenCalledWith(
          ['wrapper-path'],
          'setup-java-maven-wrapper-key'
        );
        expect(spyWarning).not.toHaveBeenCalled();
      });
      it('does not save the maven wrapper cache on an exact wrapper hit', async () => {
        createFile(join(workspace, 'pom.xml'));
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-maven-wrapper':
            case 'cache-matched-key-maven-wrapper':
              return 'setup-java-maven-wrapper-key';
            default:
              return '';
          }
        });

        await save('maven');
        expect(spyCacheSave).not.toHaveBeenCalledWith(
          [join(os.homedir(), '.m2', 'wrapper', 'dists')],
          expect.any(String)
        );
      });
      it('does not fail the post step when the wrapper distribution path is missing', async () => {
        createFile(join(workspace, 'pom.xml'));
        createDirectory(join(workspace, '.mvn'));
        createDirectory(join(workspace, '.mvn', 'wrapper'));
        createFile(
          join(workspace, '.mvn', 'wrapper', 'maven-wrapper.properties')
        );
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-maven-wrapper':
              return 'setup-java-maven-wrapper-key';
            default:
              return '';
          }
        });
        spyGlobCreate.mockResolvedValue({
          glob: jest.fn(() => Promise.resolve([]))
        });

        await expect(save('maven')).resolves.toBeUndefined();
        expect(spyCacheSave).not.toHaveBeenCalledWith(
          [join(os.homedir(), '.m2', 'wrapper', 'dists')],
          expect.any(String)
        );
        expect(spyCacheSave).toHaveBeenCalledWith(
          [join(os.homedir(), '.m2', 'repository')],
          'setup-java-cache-primary-key'
        );
        expect(spyWarning).not.toHaveBeenCalled();
      });
      it('continues with primary cache save when additional cache save fails unexpectedly', async () => {
        createFile(join(workspace, 'pom.xml'));
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-maven-wrapper':
              return 'setup-java-maven-wrapper-key';
            default:
              return '';
          }
        });
        spyCacheSave.mockImplementation((paths: string[], key: string) => {
          if (paths[0] === 'wrapper-path') {
            return Promise.reject(new Error('wrapper save exploded'));
          }
          return Promise.resolve(0);
        });

        await expect(save('maven')).resolves.toBeUndefined();
        expect(spyWarning).toHaveBeenCalledWith(
          'Failed to save maven-wrapper cache: wrapper save exploded. Continuing with primary cache save.'
        );
        expect(spyCacheSave).toHaveBeenCalledWith(
          [join(os.homedir(), '.m2', 'repository')],
          'setup-java-cache-primary-key'
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
      it('saves the gradle wrapper distribution cache under its own key', async () => {
        createFile(join(workspace, 'build.gradle'));
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-gradle-wrapper':
              return 'setup-java-gradle-wrapper-key';
            default:
              return '';
          }
        });

        await save('gradle');
        expect(spyCacheSave).toHaveBeenCalledWith(
          ['wrapper-path'],
          'setup-java-gradle-wrapper-key'
        );
        expect(spyWarning).not.toHaveBeenCalled();
      });
      it('does not save the gradle wrapper cache on an exact wrapper hit', async () => {
        createFile(join(workspace, 'build.gradle'));
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-gradle-wrapper':
            case 'cache-matched-key-gradle-wrapper':
              return 'setup-java-gradle-wrapper-key';
            default:
              return '';
          }
        });

        await save('gradle');
        expect(spyCacheSave).not.toHaveBeenCalledWith(
          [join(os.homedir(), '.gradle', 'wrapper')],
          expect.any(String)
        );
      });
      it('does not fail the post step when the wrapper distribution path is missing', async () => {
        createFile(join(workspace, 'build.gradle'));
        createFile(join(workspace, 'gradle-wrapper.properties'));
        (core.getState as jest.Mock<any>).mockImplementation((name: any) => {
          switch (name) {
            case 'cache-primary-key':
              return 'setup-java-cache-primary-key';
            case 'cache-matched-key':
              return 'setup-java-cache-matched-key';
            case 'cache-primary-key-gradle-wrapper':
              return 'setup-java-gradle-wrapper-key';
            default:
              return '';
          }
        });
        spyGlobCreate.mockResolvedValue({
          glob: jest.fn(() => Promise.resolve([]))
        });

        await expect(save('gradle')).resolves.toBeUndefined();
        expect(spyCacheSave).not.toHaveBeenCalledWith(
          [join(os.homedir(), '.gradle', 'wrapper')],
          expect.any(String)
        );
        expect(spyCacheSave).toHaveBeenCalledWith(
          [join(os.homedir(), '.gradle', 'caches')],
          'setup-java-cache-primary-key'
        );
        expect(spyWarning).not.toHaveBeenCalled();
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

function createFile(path: string, contents = '') {
  core.info(`created a file at ${path}`);
  fs.writeFileSync(path, contents);
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return {promise, resolve, reject};
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

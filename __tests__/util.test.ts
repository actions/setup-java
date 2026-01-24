import * as cache from '@actions/cache';
import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import {
  convertVersionToSemver,
  getVersionFromFileContent,
  isVersionSatisfies,
  isCacheFeatureAvailable,
  isGhes
} from '../src/util';

jest.mock('@actions/cache');
jest.mock('@actions/core');

describe('isVersionSatisfies', () => {
  it.each([
    ['x', '11.0.0', true],
    ['3', '3.7.1', true],
    ['3', '3.7.2', true],
    ['3', '3.7.2+4', true],
    ['2.5', '2.5.0', true],
    ['2.5', '2.5.0+1', true],
    ['2.5', '2.6.1', false],
    ['2.5.1', '2.5.0', false],
    ['2.5.1+3', '2.5.0', false],
    ['2.5.1+3', '2.5.1+3', true],
    ['2.5.1+3', '2.5.1+2', false],
    ['15.0.0+14', '15.0.0+14.1.202003190635', false],
    ['15.0.0+14.1.202003190635', '15.0.0+14.1.202003190635', true]
  ])(
    '%s, %s -> %s',
    (inputRange: string, inputVersion: string, expected: boolean) => {
      const actual = isVersionSatisfies(inputRange, inputVersion);
      expect(actual).toBe(expected);
    }
  );
});

describe('isCacheFeatureAvailable', () => {
  it('isCacheFeatureAvailable disabled on GHES', () => {
    jest.spyOn(cache, 'isFeatureAvailable').mockImplementation(() => false);
    const infoMock = jest.spyOn(core, 'warning');
    const message =
      'Caching is only supported on GHES version >= 3.5. If you are on a version >= 3.5, please check with your GHES admin if the Actions cache service is enabled or not.';
    try {
      process.env['GITHUB_SERVER_URL'] = 'http://example.com';
      expect(isCacheFeatureAvailable()).toBeFalsy();
      expect(infoMock).toHaveBeenCalledWith(message);
    } finally {
      delete process.env['GITHUB_SERVER_URL'];
    }
  });

  it('isCacheFeatureAvailable disabled on dotcom', () => {
    jest.spyOn(cache, 'isFeatureAvailable').mockImplementation(() => false);
    const infoMock = jest.spyOn(core, 'warning');
    const message =
      'The runner was not able to contact the cache service. Caching will be skipped';
    try {
      process.env['GITHUB_SERVER_URL'] = 'http://github.com';
      expect(isCacheFeatureAvailable()).toBe(false);
      expect(infoMock).toHaveBeenCalledWith(message);
    } finally {
      delete process.env['GITHUB_SERVER_URL'];
    }
  });

  it('isCacheFeatureAvailable is enabled', () => {
    jest.spyOn(cache, 'isFeatureAvailable').mockImplementation(() => true);
    expect(isCacheFeatureAvailable()).toBe(true);
  });
});

describe('convertVersionToSemver', () => {
  it.each([
    ['12', '12'],
    ['12.0', '12.0'],
    ['12.0.2', '12.0.2'],
    ['12.0.2.1', '12.0.2+1'],
    ['12.0.2.1.0', '12.0.2+1.0']
  ])('%s -> %s', (input: string, expected: string) => {
    const actual = convertVersionToSemver(input);
    expect(actual).toBe(expected);
  });
});

describe('getVersionFromFileContent', () => {
  describe('.sdkmanrc', () => {
    it.each([
      ['java=11.0.20.1-tem', '11.0.20', 'temurin'],
      ['java = 11.0.20.1-tem', '11.0.20', 'temurin'],
      ['java=11.0.20.1-tem # a comment in sdkmanrc', '11.0.20', 'temurin'],
      ['java=11.0.20.1-tem\n#java=21.0.20.1-tem\n', '11.0.20', 'temurin'], // choose first match
      ['java=11.0.20.1-tem\njava=21.0.20.1-tem\n', '11.0.20', 'temurin'], // choose first match
      ['#java=11.0.20.1-tem\njava=21.0.20.1-tem\n', '21.0.20', 'temurin'], // first one is 'commented' in .sdkmanrc
      ['java=21.0.5-zulu', '21.0.5', 'zulu'],
      ['java=17.0.13-amzn', '17', 'corretto'],
      ['java=21.0.5-graal', '21.0.5', 'graalvm'],
      ['java=17.0.9-graalce', '17.0.9', 'graalvm'],
      ['java=11.0.25-librca', '11.0.25', 'liberica'],
      ['java=11.0.25-ms', '11.0.25', 'microsoft'],
      ['java=21.0.5-oracle', '21.0.5', 'oracle'],
      ['java=11.0.25-sapmchn', '11.0.25', 'sapmachine'],
      ['java=21.0.5-jbr', '21.0.5', 'jetbrains'],
      ['java=11.0.25-sem', '11.0.25', 'temurin'],
      ['java=17.0.13-dragonwell', '17.0.13', 'dragonwell']
    ])('parsing %s should return version %s and distribution %s', (content: string, expectedVersion: string, expectedDist: string) => {
      const actual = getVersionFromFileContent(content, 'openjdk', '.sdkmanrc');
      expect(actual?.version).toBe(expectedVersion);
      expect(actual?.distribution).toBe(expectedDist);
    });

    it('should warn and return undefined distribution for unknown identifier', () => {
      const warnSpy = jest.spyOn(require('@actions/core'), 'warning');
      const actual = getVersionFromFileContent('java=21.0.5-unknown', 'temurin', '.sdkmanrc');
      expect(actual?.version).toBe('21.0.5');
      expect(actual?.distribution).toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown SDKMAN distribution identifier'));
    });

    it('should return version without distribution when no suffix provided', () => {
      const actual = getVersionFromFileContent('java=11.0.20', 'temurin', '.sdkmanrc');
      expect(actual?.version).toBe('11.0.20');
      expect(actual?.distribution).toBeUndefined();
    });

    describe('known versions', () => {
      const csv = fs.readFileSync(
        path.join(__dirname, 'data/sdkman-java-versions.csv'),
        'utf8'
      );
      const versions = csv.split('\n').map(r => r.split(', '));

      it.each(versions)(
        'parsing %s should return %s',
        (sdkmanJavaVersion: string, expected: string) => {
          const asContent = `java=${sdkmanJavaVersion}`;
          const actual = getVersionFromFileContent(
            asContent,
            'openjdk',
            '.sdkmanrc'
          );
          expect(actual?.version).toBe(expected);
        }
      );
    });
  });
});

describe('isGhes', () => {
  const pristineEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {...pristineEnv};
  });

  afterAll(() => {
    process.env = pristineEnv;
  });

  it('returns false when the GITHUB_SERVER_URL environment variable is not defined', async () => {
    delete process.env['GITHUB_SERVER_URL'];
    expect(isGhes()).toBeFalsy();
  });

  it('returns false when the GITHUB_SERVER_URL environment variable is set to github.com', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://github.com';
    expect(isGhes()).toBeFalsy();
  });

  it('returns false when the GITHUB_SERVER_URL environment variable is set to a GitHub Enterprise Cloud-style URL', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://contoso.ghe.com';
    expect(isGhes()).toBeFalsy();
  });

  it('returns false when the GITHUB_SERVER_URL environment variable has a .localhost suffix', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://mock-github.localhost';
    expect(isGhes()).toBeFalsy();
  });

  it('returns true when the GITHUB_SERVER_URL environment variable is set to some other URL', async () => {
    process.env['GITHUB_SERVER_URL'] = 'https://src.onpremise.fabrikam.com';
    expect(isGhes()).toBeTruthy();
  });
});

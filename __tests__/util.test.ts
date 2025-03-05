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
      ['java=11.0.20.1-tem', '11.0.20'],
      ['java = 11.0.20.1-tem', '11.0.20'],
      ['java=11.0.20.1-tem # a comment in sdkmanrc', '11.0.20'],
      ['java=11.0.20.1-tem\n#java=21.0.20.1-tem\n', '11.0.20'], // choose first match
      ['java=11.0.20.1-tem\njava=21.0.20.1-tem\n', '11.0.20'], // choose first match
      ['#java=11.0.20.1-tem\njava=21.0.20.1-tem\n', '21.0.20'] // first one is 'commented' in .sdkmanrc
    ])('parsing %s should return %s', (content: string, expected: string) => {
      const actual = getVersionFromFileContent(content, 'openjdk', '.sdkmanrc');
      expect(actual).toBe(expected);
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
          expect(actual).toBe(expected);
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

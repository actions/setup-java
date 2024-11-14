import * as cache from '@actions/cache';
import * as core from '@actions/core';
import {
  convertVersionToSemver,
  isVersionSatisfies,
  isCacheFeatureAvailable
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

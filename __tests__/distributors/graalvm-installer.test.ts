import semver from 'semver';

describe('getAvailableVersions', () => {
  it('works', () => {
    const versions = [
      '1.2.3+22.0.0.2',
      '1.2.3+21.3.1',
      '1.2.3+20.3.5',
      '1.2.3+21.3.0',
      '1.2.3+20.3.4',
      '1.2.3+21.2.0',
      '1.2.3+20.3.3',
      '1.2.3+21.1.0',
      '1.2.3+20.3.2',
      '1.2.3+19.3.6',
      '1.2.3+21.0.0.2',
      '1.2.3+20.3.1.2',
      '1.2.3+21.0.0'
    ];
    expect(versions.sort((x, y) => semver.compareBuild(x, y))).toEqual([]);
  });
});

import {jest, describe, it, expect} from '@jest/globals';

jest.unstable_mockModule('../../src/distributions/zulu/installer.js', () => {
  throw new Error(
    'Zulu installer module must not be imported on the Temurin fast path'
  );
});

const {getJavaDistribution} =
  await import('../../src/distributions/distribution-factory.js');

describe('distribution factory lazy loading', () => {
  it('does not load non-selected distribution installers for Temurin', async () => {
    const distribution = await getJavaDistribution('temurin', {
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    expect(distribution).not.toBeNull();
  });
});

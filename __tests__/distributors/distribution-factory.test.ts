import {getJavaDistribution} from '../../src/distributions/distribution-factory.js';
import {RetryingHttpClient} from '../../src/retrying-http-client.js';

describe('getJavaDistribution', () => {
  it.each([
    'adopt',
    'adopt-hotspot',
    'adopt-openj9',
    'temurin',
    'zulu',
    'liberica',
    'liberica-nik',
    'microsoft',
    'semeru',
    'corretto',
    'oracle',
    'dragonwell',
    'sapmachine',
    'graalvm',
    'graalvm-community',
    'jetbrains',
    'kona',
    'oracle-openjdk'
  ])('uses the shared retrying HTTP client for %s', distributionName => {
    const distribution = getJavaDistribution(distributionName, {
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    expect(distribution).not.toBeNull();
    expect(distribution!['http']).toBeInstanceOf(RetryingHttpClient);
  });

  it("rejects java-package 'jdk+jmods' for non-Temurin distributions", () => {
    expect(() =>
      getJavaDistribution('zulu', {
        version: '25',
        architecture: 'x64',
        packageType: 'jdk+jmods',
        checkLatest: false
      })
    ).toThrow(
      "java-package 'jdk+jmods' is only supported for distribution 'temurin'."
    );
  });
});

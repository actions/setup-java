import {getJavaDistribution} from '../../src/distributions/distribution-factory.js';

describe('getJavaDistribution', () => {
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

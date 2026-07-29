import {getJavaDistribution} from '../../src/distributions/distribution-factory.js';
import {RetryingHttpClient} from '../../src/retrying-http-client.js';
import {
  JAVA_PACKAGE_CAPABILITIES,
  JavaDistribution
} from '../../src/distributions/package-types.js';
import os from 'os';
import {validateJavaPlatform} from '../../src/distributions/platform-types.js';
import {normalizeArchitecture} from '../../src/distributions/platform-types.js';

const supportedDistributionsOnCurrentPlatform = Object.values(
  JavaDistribution
).filter(distributionName => {
  try {
    validateJavaPlatform(distributionName, process.platform, 'x64', '25');
    return distributionName !== JavaDistribution.JdkFile;
  } catch {
    return false;
  }
});

const installerOptions = (packageType: string, version = '25') => ({
  version,
  architecture: 'x64',
  packageType,
  checkLatest: false
});

describe('getJavaDistribution', () => {
  it.each(supportedDistributionsOnCurrentPlatform)(
    'uses the shared retrying HTTP client for %s',
    distributionName => {
      const distribution = getJavaDistribution(distributionName, {
        version: '25',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });

      expect(distribution).not.toBeNull();
      expect(distribution!['http']).toBeInstanceOf(RetryingHttpClient);
    }
  );

  it.each(
    Object.entries(JAVA_PACKAGE_CAPABILITIES).flatMap(
      ([distributionName, packageTypes]) =>
        supportedDistributionsOnCurrentPlatform.includes(
          distributionName as JavaDistribution
        ) || distributionName === JavaDistribution.JdkFile
          ? packageTypes.map(packageType => [distributionName, packageType])
          : []
    )
  )('accepts %s with java-package %s', (distributionName, packageType) => {
    expect(
      getJavaDistribution(
        distributionName,
        installerOptions(packageType as string)
      )
    ).not.toBeNull();
  });

  it.each(Object.entries(JAVA_PACKAGE_CAPABILITIES))(
    'rejects unsupported java-package values for %s',
    (distributionName, packageTypes) => {
      expect(() =>
        getJavaDistribution(distributionName, installerOptions('jdk+typo'))
      ).toThrow(
        `Java package 'jdk+typo' is not supported for distribution '${distributionName}'. Supported package types: ${packageTypes.join(', ')}.`
      );
    }
  );

  it("rejects java-package 'jdk+jmods' for non-Temurin distributions", () => {
    expect(() =>
      getJavaDistribution('zulu', installerOptions('jdk+jmods'))
    ).toThrow(
      "Java package 'jdk+jmods' is not supported for distribution 'zulu'. Supported package types: jdk, jre, jdk+fx, jre+fx, jdk+crac, jre+crac."
    );
  });

  it.each(['8', '23.x', '23.0.1.1', '<24'])(
    "rejects Temurin java-package 'jdk+jmods' for version %s",
    version => {
      expect(() =>
        getJavaDistribution(
          JavaDistribution.Temurin,
          installerOptions('jdk+jmods', version)
        )
      ).toThrow(
        `Java package 'jdk+jmods' is not supported for distribution 'temurin'. Supported package types: jdk, jre, jdk+jmods. Package 'jdk+jmods' requires Java 24 or later; requested version '${version}'.`
      );
    }
  );

  it.each(['24', '24.0.1.1', '25-ea', '>=21', 'latest'])(
    "accepts Temurin java-package 'jdk+jmods' for version %s",
    version => {
      expect(
        getJavaDistribution(
          JavaDistribution.Temurin,
          installerOptions('jdk+jmods', version)
        )
      ).not.toBeNull();
    }
  );

  it('preserves unsupported distribution handling', () => {
    expect(
      getJavaDistribution(
        'not-a-distribution',
        installerOptions('not-a-package')
      )
    ).toBeNull();
  });

  it.each([
    ['amd64', 'x64'],
    ['ia32', 'x86'],
    ['arm64', 'aarch64']
  ])('passes normalized architecture %s as %s', (input, expected) => {
    const normalized = getJavaDistribution(JavaDistribution.JdkFile, {
      ...installerOptions('jdk'),
      architecture: input
    });

    expect(normalized!['architecture']).toBe(expected);
  });

  it('uses the runner architecture when the input is empty', () => {
    const distribution = getJavaDistribution(JavaDistribution.Temurin, {
      ...installerOptions('jdk'),
      architecture: ''
    });

    const expected = normalizeArchitecture(os.arch());
    expect(distribution!['architecture']).toBe(expected);
  });

  it('rejects an unsupported combination before creating an HTTP client', () => {
    expect(() =>
      getJavaDistribution(JavaDistribution.Oracle, {
        ...installerOptions('jdk'),
        architecture: 'x86'
      })
    ).toThrow(/does not support operating system/);
  });
});

import semver from 'semver';
import {convertVersionToSemver} from '../util.js';

export enum JavaDistribution {
  Temurin = 'temurin',
  Zulu = 'zulu',
  Liberica = 'liberica',
  LibericaNik = 'liberica-nik',
  JdkFile = 'jdkfile',
  Microsoft = 'microsoft',
  Semeru = 'semeru',
  Corretto = 'corretto',
  Oracle = 'oracle',
  Dragonwell = 'dragonwell',
  SapMachine = 'sapmachine',
  GraalVM = 'graalvm',
  GraalVMCommunity = 'graalvm-community',
  JetBrains = 'jetbrains',
  Kona = 'kona',
  OracleOpenJdk = 'oracle-openjdk',
  RedHat = 'redhat'
}

export const JAVA_PACKAGE_CAPABILITIES = {
  [JavaDistribution.Temurin]: ['jdk', 'jre', 'jdk+jmods'],
  [JavaDistribution.Zulu]: [
    'jdk',
    'jre',
    'jdk+fx',
    'jre+fx',
    'jdk+crac',
    'jre+crac'
  ],
  [JavaDistribution.Liberica]: ['jdk', 'jre', 'jdk+fx', 'jre+fx'],
  [JavaDistribution.LibericaNik]: ['jdk', 'jdk+fx'],
  [JavaDistribution.JdkFile]: ['jdk'],
  [JavaDistribution.Microsoft]: ['jdk'],
  [JavaDistribution.Semeru]: ['jdk', 'jre'],
  [JavaDistribution.Corretto]: ['jdk', 'jre'],
  [JavaDistribution.Oracle]: ['jdk'],
  [JavaDistribution.Dragonwell]: ['jdk'],
  [JavaDistribution.SapMachine]: ['jdk', 'jre'],
  [JavaDistribution.GraalVM]: ['jdk'],
  [JavaDistribution.GraalVMCommunity]: ['jdk'],
  [JavaDistribution.JetBrains]: [
    'jdk',
    'jre',
    'jdk+jcef',
    'jre+jcef',
    'jdk+ft',
    'jre+ft'
  ],
  [JavaDistribution.Kona]: ['jdk'],
  [JavaDistribution.OracleOpenJdk]: ['jdk'],
  [JavaDistribution.RedHat]: ['jdk', 'jre']
} as const satisfies Record<JavaDistribution, readonly string[]>;

export function validateJavaPackage(
  distributionName: string,
  packageType: string,
  version: string
): void {
  if (!isJavaDistribution(distributionName)) {
    return;
  }

  const supportedPackages: readonly string[] =
    JAVA_PACKAGE_CAPABILITIES[distributionName];
  if (!supportedPackages.includes(packageType)) {
    throw createUnsupportedPackageError(
      distributionName,
      packageType,
      supportedPackages
    );
  }

  if (
    distributionName === JavaDistribution.Temurin &&
    packageType === 'jdk+jmods' &&
    !canResolveTemurinJmods(version)
  ) {
    throw createUnsupportedPackageError(
      distributionName,
      packageType,
      supportedPackages,
      `Package 'jdk+jmods' requires Java 24 or later; requested version '${version}'.`
    );
  }
}

function isJavaDistribution(value: string): value is JavaDistribution {
  return Object.prototype.hasOwnProperty.call(JAVA_PACKAGE_CAPABILITIES, value);
}

function canResolveTemurinJmods(version: string): boolean {
  const normalizedVersion = version.trim().toLowerCase();
  if (normalizedVersion === 'latest') {
    return true;
  }

  let normalizedRange = normalizedVersion
    .replace(/-ea$/, '')
    .replace('-ea.', '+');
  if (/^\d+(\.\d+){3,}$/.test(normalizedRange)) {
    normalizedRange = convertVersionToSemver(normalizedRange);
  }
  if (!semver.validRange(normalizedRange)) {
    // JavaBase owns general version validation and its targeted error messages.
    return true;
  }

  return semver.intersects(normalizedRange, '>=24.0.0', {
    includePrerelease: true
  });
}

function createUnsupportedPackageError(
  distributionName: JavaDistribution,
  packageType: string,
  supportedPackages: readonly string[],
  detail?: string
): Error {
  const message = [
    `Java package '${packageType}' is not supported for distribution '${distributionName}'.`,
    `Supported package types: ${supportedPackages.join(', ')}.`
  ];
  if (detail) {
    message.push(detail);
  }
  return new Error(message.join(' '));
}

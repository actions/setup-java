import fs from 'fs';
import semver from 'semver';
import {JavaDistribution} from './package-types.js';

export type JavaPlatform = 'linux' | 'macos' | 'windows' | 'solaris';

export type JavaArchitecture =
  'x86' | 'x64' | 'armv7' | 'aarch64' | 'ppc64le' | 'ppc64' | 's390x';

interface VersionedArchitecture {
  architecture: JavaArchitecture;
  versionRange: string;
}

type ArchitectureCapability = JavaArchitecture | VersionedArchitecture;

interface RestrictedPlatformCapability {
  unrestricted?: false;
  platforms: Partial<Record<JavaPlatform, readonly ArchitectureCapability[]>>;
}

interface UnrestrictedPlatformCapability {
  unrestricted: true;
}

export type JavaPlatformCapability =
  RestrictedPlatformCapability | UnrestrictedPlatformCapability;

const X64_ARM64 = ['x64', 'aarch64'] as const;
const STANDARD_LINUX = ['x64', 'x86', 'aarch64', 'ppc64le', 's390x'] as const;

export const JAVA_PLATFORM_CAPABILITIES: Record<
  JavaDistribution,
  JavaPlatformCapability
> = {
  [JavaDistribution.Temurin]: {
    platforms: {
      linux: [...STANDARD_LINUX, {architecture: 'armv7', versionRange: '<18'}],
      macos: X64_ARM64,
      windows: ['x64', 'x86', 'aarch64']
    }
  },
  [JavaDistribution.Zulu]: {
    platforms: {
      linux: ['x64', 'x86', 'armv7', 'aarch64'],
      macos: X64_ARM64,
      windows: ['x64', 'x86', 'aarch64']
    }
  },
  [JavaDistribution.Liberica]: {
    platforms: {
      linux: ['x64', 'x86', 'armv7', 'aarch64', 'ppc64le'],
      macos: X64_ARM64,
      windows: ['x64', 'x86', 'aarch64'],
      solaris: ['x64']
    }
  },
  [JavaDistribution.LibericaNik]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: X64_ARM64
    }
  },
  [JavaDistribution.JdkFile]: {
    unrestricted: true
  },
  [JavaDistribution.Microsoft]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: X64_ARM64
    }
  },
  [JavaDistribution.Semeru]: {
    platforms: {
      linux: ['x64', 'x86', 'ppc64le', 'ppc64', 's390x', 'aarch64'],
      macos: X64_ARM64,
      windows: ['x64', 'aarch64']
    }
  },
  [JavaDistribution.Corretto]: {
    platforms: {
      linux: [
        'x64',
        {architecture: 'x86', versionRange: '<12'},
        {architecture: 'armv7', versionRange: '11'},
        'aarch64'
      ],
      macos: X64_ARM64,
      windows: ['x64', {architecture: 'x86', versionRange: '<12'}]
    }
  },
  [JavaDistribution.Oracle]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: ['x64']
    }
  },
  [JavaDistribution.Dragonwell]: {
    platforms: {
      linux: X64_ARM64,
      windows: ['x64']
    }
  },
  [JavaDistribution.SapMachine]: {
    platforms: {
      linux: ['x64', 'aarch64', 'ppc64le'],
      macos: X64_ARM64,
      windows: X64_ARM64
    }
  },
  [JavaDistribution.GraalVM]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: ['x64']
    }
  },
  [JavaDistribution.GraalVMCommunity]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: ['x64']
    }
  },
  [JavaDistribution.JetBrains]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: X64_ARM64
    }
  },
  [JavaDistribution.Kona]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: ['x64']
    }
  },
  [JavaDistribution.OracleOpenJdk]: {
    platforms: {
      linux: X64_ARM64,
      macos: X64_ARM64,
      windows: ['x64']
    }
  },
  [JavaDistribution.RedHat]: {
    platforms: {
      linux: [
        'x64',
        {architecture: 'aarch64', versionRange: '<12'},
        {architecture: 'ppc64le', versionRange: '<12'}
      ],
      windows: [
        {architecture: 'x64', versionRange: '<22'},
        {architecture: 'x86', versionRange: '<11'}
      ]
    }
  }
};

const ARCHITECTURE_ALIASES: Readonly<Record<string, JavaArchitecture>> = {
  amd64: 'x64',
  arm: 'armv7',
  ia32: 'x86',
  arm64: 'aarch64'
};
const CANONICAL_ARCHITECTURES: readonly JavaArchitecture[] = [
  'x86',
  'x64',
  'armv7',
  'aarch64',
  'ppc64le',
  'ppc64',
  's390x'
];

const PLATFORM_ALIASES: Readonly<
  Partial<Record<NodeJS.Platform, JavaPlatform>>
> = {
  darwin: 'macos',
  linux: 'linux',
  sunos: 'solaris',
  win32: 'windows'
};

export function normalizeArchitecture(architecture: string): string {
  const trimmedArchitecture = architecture.trim();
  const normalizedArchitecture = trimmedArchitecture.toLowerCase();
  return (
    ARCHITECTURE_ALIASES[normalizedArchitecture] ??
    (CANONICAL_ARCHITECTURES.includes(
      normalizedArchitecture as JavaArchitecture
    )
      ? normalizedArchitecture
      : trimmedArchitecture)
  );
}

export function normalizePlatform(
  platform: NodeJS.Platform
): JavaPlatform | undefined {
  return PLATFORM_ALIASES[platform];
}

export function isAlpineLinux(
  platform: NodeJS.Platform = process.platform,
  alpineReleaseExists?: boolean
): boolean {
  return (
    platform === 'linux' &&
    (alpineReleaseExists ?? fs.existsSync('/etc/alpine-release'))
  );
}

export function getJavaPlatformIdentity(
  platform: NodeJS.Platform = process.platform,
  alpineReleaseExists?: boolean
): string {
  if (platform === 'linux') {
    return isAlpineLinux(platform, alpineReleaseExists)
      ? 'linux-musl'
      : 'linux-glibc';
  }
  return normalizePlatform(platform) ?? platform;
}

export function validateJavaPlatform(
  distributionName: string,
  platform: NodeJS.Platform,
  architecture: string,
  version: string
): string {
  const normalizedArchitecture = normalizeArchitecture(architecture);
  if (!isJavaDistribution(distributionName)) {
    return normalizedArchitecture;
  }

  const capability = JAVA_PLATFORM_CAPABILITIES[distributionName];
  if ('unrestricted' in capability && capability.unrestricted === true) {
    return normalizedArchitecture;
  }

  const normalizedPlatform = normalizePlatform(platform);
  const architectures = normalizedPlatform
    ? capability.platforms[normalizedPlatform]
    : undefined;
  const supported = architectures?.some(item => {
    const architectureCapability =
      typeof item === 'string' ? {architecture: item} : item;
    return (
      architectureCapability.architecture === normalizedArchitecture &&
      (!('versionRange' in architectureCapability) ||
        isVersionCompatible(version, architectureCapability.versionRange))
    );
  });

  if (!supported) {
    throw new Error(
      `Distribution '${distributionName}' does not support operating system '${normalizedPlatform ?? platform}' with architecture '${normalizedArchitecture}' for Java version '${version}'. Supported combinations: ${formatSupportedCombinations(capability)}.`
    );
  }

  return normalizedArchitecture;
}

function isJavaDistribution(value: string): value is JavaDistribution {
  return Object.prototype.hasOwnProperty.call(
    JAVA_PLATFORM_CAPABILITIES,
    value
  );
}

function isVersionCompatible(version: string, supportedRange: string): boolean {
  let normalizedVersion = version.trim().toLowerCase();
  if (normalizedVersion === 'latest') {
    return true;
  }
  if (/^\d+(\.\d+){3,}$/.test(normalizedVersion)) {
    normalizedVersion = normalizeExtendedVersionToSemver(normalizedVersion);
  }

  const requestedRange = semver.validRange(
    normalizedVersion.replace(/-ea$/, '')
  );
  const capabilityRange = semver.validRange(supportedRange);
  if (!requestedRange || !capabilityRange) {
    return true;
  }

  function normalizeExtendedVersionToSemver(version: string): string {
    const versionParts = version.split('.');
    const mainVersion = versionParts.slice(0, 3).join('.');
    if (versionParts.length > 3) {
      return `${mainVersion}+${versionParts.slice(3).join('.')}`;
    }
    return version;
  }

  return semver.intersects(requestedRange, capabilityRange, {
    includePrerelease: true
  });
}

function formatSupportedCombinations(
  capability: RestrictedPlatformCapability
): string {
  return Object.entries(capability.platforms)
    .map(([platform, architectures]) => {
      const values = architectures.map(item =>
        typeof item === 'string'
          ? item
          : `${item.architecture} (${item.versionRange})`
      );
      return `${platform} (${values.join(', ')})`;
    })
    .join('; ');
}

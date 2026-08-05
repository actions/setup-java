import fs from 'fs';
import path from 'path';
import {
  isAlpineLinux,
  JAVA_PLATFORM_CAPABILITIES,
  normalizeArchitecture,
  validateJavaPlatform
} from '../src/distributions/platform-types.js';
import {JavaDistribution} from '../src/distributions/package-types.js';

describe('Java platform capabilities', () => {
  it('declares a capability for every distribution', () => {
    expect(Object.keys(JAVA_PLATFORM_CAPABILITIES).sort()).toEqual(
      Object.values(JavaDistribution).sort()
    );
  });

  it.each([
    ['x64', 'x64'],
    ['amd64', 'x64'],
    ['x86', 'x86'],
    ['ia32', 'x86'],
    ['arm', 'armv7'],
    ['aarch64', 'aarch64'],
    ['arm64', 'aarch64'],
    ['ppc64le', 'ppc64le'],
    ['s390x', 's390x']
  ])('normalizes architecture %s to %s', (input, expected) => {
    expect(normalizeArchitecture(input)).toBe(expected);
  });

  it('uses the normalized architecture for validation', () => {
    expect(validateJavaPlatform('microsoft', 'linux', 'arm64', '25')).toBe(
      'aarch64'
    );
  });

  it('rejects OS-specific restrictions with a consistent diagnostic', () => {
    expect(() =>
      validateJavaPlatform('oracle', 'win32', 'arm64', '21')
    ).toThrow(
      "Distribution 'oracle' does not support operating system 'windows' with architecture 'aarch64' for Java version '21'. Supported combinations: linux (x64, aarch64); macos (x64, aarch64); windows (x64)."
    );
  });

  it('rejects version-dependent architecture restrictions', () => {
    expect(() =>
      validateJavaPlatform('corretto', 'linux', 'x86', '17')
    ).toThrow(/x86 \(<12\)/);
    expect(() =>
      validateJavaPlatform('corretto', 'linux', 'x86', '17.0.2.8.1')
    ).toThrow(/x86 \(<12\)/);
    expect(validateJavaPlatform('corretto', 'linux', 'x86', '11')).toBe('x86');
  });

  it.each(['corretto', 'kona'])(
    'rejects Windows aarch64 for %s',
    distributionName => {
      expect(() =>
        validateJavaPlatform(distributionName, 'win32', 'arm64', '21')
      ).toThrow(/does not support operating system 'windows'/);
    }
  );

  it('allows local archives on any platform and architecture', () => {
    expect(validateJavaPlatform('jdkfile', 'aix', 'mips64', '21')).toBe(
      'mips64'
    );
  });

  it('keeps the documented architecture contract aligned', () => {
    const repositoryRoot = process.cwd();
    const readRepositoryFile = (filePath: string) =>
      fs.readFileSync(path.join(repositoryRoot, filePath), 'utf8');

    for (const filePath of ['action.yml', 'README.md']) {
      const content = readRepositoryFile(filePath);
      for (const architecture of [
        'x86',
        'x64',
        'armv7',
        'aarch64',
        'ppc64le',
        'ppc64',
        's390x'
      ]) {
        expect(content).toContain(architecture);
      }
    }
  });

  it.each(Object.entries(JAVA_PLATFORM_CAPABILITIES))(
    'keeps the advanced compatibility table aligned for %s',
    (distributionName, capability) => {
      const advancedUsage = fs.readFileSync(
        path.join(process.cwd(), 'docs/advanced-usage.md'),
        'utf8'
      );
      const compatibilityTable = advancedUsage.slice(
        advancedUsage.indexOf('## Platform and architecture compatibility')
      );
      const compatibilityRow = compatibilityTable
        .split('\n')
        .find(
          line =>
            line.startsWith('|') && line.includes(`\`${distributionName}\``)
        );

      expect(compatibilityRow).toBeDefined();
      if (!('platforms' in capability)) {
        expect(compatibilityRow).toContain('Any');
        return;
      }

      const architectures = new Set(
        Object.values(capability.platforms)
          .flat()
          .map(item => (typeof item === 'string' ? item : item.architecture))
      );
      for (const architecture of architectures) {
        expect(compatibilityRow).toContain(`\`${architecture}\``);
      }
    }
  );
});

describe('isAlpineLinux', () => {
  // The platform check has to short-circuit before the filesystem probe, so a
  // stray /etc/alpine-release can never make a non-Linux runner look like musl.
  it.each([
    ['linux', true, true],
    ['linux', false, false],
    ['darwin', true, false],
    ['win32', true, false]
  ] as const)(
    'treats %s with Alpine release %s as Alpine: %s',
    (platform, alpineReleaseExists, expected) => {
      expect(isAlpineLinux(platform, alpineReleaseExists)).toBe(expected);
    }
  );
});

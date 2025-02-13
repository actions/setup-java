import {KonaDistribution} from '../../src/distributions/kona/installer';

import manifestData from '../data/kona.json';

function mockDistr(
  version: string,
  os: string,
  arch: string,
  packageType: string
): KonaDistribution {
  const distribution = new KonaDistribution({
    version: version,
    architecture: arch,
    packageType: packageType,
    checkLatest: false
  });

  distribution['getOs'] = () => os;
  distribution['fetchReleaseInfo'] = async () => manifestData;

  return distribution;
}

describe('Check getAvailableReleases', () => {
  it.each([
    ['8', 'linux', 'aarch64', 'linux-aarch64'],
    ['8.0.20', 'macos', 'x86_64', 'macosx-x86_64'],
    ['11', 'linux', 'x86_64', 'linux-x86_64'],
    ['11.0.25', 'macos', 'aarch64', 'macosx-aarch64'],
    ['17.0.13', 'windows', 'x86_64', 'windows-x86_64'],
    ['21.0.5', 'linux', 'x86_64', 'linux-x86_64']
  ])(
    'should get releases with the specified version "%s", OS "%s" and arch "%s"',
    async (
      version: string,
      os: string,
      arch: string,
      expectedPattern: string
    ) => {
      const distribution = mockDistr(version, os, arch, 'jdk');

      const releases = await distribution['getAvailableReleases']();
      expect(releases).not.toBeNull();
      expect(releases.length).toBe(4);
      releases.forEach(release =>
        expect(release.downloadUrl).toContain(expectedPattern)
      );
    }
  );
});

describe('Check findPackageForDownload', () => {
  it.each([
    [
      '8',
      'linux',
      'aarch64',
      'https://github.com/Tencent/TencentKona-8/releases/download/8.0.20-GA/TencentKona8.0.20.b1_jdk_linux-aarch64_8u432.tar.gz'
    ],
    [
      '8.0.20',
      'linux',
      'x86_64',
      'https://github.com/Tencent/TencentKona-8/releases/download/8.0.20-GA/TencentKona8.0.20.b1_jdk_linux-x86_64_8u432.tar.gz'
    ],
    [
      '8.0.20',
      'macos',
      'aarch64',
      'https://github.com/Tencent/TencentKona-8/releases/download/8.0.20-GA/TencentKona8.0.20.b1_jdk_macosx-aarch64_8u432_notarized.tar.gz'
    ],
    [
      '8.0.20',
      'macos',
      'x86_64',
      'https://github.com/Tencent/TencentKona-8/releases/download/8.0.20-GA/TencentKona8.0.20.b1_jdk_macosx-x86_64_8u432_notarized.tar.gz'
    ],
    [
      '8.0.20',
      'windows',
      'x86_64',
      'https://github.com/Tencent/TencentKona-8/releases/download/8.0.20-GA/TencentKona8.0.20.b1_jdk_windows-x86_64_8u432_signed.zip'
    ],

    [
      '11',
      'linux',
      'aarch64',
      'https://github.com/Tencent/TencentKona-11/releases/download/kona11.0.25/TencentKona-11.0.25.b1-jdk_linux-aarch64.tar.gz'
    ],
    [
      '11.0.25',
      'linux',
      'x86_64',
      'https://github.com/Tencent/TencentKona-11/releases/download/kona11.0.25/TencentKona-11.0.25.b1-jdk_linux-x86_64.tar.gz'
    ],
    [
      '11.0.25',
      'macos',
      'aarch64',
      'https://github.com/Tencent/TencentKona-11/releases/download/kona11.0.25/TencentKona-11.0.25.b1_jdk_macosx-aarch64_notarized.tar.gz'
    ],
    [
      '11.0.25',
      'macos',
      'x86_64',
      'https://github.com/Tencent/TencentKona-11/releases/download/kona11.0.25/TencentKona-11.0.25.b1_jdk_macosx-x86_64_notarized.tar.gz'
    ],
    [
      '11.0.25',
      'windows',
      'x86_64',
      'https://github.com/Tencent/TencentKona-11/releases/download/kona11.0.25/TencentKona-11.0.25.b1_jdk_windows-x86_64_signed.zip'
    ],

    [
      '17',
      'linux',
      'aarch64',
      'https://github.com/Tencent/TencentKona-17/releases/download/TencentKona-17.0.13/TencentKona-17.0.13.b1-jdk_linux-aarch64.tar.gz'
    ],
    [
      '17.0.13',
      'linux',
      'x86_64',
      'https://github.com/Tencent/TencentKona-17/releases/download/TencentKona-17.0.13/TencentKona-17.0.13.b1-jdk_linux-x86_64.tar.gz'
    ],
    [
      '17.0.13',
      'macos',
      'aarch64',
      'https://github.com/Tencent/TencentKona-17/releases/download/TencentKona-17.0.13/TencentKona-17.0.13.b1_jdk_macosx-aarch64_notarized.tar.gz'
    ],
    [
      '17.0.13',
      'macos',
      'x86_64',
      'https://github.com/Tencent/TencentKona-17/releases/download/TencentKona-17.0.13/TencentKona-17.0.13.b1_jdk_macosx-x86_64_notarized.tar.gz'
    ],
    [
      '17.0.13',
      'windows',
      'x86_64',
      'https://github.com/Tencent/TencentKona-17/releases/download/TencentKona-17.0.13/TencentKona-17.0.13.b1_jdk_windows-x86_64_signed.zip'
    ],

    [
      '21',
      'linux',
      'aarch64',
      'https://github.com/Tencent/TencentKona-21/releases/download/TencentKona-21.0.5/TencentKona-21.0.5.b1-jdk_linux-aarch64.tar.gz'
    ],
    [
      '21.0.5',
      'linux',
      'x86_64',
      'https://github.com/Tencent/TencentKona-21/releases/download/TencentKona-21.0.5/TencentKona-21.0.5.b1-jdk_linux-x86_64.tar.gz'
    ],
    [
      '21.0.5',
      'macos',
      'aarch64',
      'https://github.com/Tencent/TencentKona-21/releases/download/TencentKona-21.0.5/TencentKona-21.0.5.b1_jdk_macosx-aarch64_notarized.tar.gz'
    ],
    [
      '21.0.5',
      'macos',
      'x86_64',
      'https://github.com/Tencent/TencentKona-21/releases/download/TencentKona-21.0.5/TencentKona-21.0.5.b1_jdk_macosx-x86_64_notarized.tar.gz'
    ],
    [
      '21.0.5',
      'windows',
      'x86_64',
      'https://github.com/Tencent/TencentKona-21/releases/download/TencentKona-21.0.5/TencentKona-21.0.5.b1_jdk_windows-x86_64_signed.zip'
    ]
  ])(
    'should return the download URL with the specified version "%s", OS "%s" and arch "%s"',
    async (version: string, os: string, arch: string, expectedUrl: string) => {
      const distribution = mockDistr(version, os, arch, 'jdk');

      const availableRelease = await distribution['findPackageForDownload'](
        version
      );
      expect(availableRelease).not.toBeNull();
      expect(availableRelease.url).toBe(expectedUrl);
    }
  );
});

describe('No release is found', () => {
  it.each([
    ['8', 'linux', 'x86'],
    ['8.0.0', 'linux', 'x86_64'],
    ['11', 'linux', 'ppc64'],
    ['17', 'solaris', 'x86_64'],
    ['17', 'windows', 'aarch64'],
    ['22', 'macos', 'x86_64']
  ])(
    `should throw an error due to no release with the specified version "%s", os "%s" and arch "%s"`,
    async (version: string, os: string, arch: string) => {
      const distribution = mockDistr(version, os, arch, 'jdk');

      await expect(
        distribution['findPackageForDownload'](version)
      ).rejects.toThrow(
        `No Kona release for the specified version "${version}" on OS "${os}" and arch "${arch}".`
      );
    }
  );
});

describe('The package type must be jdk', () => {
  it('should throw an error due to the specified package type is not jdk', async () => {
    const version = '8.0.20';
    const os = 'linux';
    const arch = 'x86_64';
    const distribution = mockDistr(version, os, arch, 'jre');

    await expect(
      distribution['findPackageForDownload'](version)
    ).rejects.toThrow('Kona provides jdk only');
  });
});

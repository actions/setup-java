import { MicrosoftDistributions } from '../../src/distributions/microsoft/installer';
import { ArchitectureOptions } from '../../src/distributions/microsoft/models';

describe('getArchitectureOptions', () => {
  it.each([
    ['x64', { bitness: '64', arch: 'x86' }],
    ['aarch64', { bitness: '64', arch: 'arm' }]
  ] as [string, ArchitectureOptions][])('parse architecture %s -> %s', (input, expected) => {
    const distributions = new MicrosoftDistributions({
      architecture: input,
      checkLatest: false,
      packageType: '',
      version: ''
    });

    expect(distributions['getArchitectureOptions']()).toEqual(expected);
  });

  it.each(['armv6', 's390x'])('not support architecture %s', input => {
    const distributions = new MicrosoftDistributions({
      architecture: input,
      checkLatest: false,
      packageType: '',
      version: ''
    });

    expect(() => distributions['getArchitectureOptions']()).toThrow(
      /Architecture '\w+' is not supported\. Supported architectures: .*/
    );
  });
});

describe('findPackageForDownload', () => {
  let distribution: MicrosoftDistributions;

  beforeEach(() => {
    distribution = new MicrosoftDistributions({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
  });

  it.each([
    [
      '17.x',
      '17.0.1',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.1.12.1-{{OS_TYPE}}-x64.tar.gz'
    ],
    [
      '16.0.x',
      '16.0.2',
      'https://aka.ms/download-jdk/microsoft-jdk-16.0.2.7.1-{{OS_TYPE}}-x64.tar.gz'
    ],
    [
      '11.0.13',
      '11.0.13',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.13.8.1-{{OS_TYPE}}-x64.tar.gz'
    ]
  ])('version is %s -> %s', async (input, expectedVersion, expectedUrl) => {
    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expectedVersion);
    var os: string;
    switch (process.platform) {
      case 'darwin':
        os = 'macos';
        break;
      case 'win32':
        os = 'windows';
        break;
      default:
        os = process.platform.toString();
        break;
    }
    expect(result.url).toBe(expectedUrl.replace('{{OS_TYPE}}', os));
  });

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for semver */
    );
  });
});

describe('getPlatformOption', () => {
  const distributions = new MicrosoftDistributions({
    architecture: 'x64',
    version: '11',
    packageType: 'jdk',
    checkLatest: false
  });

  it.each([
    ['linux', 'linux'],
    ['darwin', 'macos'],
    ['win32', 'windows']
  ])('os version %s -> %s', (input, expected) => {
    const actual = distributions['getPlatformOption'](input as NodeJS.Platform);

    expect(actual).toEqual(expected);
  });

  it.each(['aix', 'android', 'freebsd', 'openbsd', 'netbsd', 'solaris', 'cygwin'])(
    'not support os version %s',
    input => {
      expect(() => distributions['getPlatformOption'](input as NodeJS.Platform)).toThrow(
        /Platform '\w+' is not supported\. Supported platforms: .+/
      );
    }
  );
});

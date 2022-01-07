import { MicrosoftDistributions } from '../../src/distributions/microsoft/installer';

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
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.1.12.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '16.0.x',
      '16.0.2',
      'https://aka.ms/download-jdk/microsoft-jdk-16.0.2.7.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.0.13',
      '11.0.13',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.13.8.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ]
  ])('version is %s -> %s', async (input, expectedVersion, expectedUrl) => {
    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expectedVersion);
    let os: string;
    let archive: string;
    switch (process.platform) {
      case 'darwin':
        os = 'macos';
        archive = 'tar.gz';
        break;
      case 'win32':
        os = 'windows';
        archive = 'zip';
        break;
      default:
        os = process.platform.toString();
        archive = 'tar.gz';
        break;
    }
    const url = expectedUrl.replace('{{OS_TYPE}}', os).replace('{{ARCHIVE_TYPE}}', archive);
    expect(result.url).toBe(url);
  });

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
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
    ['linux', 'tar.gz', 'linux'],
    ['darwin', 'tar.gz', 'macos'],
    ['win32', 'zip', 'windows']
  ])('os version %s -> %s', (input, expectedArchive, expectedOs) => {
    const actual = distributions['getPlatformOption'](input as NodeJS.Platform);

    expect(actual.archive).toEqual(expectedArchive);
    expect(actual.os).toEqual(expectedOs);
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

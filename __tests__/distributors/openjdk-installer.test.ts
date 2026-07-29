import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import {HttpClient} from '@actions/http-client';

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getMultilineInput: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  setSecret: jest.fn(),
  isDebug: jest.fn(() => false),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  group: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  toPlatformPath: jest.fn((value: string) => value),
  toWin32Path: jest.fn((value: string) => value),
  toPosixPath: jest.fn((value: string) => value)
}));

const {OpenJdkDistribution} =
  await import('../../src/distributions/openjdk/installer.js');
const {getJavaDistribution} =
  await import('../../src/distributions/distribution-factory.js');

const homePage = `
  <a href="/26/">JDK 26</a>
  <a href="/27/">JDK
  27</a>
`;
const currentPage = `
  <a href="https://download.java.net/java/GA/jdk26.0.2/hash/10/GPL/openjdk-26.0.2_linux-x64_bin.tar.gz">tar.gz</a>
  <a href="https://download.java.net/java/GA/jdk26.0.2/hash/10/GPL/openjdk-26.0.2_linux-aarch64_bin.tar.gz">tar.gz</a>
`;
const earlyAccessPage = `
  <a href="https://download.java.net/java/early_access/jdk27/32/GPL/openjdk-27-ea+32_linux-x64_bin.tar.gz">tar.gz</a>
`;
const archivePage = `
  <a href="https://download.java.net/java/GA/jdk26.0.1/hash/8/GPL/openjdk-26.0.1_linux-x64_bin.tar.gz">tar.gz</a>
  <a href="https://download.java.net/java/GA/jdk25/hash/36/GPL/openjdk-25_linux-x64_bin.tar.gz">tar.gz</a>
  <a href="https://download.java.net/java/GA/jdk18.0.1.1/hash/2/GPL/openjdk-18.0.1.1_linux-x64_bin.tar.gz">tar.gz</a>
  <th>9.0.4 (build 9.0.4+11)</th>
  <a href="https://download.java.net/java/GA/jdk9/9.0.4/binaries/openjdk-9.0.4_linux-x64_bin.tar.gz">tar.gz</a>
`;
const GA_CHECKSUM = 'c'.repeat(64);
const EA_CHECKSUM = 'd'.repeat(64);
const checksumPages: Record<string, string> = {
  'https://download.java.net/java/GA/jdk26.0.2/hash/10/GPL/openjdk-26.0.2_linux-x64_bin.tar.gz.sha256':
    GA_CHECKSUM,
  'https://download.java.net/java/early_access/jdk27/32/GPL/openjdk-27-ea+32_linux-x64_bin.tar.gz.sha256':
    EA_CHECKSUM
};

function createDistribution(
  version = '26',
  architecture = 'x64',
  packageType = 'jdk',
  useFixturePlatform = true
) {
  const distribution = new OpenJdkDistribution({
    version,
    architecture,
    packageType,
    checkLatest: false
  });
  if (useFixturePlatform) {
    distribution['getPlatform'] = jest.fn(() => 'linux');
  }
  return distribution;
}

describe('OpenJdkDistribution', () => {
  let getSpy: jest.SpiedFunction<HttpClient['get']>;

  beforeEach(() => {
    getSpy = jest
      .spyOn(HttpClient.prototype, 'get')
      .mockImplementation(async url => {
        const pages: Record<string, string> = {
          'https://jdk.java.net/': homePage,
          'https://jdk.java.net/26/': currentPage,
          'https://jdk.java.net/27/': earlyAccessPage,
          'https://jdk.java.net/archive/': archivePage
        };
        if (url in pages) {
          return {
            message: {statusCode: 200},
            readBody: async () => pages[url]
          } as Awaited<ReturnType<HttpClient['get']>>;
        }
        // Any other GET is a `${archiveUrl}.sha256` checksum sibling request.
        return {
          message: {statusCode: 200},
          readBody: async () => checksumPages[url] ?? 'e'.repeat(64)
        } as Awaited<ReturnType<HttpClient['get']>>;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves the newest matching GA release', async () => {
    const result = await createDistribution()['findPackageForDownload']('26');

    expect(result).toEqual({
      version: '26.0.2+10',
      url: 'https://download.java.net/java/GA/jdk26.0.2/hash/10/GPL/openjdk-26.0.2_linux-x64_bin.tar.gz',
      checksum: {
        algorithm: 'sha256',
        value: GA_CHECKSUM,
        source:
          'https://download.java.net/java/GA/jdk26.0.2/hash/10/GPL/openjdk-26.0.2_linux-x64_bin.tar.gz.sha256'
      }
    });
    expect(getSpy).toHaveBeenCalledWith(`${result.url}.sha256`);
  });

  it('resolves an archived GA release', async () => {
    const result =
      await createDistribution('26.0.1')['findPackageForDownload']('26.0.1');

    expect(result.version).toBe('26.0.1+8');
    expect(result.url).toContain('/openjdk-26.0.1_linux-x64_bin.tar.gz');
  });

  it('resolves an exact GA build', async () => {
    const result =
      await createDistribution('26.0.2+10')['findPackageForDownload'](
        '26.0.2+10'
      );

    expect(result.version).toBe('26.0.2+10');
  });

  it('resolves an exact build from a legacy archive heading', async () => {
    const result =
      await createDistribution('9.0.4+11')['findPackageForDownload'](
        '9.0.4+11'
      );

    expect(result.version).toBe('9.0.4+11');
    expect(result.url).toContain('/binaries/openjdk-9.0.4_linux-x64_bin');
  });

  it('resolves a four-field Java version', async () => {
    const result =
      await createDistribution('18.0.1.1')['findPackageForDownload'](
        '18.0.1+1'
      );

    expect(result.version).toBe('18.0.1+1');
    expect(result.url).toContain('/openjdk-18.0.1.1_linux-x64_bin.tar.gz');
  });

  it('resolves an early-access release without requesting the archive', async () => {
    const result =
      await createDistribution('27-ea')['findPackageForDownload']('27');

    expect(result).toEqual({
      version: '27.0.0+32',
      url: 'https://download.java.net/java/early_access/jdk27/32/GPL/openjdk-27-ea+32_linux-x64_bin.tar.gz',
      checksum: {
        algorithm: 'sha256',
        value: EA_CHECKSUM,
        source:
          'https://download.java.net/java/early_access/jdk27/32/GPL/openjdk-27-ea+32_linux-x64_bin.tar.gz.sha256'
      }
    });
    expect(getSpy).not.toHaveBeenCalledWith('https://jdk.java.net/archive/');
    expect(getSpy).toHaveBeenCalledWith(`${result.url}.sha256`);
  });

  it('reports available versions when no release matches', async () => {
    await expect(
      createDistribution()['findPackageForDownload']('24')
    ).rejects.toThrow(
      "No matching version found for SemVer '24'.\nDistribution: Oracle OpenJDK"
    );
  });

  it.each([
    ['jre', 'Oracle OpenJDK provides only the `jdk` package type'],
    ['jdk+fx', 'Oracle OpenJDK provides only the `jdk` package type']
  ])('rejects the %s package type', async (packageType, message) => {
    await expect(
      createDistribution('26', 'x64', packageType)['findPackageForDownload'](
        '26'
      )
    ).rejects.toThrow(message);
  });

  it('rejects unsupported architectures', async () => {
    await expect(
      createDistribution('26', 'x86')['findPackageForDownload']('26')
    ).rejects.toThrow('Unsupported architecture: x86');
  });

  it('maps supported platforms', () => {
    const distribution = createDistribution('26', 'x64', 'jdk', false);

    expect(distribution['getPlatform']('linux')).toBe('linux');
    expect(distribution['getPlatform']('darwin')).toBe('macos');
    expect(distribution['getPlatform']('win32')).toBe('windows');
    expect(() => distribution['getPlatform']('freebsd')).toThrow(
      "Platform 'freebsd' is not supported"
    );
  });

  it('parses legacy platform names and archive formats', () => {
    const distribution = createDistribution();
    const macRelease = distribution['parseReleases'](
      '<a href="https://download.java.net/java/GA/jdk16/hash/7/GPL/openjdk-16_osx-x64_bin.tar.gz">tar.gz</a>',
      'macos',
      'x64'
    );
    const windowsRelease = distribution['parseReleases'](
      '<a href="https://download.java.net/java/GA/jdk10/hash/13/openjdk-10.0.2_windows-x64_bin.tar.gz">tar.gz</a>',
      'windows',
      'x64'
    );

    expect(macRelease[0].version).toBe('16.0.0+7');
    expect(windowsRelease[0].version).toBe('10.0.2+13');
    expect(windowsRelease[0].url.endsWith('.tar.gz')).toBe(true);
  });

  it('is registered in the distribution factory', () => {
    const distribution = getJavaDistribution('oracle-openjdk', {
      version: '26',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    expect(distribution).toBeInstanceOf(OpenJdkDistribution);
  });
});

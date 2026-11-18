import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {HttpClient} from '@actions/http-client';
import {JavaBase} from '../src/distributions/base-installer.js';
import {
  classifyResolutionError,
  getDefaultVersions,
  getSupportedArchitectures,
  renderMarkdownReport,
  ResolutionReport,
  resolveLatestVersions,
  VersionResolution
} from '../src/reports/latest-versions.js';

function result(
  overrides: Partial<VersionResolution> &
    Pick<VersionResolution, 'distribution' | 'versionSpec'>
): VersionResolution {
  return {
    platform: 'linux',
    architecture: 'x64',
    status: 'resolved',
    ...overrides
  };
}

function report(
  platform: string,
  results: VersionResolution[]
): ResolutionReport {
  return {platform, generatedAt: '2026-11-18T06:30:00.000Z', results};
}

function tableRows(markdown: string, distribution: string): string[] {
  const section = markdown.split(`## \`${distribution}\``)[1].split('\n## ')[0];
  return section.split('\n').filter(line => /^\| (?!Platform|---)/.test(line));
}

describe('latest versions report', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('includes every major from Java 6 through GA, including non-LTS releases but not EA', async () => {
    jest.spyOn(HttpClient.prototype, 'getJson').mockResolvedValue({
      statusCode: 200,
      headers: {},
      result: {
        most_recent_feature_release: 27,
        most_recent_feature_version: 28,
        most_recent_lts: 25
      }
    });

    await expect(getDefaultVersions(new HttpClient())).resolves.toEqual([
      '6',
      '7',
      '8',
      '9',
      '10',
      '11',
      '12',
      '13',
      '14',
      '15',
      '16',
      '17',
      '18',
      '19',
      '20',
      '21',
      '22',
      '23',
      '24',
      '25',
      '26',
      '27',
      'latest'
    ]);
  });

  it('fails rather than publishing incomplete defaults when discovery fails', async () => {
    jest
      .spyOn(HttpClient.prototype, 'getJson')
      .mockRejectedValue(new Error('Java release metadata is unavailable'));

    await expect(getDefaultVersions(new HttpClient())).rejects.toThrow(
      'Java release metadata is unavailable'
    );
  });

  it.each([5, 27.5, Infinity])(
    'rejects invalid newest major %s',
    async major => {
      jest.spyOn(HttpClient.prototype, 'getJson').mockResolvedValue({
        statusCode: 200,
        headers: {},
        result: {most_recent_feature_release: major}
      });

      await expect(getDefaultVersions(new HttpClient())).rejects.toThrow(
        'Invalid newest Java feature release'
      );
    }
  );

  it('resolves Solaris metadata and combines its exact builds with every other platform', async () => {
    const getJson = jest
      .spyOn(HttpClient.prototype, 'getJson')
      .mockResolvedValue({
        statusCode: 200,
        headers: {},
        result: [
          {
            downloadUrl: 'https://example.com/solaris-jdk8-old.tar.gz',
            version: '8.0.452+9',
            featureVersion: 8,
            interimVersion: 0,
            updateVersion: 452,
            buildVersion: 9
          },
          {
            downloadUrl: 'https://example.com/solaris-jdk8.tar.gz',
            version: '8.0.462+10',
            featureVersion: 8,
            interimVersion: 0,
            updateVersion: 462,
            buildVersion: 10
          },
          {
            downloadUrl: 'https://example.com/solaris-jdk9.tar.gz',
            version: '9.0.4+11',
            featureVersion: 9,
            interimVersion: 0,
            updateVersion: 4,
            buildVersion: 11
          }
        ]
      });
    const install = jest
      .spyOn(JavaBase.prototype, 'setupJava')
      .mockRejectedValue(new Error('The report must not install a JDK'));
    const network = jest
      .spyOn(HttpClient.prototype, 'request')
      .mockRejectedValue(
        new Error('Only the mocked metadata request is permitted')
      );
    const hostPlatform = process.platform;
    const solaris = await resolveLatestVersions({
      distributions: ['liberica'],
      versions: ['8', '9', '11', 'latest'],
      platform: 'solaris'
    });

    expect(solaris.platform).toBe('solaris');
    expect(solaris.results).toEqual([
      result({
        distribution: 'liberica',
        platform: 'solaris',
        versionSpec: '8',
        version: '8.0.462+10'
      }),
      result({
        distribution: 'liberica',
        platform: 'solaris',
        versionSpec: '9',
        version: '9.0.4+11'
      }),
      expect.objectContaining({
        platform: 'solaris',
        versionSpec: '11',
        status: 'unavailable'
      }),
      result({
        distribution: 'liberica',
        platform: 'solaris',
        versionSpec: 'latest',
        version: '9.0.4+11'
      })
    ]);
    expect(getJson).toHaveBeenCalledTimes(1);
    const url = new URL(getJson.mock.calls[0][0]);
    expect(url.origin).toBe('https://api.bell-sw.com');
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      os: 'solaris',
      arch: 'x86',
      bitness: '64',
      'bundle-type': 'jdk',
      'installation-type': 'archive'
    });
    expect(install).not.toHaveBeenCalled();
    expect(network).not.toHaveBeenCalled();
    expect(process.platform).toBe(hostPlatform);

    const otherReports = ['linux', 'linux-musl', 'macos', 'windows'].map(
      (platform, index) =>
        report(
          platform,
          ['8', '9', '11', 'latest'].map(versionSpec =>
            result({
              distribution: 'liberica',
              platform,
              versionSpec,
              version: `${versionSpec === 'latest' ? '11' : versionSpec}.0.1+${index + 1}`
            })
          )
        )
    );
    const markdown = renderMarkdownReport([solaris, ...otherReports]);
    expect(tableRows(markdown, 'liberica')).toEqual([
      '| Linux x64 | `8.0.1+1` | `9.0.1+1` | `11.0.1+1` | `11.0.1+1` |',
      '| Alpine Linux x64 | `8.0.1+2` | `9.0.1+2` | `11.0.1+2` | `11.0.1+2` |',
      '| macOS x64 | `8.0.1+3` | `9.0.1+3` | `11.0.1+3` | `11.0.1+3` |',
      '| Windows x64 | `8.0.1+4` | `9.0.1+4` | `11.0.1+4` | `11.0.1+4` |',
      '| Solaris x64 | `8.0.462+10` | `9.0.4+11` | — | `9.0.4+11` |'
    ]);
    expect(markdown).not.toContain('Needs attention');
    expect(markdown).not.toContain('Not checked');
  });

  it('classifies missing releases separately from lookup failures', () => {
    const notFound = new Error("No matching version found for SemVer '8'.");
    notFound.name = 'VersionNotFoundError';

    expect(classifyResolutionError(notFound)).toBe('unavailable');
    expect(
      classifyResolutionError(
        new Error('Oracle JDK is only supported for JDK 17 and later')
      )
    ).toBe('unavailable');
    expect(
      classifyResolutionError(
        new Error(
          'No Kona release for the specified version "27" on OS "macos" and arch "aarch64".'
        )
      )
    ).toBe('unavailable');
    expect(classifyResolutionError(new Error('socket hang up'))).toBe('error');
  });

  it('resolves Alpine with the Linux architectures, including version-restricted ones', () => {
    expect(getSupportedArchitectures('redhat', 'linux-musl')).toEqual([
      'x64',
      'aarch64',
      'ppc64le'
    ]);
    expect(getSupportedArchitectures('dragonwell', 'macos')).toEqual([]);
  });

  it('lists the exact version for every platform, ordered by operating system and architecture', () => {
    const markdown = renderMarkdownReport([
      report('macos', [
        result({
          distribution: 'temurin',
          versionSpec: '21',
          platform: 'macos',
          architecture: 'aarch64',
          version: '21.0.13+100000002.0.LTS'
        })
      ]),
      report('linux', [
        result({
          distribution: 'temurin',
          versionSpec: '21',
          architecture: 's390x',
          version: '21.0.12+7'
        }),
        result({
          distribution: 'temurin',
          versionSpec: '21',
          version: '21.0.13+9'
        })
      ]),
      report('linux-musl', [
        result({
          distribution: 'temurin',
          versionSpec: '21',
          platform: 'linux-musl',
          version: '21.0.13+9'
        })
      ])
    ]);

    expect(tableRows(markdown, 'temurin')).toEqual([
      '| Linux x64 | `21.0.13+9` |',
      '| Linux s390x | `21.0.12+7` |',
      '| Alpine Linux x64 | `21.0.13+9` |',
      '| macOS aarch64 | `21.0.13+100000002.0.LTS` |'
    ]);
    expect(markdown).not.toContain('Needs attention');
    expect(markdown).toContain(
      'Not checked, because no runner reported these platforms: Windows (x64, x86, aarch64).'
    );
  });

  it('distinguishes unsupported, unpublished, and floating releases', () => {
    const markdown = renderMarkdownReport([
      report('linux', [
        result({
          distribution: 'redhat',
          versionSpec: '11',
          architecture: 'aarch64',
          version: '11.0.29'
        }),
        result({
          distribution: 'redhat',
          versionSpec: '25',
          architecture: 'aarch64',
          status: 'unsupported'
        }),
        result({
          distribution: 'oracle',
          versionSpec: '11',
          status: 'unavailable'
        }),
        result({
          distribution: 'oracle',
          versionSpec: '25',
          version: '25',
          floating: true,
          advertisedVersion: '25.0.5.1',
          publishedAt: '2026-10-27'
        })
      ])
    ]);

    expect(tableRows(markdown, 'redhat')).toEqual([
      '| Linux aarch64 | `11.0.29` | n/a |'
    ]);
    expect(tableRows(markdown, 'oracle')).toEqual([
      '| Linux x64 | — | `25.0.5.1` ¹ (published 2026-10-27) |'
    ]);
    expect(markdown).toContain('¹ Major-only requests download');
  });

  it('reports lookup errors and distributions that resolved nothing', () => {
    const markdown = renderMarkdownReport([
      report('linux', [
        result({
          distribution: 'oracle-openjdk',
          versionSpec: '25',
          status: 'unavailable'
        }),
        result({
          distribution: 'zulu',
          versionSpec: '25',
          status: 'error',
          message: 'socket hang up\nstack'
        })
      ])
    ]);

    expect(markdown).toContain('## `oracle-openjdk` ❗');
    expect(tableRows(markdown, 'zulu')).toEqual(['| Linux x64 | ❗ error |']);
    expect(markdown).toContain(
      '| `oracle-openjdk` | all | all | No release matched any requested version'
    );
    expect(markdown).toContain(
      '| `zulu` | `25` | Linux x64 | socket hang up |'
    );
  });
});

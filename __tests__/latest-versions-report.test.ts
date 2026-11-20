import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {HttpClient, HttpClientResponse} from '@actions/http-client';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {IncomingMessage} from 'http';
import {Socket} from 'net';
import {JavaBase} from '../src/distributions/base-installer.js';
import {
  currentResolver,
  loadMetadataResolver,
  type MetadataResolver
} from '../src/reports/resolver.js';
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
  return {
    source: {ref: 'main'},
    platform,
    generatedAt: '2026-11-18T06:30:00.000Z',
    results
  };
}

function tableRows(markdown: string, distribution: string): string[] {
  const section = markdown.split(`## \`${distribution}\``)[1].split('\n## ')[0];
  return section.split('\n').filter(line => /^\| (?!Platform|---)/.test(line));
}

describe('latest versions report', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
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
    ).toBe('unsupported');
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

  it('uses the selected revision without substituting main for unsupported version syntax', async () => {
    const mainFactory = jest.spyOn(currentResolver, 'getJavaDistribution');
    const lookup = jest.fn(async () => ({
      version: '21.0.8+9',
      url: 'https://example.com/jdk.tar.gz'
    }));
    const legacy: MetadataResolver = {
      source: {ref: 'v5', sha: 'a'.repeat(40), version: '5.6.0'},
      distributions: ['adopt'],
      getJavaDistribution: (_distribution, options) => {
        if (options.version === 'latest') {
          throw new Error("The string 'latest' is not valid SemVer notation");
        }
        return {
          version: options.version,
          http: new HttpClient(),
          findPackageForDownload: lookup
        };
      },
      createSolarisInstaller: () => {
        throw new Error('Unexpected Solaris lookup');
      }
    };
    const resolved = await resolveLatestVersions({
      resolver: legacy,
      distributions: legacy.distributions,
      versions: ['21', 'latest'],
      architectures: ['x64']
    });

    expect(resolved.source).toEqual(legacy.source);
    expect(resolved.results).toEqual([
      expect.objectContaining({
        distribution: 'adopt',
        versionSpec: '21',
        version: '21.0.8+9'
      }),
      expect.objectContaining({
        distribution: 'adopt',
        versionSpec: 'latest',
        status: 'unsupported'
      })
    ]);
    expect(lookup).toHaveBeenCalledTimes(1);
    expect(lookup).toHaveBeenCalledWith('21');
    expect(mainFactory).not.toHaveBeenCalled();
    expect(getSupportedArchitectures('adopt', 'linux', legacy)).toContain(
      's390x'
    );
    expect(getSupportedArchitectures('redhat', 'linux', legacy)).toEqual([]);
  });

  it('marks legacy mutable Oracle URLs as floating instead of reporting a major as exact', async () => {
    const response = new IncomingMessage(new Socket());
    response.headers['last-modified'] = 'Tue, 27 Oct 2026 00:00:00 GMT';
    jest
      .spyOn(HttpClient.prototype, 'head')
      .mockResolvedValue(new HttpClientResponse(response));
    jest.spyOn(HttpClient.prototype, 'getJson').mockResolvedValue({
      statusCode: 200,
      headers: {},
      result: {releaseVersion: '25.0.1', licenseDetails: {licenseType: 'NFTC'}}
    });
    const resolved = await resolveLatestVersions({
      resolver: {
        ...currentResolver,
        source: {ref: 'v5'},
        getJavaDistribution: () => ({
          version: '25',
          http: new HttpClient(),
          findPackageForDownload: async () => ({
            version: '25',
            url: 'https://download.oracle.com/java/25/latest/jdk-25_linux-x64_bin.tar.gz'
          })
        })
      },
      distributions: ['oracle'],
      versions: ['25'],
      architectures: ['x64']
    });

    expect(resolved.results[0]).toMatchObject({
      status: 'resolved',
      floating: true,
      advertisedVersion: '25.0.1',
      publishedAt: '2026-10-27'
    });
  });

  it('refuses to install if a revision crosses the metadata boundary', async () => {
    const download = jest.fn();
    const installer = {
      version: '21',
      http: new HttpClient(),
      downloadTool: download,
      async findPackageForDownload() {
        this.downloadTool();
        return {version: '21', url: 'https://example.com/jdk.tar.gz'};
      }
    };
    const resolved = await resolveLatestVersions({
      resolver: {...currentResolver, getJavaDistribution: () => installer},
      distributions: ['temurin'],
      versions: ['21'],
      architectures: ['x64']
    });
    expect(resolved.results[0]).toMatchObject({
      status: 'error',
      message: 'JDK download/install is forbidden in the versions report.'
    });
    expect(download).not.toHaveBeenCalled();
  });

  it('records stalled legacy endpoints as errors and does not retry them for every major', async () => {
    jest.useFakeTimers();
    const request = jest
      .spyOn(HttpClient.prototype, 'getJson')
      .mockImplementation(() => new Promise(() => {}));
    const dispose = jest.spyOn(HttpClient.prototype, 'dispose');
    const pending = resolveLatestVersions({
      resolver: {
        ...currentResolver,
        getJavaDistribution: (_distribution, options) => ({
          version: options.version,
          http: new HttpClient(),
          async findPackageForDownload() {
            await this.http.getJson('https://example.com/retired-api');
            throw new Error('Unreachable');
          }
        })
      },
      distributions: ['temurin'],
      versions: ['17', '21'],
      architectures: ['x64']
    });
    await jest.advanceTimersByTimeAsync(60_000);
    const resolved = await pending;
    expect(resolved.results).toEqual([
      expect.objectContaining({
        versionSpec: '17',
        status: 'error',
        message: expect.stringContaining('Metadata request timed out')
      }),
      expect.objectContaining({
        versionSpec: '21',
        status: 'error',
        message: expect.stringContaining('Metadata request timed out')
      })
    ]);
    expect(request).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps different revision results and failures separate, including missing runners', () => {
    const main = report('linux', [
      result({distribution: 'temurin', versionSpec: '21', version: '21.0.13+9'})
    ]);
    const v6 = {
      ...report('linux', [
        result({
          distribution: 'temurin',
          versionSpec: '21',
          version: '21.0.12+7'
        })
      ]),
      source: {ref: 'v6', sha: 'b'.repeat(40), version: '6.0.0'}
    };
    const v5 = {
      ...report('linux', [
        result({
          distribution: 'adopt',
          versionSpec: '21',
          status: 'unavailable'
        }),
        result({
          distribution: 'temurin',
          versionSpec: '21',
          status: 'error',
          message: 'metadata failed'
        })
      ]),
      source: {ref: 'v5', sha: 'a'.repeat(40), version: '5.6.0'},
      targets: {adopt: {linux: ['x64'], windows: ['x64']}}
    };
    const markdown = renderMarkdownReport([main, v6, v5]);
    const mainSection = markdown
      .split('<summary>setup-java@main</summary>')[1]
      .split('</details>')[0];
    const v6Section = markdown
      .split('<summary>setup-java@v6</summary>')[1]
      .split('</details>')[0];
    const v5Section = markdown
      .split('<summary>setup-java@v5</summary>')[1]
      .split('</details>')[0];
    expect(mainSection).toContain('`21.0.13+9`');
    expect(mainSection).not.toContain('Needs attention');
    expect(v6Section).toContain('`21.0.12+7`');
    expect(v6Section).not.toContain('`21.0.13+9`');
    expect(v5Section).toContain('metadata failed');
    expect(v5Section).toContain('## `adopt` ❗');
    expect(v5Section).toContain(
      'Not checked, because no runner reported these platforms: Windows (x64).'
    );
    expect(markdown).toContain(
      `https://github.com/actions/setup-java/commit/${'a'.repeat(40)}`
    );
  });

  it('shows missing revisions and rejects mixed commits within one revision', () => {
    const main = report('linux', []);
    expect(
      renderMarkdownReport([main], {expectedRefs: ['main', 'v6', 'v5']})
    ).toContain('| `v5` | - | - | Not checked: no reports received |');
    expect(() =>
      renderMarkdownReport([
        {...main, source: {ref: 'v6', sha: 'a'.repeat(40)}},
        {...main, source: {ref: 'v6', sha: 'b'.repeat(40)}}
      ])
    ).toThrow("Reports for 'v6' were produced from different revisions.");
  });

  it.each(['module', 'commonjs'])(
    'loads a separate %s resolver with its provenance',
    async type => {
      const directory = fs.mkdtempSync(
        path.join(os.tmpdir(), 'setup-java resolver-')
      );
      try {
        fs.writeFileSync(
          path.join(directory, 'package.json'),
          JSON.stringify({type})
        );
        const source = {ref: 'v5', sha: 'a'.repeat(40), version: '5.6.0'};
        fs.writeFileSync(
          path.join(directory, 'index.js'),
          `
        const source = ${JSON.stringify(source)};
        const distributions = ['adopt'];
        const getJavaDistribution = () => 'selected checkout';
        const createSolarisInstaller = () => null;
        ${type === 'module' ? 'export' : 'module.exports ='}
        {source, distributions, getJavaDistribution, createSolarisInstaller};
      `
        );
        const loaded = await loadMetadataResolver(directory);
        expect(loaded.source).toEqual(source);
        expect(
          loaded.getJavaDistribution('adopt', {
            version: '21',
            architecture: 'x64',
            packageType: 'jdk',
            checkLatest: true
          })
        ).toBe('selected checkout');
      } finally {
        fs.rmSync(directory, {recursive: true, force: true});
      }
    }
  );

  it('fails explicitly instead of falling back to main when the resolver bundle is invalid', async () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'setup-java resolver-')
    );
    try {
      fs.writeFileSync(
        path.join(directory, 'package.json'),
        '{"type":"module"}'
      );
      fs.writeFileSync(
        path.join(directory, 'index.js'),
        'export const source = {ref: "v5"};'
      );
      await expect(loadMetadataResolver(directory)).rejects.toThrow(
        'Invalid metadata resolver bundle'
      );
    } finally {
      fs.rmSync(directory, {recursive: true, force: true});
    }
  });
});

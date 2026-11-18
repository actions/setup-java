import {describe, expect, it} from '@jest/globals';
import {
  classifyResolutionError,
  getSupportedArchitectures,
  renderMarkdownReport,
  ResolutionReport,
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

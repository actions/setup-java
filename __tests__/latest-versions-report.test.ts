import {describe, expect, it} from '@jest/globals';
import {
  classifyResolutionError,
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

function report(results: VersionResolution[]): ResolutionReport {
  return {platform: 'linux', generatedAt: '2026-11-18T06:30:00.000Z', results};
}

function overviewRow(markdown: string, distribution: string): string {
  return markdown
    .split('\n')
    .find(line => line.startsWith(`| \`${distribution}\``))!;
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

  it('shows one version when every platform agrees and flags differences', () => {
    const markdown = renderMarkdownReport([
      report([
        result({distribution: 'zulu', versionSpec: '21', version: '21.0.9'}),
        result({
          distribution: 'zulu',
          versionSpec: '21',
          architecture: 'aarch64',
          version: '21.0.9'
        }),
        result({distribution: 'temurin', versionSpec: '21', version: '21.0.9'}),
        result({
          distribution: 'temurin',
          versionSpec: '21',
          architecture: 'aarch64',
          version: '21.0.8'
        })
      ])
    ]);

    expect(overviewRow(markdown, 'zulu')).toBe('| `zulu` | `21.0.9` |');
    expect(overviewRow(markdown, 'temurin')).toBe(
      '| `temurin` | `21.0.9` / `21.0.8` ⚠️ |'
    );
    expect(markdown).toContain(
      '<details open><summary><code>temurin</code> ⚠️</summary>'
    );
  });

  it('marks floating releases and prefers the vendor-advertised version', () => {
    const markdown = renderMarkdownReport([
      report([
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

    expect(overviewRow(markdown, 'oracle')).toBe('| `oracle` | `25.0.5.1` ¹ |');
    expect(markdown).toContain('`25.0.5.1` ¹ (published 2026-10-27)');
  });

  it('reports lookup errors and distributions that resolved nothing', () => {
    const markdown = renderMarkdownReport([
      report([
        result({
          distribution: 'oracle-openjdk',
          versionSpec: '25',
          status: 'unavailable',
          message: "No matching version found for SemVer '25'."
        }),
        result({
          distribution: 'redhat',
          versionSpec: '25',
          platform: 'macos',
          status: 'unsupported',
          message: "Distribution 'redhat' does not support operating system"
        }),
        result({
          distribution: 'zulu',
          versionSpec: '25',
          status: 'error',
          message: 'socket hang up\nstack'
        })
      ])
    ]);

    expect(overviewRow(markdown, 'oracle-openjdk')).toBe(
      '| `oracle-openjdk` ❗ | — |'
    );
    expect(overviewRow(markdown, 'redhat')).toBe('| `redhat` | — |');
    expect(overviewRow(markdown, 'zulu')).toBe('| `zulu` | ❗ error |');
    expect(markdown).toContain(
      '| `oracle-openjdk` | all | all | No release matched any requested version'
    );
    expect(markdown).toContain(
      '| `zulu` | `25` | linux x64 | socket hang up |'
    );
  });
});

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll
} from '@jest/globals';
import https from 'https';
import {HttpClient, HttpClientResponse} from '@actions/http-client';
import type {IncomingMessage} from 'http';
import {Readable} from 'stream';

import manifestData from '../data/jetbrains.json' with {type: 'json'};
import os from 'os';

// Mock @actions/core before importing source modules that depend on it
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
  toPlatformPath: jest.fn((p: string) => p),
  toWin32Path: jest.fn((p: string) => p),
  toPosixPath: jest.fn((p: string) => p)
}));

// Dynamic imports after mocking
const core = await import('@actions/core');
const {JetBrainsDistribution} =
  await import('../../src/distributions/jetbrains/installer.js');
const {RetryingHttpClient} = await import('../../src/retrying-http-client.js');
const {MAX_PAGINATION_PAGES} = await import('../../src/util.js');

const JETBRAINS_RELEASES_URL =
  'https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases?per_page=100';

function release(tagName: string, prerelease: boolean) {
  return {
    tag_name: tagName,
    name: tagName,
    prerelease
  };
}

function nextPageHeader(page: number) {
  return {
    link: `<${JETBRAINS_RELEASES_URL}&page=${page}>; rel="next"`
  };
}

function response(
  statusCode: number,
  body = '',
  headers: IncomingMessage['headers'] = {}
): HttpClientResponse {
  const message = Readable.from([Buffer.from(body)]) as IncomingMessage;
  message.statusCode = statusCode;
  message.headers = headers;
  return new HttpClientResponse(message);
}

describe('getAvailableVersions', () => {
  let spyHttpClient: any;
  let spyCoreError: any;
  const originalGitHubToken = process.env.GITHUB_TOKEN;

  beforeEach(() => {
    delete process.env.GITHUB_TOKEN;
    (core.getInput as jest.Mock).mockReturnValue('');
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: []
    });

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  afterEach(() => {
    if (originalGitHubToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalGitHubToken;
    }
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('load available versions', async () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      })
      .mockReturnValue({
        statusCode: 200,
        headers: {},
        result: []
      });

    const distribution = new JetBrainsDistribution({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();

    const length =
      os.platform() === 'win32' ? manifestData.length : manifestData.length + 2;
    expect(availableVersions.length).toBe(length);
  }, 10_000);

  it('continues a stable request after an all-prerelease page', async () => {
    jest.spyOn(HttpClient.prototype, 'head').mockResolvedValue({
      message: {statusCode: 200}
    } as any);
    spyHttpClient
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: nextPageHeader(2),
        result: [release('jbr-release-26.0.0b1.1', true)]
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        result: [release('jbr-release-21.0.11b1163.116', false)]
      });
    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = await distribution['getAvailableVersions']();

    expect(availableVersions.map(version => version.tag_name)).toContain(
      'jbr-release-21.0.11b1163.116'
    );
    expect(availableVersions.map(version => version.tag_name)).not.toContain(
      'jbr-release-26.0.0b1.1'
    );
    expect(spyHttpClient).toHaveBeenCalledTimes(2);
  });

  it('continues an EA request after an all-stable page', async () => {
    jest.spyOn(HttpClient.prototype, 'head').mockResolvedValue({
      message: {statusCode: 200}
    } as any);
    spyHttpClient
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: nextPageHeader(2),
        result: [release('jbr-release-21.0.11b1163.116', false)]
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        result: [release('jbr-release-26.0.0b1.1', true)]
      });
    const distribution = new JetBrainsDistribution({
      version: '26-ea',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = await distribution['getAvailableVersions']();

    expect(availableVersions.map(version => version.tag_name)).toEqual([
      'jbr-release-26.0.0b1.1'
    ]);
    expect(spyHttpClient).toHaveBeenCalledTimes(2);
  });

  it('uses the token input for every paginated GitHub Releases request', async () => {
    (core.getInput as jest.Mock).mockReturnValue('input-token');
    spyHttpClient
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: nextPageHeader(2),
        result: [release('jbr-release-21.0.11b1163.116', false)]
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: {},
        result: [release('jbr-release-21.0.10b1087.6', false)]
      });
    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenNthCalledWith(1, JETBRAINS_RELEASES_URL, {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer input-token'
    });
    expect(spyHttpClient).toHaveBeenNthCalledWith(
      2,
      `${JETBRAINS_RELEASES_URL}&page=2`,
      {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer input-token'
      }
    );
  });

  it('prefers the token input over the environment fallback', async () => {
    (core.getInput as jest.Mock).mockReturnValue('input-token');
    process.env.GITHUB_TOKEN = 'environment-token';
    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledWith(JETBRAINS_RELEASES_URL, {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer input-token'
    });
  });

  it('falls back to GITHUB_TOKEN when the token input is empty', async () => {
    process.env.GITHUB_TOKEN = 'environment-token';
    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledWith(JETBRAINS_RELEASES_URL, {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer environment-token'
    });
  });

  it('omits authorization when no GitHub token is available', async () => {
    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledWith(JETBRAINS_RELEASES_URL, {
      Accept: 'application/vnd.github+json'
    });
  });

  it('stops pagination when a raw GitHub page is empty', async () => {
    spyHttpClient
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: nextPageHeader(2),
        result: [release('jbr-release-21.0.11b1163.116', false)]
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: nextPageHeader(3),
        result: []
      });
    const distribution = new JetBrainsDistribution({
      version: '26-ea',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledTimes(2);
  });

  it('stops at the pagination safeguard', async () => {
    spyHttpClient.mockResolvedValue({
      statusCode: 200,
      headers: nextPageHeader(2),
      result: [release('jbr-release-21.0.11b1163.116', false)]
    });
    const distribution = new JetBrainsDistribution({
      version: '26-ea',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const availableVersions = await distribution['getAvailableVersions']();

    expect(availableVersions).toEqual([]);
    expect(spyHttpClient).toHaveBeenCalledTimes(MAX_PAGINATION_PAGES);
    expect(core.warning).toHaveBeenCalledWith(
      `Reached pagination safeguard limit (${MAX_PAGINATION_PAGES} pages) while listing JetBrains Runtime releases.`
    );
  });

  it('ignores pagination links with an unexpected origin', async () => {
    spyHttpClient.mockResolvedValueOnce({
      statusCode: 200,
      headers: {
        link: '<https://example.com/releases?page=2>; rel="next"'
      },
      result: [release('jbr-release-21.0.11b1163.116', false)]
    });
    const distribution = new JetBrainsDistribution({
      version: '26-ea',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await distribution['getAvailableVersions']();

    expect(spyHttpClient).toHaveBeenCalledTimes(1);
    expect(core.warning).toHaveBeenCalledWith(
      'Ignoring pagination link with unexpected origin: https://example.com/releases?page=2'
    );
  });

  it('retries a GitHub rate limit using Retry-After', async () => {
    spyHttpClient.mockRestore();
    const sleep = jest.fn(async () => undefined);
    const requestRaw = jest
      .spyOn(HttpClient.prototype, 'requestRaw')
      .mockResolvedValueOnce(response(429, '', {'retry-after': '2'}))
      .mockResolvedValueOnce(response(200, '[]'))
      .mockResolvedValueOnce(response(200))
      .mockResolvedValueOnce(response(200));
    const distribution = new JetBrainsDistribution({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['http'] = new RetryingHttpClient('test', {
      sleep,
      random: () => 0
    });

    const availableVersions = await distribution['getAvailableVersions']();

    expect(availableVersions).toHaveLength(2);
    expect(requestRaw).toHaveBeenCalledTimes(4);
    expect(requestRaw.mock.calls[0][0].options.path).toBe(
      requestRaw.mock.calls[1][0].options.path
    );
    expect(requestRaw.mock.calls[0][0].options.path).toContain(
      '/repos/JetBrains/JetBrainsRuntime/releases'
    );
    expect(sleep).toHaveBeenCalledWith(2000);
    expect(core.info).toHaveBeenCalledWith(
      'Request attempt 1 of 4 failed (HTTP 429); retrying in 2000 ms'
    );
  });
});

describe('findPackageForDownload', () => {
  let spyHttpClientGet: any;

  const JETBRAINS_CHECKSUM = 'c'.repeat(128);

  beforeEach(() => {
    // Every resolved release fetches `${url}.checksum` (sha512, GNU
    // `<hex>  <filename>` format); stub it so tests never reach the real
    // network, except the dedicated 'version %s can be downloaded' test
    // below which intentionally exercises real HTTPS HEAD requests.
    spyHttpClientGet = jest
      .spyOn(HttpClient.prototype, 'get')
      .mockResolvedValue({
        message: {statusCode: 200},
        readBody: async () => `${JETBRAINS_CHECKSUM}  jbrsdk.tar.gz\n`
      } as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['17', '17.0.11+1207.24'],
    ['11.0', '11.0.16+2043.64'],
    ['11.0.11', '11.0.11+1542.1'],
    ['21.0.2', '21.0.2+375.1'],
    ['21', '21.0.3+465.3'],
    ['x', '21.0.3+465.3']
  ])('version is resolved correctly %s -> %s', async (input, expected) => {
    const distribution = new JetBrainsDistribution({
      version: input,
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it.each(['17', '11.0', '11.0.11', '21.0.2', '21'])(
    'version %s can be downloaded',
    async input => {
      const distribution = new JetBrainsDistribution({
        version: input,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => manifestData as any;
      const resolvedVersion =
        await distribution['findPackageForDownload'](input);
      const url = resolvedVersion.url;
      const options = {method: 'HEAD'};

      await new Promise<void>((resolve, reject) => {
        const request = https.request(url, options, res => {
          let assertionError: unknown;

          try {
            // JetBrains uses 403 for non-existent packages
            expect(res.statusCode).not.toBe(403);
          } catch (error) {
            assertionError = error;
          }

          res.resume();
          res.once('error', reject);
          res.once('end', () =>
            assertionError ? reject(assertionError as Error) : resolve()
          );
        });

        request.on('error', reject);
        request.end();
      });
    }
  );

  it('version is not found', async () => {
    const distribution = new JetBrainsDistribution({
      version: '8.0.452',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(distribution['findPackageForDownload']('8.x')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new JetBrainsDistribution({
      version: '8',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });

  it('fetches the authoritative sha512 checksum only for the resolved version', async () => {
    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;

    const result = await distribution['findPackageForDownload']('21');

    expect(result.checksum).toEqual({
      algorithm: 'sha512',
      value: JETBRAINS_CHECKSUM,
      source: `${result.url}.checksum`
    });
    // Only the single resolved/winning version's checksum is requested,
    // not one per candidate considered during version resolution.
    expect(spyHttpClientGet).toHaveBeenCalledWith(`${result.url}.checksum`);
    expect(spyHttpClientGet).toHaveBeenCalledTimes(1);
  });

  it('parses only the first whitespace-delimited token from the GNU checksum payload', async () => {
    spyHttpClientGet.mockResolvedValue({
      message: {statusCode: 200},
      readBody: async () => `${JETBRAINS_CHECKSUM}  jbrsdk-21.tar.gz\n`
    } as any);

    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;

    const result = await distribution['findPackageForDownload']('21');

    expect(result.checksum?.value).toBe(JETBRAINS_CHECKSUM);
  });

  it('falls back to a sha256 checksum for older JBR builds that only publish one', async () => {
    // Older JBR 11 builds (e.g. jbrsdk_nomod-11_0_16-*-b2043.64.tar.gz) publish
    // a SHA-256 digest at the generic `.checksum` sibling instead of SHA-512.
    const sha256Checksum = 'a'.repeat(64);
    spyHttpClientGet.mockResolvedValue({
      message: {statusCode: 200},
      readBody: async () =>
        `${sha256Checksum}  jbrsdk_nomod-11_0_16-osx-x64-b2043.64.tar.gz\n`
    } as any);

    const distribution = new JetBrainsDistribution({
      version: '21',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;

    const result = await distribution['findPackageForDownload']('21');

    expect(result.checksum).toEqual({
      algorithm: 'sha256',
      value: sha256Checksum,
      source: `${result.url}.checksum`
    });
  });
});

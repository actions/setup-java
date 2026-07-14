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
import os from 'os';
import {HttpClient} from '@actions/http-client';

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
const {OracleDistribution} =
  await import('../../src/distributions/oracle/installer.js');
const {getDownloadArchiveExtension} = await import('../../src/util.js');

describe('findPackageForDownload', () => {
  let distribution: InstanceType<typeof OracleDistribution>;
  let spyDebug: any;
  let spyHttpClient: any;
  let spyCoreError: any;

  beforeEach(() => {
    distribution = new OracleDistribution({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyDebug = core.debug as jest.Mock;
    spyDebug.mockImplementation(() => {});

    // Mock core.error to suppress error logs
    spyCoreError = core.error as jest.Mock;
    spyCoreError.mockImplementation(() => {});
  });

  it.each([
    [
      '21',
      '21',
      'https://download.oracle.com/java/21/latest/jdk-21_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '20',
      '20',
      'https://download.oracle.com/java/20/latest/jdk-20_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '18',
      '18',
      'https://download.oracle.com/java/18/archive/jdk-18_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '20.0.1',
      '20.0.1',
      'https://download.oracle.com/java/20/archive/jdk-20.0.1_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '17',
      '17',
      'https://download.oracle.com/java/17/latest/jdk-17_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.0.1',
      '17.0.1',
      'https://download.oracle.com/java/17/archive/jdk-17.0.1_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ]
  ])('version is %s -> %s', async (input, expectedVersion, expectedUrl) => {
    /* Needed only for this particular test because some urls might change */
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'head');
    spyHttpClient.mockReturnValue(
      Promise.resolve({
        message: {
          statusCode: 200
        }
      })
    );

    /**
     * NOTE - Should fail to retrieve 18 from latest and check archive instead
     */
    if (input === '18') {
      spyHttpClient.mockReturnValueOnce(
        Promise.resolve({
          message: {
            statusCode: 404
          }
        })
      );
    }

    const result = await distribution['findPackageForDownload'](input);

    jest.restoreAllMocks();

    expect(result.version).toBe(expectedVersion);
    const osType = distribution.getPlatform();
    const archiveType = getDownloadArchiveExtension();
    const url = expectedUrl
      .replace('{{OS_TYPE}}', osType)
      .replace('{{ARCHIVE_TYPE}}', archiveType);
    expect(result.url).toBe(url);
  });

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);
      jest.spyOn(os, 'platform').mockReturnValue('linux');

      const version = '18';
      const distro = new OracleDistribution({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const osType = distribution.getPlatform();
      if (osType === 'windows' && distroArch == 'aarch64') {
        return; // skip, aarch64 is not available for Windows
      }
      const archiveType = getDownloadArchiveExtension();
      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://download.oracle.com/java/18/archive/jdk-18_${osType}-${distroArch}_bin.${archiveType}`;

      expect(result.url).toBe(expectedUrl);
    },
    10000
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Oracle JDK is only supported for JDK 17 and later/
    );
    await expect(distribution['findPackageForDownload']('11')).rejects.toThrow(
      /Oracle JDK is only supported for JDK 17 and later/
    );
  });
});
describe('findPackageForDownload with latest', () => {
  let spyHttpClientHead: any;
  let spyHttpClientGetJson: any;

  beforeEach(() => {
    (core.debug as jest.Mock).mockImplementation(() => {});
    (core.error as jest.Mock).mockImplementation(() => {});
    spyHttpClientGetJson = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClientGetJson.mockResolvedValue({
      statusCode: 200,
      result: {most_recent_feature_release: 25},
      headers: {}
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('resolves the newest major version from the Adoptium API', async () => {
    spyHttpClientHead = jest.spyOn(HttpClient.prototype, 'head');
    spyHttpClientHead.mockResolvedValue({message: {statusCode: 200}});

    const distribution = new OracleDistribution({
      version: 'latest',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    const result = await distribution['findPackageForDownload']('x');
    const osType = distribution.getPlatform();
    const archiveType = getDownloadArchiveExtension();

    expect(result.version).toBe('25');
    expect(result.url).toBe(
      `https://download.oracle.com/java/25/latest/jdk-25_${osType}-x64_bin.${archiveType}`
    );
  });

  it('throws an actionable error when the latest major is not yet available', async () => {
    spyHttpClientHead = jest.spyOn(HttpClient.prototype, 'head');
    spyHttpClientHead.mockResolvedValue({message: {statusCode: 404}});

    const distribution = new OracleDistribution({
      version: 'latest',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    await expect(distribution['findPackageForDownload']('x')).rejects.toThrow(
      /is not yet available for the Oracle JDK distribution/
    );
  });
});

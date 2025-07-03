import {GraalVMDistribution} from '../../src/distributions/graalvm/installer';
import os from 'os';
import * as core from '@actions/core';
import {getDownloadArchiveExtension} from '../../src/util';
import {HttpClient, HttpClientResponse} from '@actions/http-client';

describe('GraalVMDistribution', () => {
  let distribution: GraalVMDistribution;
  let spyDebug: jest.SpyInstance;
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    distribution = new GraalVMDistribution({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyDebug = jest.spyOn(core, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const setupHttpClientSpy = () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'head').mockResolvedValue({
      message: {statusCode: 200} as any, // Minimal mock for IncomingMessage
      readBody: jest.fn().mockResolvedValue('')
    } as HttpClientResponse);
  };

  const testCases = [
    [
      '21',
      '21',
      'https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '21.0.4',
      '21.0.4',
      'https://download.oracle.com/graalvm/21/archive/graalvm-jdk-21.0.4_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '17',
      '17',
      'https://download.oracle.com/graalvm/17/latest/graalvm-jdk-17_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.0.12',
      '17.0.12',
      'https://download.oracle.com/graalvm/17/archive/graalvm-jdk-17.0.12_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ]
  ];

  it.each(testCases)(
    'should find package for version %s',
    async (input, expectedVersion, expectedUrl) => {
      setupHttpClientSpy();

      const result = await distribution['findPackageForDownload'](input);
      const osType = distribution.getPlatform();
      const archiveType = getDownloadArchiveExtension();
      const expectedFormattedUrl = expectedUrl
        .replace('{{OS_TYPE}}', osType)
        .replace('{{ARCHIVE_TYPE}}', archiveType);

      expect(result.version).toBe(expectedVersion);
      expect(result.url).toBe(expectedFormattedUrl);
    }
  );

  it.each([
    [
      '24-ea',
      /^https:\/\/github\.com\/graalvm\/oracle-graalvm-ea-builds\/releases\/download\/jdk-24\.0\.0-ea\./
    ]
  ])(
    'should find EA package for version %s',
    async (version, expectedUrlPrefix) => {
      setupHttpClientSpy();

      const eaDistro = new GraalVMDistribution({
        version,
        architecture: '',
        packageType: 'jdk',
        checkLatest: false
      });

      const versionWithoutEA = version.split('-')[0];
      const result = await eaDistro['findPackageForDownload'](versionWithoutEA);

      expect(result.url).toEqual(expect.stringMatching(expectedUrlPrefix));
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'should map OS architecture %s to distribution architecture %s',
    async (osArch: string, distroArch: string) => {
      jest.spyOn(os, 'arch').mockReturnValue(osArch);
      jest.spyOn(os, 'platform').mockReturnValue('linux');

      const version = '21';
      const distro = new GraalVMDistribution({
        version,
        architecture: '',
        packageType: 'jdk',
        checkLatest: false
      });

      const osType = distribution.getPlatform();
      if (osType === 'windows' && distroArch === 'aarch64') {
        console.warn('Skipping test: aarch64 is not available for Windows');
        return;
      }

      const archiveType = getDownloadArchiveExtension();
      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_${osType}-${distroArch}_bin.${archiveType}`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error for unsupported versions', async () => {
    setupHttpClientSpy();

    const unsupportedVersions = ['8', '11'];
    for (const version of unsupportedVersions) {
      await expect(
        distribution['findPackageForDownload'](version)
      ).rejects.toThrow(/GraalVM is only supported for JDK 17 and later/);
    }

    const unavailableEADistro = new GraalVMDistribution({
      version: '17-ea',
      architecture: '',
      packageType: 'jdk',
      checkLatest: false
    });
    await expect(
      unavailableEADistro['findPackageForDownload']('17')
    ).rejects.toThrow(
      `No GraalVM EA build found for version '17-ea'. Please check if the version is correct.`
    );
  });
});

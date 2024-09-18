import {GraalVMDistribution} from '../../src/distributions/graalvm/installer';
import os from 'os';
import * as core from '@actions/core';
import {getDownloadArchiveExtension} from '../../src/util';
import {HttpClient} from '@actions/http-client';

describe('findPackageForDownload', () => {
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

    spyDebug = jest.spyOn(core, 'debug');
    spyDebug.mockImplementation(() => {});
  });

  it.each([
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
  ])('version is %s -> %s', async (input, expectedVersion, expectedUrl) => {
    /* Needed only for this particular test because /latest/ urls tend to change */
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'head');
    spyHttpClient.mockReturnValue(
      Promise.resolve({
        message: {
          statusCode: 200
        }
      })
    );

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
    [
      '24-ea',
      /^https:\/\/github\.com\/graalvm\/oracle-graalvm-ea-builds\/releases\/download\/jdk-24\.0\.0-ea\./
    ]
  ])('version is %s -> %s', async (version, expectedUrlPrefix) => {
    /* Needed only for this particular test because /latest/ urls tend to change */
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'head');
    spyHttpClient.mockReturnValue(
      Promise.resolve({
        message: {
          statusCode: 200
        }
      })
    );

    const eaDistro = new GraalVMDistribution({
      version,
      architecture: '', // to get default value
      packageType: 'jdk',
      checkLatest: false
    });

    const versionWithoutEA = version.split('-')[0];
    const result = await eaDistro['findPackageForDownload'](versionWithoutEA);

    jest.restoreAllMocks();

    expect(result.url).toEqual(expect.stringMatching(expectedUrlPrefix));
  });

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest.spyOn(os, 'arch').mockReturnValue(osArch);
      jest.spyOn(os, 'platform').mockReturnValue('linux');

      const version = '21';
      const distro = new GraalVMDistribution({
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
      const expectedUrl = `https://download.oracle.com/graalvm/21/latest/graalvm-jdk-21_${osType}-${distroArch}_bin.${archiveType}`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /GraalVM is only supported for JDK 17 and later/
    );
    await expect(distribution['findPackageForDownload']('11')).rejects.toThrow(
      /GraalVM is only supported for JDK 17 and later/
    );
    await expect(distribution['findPackageForDownload']('18')).rejects.toThrow(
      /Could not find GraalVM for SemVer */
    );

    const unavailableEADistro = new GraalVMDistribution({
      version: '17-ea',
      architecture: '', // to get default value
      packageType: 'jdk',
      checkLatest: false
    });
    await expect(
      unavailableEADistro['findPackageForDownload']('17')
    ).rejects.toThrow(
      /No GraalVM EA build found\. Are you sure java-version: '17-ea' is correct\?/
    );
  });
});

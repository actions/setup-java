import {OracleDistribution} from '../../src/distributions/oracle/installer';
import os from 'os';
import * as core from '@actions/core';
import {getDownloadArchiveExtension} from '../../src/util';
import {HttpClient} from '@actions/http-client';

describe('findPackageForDownload', () => {
  let distribution: OracleDistribution;
  let spyDebug: jest.SpyInstance;
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    distribution = new OracleDistribution({
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
      jest.spyOn(os, 'arch').mockReturnValue(osArch);
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

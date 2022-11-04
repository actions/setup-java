import { OracleDistribution } from '../../src/distributions/oracle/installer';
import os from 'os';
import * as core from '@actions/core';

describe('findPackageForDownload', () => {
  let distribution: OracleDistribution;
  let spyDebug: jest.SpyInstance;

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
      '19',
      '19',
      'https://download.oracle.com/java/19/latest/jdk-19_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '19.0.1',
      '19.0.1',
      'https://download.oracle.com/java/19/archive/jdk-19.0.1_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
    ],
    [
      '18.0.2.1',
      '18.0.2.1',
      'https://download.oracle.com/java/18/archive/jdk-18.0.2.1_{{OS_TYPE}}-x64_bin.{{ARCHIVE_TYPE}}'
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
    const result = await distribution['findPackageForDownload'](input);
    expect(result.version).toBe(expectedVersion);
    let os: string;
    let archive: string;
    switch (process.platform) {
      case 'darwin':
        os = 'macos';
        archive = 'tar.gz';
        break;
      case 'win32':
        os = 'windows';
        archive = 'zip';
        break;
      default:
        os = process.platform.toString();
        archive = 'tar.gz';
        break;
    }
    const url = expectedUrl.replace('{{OS_TYPE}}', os).replace('{{ARCHIVE_TYPE}}', archive);
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

      const version = '17';
      const distro = new OracleDistribution({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://download.oracle.com/java/17/latest/jdk-17_linux-${distroArch}_bin.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Oracle JDK is only supported for JDK 17 and later/
    );
    await expect(distribution['findPackageForDownload']('11')).rejects.toThrow(
      /Oracle JDK is only supported for JDK 17 and later/
    );
    await expect(distribution['findPackageForDownload']('18')).rejects.toThrow(
      /Could not find Oracle JDK for SemVer */
    );
  });
});

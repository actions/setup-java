import {MicrosoftDistributions} from '../../src/distributions/microsoft/installer';
import os from 'os';
import data from '../data/microsoft.json';
import * as httpm from '@actions/http-client';
import * as core from '@actions/core';

describe('findPackageForDownload', () => {
  let distribution: MicrosoftDistributions;
  let spyGetManifestFromRepo: jest.SpyInstance;
  let spyDebug: jest.SpyInstance;

  beforeEach(() => {
    distribution = new MicrosoftDistributions({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyGetManifestFromRepo = jest.spyOn(httpm.HttpClient.prototype, 'getJson');
    spyGetManifestFromRepo.mockReturnValue({
      result: data,
      statusCode: 200,
      headers: {}
    });

    spyDebug = jest.spyOn(core, 'debug');
    spyDebug.mockImplementation(() => {});
  });

  it.each([
    [
      '17.0.1',
      '17.0.1+12.1',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.1.12.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.x',
      '17.0.7',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.7-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '16.0.x',
      '16.0.2+7.1',
      'https://aka.ms/download-jdk/microsoft-jdk-16.0.2.7.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.0.13',
      '11.0.13+8.1',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.13.8.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.0.15',
      '11.0.15',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.15-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.x',
      '11.0.19',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.19-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
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
    const url = expectedUrl
      .replace('{{OS_TYPE}}', os)
      .replace('{{ARCHIVE_TYPE}}', archive);
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
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.7-linux-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });
});

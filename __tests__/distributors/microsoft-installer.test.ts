import { MicrosoftDistributions } from '../../src/distributions/microsoft/installer';
import * as tc from '@actions/tool-cache';
import data from '../../versions-manifest.json';
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

    spyGetManifestFromRepo = jest.spyOn(tc, 'getManifestFromRepo');
    spyGetManifestFromRepo.mockImplementation(() => {
      return data;
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
      '17.0.3',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.3-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
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

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });
});

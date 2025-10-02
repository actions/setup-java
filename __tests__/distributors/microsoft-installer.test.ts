import {MicrosoftDistributions} from '../../src/distributions/microsoft/installer';
import os from 'os';
import * as httpm from '@actions/http-client';
import * as core from '@actions/core';

describe('findPackageForDownload', () => {
  let distribution: MicrosoftDistributions;
  let spyHttpGet: jest.SpyInstance;
  let spyDebug: jest.SpyInstance;

  const mockHtmlResponse = `
    <html>
      <body>
        <h3>OpenJDK 25.0.0 LTS</h3>
        <h3>OpenJDK 21.0.8 LTS</h3>
        <h3>OpenJDK 17.0.16 LTS</h3>
        <h3>OpenJDK 11.0.28 LTS</h3>
      </body>
    </html>
  `;

  beforeEach(() => {
    distribution = new MicrosoftDistributions({
      version: '',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyHttpGet = jest.spyOn(httpm.HttpClient.prototype, 'get');
    spyHttpGet.mockResolvedValue({
      readBody: jest.fn().mockResolvedValue(mockHtmlResponse)
    } as any);

    spyDebug = jest.spyOn(core, 'debug');
    spyDebug.mockImplementation(() => {});
  });

  it.each([
    [
      '25.x',
      '25.0.0',
      'https://aka.ms/download-jdk/microsoft-jdk-25.0.0-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '21.x',
      '21.0.8',
      'https://aka.ms/download-jdk/microsoft-jdk-21.0.8-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.x',
      '17.0.16',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.16-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '11.x',
      '11.0.28',
      'https://aka.ms/download-jdk/microsoft-jdk-11.0.28-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
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
    'macOS: defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);
      jest.spyOn(os, 'platform').mockReturnValue('darwin');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.16-macos-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'Linux: defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);
      jest.spyOn(os, 'platform').mockReturnValue('linux');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.16-linux-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'Windows: defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: string) => {
      jest
        .spyOn(os, 'arch')
        .mockReturnValue(osArch as ReturnType<typeof os.arch>);
      jest.spyOn(os, 'platform').mockReturnValue('win32');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.16-windows-${distroArch}.zip`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });
});

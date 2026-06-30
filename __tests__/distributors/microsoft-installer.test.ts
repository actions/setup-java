import {
  MicrosoftDistributions,
  MICROSOFT_PUBLIC_KEY
} from '../../src/distributions/microsoft/installer';
import os from 'os';
import data from '../data/microsoft.json';
import * as httpm from '@actions/http-client';
import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as gpg from '../../src/gpg';
import * as util from '../../src/util';
import fs from 'fs';

describe('findPackageForDownload', () => {
  let distribution: MicrosoftDistributions;
  let spyGetManifestFromRepo: jest.SpyInstance;
  let spyDebug: jest.SpyInstance;
  let spyCoreError: jest.SpyInstance;

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

    // Mock core.error to suppress error logs
    spyCoreError = jest.spyOn(core, 'error');
    spyCoreError.mockImplementation(() => {});
  });

  it.each([
    [
      '25.x',
      '25.0.0',
      'https://aka.ms/download-jdk/microsoft-jdk-25.0.0-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '21.x',
      '21.0.0',
      'https://aka.ms/download-jdk/microsoft-jdk-21.0.0-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.x',
      '17.0.18',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.18-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.0.7',
      '17.0.7',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.7-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
    ],
    [
      '17.0.1',
      '17.0.1+12.1',
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.1.12.1-{{OS_TYPE}}-x64.{{ARCHIVE_TYPE}}'
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
    expect(result.signatureUrl).toBe(`${url}.sig`);
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
      jest.spyOn(os, 'platform').mockReturnValue('darwin');

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.18-macos-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

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

      const version = '17';
      const distro = new MicrosoftDistributions({
        version,
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });

      const result = await distro['findPackageForDownload'](version);
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.18-linux-${distroArch}.tar.gz`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it.each([
    ['amd64', 'x64'],
    ['arm64', 'aarch64']
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
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
      const expectedUrl = `https://aka.ms/download-jdk/microsoft-jdk-17.0.18-windows-${distroArch}.zip`;

      expect(result.url).toBe(expectedUrl);
    }
  );

  it('should throw an error', async () => {
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /No matching version found for SemVer */
    );
  });

  it('prefers Alpine package when running on Alpine and requesting JDK 17', async () => {
    jest.spyOn(distribution as any, 'isRunningOnAlpine').mockReturnValue(true);

    const result = await distribution['findPackageForDownload']('17.0.9');

    expect(result.version).toBe('17.0.9');
    expect(result.url).toBe(
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.9-alpine-x64.tar.gz'
    );
    expect(result.signatureUrl).toBe(
      'https://aka.ms/download-jdk/microsoft-jdk-17.0.9-alpine-x64.tar.gz.sig'
    );
  });

  it('falls back to generic linux manifest matching for unsupported major streams on Alpine', async () => {
    jest.spyOn(distribution as any, 'isRunningOnAlpine').mockReturnValue(true);
    jest.spyOn(os, 'platform').mockReturnValue('linux');

    const result = await distribution['findPackageForDownload']('21.x');

    expect(result.version).toBe('21.0.0');
    expect(result.url).toBe(
      'https://aka.ms/download-jdk/microsoft-jdk-21.0.0-linux-x64.tar.gz'
    );
    expect(result.signatureUrl).toBe(
      'https://aka.ms/download-jdk/microsoft-jdk-21.0.0-linux-x64.tar.gz.sig'
    );
  });

  it('uses manifest-provided signature URL when available', async () => {
    spyGetManifestFromRepo.mockReturnValue({
      result: [
        {
          version: '17.0.10',
          stable: true,
          release_url: 'https://example.test',
          files: [
            {
              filename: 'microsoft-jdk-17.0.10-linux-x64.tar.gz',
              arch: 'x64',
              platform: 'linux',
              download_url: 'https://example.test/jdk.tar.gz',
              signature_url: 'https://example.test/jdk.tar.gz.custom.sig'
            }
          ]
        }
      ],
      statusCode: 200,
      headers: {}
    });
    jest.spyOn(os, 'platform').mockReturnValue('linux');

    const result = await distribution['findPackageForDownload']('17.0.10');

    expect(result.signatureUrl).toBe(
      'https://example.test/jdk.tar.gz.custom.sig'
    );
  });
});

describe('downloadTool', () => {
  let spyDownloadTool: jest.SpyInstance;
  let spyExtractJdkFile: jest.SpyInstance;
  let spyCacheDir: jest.SpyInstance;
  let spyVerifySignature: jest.SpyInstance;
  let distribution: MicrosoftDistributions;

  beforeEach(() => {
    jest
      .spyOn(os, 'platform')
      .mockReturnValue(process.platform as ReturnType<typeof os.platform>);

    distribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });

    spyDownloadTool = jest.spyOn(tc, 'downloadTool');
    spyDownloadTool.mockImplementation(async () => {
      return '/tmp/jdk.tar.gz';
    });

    spyExtractJdkFile = jest.spyOn(util, 'extractJdkFile');
    spyExtractJdkFile.mockImplementation(async () => {
      return '/tmp/unpacked';
    });

    jest.spyOn(fs, 'readdirSync').mockReturnValue(['jdk'] as any);
    spyCacheDir = jest.spyOn(tc, 'cacheDir');
    spyCacheDir.mockImplementation(async () => {
      return '/tmp/cached';
    });

    jest
      .spyOn(util, 'renameWinArchive')
      .mockImplementation((archivePath: string) => `${archivePath}.zip`);

    spyVerifySignature = jest.spyOn(gpg, 'verifyPackageSignature');
    spyVerifySignature.mockImplementation(async () => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies signature when enabled', async () => {
    const signedDistribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true
    });

    await signedDistribution['downloadTool']({
      version: '17.0.14+7',
      url: 'https://example.com/jdk.tar.gz',
      signatureUrl: 'https://example.com/jdk.tar.gz.sig'
    });

    expect(spyVerifySignature).toHaveBeenCalledWith(
      '/tmp/jdk.tar.gz',
      'https://example.com/jdk.tar.gz.sig',
      MICROSOFT_PUBLIC_KEY
    );
  });

  it('uses custom public key when verifySignaturePublicKey is provided', async () => {
    const customKey =
      '-----BEGIN PGP PUBLIC KEY BLOCK-----\ncustom\n-----END PGP PUBLIC KEY BLOCK-----';
    const signedDistribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true,
      verifySignaturePublicKey: customKey
    });

    await signedDistribution['downloadTool']({
      version: '17.0.14+7',
      url: 'https://example.com/jdk.tar.gz',
      signatureUrl: 'https://example.com/jdk.tar.gz.sig'
    });

    expect(spyVerifySignature).toHaveBeenCalledWith(
      '/tmp/jdk.tar.gz',
      'https://example.com/jdk.tar.gz.sig',
      customKey
    );
  });

  it('fails when signature is missing and verification is enabled', async () => {
    const signedDistribution = new MicrosoftDistributions({
      version: '17',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false,
      verifySignature: true
    });

    await expect(
      signedDistribution['downloadTool']({
        version: '17.0.14+7',
        url: 'https://example.com/jdk.tar.gz'
      })
    ).rejects.toThrow(
      "Input 'verify-signature' is enabled, but no signature URL was found for Microsoft Build of OpenJDK version 17.0.14+7."
    );
    expect(spyVerifySignature).not.toHaveBeenCalled();
  });

  it('supports signature verification', () => {
    expect(distribution['supportsSignatureVerification']()).toBe(true);
  });
});

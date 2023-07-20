import {HttpClient} from '@actions/http-client';
import * as semver from 'semver';
import {ZuluDistribution} from '../../src/distributions/zulu/installer';
import {IZuluVersions} from '../../src/distributions/zulu/models';
import * as utils from '../../src/util';
import os from 'os';

import manifestData from '../data/zulu-releases-default.json';

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;
  let spyUtilGetDownloadArchiveExtension: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: manifestData as IZuluVersions[]
    });

    spyUtilGetDownloadArchiveExtension = jest.spyOn(
      utils,
      'getDownloadArchiveExtension'
    );
    spyUtilGetDownloadArchiveExtension.mockReturnValue('tar.gz');
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      {
        version: '11',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jdk&javafx=false&arch=x86&hw_bitness=32&release_status=ga'
    ],
    [
      {
        version: '11-ea',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jdk&javafx=false&arch=x86&hw_bitness=32&release_status=ea'
    ],
    [
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jdk&javafx=false&arch=x86&hw_bitness=64&release_status=ga'
    ],
    [
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jre&javafx=false&arch=x86&hw_bitness=64&release_status=ga'
    ],
    [
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jdk+fx',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jdk&javafx=true&arch=x86&hw_bitness=64&release_status=ga&features=fx'
    ],
    [
      {
        version: '8',
        architecture: 'x64',
        packageType: 'jre+fx',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jre&javafx=true&arch=x86&hw_bitness=64&release_status=ga&features=fx'
    ],
    [
      {
        version: '11',
        architecture: 'arm64',
        packageType: 'jdk',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jdk&javafx=false&arch=arm&hw_bitness=64&release_status=ga'
    ],
    [
      {
        version: '11',
        architecture: 'arm',
        packageType: 'jdk',
        checkLatest: false
      },
      '?os=macos&ext=tar.gz&bundle_type=jdk&javafx=false&arch=arm&hw_bitness=&release_status=ga'
    ]
  ])('build correct url for %s -> %s', async (input, parsedUrl) => {
    const distribution = new ZuluDistribution(input);
    distribution['getPlatformOption'] = () => 'macos';
    const buildUrl = `https://api.azul.com/zulu/download/community/v1.0/bundles/${parsedUrl}`;

    await distribution['getAvailableVersions']();

    expect(spyHttpClient.mock.calls).toHaveLength(1);
    expect(spyHttpClient.mock.calls[0][0]).toBe(buildUrl);
  });

  type DistroArch = {
    bitness: string;
    arch: string;
  };
  it.each([
    ['amd64', {bitness: '64', arch: 'x86'}],
    ['arm64', {bitness: '64', arch: 'arm'}]
  ])(
    'defaults to os.arch(): %s mapped to distro arch: %s',
    async (osArch: string, distroArch: DistroArch) => {
      jest.spyOn(os, 'arch').mockReturnValue(osArch);

      const distribution = new ZuluDistribution({
        version: '17',
        architecture: '', // to get default value
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getPlatformOption'] = () => 'macos';
      const buildUrl = `https://api.azul.com/zulu/download/community/v1.0/bundles/?os=macos&ext=tar.gz&bundle_type=jdk&javafx=false&arch=${distroArch.arch}&hw_bitness=${distroArch.bitness}&release_status=ga`;

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(buildUrl);
    }
  );

  it('load available versions', async () => {
    const distribution = new ZuluDistribution({
      version: '11',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    });
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).toHaveLength(manifestData.length);
  });
});

describe('getArchitectureOptions', () => {
  it.each([
    [{architecture: 'x64'}, {arch: 'x86', hw_bitness: '64', abi: ''}],
    [{architecture: 'x86'}, {arch: 'x86', hw_bitness: '32', abi: ''}],
    [{architecture: 'x32'}, {arch: 'x32', hw_bitness: '', abi: ''}],
    [{architecture: 'arm'}, {arch: 'arm', hw_bitness: '', abi: ''}]
  ])('%s -> %s', (input, expected) => {
    const distribution = new ZuluDistribution({
      version: '11',
      architecture: input.architecture,
      packageType: 'jdk',
      checkLatest: false
    });
    expect(distribution['getArchitectureOptions']()).toEqual(expected);
  });
});

describe('findPackageForDownload', () => {
  it.each([
    ['8', '8.0.282+8'],
    ['11.x', '11.0.10+9'],
    ['8.0', '8.0.282+8'],
    ['11.0.x', '11.0.10+9'],
    ['15', '15.0.2+7'],
    ['9.0.0', '9.0.0+0'],
    ['9.0', '9.0.1+0'],
    ['8.0.262', '8.0.262+19'], // validate correct choice between [8.0.262.17, 8.0.262.19, 8.0.262.18]
    ['8.0.262+17', '8.0.262+17'],
    ['15.0.1+8', '15.0.1+8'],
    ['15.0.1+9', '15.0.1+9']
  ])('version is %s -> %s', async (input, expected) => {
    const distribution = new ZuluDistribution({
      version: input,
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData;
    const result = await distribution['findPackageForDownload'](
      distribution['version']
    );
    expect(result.version).toBe(expected);
  });

  it('select correct bundle if there are multiple items with the same jdk version but different zulu versions', async () => {
    const distribution = new ZuluDistribution({
      version: '',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData;
    const result = await distribution['findPackageForDownload']('11.0.5');
    expect(result.url).toBe(
      'https://cdn.azul.com/zulu/bin/zulu11.35.15-ca-jdk11.0.5-macosx_x64.tar.gz'
    );
  });

  it('should throw an error', async () => {
    const distribution = new ZuluDistribution({
      version: '18',
      architecture: 'x86',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData;
    await expect(
      distribution['findPackageForDownload'](distribution['version'])
    ).rejects.toThrow(/Could not find satisfied version for semver */);
  });
});

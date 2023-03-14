import {HttpClient} from '@actions/http-client';

import {JavaInstallerOptions} from '../../src/distributions/base-models';
import {SemeruDistribution} from '../../src/distributions/semeru/installer';

import manifestData from '../data/semeru.json';

describe('getAvailableVersions', () => {
  let spyHttpClient: jest.SpyInstance;

  beforeEach(() => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient.mockReturnValue({
      statusCode: 200,
      headers: {},
      result: []
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it.each([
    [
      {
        version: '16',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      {
        version: '16',
        architecture: 'x86',
        packageType: 'jdk',
        checkLatest: false
      },
      'os=mac&architecture=x86&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      {
        version: '16',
        architecture: 'x64',
        packageType: 'jre',
        checkLatest: false
      },
      'os=mac&architecture=x64&image_type=jre&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ],
    [
      {
        version: '16',
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      },
      'os=mac&architecture=x64&image_type=jdk&release_type=ga&jvm_impl=openj9&page_size=20&page=0'
    ]
  ])(
    'build correct url for %s',
    async (installerOptions: JavaInstallerOptions, expectedParameters) => {
      const distribution = new SemeruDistribution(installerOptions);
      const baseUrl =
        'https://api.adoptopenjdk.net/v3/assets/version/%5B1.0,100.0%5D';
      const expectedUrl = `${baseUrl}?project=jdk&vendor=ibm&heap_size=normal&sort_method=DEFAULT&sort_order=DESC&${expectedParameters}`;
      distribution['getPlatformOption'] = () => 'mac';

      await distribution['getAvailableVersions']();

      expect(spyHttpClient.mock.calls).toHaveLength(1);
      expect(spyHttpClient.mock.calls[0][0]).toBe(expectedUrl);
    }
  );

  it('load available versions', async () => {
    spyHttpClient = jest.spyOn(HttpClient.prototype, 'getJson');
    spyHttpClient
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: manifestData as any
      })
      .mockReturnValueOnce({
        statusCode: 200,
        headers: {},
        result: []
      });

    const distribution = new SemeruDistribution({
      version: '8',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    const availableVersions = await distribution['getAvailableVersions']();
    expect(availableVersions).not.toBeNull();
    expect(availableVersions.length).toBe(manifestData.length * 2);
  });

  it.each([
    ['jdk', 'Java_IBM_Semeru_jdk'],
    ['jre', 'Java_IBM_Semeru_jre']
  ])('find right toolchain folder', (packageType: string, expected: string) => {
    const distribution = new SemeruDistribution({
      version: '8',
      architecture: 'x64',
      packageType: packageType,
      checkLatest: false
    });

    // @ts-ignore - because it is protected
    expect(distribution.toolcacheFolderName).toBe(expected);
  });
});

describe('findPackageForDownload', () => {
  it.each([
    ['8', '8.0.322+6'],
    ['16', '16.0.2+7'],
    ['16.0', '16.0.2+7'],
    ['16.0.2', '16.0.2+7'],
    ['8.x', '8.0.322+6'],
    ['x', '17.0.2+8']
  ])('version is resolved correctly %s -> %s', async (input, expected) => {
    const distribution = new SemeruDistribution({
      version: '8',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    const resolvedVersion = await distribution['findPackageForDownload'](input);
    expect(resolvedVersion.version).toBe(expected);
  });

  it('version is found but binaries list is empty', async () => {
    const distribution = new SemeruDistribution({
      version: '9.0.8',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(
      distribution['findPackageForDownload']('9.0.8')
    ).rejects.toThrow(/Could not find satisfied version for SemVer */);
  });

  it('version is not found', async () => {
    const distribution = new SemeruDistribution({
      version: '7.x',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => manifestData as any;
    await expect(distribution['findPackageForDownload']('7.x')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });

  it('version list is empty', async () => {
    const distribution = new SemeruDistribution({
      version: '8',
      architecture: 'x64',
      packageType: 'jdk',
      checkLatest: false
    });
    distribution['getAvailableVersions'] = async () => [];
    await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
      /Could not find satisfied version for SemVer */
    );
  });

  it.each(['x64', 'x86', 'ppc64le', 'ppc64', 's390x', 'aarch64'])(
    'correct Semeru `%s` architecture resolves',
    async (arch: string) => {
      const distribution = new SemeruDistribution({
        version: '8',
        architecture: arch,
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => manifestData as any;
      const resolvedVersion = await distribution['findPackageForDownload']('8');
      expect(resolvedVersion.version).not.toBeNull();
    }
  );

  it.each(['zos', 'z/OS', 'z/os', 'test0987654321=', '++=++', 'myArch'])(
    'incorrect Semeru `%s` architecture throws',
    async (arch: string) => {
      const distribution = new SemeruDistribution({
        version: '8',
        architecture: arch,
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => [];
      await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
        `Unsupported architecture for IBM Semeru: ${arch}, the following are supported: x64, x86, ppc64le, ppc64, s390x, aarch64`
      );
    }
  );

  it.each(['9-ea', '17-ea', '8-ea', '4-ea'])(
    'early access version are illegal for Semeru (%s)',
    async (version: string) => {
      const distribution = new SemeruDistribution({
        version: version,
        architecture: 'x64',
        packageType: 'jdk',
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => manifestData as any;
      await expect(
        distribution['findPackageForDownload'](version)
      ).rejects.toThrow(
        'IBM Semeru does not provide builds for early access versions'
      );
    }
  );

  it.each([
    'jdk+fx',
    'jre+fx',
    'test',
    'test2',
    'jdk-fx',
    'javafx',
    'jdk-javafx',
    'ibm',
    ' '
  ])(
    'rejects incorrect `%s` Semeru package type',
    async (packageType: string) => {
      const distribution = new SemeruDistribution({
        version: '8',
        architecture: 'x64',
        packageType: packageType,
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => manifestData as any;
      await expect(distribution['findPackageForDownload']('8')).rejects.toThrow(
        'IBM Semeru only provide `jdk` and `jre` package types'
      );
    }
  );

  it.each(['jdk', 'jre'])(
    'accepts correct `%s` Semeru package type',
    async (packageType: string) => {
      const distribution = new SemeruDistribution({
        version: '8',
        architecture: 'x64',
        packageType: packageType,
        checkLatest: false
      });
      distribution['getAvailableVersions'] = async () => manifestData as any;
      const resolvedVersion = await distribution['findPackageForDownload']('8');
      await expect(resolvedVersion.version).toMatch(/8[0-9.]+/);
    }
  );

  it('fails when long release name is used', async () => {
    expect(
      () =>
        new SemeruDistribution({
          version: 'jdk-16.0.2+7_openj9-0.27.1',
          architecture: 'x64',
          packageType: 'jdk',
          checkLatest: false
        })
    ).toThrow(
      "The string 'jdk-16.0.2+7_openj9-0.27.1' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information"
    );
  });
});

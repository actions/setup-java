import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {HttpClient} from '@actions/http-client';
import packageDetails from '../data/redhat-package-details.json' with {type: 'json'};
import packages from '../data/redhat-packages.json' with {type: 'json'};
import {RedHatDistribution} from '../../src/distributions/redhat/installer.js';

const createDistribution = (
  version: string,
  packageType = 'jdk'
): RedHatDistribution =>
  new RedHatDistribution({
    version,
    architecture: 'x64',
    packageType,
    checkLatest: false
  });

const mockDisco = (
  packageResponse: unknown = packages,
  detailsResponse: unknown = packageDetails
) =>
  jest.spyOn(HttpClient.prototype, 'getJson').mockImplementation(async url => ({
    result: url.includes('/packages?') ? packageResponse : detailsResponse,
    statusCode: 200,
    headers: {}
  }));

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Red Hat package resolution', () => {
  it('resolves the newest matching release and authoritative checksum', async () => {
    const getJson = mockDisco();
    const distribution = createDistribution('21');

    const release = await distribution['findPackageForDownload']('21');

    expect(release).toEqual({
      version: '21.0.8+9',
      url: packageDetails.result[0].direct_download_uri,
      checksum: {
        algorithm: 'sha256',
        value: packageDetails.result[0].checksum,
        source:
          'https://api.foojay.io/disco/v3.0/ids/redhat-21.0.8-jdk-linux-x64'
      }
    });
    expect(getJson).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'distro=redhat&release_status=ga&operating_system=linux&architecture=x64&package_type=jdk&archive_type=tar.xz&directly_downloadable=true'
      )
    );
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      'https://api.foojay.io/disco/v3.0/ids/redhat-21.0.8-jdk-linux-x64'
    );
  });

  it('normalizes feature-only Disco versions before matching', async () => {
    mockDisco(undefined, {
      result: [
        {
          ...packageDetails.result[0],
          direct_download_uri: 'https://developers.redhat.com/openjdk-9.tar.xz'
        }
      ],
      message: ''
    });
    const distribution = createDistribution('9');

    const release = await distribution['findPackageForDownload']('9');

    expect(release.version).toBe('9.0.0+181');
  });

  it('selects the requested package type', async () => {
    const getJson = mockDisco();
    const distribution = createDistribution('21', 'jre');

    await distribution['findPackageForDownload']('21');

    expect(getJson).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('package_type=jre')
    );
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      'https://api.foojay.io/disco/v3.0/ids/redhat-21.0.8-jre-linux-x64'
    );
  });

  it('maps Windows to ZIP packages', async () => {
    const getJson = mockDisco();
    const distribution = createDistribution('17');
    distribution['getOperatingSystem'] = () => 'windows';
    distribution['getArchiveType'] = () => 'zip';

    await distribution['findPackageForDownload']('17');

    expect(getJson).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(
        'operating_system=windows&architecture=x64&package_type=jdk&archive_type=zip'
      )
    );
    expect(getJson).toHaveBeenNthCalledWith(
      2,
      'https://api.foojay.io/disco/v3.0/ids/redhat-17.0.16-jdk-windows-x64'
    );
  });

  it('rejects Alpine before requesting glibc package metadata', async () => {
    const getJson = mockDisco();
    const distribution = createDistribution('21');

    expect(() => distribution['getOperatingSystem'](true)).toThrow(
      "Distribution 'redhat' does not support Alpine Linux because Red Hat portable archives require glibc."
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it('rejects early-access versions before requesting metadata', async () => {
    const getJson = mockDisco();
    const distribution = createDistribution('21-ea');

    await expect(distribution['findPackageForDownload']('21')).rejects.toThrow(
      'Early access versions are not supported'
    );
    expect(getJson).not.toHaveBeenCalled();
  });

  it('reports available versions when no release matches', async () => {
    mockDisco();
    const distribution = createDistribution('25');

    await expect(distribution['findPackageForDownload']('25')).rejects.toThrow(
      "No matching version found for SemVer '25'.\nDistribution: RedHat"
    );
  });

  it('fails when the package detail has no direct Red Hat URL', async () => {
    mockDisco(packages, {result: [], message: ''});
    const distribution = createDistribution('21');

    await expect(distribution['findPackageForDownload']('21')).rejects.toThrow(
      'returned no direct Red Hat download URL'
    );
  });

  it('fails when the package detail has no SHA-256 checksum', async () => {
    mockDisco(packages, {
      result: [{...packageDetails.result[0], checksum: ''}],
      message: ''
    });
    const distribution = createDistribution('21');

    await expect(distribution['findPackageForDownload']('21')).rejects.toThrow(
      'returned no SHA-256 checksum'
    );
  });

  it('fails with a targeted error when package metadata is missing', async () => {
    mockDisco(null);
    const distribution = createDistribution('21');

    await expect(distribution['findPackageForDownload']('21')).rejects.toThrow(
      'Could not fetch Red Hat package metadata from Foojay Disco'
    );
  });
});

import {beforeEach, describe, expect, it, jest} from '@jest/globals';
import path from 'path';

const mockReaddirSync = jest.fn();
const realFs = await import('fs');
jest.unstable_mockModule('fs', () => ({
  ...realFs,
  default: {...realFs.default, readdirSync: mockReaddirSync},
  readdirSync: mockReaddirSync
}));

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  isDebug: jest.fn(() => false),
  startGroup: jest.fn(),
  endGroup: jest.fn()
}));

const realUtil = await import('../../src/util.js');
const mockCacheJdkDir = jest.fn();
const mockExtractJdkFile = jest.fn();
const mockRenameWinArchive = jest.fn();
jest.unstable_mockModule('../../src/util.js', () => ({
  ...realUtil,
  cacheJdkDir: mockCacheJdkDir,
  extractJdkFile: mockExtractJdkFile,
  renameWinArchive: mockRenameWinArchive
}));

const {RedHatDistribution} =
  await import('../../src/distributions/redhat/installer.js');

const release = {
  version: '21.0.8+9',
  url: 'https://developers.redhat.com/openjdk-21.tar.xz',
  checksum: {
    algorithm: 'sha256' as const,
    value: 'a'.repeat(64)
  }
};

const createDistribution = () =>
  new RedHatDistribution({
    version: '21',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockReaddirSync.mockReturnValue(['jdk-21']);
  mockExtractJdkFile.mockResolvedValue('/tmp/extracted');
  mockCacheJdkDir.mockResolvedValue('/toolcache/Java_RedHat_jdk/21.0.8-9/x64');
  mockRenameWinArchive.mockReturnValue('/tmp/download.zip');
});

describe('Red Hat package installation', () => {
  it('extracts and caches Linux tar.xz archives', async () => {
    const distribution = createDistribution();
    distribution['downloadAndVerify'] = jest
      .fn()
      .mockResolvedValue('/tmp/download');
    distribution['getArchiveType'] = () => 'tar.xz';

    const result = await distribution['downloadTool'](release);

    expect(mockExtractJdkFile).toHaveBeenCalledWith('/tmp/download', 'tar.xz');
    expect(mockRenameWinArchive).not.toHaveBeenCalled();
    expect(mockCacheJdkDir).toHaveBeenCalledWith(
      path.join('/tmp/extracted', 'jdk-21'),
      'Java_RedHat_jdk',
      '21.0.8-9',
      'x64'
    );
    expect(result).toEqual({
      version: '21.0.8+9',
      path: '/toolcache/Java_RedHat_jdk/21.0.8-9/x64'
    });
  });

  it('renames downloaded Windows ZIP archives before extraction', async () => {
    const distribution = createDistribution();
    distribution['downloadAndVerify'] = jest
      .fn()
      .mockResolvedValue('/tmp/download');
    distribution['getArchiveType'] = () => 'zip';

    await distribution['downloadTool'](release);

    expect(mockRenameWinArchive).toHaveBeenCalledWith('/tmp/download');
    expect(mockExtractJdkFile).toHaveBeenCalledWith('/tmp/download.zip', 'zip');
  });

  it('fails when the extracted archive is empty', async () => {
    mockReaddirSync.mockReturnValue([]);
    const distribution = createDistribution();
    distribution['downloadAndVerify'] = jest
      .fn()
      .mockResolvedValue('/tmp/download');
    distribution['getArchiveType'] = () => 'tar.xz';

    await expect(distribution['downloadTool'](release)).rejects.toThrow(
      'The Red Hat archive for Java 21.0.8+9 was empty.'
    );
    expect(mockCacheJdkDir).not.toHaveBeenCalled();
  });
});

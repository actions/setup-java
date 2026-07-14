import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  afterEach
} from '@jest/globals';
import {fileURLToPath} from 'url';
import * as path from 'path';
import * as io from '@actions/io';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

jest.unstable_mockModule('@actions/exec', () => ({
  exec: jest.fn()
}));

jest.unstable_mockModule('@actions/tool-cache', () => ({
  downloadTool: jest.fn()
}));

const exec = await import('@actions/exec');
const tc = await import('@actions/tool-cache');
const gpg = await import('../src/gpg.js');

const tempDir = path.join(__dirname, 'runner', 'temp');
process.env['RUNNER_TEMP'] = tempDir;

describe('gpg tests', () => {
  beforeEach(async () => {
    await io.mkdirP(tempDir);
  });

  afterAll(async () => {
    try {
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  });

  describe('toGpgPath', () => {
    const originalPlatform = process.platform;

    afterEach(() => {
      Object.defineProperty(process, 'platform', {value: originalPlatform});
    });

    it('returns path unchanged on non-Windows platforms', () => {
      Object.defineProperty(process, 'platform', {value: 'linux'});
      expect(gpg.toGpgPath('/tmp/some/path')).toBe('/tmp/some/path');
      expect(gpg.toGpgPath('D:\\a\\_temp\\file')).toBe('D:\\a\\_temp\\file');
    });

    it('converts Windows backslashes and drive letter to POSIX path on Windows', () => {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      expect(gpg.toGpgPath('D:\\a\\_temp\\gpg-home')).toBe(
        '/d/a/_temp/gpg-home'
      );
      expect(
        gpg.toGpgPath('C:\\Users\\runner\\AppData\\Local\\Temp\\key.asc')
      ).toBe('/c/Users/runner/AppData/Local/Temp/key.asc');
    });

    it('handles uppercase and lowercase drive letters on Windows', () => {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      expect(gpg.toGpgPath('d:\\a\\_temp\\file')).toBe('/d/a/_temp/file');
    });
  });

  describe('importKey', () => {
    it('attempts to import private key and returns null key id on failure', async () => {
      const privateKey = 'KEY CONTENTS';
      const keyId = await gpg.importKey(privateKey);

      expect(keyId).toBeNull();

      expect(exec.exec).toHaveBeenCalledWith(
        'gpg',
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe('deleteKey', () => {
    it('deletes private key', async () => {
      const keyId = 'asdfhjkl';
      await gpg.deleteKey(keyId);

      expect(exec.exec).toHaveBeenCalledWith(
        'gpg',
        expect.anything(),
        expect.anything()
      );
    });

    describe('verifyPackageSignature', () => {
      it('imports bundled key and verifies package', async () => {
        const publicKeyContent =
          '-----BEGIN PGP PUBLIC KEY BLOCK-----\ntest\n-----END PGP PUBLIC KEY BLOCK-----';
        (tc.downloadTool as jest.Mock<any>).mockResolvedValue(
          '/tmp/jdk.tar.gz.sig'
        );
        await gpg.verifyPackageSignature(
          '/tmp/jdk.tar.gz',
          'https://example.com/jdk.tar.gz.sig',
          publicKeyContent
        );

        expect(tc.downloadTool).toHaveBeenCalledWith(
          'https://example.com/jdk.tar.gz.sig'
        );
        expect(exec.exec).toHaveBeenNthCalledWith(
          1,
          'gpg',
          [
            '--homedir',
            expect.any(String),
            '--batch',
            '--import',
            expect.stringContaining('public-key.asc')
          ],
          expect.objectContaining({silent: true})
        );
        expect(exec.exec).toHaveBeenNthCalledWith(
          2,
          'gpg',
          [
            '--homedir',
            expect.any(String),
            '--batch',
            '--verify',
            '/tmp/jdk.tar.gz.sig',
            '/tmp/jdk.tar.gz'
          ],
          expect.objectContaining({silent: true})
        );
      });
    });
  });
});

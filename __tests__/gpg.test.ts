import * as path from 'path';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as gpg from '../src/gpg';

jest.mock('@actions/exec', () => {
  return {
    exec: jest.fn()
  };
});

jest.mock('@actions/tool-cache', () => {
  return {
    downloadTool: jest.fn()
  };
});

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
        (tc.downloadTool as jest.Mock).mockResolvedValue('/tmp/jdk.tar.gz.sig');
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

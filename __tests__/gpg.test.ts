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
import * as fs from 'fs';
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
    await io.rmRF(tempDir);
    await io.mkdirP(tempDir);
    jest.clearAllMocks();
    (exec.exec as jest.Mock<any>).mockResolvedValue(0);
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
    it('imports private keys into a unique isolated GPG home', async () => {
      const privateKey = 'KEY CONTENTS';
      let privateKeyFile = '';
      (exec.exec as jest.Mock<any>).mockImplementation(
        async (_command: string, _args: string[]) => {
          const [createdGpgHome] = fs.readdirSync(tempDir);
          privateKeyFile = path.join(
            tempDir,
            createdGpgHome,
            fs
              .readdirSync(path.join(tempDir, createdGpgHome))
              .find(file => file.startsWith('private-key-')) ?? ''
          );
          expect(fs.readFileSync(privateKeyFile, 'utf8')).toBe(privateKey);
          if (process.platform !== 'win32') {
            expect(fs.statSync(privateKeyFile).mode & 0o777).toBe(0o600);
          }
          return 0;
        }
      );

      const gpgHome = await gpg.importKey(privateKey);

      expect(path.dirname(gpgHome)).toBe(tempDir);
      expect(path.basename(gpgHome).startsWith(gpg.GPG_HOME_PREFIX)).toBe(true);
      expect(fs.existsSync(gpgHome)).toBe(true);
      expect(fs.existsSync(privateKeyFile)).toBe(false);
      if (process.platform !== 'win32') {
        expect(fs.statSync(gpgHome).mode & 0o777).toBe(0o700);
      }
      expect(exec.exec).toHaveBeenCalledWith(
        'gpg',
        [
          '--homedir',
          gpg.toGpgPath(gpgHome),
          '--batch',
          '--import',
          gpg.toGpgPath(privateKeyFile)
        ],
        {silent: true}
      );
    });

    it('removes the private-key file and isolated home when import fails', async () => {
      let gpgHome = '';
      let privateKeyFile = '';
      (exec.exec as jest.Mock<any>).mockImplementation(
        async (_command: string, _args: string[]) => {
          const [createdGpgHome] = fs.readdirSync(tempDir);
          gpgHome = path.join(tempDir, createdGpgHome);
          privateKeyFile = path.join(
            gpgHome,
            fs
              .readdirSync(gpgHome)
              .find(file => file.startsWith('private-key-')) ?? ''
          );
          expect(fs.existsSync(privateKeyFile)).toBe(true);
          throw new Error('invalid key');
        }
      );

      await expect(gpg.importKey('INVALID KEY')).rejects.toThrow('invalid key');

      expect(fs.existsSync(privateKeyFile)).toBe(false);
      expect(fs.existsSync(gpgHome)).toBe(false);
    });

    it('imports multi-key input without parsing or deleting fingerprints', async () => {
      const privateKeys = 'KEY ONE\nKEY TWO';
      (exec.exec as jest.Mock<any>).mockImplementation(
        async (_command: string, _args: string[]) => {
          const [createdGpgHome] = fs.readdirSync(tempDir);
          const keyFile = fs
            .readdirSync(path.join(tempDir, createdGpgHome))
            .find(file => file.startsWith('private-key-'));
          expect(
            fs.readFileSync(
              path.join(tempDir, createdGpgHome, keyFile ?? ''),
              'utf8'
            )
          ).toBe(privateKeys);
          return 0;
        }
      );

      const gpgHome = await gpg.importKey(privateKeys);

      expect(gpgHome).toContain(gpg.GPG_HOME_PREFIX);
      expect(exec.exec).toHaveBeenCalledTimes(1);
      expect((exec.exec as jest.Mock).mock.calls[0][1]).not.toContain(
        '--delete-secret-and-public-key'
      );
    });

    it('uses a separate GPG home for each invocation', async () => {
      const firstGpgHome = await gpg.importKey('FIRST KEY');
      const secondGpgHome = await gpg.importKey('SECOND KEY');

      expect(firstGpgHome).not.toBe(secondGpgHome);
      expect(fs.existsSync(firstGpgHome)).toBe(true);
      expect(fs.existsSync(secondGpgHome)).toBe(true);
    });
  });

  describe('removeGpgHome', () => {
    it('removes only action-owned GPG homes and is idempotent', async () => {
      const gpgHome = await gpg.importKey('KEY CONTENTS');
      const unrelatedGpgHome = path.join(tempDir, 'user-gpg-home');
      fs.mkdirSync(unrelatedGpgHome);

      await gpg.removeGpgHome(gpgHome);
      await gpg.removeGpgHome(gpgHome);

      expect(fs.existsSync(gpgHome)).toBe(false);
      expect(fs.existsSync(unrelatedGpgHome)).toBe(true);
    });

    it('refuses to remove a GPG home it does not own', async () => {
      const unrelatedGpgHome = path.join(tempDir, 'user-gpg-home');
      fs.mkdirSync(unrelatedGpgHome, {recursive: true});

      await expect(gpg.removeGpgHome(unrelatedGpgHome)).rejects.toThrow(
        'Refusing to remove unexpected GPG home'
      );
      expect(fs.existsSync(unrelatedGpgHome)).toBe(true);
    });
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

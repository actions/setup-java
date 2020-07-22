import path = require('path');
import io = require('@actions/io');
import exec = require('@actions/exec');

jest.mock('@actions/exec', () => {
  return {
    exec: jest.fn()
  };
});

const tempDir = path.join(__dirname, 'runner', 'temp');
process.env['RUNNER_TEMP'] = tempDir;

import gpg = require('../src/gpg');

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
  });
});

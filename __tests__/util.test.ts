import path = require('path');

const env = process.env;

describe('util tests', () => {
  beforeEach(() => {
    const tempEnv = Object.assign({}, env);
    delete tempEnv.RUNNER_TEMP;
    delete tempEnv.USERPROFILE;
    process.env = tempEnv;
    Object.defineProperty(process, 'platform', {value: 'linux'});
  });

  describe('getTempDir', () => {
    it('gets temp dir using env', () => {
      process.env['RUNNER_TEMP'] = 'defaulttmp';
      const util = require('../src/util');

      const tempDir = util.getTempDir();

      expect(tempDir).toEqual(process.env['RUNNER_TEMP']);
    });

    it('gets temp dir for windows using userprofile', () => {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      process.env['USERPROFILE'] = 'winusertmp';
      const util = require('../src/util');

      const tempDir = util.getTempDir();

      expect(tempDir).toEqual(
        path.join(process.env['USERPROFILE'], 'actions', 'temp')
      );
    });

    it('gets temp dir for windows using c drive', () => {
      Object.defineProperty(process, 'platform', {value: 'win32'});
      const util = require('../src/util');

      const tempDir = util.getTempDir();

      expect(tempDir).toEqual(path.join('C:\\', 'actions', 'temp'));
    });

    it('gets temp dir for mac', () => {
      Object.defineProperty(process, 'platform', {value: 'darwin'});
      const util = require('../src/util');

      const tempDir = util.getTempDir();

      expect(tempDir).toEqual(path.join('/Users', 'actions', 'temp'));
    });

    it('gets temp dir for linux', () => {
      const util = require('../src/util');
      const tempDir = util.getTempDir();

      expect(tempDir).toEqual(path.join('/home', 'actions', 'temp'));
    });
  });
});

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';
import fs from 'fs';
import {isMainModule} from '../src/is-main-module.js';

describe('main module detection', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = [process.execPath, 'entrypoint.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  it.each([undefined, '-'])(
    'skips filesystem access when argv[1] is %s',
    entrypoint => {
      process.argv =
        entrypoint === undefined
          ? [process.execPath]
          : [process.execPath, entrypoint];
      const realpath = jest.spyOn(fs, 'realpathSync');

      expect(isMainModule(import.meta.url)).toBe(false);
      expect(realpath).not.toHaveBeenCalled();
    }
  );

  it.each(['ENOENT', 'ENOTDIR'])(
    'treats a non-file entrypoint returning %s as an import',
    code => {
      jest.spyOn(fs, 'realpathSync').mockImplementation(() => {
        throw Object.assign(new Error('No file-based entrypoint'), {code});
      });

      expect(isMainModule(import.meta.url)).toBe(false);
    }
  );

  it('propagates unexpected filesystem errors', () => {
    const error = Object.assign(new Error('Permission denied'), {
      code: 'EACCES'
    });
    jest.spyOn(fs, 'realpathSync').mockImplementation(() => {
      throw error;
    });

    expect(() => isMainModule(import.meta.url)).toThrow(error);
  });
});

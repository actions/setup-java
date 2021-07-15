import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { restore, save } from '../src/cache';
import { run as cleanup } from '../src/cleanup-java';
import * as fs from 'fs';
import * as os from 'os';
import * as core from '@actions/core';
import * as cache from '@actions/cache';

describe('cleanup', () => {
  let spyInfo: jest.SpyInstance<void, Parameters<typeof core.info>>;
  let spyWarning: jest.SpyInstance<void, Parameters<typeof core.warning>>;

  let spyCacheSave: jest.SpyInstance<
    ReturnType<typeof cache.saveCache>,
    Parameters<typeof cache.saveCache>
  >;
  beforeEach(() => {
    spyInfo = jest.spyOn(core, 'info');
    spyWarning = jest.spyOn(core, 'warning');
    spyCacheSave = jest.spyOn(cache, 'saveCache');
  });

  it('does not fail nor warn even when the save provess throws a ReserveCacheError', async () => {
    spyCacheSave.mockImplementation((paths: string[], key: string) =>
      Promise.reject(
        new cache.ReserveCacheError(
          'Unable to reserve cache with key, another job may be creating this cache.'
        )
      )
    );
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      return name === 'cache' ? 'gradle' : '';
    });
    await cleanup();
    expect(spyCacheSave).toBeCalled();
    expect(spyWarning).not.toBeCalled();
  });

  it('does not fail even though the save process throws error', async () => {
    spyCacheSave.mockImplementation((paths: string[], key: string) =>
      Promise.reject(new Error('Unexpected error'))
    );
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      return name === 'cache' ? 'gradle' : '';
    });
    await cleanup();
    expect(spyCacheSave).toBeCalled();
  });
});

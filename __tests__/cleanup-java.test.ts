import { run as cleanup } from '../src/cleanup-java';
import * as core from '@actions/core';
import * as cache from '@actions/cache';
import * as util from '../src/util';

describe('cleanup', () => {
  let spyWarning: jest.SpyInstance<void, Parameters<typeof core.warning>>;
  let spyCacheSave: jest.SpyInstance<
    ReturnType<typeof cache.saveCache>,
    Parameters<typeof cache.saveCache>
  >;
  let spyJobStatusSuccess: jest.SpyInstance;

  beforeEach(() => {
    spyWarning = jest.spyOn(core, 'warning');
    spyCacheSave = jest.spyOn(cache, 'saveCache');
    spyJobStatusSuccess = jest.spyOn(util, 'isJobStatusSuccess');
    spyJobStatusSuccess.mockReturnValue(true);
    createStateForSuccessfulRestore();
  });
  afterEach(() => {
    resetState();
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

function resetState() {
  jest.spyOn(core, 'getState').mockReset();
}

/**
 * Create states to emulate a successful restore process.
 */
function createStateForSuccessfulRestore() {
  jest.spyOn(core, 'getState').mockImplementation(name => {
    switch (name) {
      case 'cache-primary-key':
        return 'setup-java-cache-primary-key';
      case 'cache-matched-key':
        return 'setup-java-cache-matched-key';
      default:
        return '';
    }
  });
}

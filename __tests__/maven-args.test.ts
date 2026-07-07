import * as core from '@actions/core';

import {configureMavenArgs} from '../src/maven-args';
import {
  INPUT_SHOW_DOWNLOAD_PROGRESS,
  MAVEN_ARGS_ENV,
  MAVEN_NO_TRANSFER_PROGRESS_FLAG
} from '../src/constants';

describe('configureMavenArgs', () => {
  let inputs: Record<string, string>;
  let spyGetInput: jest.SpyInstance;
  let spyExportVariable: jest.SpyInstance;
  let spyInfo: jest.SpyInstance;
  let spyDebug: jest.SpyInstance;
  const originalMavenArgs = process.env[MAVEN_ARGS_ENV];

  beforeEach(() => {
    inputs = {};

    spyGetInput = jest.spyOn(core, 'getInput');
    spyGetInput.mockImplementation((name: string) => inputs[name] ?? '');

    spyExportVariable = jest.spyOn(core, 'exportVariable');
    spyExportVariable.mockImplementation((name: string, value: string) => {
      process.env[name] = value;
    });

    spyInfo = jest.spyOn(core, 'info');
    spyInfo.mockImplementation(() => undefined);

    spyDebug = jest.spyOn(core, 'debug');
    spyDebug.mockImplementation(() => undefined);

    delete process.env[MAVEN_ARGS_ENV];
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalMavenArgs === undefined) {
      delete process.env[MAVEN_ARGS_ENV];
    } else {
      process.env[MAVEN_ARGS_ENV] = originalMavenArgs;
    }
  });

  it('sets MAVEN_ARGS with -ntp by default', () => {
    configureMavenArgs();

    expect(spyExportVariable).toHaveBeenCalledWith(
      MAVEN_ARGS_ENV,
      MAVEN_NO_TRANSFER_PROGRESS_FLAG
    );
    expect(process.env[MAVEN_ARGS_ENV]).toBe(MAVEN_NO_TRANSFER_PROGRESS_FLAG);
  });

  it('does not modify MAVEN_ARGS when show-download-progress is true', () => {
    inputs[INPUT_SHOW_DOWNLOAD_PROGRESS] = 'true';

    configureMavenArgs();

    expect(spyExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBeUndefined();
  });

  it('preserves an existing MAVEN_ARGS value and appends -ntp', () => {
    process.env[MAVEN_ARGS_ENV] = '-B -Dstyle.color=always';

    configureMavenArgs();

    expect(spyExportVariable).toHaveBeenCalledWith(
      MAVEN_ARGS_ENV,
      `-B -Dstyle.color=always ${MAVEN_NO_TRANSFER_PROGRESS_FLAG}`
    );
  });

  it('does not duplicate the flag when -ntp is already present', () => {
    process.env[MAVEN_ARGS_ENV] = '-B -ntp';

    configureMavenArgs();

    expect(spyExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBe('-B -ntp');
  });

  it('does not duplicate the flag when --no-transfer-progress is already present', () => {
    process.env[MAVEN_ARGS_ENV] = '--no-transfer-progress -B';

    configureMavenArgs();

    expect(spyExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBe('--no-transfer-progress -B');
  });

  it('keeps the existing MAVEN_ARGS when show-download-progress is true', () => {
    inputs[INPUT_SHOW_DOWNLOAD_PROGRESS] = 'true';
    process.env[MAVEN_ARGS_ENV] = '-B';

    configureMavenArgs();

    expect(spyExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBe('-B');
  });
});

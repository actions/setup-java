import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockGetInput = jest.fn<(...args: any[]) => any>();
const mockExportVariable = jest.fn<(...args: any[]) => any>();
const mockInfo = jest.fn<(...args: any[]) => any>();
const mockDebug = jest.fn<(...args: any[]) => any>();
const mockWarning = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  exportVariable: mockExportVariable,
  info: mockInfo,
  debug: mockDebug,
  warning: mockWarning,
  setSecret: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  addPath: jest.fn(),
  getMultilineInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getState: jest.fn(),
  saveState: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  group: jest.fn(),
  isDebug: jest.fn(),
  setCommandEcho: jest.fn(),
  getIDToken: jest.fn(),
  ExitCode: {Success: 0, Failure: 1},
  summary: {},
  markdownSummary: {},
  platform: {},
  toPosixPath: jest.fn(),
  toWin32Path: jest.fn(),
  toPlatformPath: jest.fn()
}));

const {configureMavenArgs} = await import('../src/maven-args.js');
const {
  INPUT_SHOW_DOWNLOAD_PROGRESS,
  MAVEN_ARGS_ENV,
  MAVEN_NO_TRANSFER_PROGRESS_FLAG
} = await import('../src/constants.js');

describe('configureMavenArgs', () => {
  let inputs: Record<string, string>;
  const originalMavenArgs = process.env[MAVEN_ARGS_ENV];

  beforeEach(() => {
    inputs = {};

    mockGetInput.mockImplementation((name: string) => inputs[name] ?? '');
    mockExportVariable.mockImplementation((name: string, value: string) => {
      process.env[name] = value;
    });
    mockInfo.mockImplementation(() => undefined);
    mockDebug.mockImplementation(() => undefined);

    delete process.env[MAVEN_ARGS_ENV];
  });

  afterEach(() => {
    jest.resetAllMocks();
    if (originalMavenArgs === undefined) {
      delete process.env[MAVEN_ARGS_ENV];
    } else {
      process.env[MAVEN_ARGS_ENV] = originalMavenArgs;
    }
  });

  it('sets MAVEN_ARGS with -ntp by default', () => {
    configureMavenArgs();

    expect(mockExportVariable).toHaveBeenCalledWith(
      MAVEN_ARGS_ENV,
      MAVEN_NO_TRANSFER_PROGRESS_FLAG
    );
    expect(process.env[MAVEN_ARGS_ENV]).toBe(MAVEN_NO_TRANSFER_PROGRESS_FLAG);
  });

  it('does not modify MAVEN_ARGS when show-download-progress is true', () => {
    inputs[INPUT_SHOW_DOWNLOAD_PROGRESS] = 'true';

    configureMavenArgs();

    expect(mockExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBeUndefined();
  });

  it('preserves an existing MAVEN_ARGS value and appends -ntp', () => {
    process.env[MAVEN_ARGS_ENV] = '-B -Dstyle.color=always';

    configureMavenArgs();

    expect(mockExportVariable).toHaveBeenCalledWith(
      MAVEN_ARGS_ENV,
      `-B -Dstyle.color=always ${MAVEN_NO_TRANSFER_PROGRESS_FLAG}`
    );
  });

  it('does not duplicate the flag when -ntp is already present', () => {
    process.env[MAVEN_ARGS_ENV] = '-B -ntp';

    configureMavenArgs();

    expect(mockExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBe('-B -ntp');
  });

  it('does not duplicate the flag when --no-transfer-progress is already present', () => {
    process.env[MAVEN_ARGS_ENV] = '--no-transfer-progress -B';

    configureMavenArgs();

    expect(mockExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBe('--no-transfer-progress -B');
  });

  it('keeps the existing MAVEN_ARGS when show-download-progress is true', () => {
    inputs[INPUT_SHOW_DOWNLOAD_PROGRESS] = 'true';
    process.env[MAVEN_ARGS_ENV] = '-B';

    configureMavenArgs();

    expect(mockExportVariable).not.toHaveBeenCalled();
    expect(process.env[MAVEN_ARGS_ENV]).toBe('-B');
  });
});

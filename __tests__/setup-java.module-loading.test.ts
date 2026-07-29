import {jest, describe, it, expect, beforeEach} from '@jest/globals';

jest.unstable_mockModule('@actions/core', () => ({
  info: jest.fn(),
  warning: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  notice: jest.fn(),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  getInput: jest.fn(),
  getBooleanInput: jest.fn(),
  getMultilineInput: jest.fn(),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  saveState: jest.fn(),
  getState: jest.fn(),
  setSecret: jest.fn(),
  isDebug: jest.fn(() => false),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  group: jest.fn((_name: string, fn: () => Promise<unknown>) => fn()),
  toPlatformPath: jest.fn((value: string) => value),
  toWin32Path: jest.fn((value: string) => value),
  toPosixPath: jest.fn((value: string) => value)
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    readFileSync: jest.fn()
  }
}));

jest.unstable_mockModule('../src/util.js', () => ({
  getBooleanInput: jest.fn(),
  getVersionFromFileContent: jest.fn()
}));

jest.unstable_mockModule('../src/toolchains.js', () => ({
  validateToolchainIds: jest.fn(),
  configureToolchains: jest.fn()
}));

jest.unstable_mockModule(
  '../src/distributions/distribution-factory.js',
  () => ({
    getJavaDistribution: jest.fn()
  })
);

jest.unstable_mockModule('../src/auth.js', () => ({
  configureAuthentication: jest.fn()
}));

jest.unstable_mockModule('../src/maven-args.js', () => ({
  configureMavenArgs: jest.fn()
}));

jest.unstable_mockModule('../src/problem-matcher.js', () => ({
  configureProblemMatcher: jest.fn()
}));

// These modules should never be imported when `cache` input is empty.
jest.unstable_mockModule('../src/cache-feature.js', () => {
  throw new Error('cache-feature module should not be loaded');
});
jest.unstable_mockModule('../src/cache.js', () => {
  throw new Error('cache module should not be loaded');
});

const core = await import('@actions/core');
const util = await import('../src/util.js');
const toolchains = await import('../src/toolchains.js');
const factory = await import('../src/distributions/distribution-factory.js');
const {run} = await import('../src/setup-java.js');

describe('setup-java conditional module loading', () => {
  const inputs = new Map<string, string>();
  const multilineInputs = new Map<string, string[]>();
  const booleanInputs = new Map<string, boolean>();

  beforeEach(() => {
    jest.resetAllMocks();
    inputs.clear();
    multilineInputs.clear();
    booleanInputs.clear();

    (core.getInput as jest.Mock).mockImplementation((name: unknown) => {
      return inputs.get(name as string) ?? '';
    });
    (core.getMultilineInput as jest.Mock).mockImplementation(
      (name: unknown) => {
        return multilineInputs.get(name as string) ?? [];
      }
    );
    (util.getBooleanInput as jest.Mock).mockImplementation(
      (name: unknown, defaultValue: unknown) => {
        return booleanInputs.get(name as string) ?? defaultValue;
      }
    );
    (toolchains.configureToolchains as jest.Mock).mockResolvedValue(undefined);
  });

  it('does not import cache modules when cache input is not provided', async () => {
    inputs.set('distribution', 'temurin');
    multilineInputs.set('java-version', ['21']);
    (factory.getJavaDistribution as jest.Mock).mockResolvedValue({
      setupJava: jest.fn(async () => ({
        version: '21.0.4+7',
        path: '/opt/java/21'
      }))
    });

    await run();

    expect(core.setFailed).not.toHaveBeenCalled();
  });
});

import {afterEach, beforeEach, describe, expect, it, jest} from '@jest/globals';

const mockGetInput = jest.fn<(...args: any[]) => any>();
const mockInfo = jest.fn<(...args: any[]) => any>();
const mockDebug = jest.fn<(...args: any[]) => any>();

jest.unstable_mockModule('@actions/core', () => ({
  getInput: mockGetInput,
  info: mockInfo,
  debug: mockDebug,
  warning: jest.fn(),
  setSecret: jest.fn()
}));

const {configureProblemMatcher} = await import('../src/problem-matcher.js');
const {INPUT_PROBLEM_MATCHER} = await import('../src/constants.js');

describe('configureProblemMatcher', () => {
  let inputs: Record<string, string>;

  beforeEach(() => {
    inputs = {};
    mockGetInput.mockImplementation((name: string) => inputs[name] ?? '');
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('registers the Java problem matcher by default', () => {
    configureProblemMatcher('/matchers/java.json');

    expect(mockInfo).toHaveBeenCalledWith('##[add-matcher]/matchers/java.json');
  });

  it('does not register the Java problem matcher when disabled', () => {
    inputs[INPUT_PROBLEM_MATCHER] = 'false';

    configureProblemMatcher('/matchers/java.json');

    expect(mockInfo).not.toHaveBeenCalled();
    expect(mockDebug).toHaveBeenCalledWith('Java problem matcher is disabled');
  });
});

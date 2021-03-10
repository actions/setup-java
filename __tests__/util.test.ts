import { isVersionSatisfies } from '../src/util';

describe('isVersionSatisfies', () => {
  it.each([
    ['x', '11.0.0', true],
    ['3', '3.7.1', true],
    ['3', '3.7.2', true],
    ['3', '3.7.2+4', true],
    ['2.5', '2.5.0', true],
    ['2.5', '2.5.0+1', true],
    ['2.5', '2.6.1', false],
    ['2.5.1', '2.5.0', false],
    ['2.5.1+3', '2.5.0', false],
    ['2.5.1+3', '2.5.1+3', true],
    ['2.5.1+3', '2.5.1+2', false],
    ['15.0.0+14', '15.0.0+14.1.202003190635', false],
    ['15.0.0+14.1.202003190635', '15.0.0+14.1.202003190635', true]
  ])('%s, %s -> %s', (inputRange: string, inputVersion: string, expected: boolean) => {
    const actual = isVersionSatisfies(inputRange, inputVersion);
    expect(actual).toBe(expected);
  });
});

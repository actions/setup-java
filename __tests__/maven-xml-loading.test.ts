import {describe, expect, it, jest} from '@jest/globals';

const mockXmlBuilderFactory = jest.fn();
const mockXmlCreate = jest.fn((input: unknown) => {
  if (typeof input === 'string') {
    return {
      root: () => ({
        toObject: () => ({
          toolchains: {
            toolchain: {
              type: 'foo',
              provides: {id: 'custom'},
              configuration: {fooHome: '/opt/foo'}
            }
          }
        })
      })
    };
  }

  return {
    end: () => '<merged-toolchains />'
  };
});

jest.unstable_mockModule('xmlbuilder2', () => {
  mockXmlBuilderFactory();
  return {
    create: mockXmlCreate
  };
});

const toolchains = await import('../src/toolchains.js');

describe('Maven XML loading', () => {
  it('does not load xmlbuilder2 for new toolchains.xml generation', () => {
    const xml = toolchains.generateToolchainDefinition(
      '',
      '21',
      'temurin',
      'temurin_21',
      '/opt/java/21'
    );

    expect(xml).toContain('<id>temurin_21</id>');
    expect(mockXmlBuilderFactory).not.toHaveBeenCalled();
    expect(mockXmlCreate).not.toHaveBeenCalled();
  });

  it('loads xmlbuilder2 for existing toolchains.xml merge generation', async () => {
    await expect(
      toolchains.generateToolchainDefinition(
        '<toolchains><toolchain><type>foo</type></toolchain></toolchains>',
        '21',
        'temurin',
        'temurin_21',
        '/opt/java/21'
      )
    ).resolves.toBe('<merged-toolchains />');

    expect(mockXmlBuilderFactory).toHaveBeenCalledTimes(1);
    expect(mockXmlCreate).toHaveBeenCalledTimes(2);
  });
});

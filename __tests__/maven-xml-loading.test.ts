import {describe, expect, it, jest} from '@jest/globals';

const mockXmlBuilderFactory = jest.fn();
const mockParse = jest.fn(() => ({
  toolchains: {
    toolchain: [
      {
        type: 'foo',
        provides: {id: 'custom'},
        configuration: {fooHome: '/opt/foo'}
      }
    ]
  }
}));

jest.unstable_mockModule('fast-xml-parser', () => {
  mockXmlBuilderFactory();
  return {
    XMLParser: jest.fn().mockImplementation(() => ({
      parse: mockParse
    }))
  };
});

const toolchains = await import('../src/toolchains.js');

describe('Maven XML loading', () => {
  it('does not load fast-xml-parser for new toolchains.xml generation', async () => {
    const xml = await toolchains.generateToolchainDefinition(
      '',
      '21',
      'temurin',
      'temurin_21',
      '/opt/java/21'
    );

    expect(xml).toContain('<id>temurin_21</id>');
    expect(mockXmlBuilderFactory).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
  });

  it('loads fast-xml-parser for existing toolchains.xml merge generation', async () => {
    await expect(
      toolchains.generateToolchainDefinition(
        '<toolchains><toolchain><type>foo</type></toolchain></toolchains>',
        '21',
        'temurin',
        'temurin_21',
        '/opt/java/21'
      )
    ).resolves.toContain('<id>temurin_21</id>');

    expect(mockXmlBuilderFactory).toHaveBeenCalledTimes(1);
    expect(mockParse).toHaveBeenCalledTimes(1);
  });
});

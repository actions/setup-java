import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as constants from './constants.js';
export {validateToolchainIds} from './toolchain-ids.js';
import {escapeXmlAttribute, escapeXmlText} from './xml.js';

interface JdkInfo {
  version: string;
  vendor: string;
  id: string;
  jdkHome: string;
}

export async function configureToolchains(
  version: string,
  distributionName: string,
  jdkHome: string,
  toolchainId?: string
) {
  const vendor =
    core.getInput(constants.INPUT_MVN_TOOLCHAIN_VENDOR) || distributionName;
  const id = toolchainId || `${vendor}_${version}`;
  const settingsDirectory =
    core.getInput(constants.INPUT_SETTINGS_PATH) ||
    path.join(os.homedir(), constants.M2_DIR);

  await createToolchainsSettings({
    jdkInfo: {
      version,
      vendor,
      id,
      jdkHome
    },
    settingsDirectory
  });
}

export async function createToolchainsSettings({
  jdkInfo,
  settingsDirectory
}: {
  jdkInfo: JdkInfo;
  settingsDirectory: string;
}) {
  core.info(
    `Creating ${constants.MVN_TOOLCHAINS_FILE} for JDK version ${jdkInfo.version} from ${jdkInfo.vendor}`
  );
  // when an alternate m2 location is specified use only that location (no .m2 directory)
  // otherwise use the home/.m2/ path
  await io.mkdirP(settingsDirectory);
  const originalToolchains =
    await readExistingToolchainsFile(settingsDirectory);
  const updatedToolchains = await generateToolchainDefinition(
    originalToolchains,
    jdkInfo.version,
    jdkInfo.vendor,
    jdkInfo.id,
    jdkInfo.jdkHome
  );
  await writeToolchainsFileToDisk(settingsDirectory, updatedToolchains);
}

// only exported for testing purposes
export async function generateToolchainDefinition(
  original: string,
  version: string,
  vendor: string,
  id: string,
  jdkHome: string
) {
  if (!original?.length) {
    return generateNewToolchainDefinition(version, vendor, id, jdkHome);
  }

  return generateMergedToolchainDefinition(
    original,
    version,
    vendor,
    id,
    jdkHome
  );
}

async function generateMergedToolchainDefinition(
  original: string,
  version: string,
  vendor: string,
  id: string,
  jdkHome: string
) {
  let jsToolchains: Toolchain[] = [
    {
      type: 'jdk',
      provides: {
        version: `${version}`,
        vendor: `${vendor}`,
        id: `${id}`
      },
      configuration: {
        jdkHome: `${jdkHome}`
      }
    }
  ];
  // default root attributes, used when the existing file does not declare its own
  let rootAttributes: Record<string, string> = {
    '@xmlns': 'http://maven.apache.org/TOOLCHAINS/1.1.0',
    '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
    '@xsi:schemaLocation':
      'http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd'
  };
  const {XMLParser} = await import('fast-xml-parser');
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    isArray: tagName => tagName === 'toolchain'
  });
  const jsObj = parser.parse(original) as ExtractedToolchains;
  if (isToolchainsRoot(jsObj.toolchains)) {
    // preserve the existing root attributes (xmlns, schemaLocation, …) so we don't
    // silently rewrite user-managed metadata or change the effective XML namespace;
    // fast-xml-parser exposes attributes as `@`-prefixed keys on the element object
    const existingAttributes = Object.fromEntries(
      Object.entries(jsObj.toolchains).filter(
        ([key, value]) => key.startsWith('@') && typeof value === 'string'
      )
    ) as Record<string, string>;
    // fall back to the defaults only for attributes the existing file is missing
    rootAttributes = {...rootAttributes, ...existingAttributes};

    if (jsObj.toolchains.toolchain) {
      jsToolchains.push(...jsObj.toolchains.toolchain);
    }
  }

  // remove potential duplicates based on type & id (which should be a unique combination);
  // self.findIndex will only return the first occurrence, ensuring duplicates are skipped
  jsToolchains = jsToolchains.filter(
    (value, index, self) =>
      // ensure non-jdk toolchains are kept in the results, we must not touch them because they belong to the user
      value.type !== 'jdk' ||
      // keep toolchains that lack a usable string id (e.g. partially-formed user files);
      // we cannot safely deduplicate them and must not crash while reading them
      typeof value.provides?.id !== 'string' ||
      index ===
        self.findIndex(
          t => t.type === value.type && t.provides?.id === value.provides?.id
        )
  );

  return serializeToolchains(rootAttributes, jsToolchains);
}

export function generateNewToolchainDefinition(
  version: string,
  vendor: string,
  id: string,
  jdkHome: string
) {
  return [
    '<?xml version="1.0"?>',
    '<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"',
    '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">',
    '  <toolchain>',
    '    <type>jdk</type>',
    '    <provides>',
    `      <version>${escapeXmlText(version)}</version>`,
    `      <vendor>${escapeXmlText(vendor)}</vendor>`,
    `      <id>${escapeXmlText(id)}</id>`,
    '    </provides>',
    '    <configuration>',
    `      <jdkHome>${escapeXmlText(jdkHome)}</jdkHome>`,
    '    </configuration>',
    '  </toolchain>',
    '</toolchains>'
  ].join('\n');
}

async function readExistingToolchainsFile(directory: string) {
  const location = path.join(directory, constants.MVN_TOOLCHAINS_FILE);
  if (fs.existsSync(location)) {
    return fs.readFileSync(location, {
      encoding: 'utf-8',
      flag: 'r'
    });
  }
  return '';
}

async function writeToolchainsFileToDisk(directory: string, settings: string) {
  const location = path.join(directory, constants.MVN_TOOLCHAINS_FILE);
  const settingsExists = fs.existsSync(location);
  // The toolchains file is produced by a non-destructive merge (existing JDK,
  // custom, and non-jdk toolchains are preserved – see generateToolchainDefinition),
  // so it is always safe to write it. Unlike settings.xml, it is therefore not
  // gated behind the `overwrite-settings` input; that would prevent subsequent
  // setup-java runs from registering additional JDKs and silently drop the
  // toolchain entries created by earlier runs.
  if (settingsExists) {
    core.info(`Updating existing file ${location}`);
  } else {
    core.info(`Writing to ${location}`);
  }

  return fs.writeFileSync(location, settings, {
    encoding: 'utf-8',
    flag: 'w'
  });
}

function serializeToolchains(
  rootAttributes: Record<string, string>,
  toolchains: Toolchain[]
) {
  return [
    '<?xml version="1.0"?>',
    serializeOpeningTag('toolchains', rootAttributes, 0),
    ...toolchains.flatMap(toolchain =>
      serializeXmlElement('toolchain', toolchain, 1)
    ),
    '</toolchains>'
  ].join('\n');
}

function serializeOpeningTag(
  name: string,
  attributes: Record<string, string>,
  depth: number
) {
  const indent = '  '.repeat(depth);
  const attributeEntries = Object.entries(attributes);
  if (!attributeEntries.length) {
    return `${indent}<${name}>`;
  }

  const [firstAttribute, ...restAttributes] = attributeEntries;
  const lines = [
    `${indent}<${name} ${formatXmlAttribute(firstAttribute)}`,
    ...restAttributes.map(([attributeName, value]) => {
      return `${indent}  ${formatXmlAttribute([attributeName, value])}`;
    })
  ];
  lines[lines.length - 1] += '>';
  return lines.join('\n');
}

function serializeXmlElement(
  name: string,
  value: XmlElementValue,
  depth: number
): string[] {
  const indent = '  '.repeat(depth);
  if (Array.isArray(value)) {
    return value.flatMap(item => serializeXmlElement(name, item, depth));
  }

  if (!isXmlElementObject(value)) {
    return [
      `${indent}<${name}>${escapeXmlText(String(value ?? ''))}</${name}>`
    ];
  }

  const attributes = Object.fromEntries(
    Object.entries(value)
      .filter(([key, attributeValue]) => {
        return key.startsWith('@') && typeof attributeValue === 'string';
      })
      .map(([key, attributeValue]) => [key, attributeValue as string])
  );
  const childEntries = Object.entries(value).filter(
    ([key]) => !key.startsWith('@') && key !== '#text'
  );
  const textValue = value['#text'];

  if (!childEntries.length) {
    if (textValue !== undefined) {
      return [
        `${serializeOpeningTag(name, attributes, depth)}${escapeXmlText(
          String(textValue ?? '')
        )}</${name}>`
      ];
    }
    return [`${serializeOpeningTag(name, attributes, depth)}</${name}>`];
  }

  return [
    serializeOpeningTag(name, attributes, depth),
    ...(textValue === undefined
      ? []
      : [`${'  '.repeat(depth + 1)}${escapeXmlText(String(textValue ?? ''))}`]),
    ...childEntries.flatMap(([childName, childValue]) =>
      serializeXmlElement(childName, childValue, depth + 1)
    ),
    `${indent}</${name}>`
  ];
}

function formatXmlAttribute([name, value]: [string, string]) {
  return `${name.slice(1)}="${escapeXmlAttribute(value)}"`;
}

function isToolchainsRoot(value: ExtractedToolchains['toolchains']) {
  return isXmlElementObject(value);
}

function isXmlElementObject(
  value: unknown
): value is Record<string, XmlElementValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface ExtractedToolchains {
  toolchains: ToolchainsRoot | string;
}

interface ToolchainsRoot extends XmlElementObject {
  // root attributes such as xmlns / schemaLocation are exposed as `@`-prefixed keys
  [attribute: `@${string}`]: string;
  toolchain?: Toolchain[];
}

// Toolchain type definition according to Maven Toolchains XSD 1.1.0
interface Toolchain {
  type: string;
  provides?: XmlElementObject;
  configuration?: XmlElementObject;
  [customElement: string]: XmlElementValue;
}

interface XmlElementObject {
  [name: string]: XmlElementValue;
}

type XmlElementValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | XmlElementObject
  | XmlElementValue[];

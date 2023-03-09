import * as fs from 'fs';
import os from 'os';
import * as path from 'path';
import * as core from '@actions/core';
import * as io from '@actions/io';
import * as toolchains from '../src/toolchains';
import {M2_DIR, MVN_TOOLCHAINS_FILE} from '../src/constants';

const m2Dir = path.join(__dirname, M2_DIR);
const toolchainsFile = path.join(m2Dir, MVN_TOOLCHAINS_FILE);

describe('toolchains tests', () => {
  let spyOSHomedir: jest.SpyInstance;
  let spyInfo: jest.SpyInstance;

  beforeEach(async () => {
    await io.rmRF(m2Dir);
    spyOSHomedir = jest.spyOn(os, 'homedir');
    spyOSHomedir.mockReturnValue(__dirname);
    spyInfo = jest.spyOn(core, 'info');
    spyInfo.mockImplementation(() => null);
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(m2Dir);
    } catch {
      console.log('Failed to remove test directories');
    }
    jest.resetAllMocks();
    jest.clearAllMocks();
    jest.restoreAllMocks();
  }, 100000);

  it('creates toolchains.xml in alternate locations', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const altHome = path.join(__dirname, 'runner', 'toolchains');
    const altToolchainsFile = path.join(altHome, MVN_TOOLCHAINS_FILE);
    await io.rmRF(altHome); // ensure it doesn't already exist

    await toolchains.createToolchainsSettings({
      jdkInfo,
      settingsDirectory: altHome,
      overwriteSettings: true
    });

    expect(fs.existsSync(m2Dir)).toBe(false);
    expect(fs.existsSync(toolchainsFile)).toBe(false);

    expect(fs.existsSync(altHome)).toBe(true);
    expect(fs.existsSync(altToolchainsFile)).toBe(true);
    expect(fs.readFileSync(altToolchainsFile, 'utf-8')).toEqual(
      toolchains.generateToolchainDefinition(
        '',
        jdkInfo.version,
        jdkInfo.vendor,
        jdkInfo.id,
        jdkInfo.jdkHome
      )
    );

    await io.rmRF(altHome);
  }, 100000);

  it('creates toolchains.xml with minimal configuration', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const result = `<?xml version="1.0"?>
<toolchains xmlns="https://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="https://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>17</version>
      <vendor>Eclipse Temurin</vendor>
      <id>temurin_17</id>
    </provides>
    <configuration>
      <jdkHome>/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64</jdkHome>
    </configuration>
  </toolchain>
</toolchains>`;

    await toolchains.createToolchainsSettings({
      jdkInfo,
      settingsDirectory: m2Dir,
      overwriteSettings: true
    });

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);
    expect(fs.readFileSync(toolchainsFile, 'utf-8')).toEqual(
      toolchains.generateToolchainDefinition(
        '',
        jdkInfo.version,
        jdkInfo.vendor,
        jdkInfo.id,
        jdkInfo.jdkHome
      )
    );
    expect(
      toolchains.generateToolchainDefinition(
        '',
        jdkInfo.version,
        jdkInfo.vendor,
        jdkInfo.id,
        jdkInfo.jdkHome
      )
    ).toEqual(result);
  }, 100000);

  it('reuses existing toolchains.xml files', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const originalFile = `<toolchains>
        <toolchain>
            <type>jdk</type>
        <provides>
        <version>1.6</version>
        <vendor>Sun</vendor>
        <id>sun_1.6</id>
        </provides>
        <configuration>
        <jdkHome>/opt/jdk/sun/1.6</jdkHome>
        </configuration>
        </toolchain>
      </toolchains>`;
    const result = `<?xml version="1.0"?>
<toolchains>
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>1.6</version>
      <vendor>Sun</vendor>
      <id>sun_1.6</id>
    </provides>
    <configuration>
      <jdkHome>/opt/jdk/sun/1.6</jdkHome>
    </configuration>
  </toolchain>
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>17</version>
      <vendor>Eclipse Temurin</vendor>
      <id>temurin_17</id>
    </provides>
    <configuration>
      <jdkHome>/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64</jdkHome>
    </configuration>
  </toolchain>
</toolchains>`;

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(toolchainsFile, originalFile);
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);

    await toolchains.createToolchainsSettings({
      jdkInfo,
      settingsDirectory: m2Dir,
      overwriteSettings: true
    });

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);
    expect(fs.readFileSync(toolchainsFile, 'utf-8')).toEqual(
      toolchains.generateToolchainDefinition(
        originalFile,
        jdkInfo.version,
        jdkInfo.vendor,
        jdkInfo.id,
        jdkInfo.jdkHome
      )
    );
    expect(
      toolchains.generateToolchainDefinition(
        originalFile,
        jdkInfo.version,
        jdkInfo.vendor,
        jdkInfo.id,
        jdkInfo.jdkHome
      )
    ).toEqual(result);
  }, 100000);

  it('does not overwrite existing toolchains.xml files', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const originalFile = `<toolchains>
        <toolchain>
            <type>jdk</type>
        <provides>
        <version>1.6</version>
        <vendor>Sun</vendor>
        <id>sun_1.6</id>
        </provides>
        <configuration>
        <jdkHome>/opt/jdk/sun/1.6</jdkHome>
        </configuration>
        </toolchain>
      </toolchains>`;

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(toolchainsFile, originalFile);
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);

    await toolchains.createToolchainsSettings({
      jdkInfo,
      settingsDirectory: m2Dir,
      overwriteSettings: false
    });

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);
    expect(fs.readFileSync(toolchainsFile, 'utf-8')).toEqual(originalFile);
  }, 100000);

  it('generates valid toolchains.xml with minimal configuration', () => {
    const jdkInfo = {
      version: 'JAVA_VERSION',
      vendor: 'JAVA_VENDOR',
      id: 'VENDOR_VERSION',
      jdkHome: 'JAVA_HOME'
    };

    const expectedToolchains = `<?xml version="1.0"?>
<toolchains xmlns="https://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="https://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="https://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>${jdkInfo.version}</version>
      <vendor>${jdkInfo.vendor}</vendor>
      <id>${jdkInfo.id}</id>
    </provides>
    <configuration>
      <jdkHome>${jdkInfo.jdkHome}</jdkHome>
    </configuration>
  </toolchain>
</toolchains>`;

    expect(
      toolchains.generateToolchainDefinition(
        '',
        jdkInfo.version,
        jdkInfo.vendor,
        jdkInfo.id,
        jdkInfo.jdkHome
      )
    ).toEqual(expectedToolchains);
  }, 100000);

  it('creates toolchains.xml with correct id when none is supplied', async () => {
    const version = '17';
    const distributionName = 'temurin';
    const id = 'temurin_17';
    const jdkHome =
      '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64';

    await toolchains.configureToolchains(
      version,
      distributionName,
      jdkHome,
      undefined
    );

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);
    expect(fs.readFileSync(toolchainsFile, 'utf-8')).toEqual(
      toolchains.generateToolchainDefinition(
        '',
        version,
        distributionName,
        id,
        jdkHome
      )
    );
  }, 100000);
});

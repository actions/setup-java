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
      settingsDirectory: altHome
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
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
      settingsDirectory: m2Dir
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
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
      settingsDirectory: m2Dir
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

  it('does not discard custom elements in existing toolchain definitions', async () => {
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
            <custom>foo</custom>
          </provides>
          <configuration>
            <jdkHome>/opt/jdk/sun/1.6</jdkHome>
            <fooHome>/usr/local/bin/bash</fooHome>
          </configuration>
        </toolchain>
      </toolchains>`;
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>1.6</version>
      <vendor>Sun</vendor>
      <id>sun_1.6</id>
      <custom>foo</custom>
    </provides>
    <configuration>
      <jdkHome>/opt/jdk/sun/1.6</jdkHome>
      <fooHome>/usr/local/bin/bash</fooHome>
    </configuration>
  </toolchain>
</toolchains>`;

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(toolchainsFile, originalFile);
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);

    await toolchains.createToolchainsSettings({
      jdkInfo,
      settingsDirectory: m2Dir
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

  it('does not discard existing, custom toolchain definitions', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const originalFile = `<toolchains>
        <toolchain>
            <type>foo</type>
            <provides>
                <custom>baz</custom>
            </provides>
            <configuration>
                <fooHome>/usr/local/bin/foo</fooHome>
            </configuration>
        </toolchain>
      </toolchains>`;
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
  <toolchain>
    <type>foo</type>
    <provides>
      <custom>baz</custom>
    </provides>
    <configuration>
      <fooHome>/usr/local/bin/foo</fooHome>
    </configuration>
  </toolchain>
</toolchains>`;

    fs.mkdirSync(m2Dir, {recursive: true});
    fs.writeFileSync(toolchainsFile, originalFile);
    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);

    await toolchains.createToolchainsSettings({
      jdkInfo,
      settingsDirectory: m2Dir
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

  it('does not duplicate existing toolchain definitions', async () => {
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
          <version>17</version>
          <vendor>Eclipse Temurin</vendor>
          <id>temurin_17</id>
        </provides>
        <configuration>
          <jdkHome>/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64</jdkHome>
        </configuration>
      </toolchain>
      </toolchains>`;
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
      settingsDirectory: m2Dir
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

  it('does not duplicate existing toolchain definitions if multiple exist', async () => {
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
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
      settingsDirectory: m2Dir
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

  it('handles an empty list of existing toolchains correctly', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const originalFile = `<toolchains>
      </toolchains>`;
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
      settingsDirectory: m2Dir
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

  it('handles an empty existing toolchains.xml correctly', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const originalFile = ``;
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
      settingsDirectory: m2Dir
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

  it('preserves custom root attributes on existing toolchains.xml', async () => {
    const jdkInfo = {
      version: '17',
      vendor: 'Eclipse Temurin',
      id: 'temurin_17',
      jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
    };

    const originalFile = `<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.0.0 http://maven.apache.org/xsd/toolchains-1.0.0.xsd">
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
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.0.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.0.0 http://maven.apache.org/xsd/toolchains-1.0.0.xsd">
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
      settingsDirectory: m2Dir
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

  it('keeps partially-formed jdk toolchains without an id instead of crashing', async () => {
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
          </provides>
          <configuration>
            <jdkHome>/opt/jdk/sun/1.6</jdkHome>
          </configuration>
        </toolchain>
      </toolchains>`;
    const result = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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
  <toolchain>
    <type>jdk</type>
    <provides>
      <version>1.6</version>
      <vendor>Sun</vendor>
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
      settingsDirectory: m2Dir
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

  it('extends existing toolchains.xml files instead of overwriting them', async () => {
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
      settingsDirectory: m2Dir
    });

    expect(fs.existsSync(m2Dir)).toBe(true);
    expect(fs.existsSync(toolchainsFile)).toBe(true);

    const updated = fs.readFileSync(toolchainsFile, 'utf-8');
    // The pre-existing (Sun 1.6) toolchain must be preserved ...
    expect(updated).toContain('<id>sun_1.6</id>');
    expect(updated).toContain('<jdkHome>/opt/jdk/sun/1.6</jdkHome>');
    // ... and the newly installed JDK must be appended.
    expect(updated).toContain('<id>temurin_17</id>');
    expect(updated).toContain('<vendor>Eclipse Temurin</vendor>');
    expect(updated).toContain(`<jdkHome>${jdkInfo.jdkHome}</jdkHome>`);
  }, 100000);

  it('generates valid toolchains.xml with minimal configuration', () => {
    const jdkInfo = {
      version: 'JAVA_VERSION',
      vendor: 'JAVA_VENDOR',
      id: 'VENDOR_VERSION',
      jdkHome: 'JAVA_HOME'
    };

    const expectedToolchains = `<?xml version="1.0"?>
<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">
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

  it('preserves toolchains from previous executions across multiple setup-java runs', async () => {
    // Regression test for https://github.com/actions/setup-java/issues/1099
    // Running setup-java several times in the same job (e.g. multiple steps / multiple
    // java-version entries) must accumulate every JDK in toolchains.xml rather
    // than replacing previously registered entries.
    jest.spyOn(core, 'getInput').mockImplementation((name: string) => {
      if (name === 'settings-path') return m2Dir;
      return '';
    });

    const runs = [
      {
        version: '8',
        distributionName: 'temurin',
        id: 'temurin_8',
        jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/8.0.1-12/x64'
      },
      {
        version: '11',
        distributionName: 'temurin',
        id: 'temurin_11',
        jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/11.0.1-12/x64'
      },
      {
        version: '17',
        distributionName: 'temurin',
        id: 'temurin_17',
        jdkHome: '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk/17.0.1-12/x64'
      }
    ];

    for (const run of runs) {
      await toolchains.configureToolchains(
        run.version,
        run.distributionName,
        run.jdkHome,
        undefined
      );
    }

    expect(fs.existsSync(toolchainsFile)).toBe(true);
    const contents = fs.readFileSync(toolchainsFile, 'utf-8');

    for (const run of runs) {
      expect(contents).toContain(`<id>${run.id}</id>`);
      expect(contents).toContain(`<jdkHome>${run.jdkHome}</jdkHome>`);
    }
    // Exactly one <toolchain> entry per run – no duplicates, none dropped.
    expect((contents.match(/<toolchain>/g) || []).length).toBe(runs.length);
  }, 100000);
});

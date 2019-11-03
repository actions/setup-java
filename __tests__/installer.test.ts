import io = require('@actions/io');
import fs = require('fs');
import path = require('path');
import child_process = require('child_process');

const toolDir = path.join(__dirname, 'runner', 'tools');
const tempDir = path.join(__dirname, 'runner', 'temp');
const javaDir = path.join(__dirname, 'runner', 'java');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
import * as installer from '../src/installer';

let javaFilePath = '';
let javaUrl = '';
if (process.platform === 'win32') {
  javaFilePath = path.join(javaDir, 'java_win.zip');
  javaUrl =
    'https://download.java.net/java/GA/jdk12/33/GPL/openjdk-12_windows-x64_bin.zip';
} else if (process.platform === 'darwin') {
  javaFilePath = path.join(javaDir, 'java_mac.tar.gz');
  javaUrl =
    'https://download.java.net/java/GA/jdk12/33/GPL/openjdk-12_osx-x64_bin.tar.gz';
} else {
  javaFilePath = path.join(javaDir, 'java_linux.tar.gz');
  javaUrl =
    'https://download.java.net/java/GA/jdk12/33/GPL/openjdk-12_linux-x64_bin.tar.gz';
}

describe('installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
    if (!fs.existsSync(`${javaFilePath}.complete`)) {
      // Download java
      await io.mkdirP(javaDir);

      console.log('Downloading java');
      child_process.execSync(`curl "${javaUrl}" > "${javaFilePath}"`);
      // Write complete file so we know it was successful
      fs.writeFileSync(`${javaFilePath}.complete`, 'content');
    }
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('Installs version of Java from jdkFile if no matching version is installed', async () => {
    await installer.getJava('12', 'x64', javaFilePath, 'jdk');
    const JavaDir = path.join(toolDir, 'jdk', '12.0.0', 'x64');

    expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(JavaDir, 'bin'))).toBe(true);
  }, 100000);

  it('Throws if invalid directory to jdk', async () => {
    let thrown = false;
    try {
      await installer.getJava('1000', 'x64', 'bad path', 'jdk');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Downloads java if no file given', async () => {
    await installer.getJava('8.0.102', 'x64', '', 'jdk');
    const JavaDir = path.join(toolDir, 'jdk', '8.0.102', 'x64');

    expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(JavaDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads java with 1.x syntax', async () => {
    await installer.getJava('1.10', 'x64', '', 'jdk');
    const JavaDir = path.join(toolDir, 'jdk', '10.0.2', 'x64');

    expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(JavaDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads java with normal semver syntax', async () => {
    await installer.getJava('9.0.x', 'x64', '', 'jdk');
    const JavaDir = path.join(toolDir, 'jdk', '9.0.7', 'x64');

    expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(JavaDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads java if package is jre', async () => {
    await installer.getJava('8.0.222', 'x64', '', 'jre');
    const JavaDir = path.join(toolDir, 'jre', '8.0.222', 'x64');

    expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(JavaDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads java if package is jdk+fx', async () => {
    await installer.getJava('8.0.222', 'x64', '', 'jdk+fx');
    const JavaDir = path.join(toolDir, 'jdk+fx', '8.0.222', 'x64');

    expect(fs.existsSync(`${JavaDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(JavaDir, 'bin'))).toBe(true);
  }, 100000);

  it('Throws if invalid java package is specified', async () => {
    let thrown = false;
    try {
      await installer.getJava('8.0.222', 'x64', '', 'bad jdk');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Throws if invalid directory to jdk', async () => {
    let thrown = false;
    try {
      await installer.getJava('1000', 'x64', 'bad path', 'jdk');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Uses version of Java installed in cache', async () => {
    const JavaDir: string = path.join(toolDir, 'jdk', '250.0.0', 'x64');
    await io.mkdirP(JavaDir);
    fs.writeFileSync(`${JavaDir}.complete`, 'hello');
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await installer.getJava(
      '250',
      'x64',
      'path shouldnt matter, found in cache',
      'jdk'
    );
    return;
  });

  it('Doesnt use version of Java that was only partially installed in cache', async () => {
    const JavaDir: string = path.join(toolDir, 'jdk', '251.0.0', 'x64');
    await io.mkdirP(JavaDir);
    let thrown = false;
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await installer.getJava('251', 'x64', 'bad path', 'jdk');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    return;
  });
});

import io = require('@actions/io');
import fs = require('fs');
import path = require('path');
import child_process = require('child_process');

const toolDir = path.join(__dirname, 'runnerm', 'tools');
const tempDir = path.join(__dirname, 'runnerm', 'temp');
const mavenDir = path.join(__dirname, 'runnerm', 'maven');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
import * as installer from '../src/maven-installer';

let mavenFilePath = '';
let mavenUrl = '';
if (process.platform === 'win32') {
  mavenFilePath = path.join(mavenDir, 'maven_win.zip');
  mavenUrl =
    'https://archive.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.zip';
} else if (process.platform === 'darwin') {
  mavenFilePath = path.join(mavenDir, 'maven_mac.tar.gz');
  mavenUrl =
    'https://archive.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.tar.gz';
} else {
  mavenFilePath = path.join(mavenDir, 'maven_linux.tar.gz');
  mavenUrl =
    'https://archive.apache.org/dist/maven/maven-3/3.6.3/binaries/apache-maven-3.6.3-bin.tar.gz';
}

describe('maven installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
    await io.rmRF(mavenDir);
    if (!fs.existsSync(`${mavenFilePath}.complete`)) {
      // Download maven
      await io.mkdirP(mavenDir);

      console.log('Downloading maven');
      child_process.execSync(`curl "${mavenUrl}" > "${mavenFilePath}"`);
      // Write complete file so we know it was successful
      fs.writeFileSync(`${mavenFilePath}.complete`, 'content');
    }
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
      await io.rmRF(mavenDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('Installs version of Maven from maven-file if no matching version is installed', async () => {
    await installer.getMaven(
      '3.6.3',
      mavenFilePath,
      'https://archive.apache.org/dist/maven/maven-3/'
    );
    const mavenDir = path.join(toolDir, 'maven', '3.6.3', 'x64');

    expect(fs.existsSync(`${mavenDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(mavenDir, 'bin'))).toBe(true);
  }, 100000);

  it('Throws if invalid directory to maven', async () => {
    let thrown = false;
    try {
      await installer.getMaven('1000', 'bad path');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Downloads maven if no file given', async () => {
    await installer.getMaven('3.6.2', '');
    const mavenDir = path.join(toolDir, 'maven', '3.6.2', 'x64');

    expect(fs.existsSync(`${mavenDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(mavenDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads maven with 1.x syntax', async () => {
    await installer.getMaven('3.1', '');
    const mavenDir = path.join(toolDir, 'maven', '3.1.1', 'x64');

    expect(fs.existsSync(`${mavenDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(mavenDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads maven with normal semver syntax', async () => {
    await installer.getMaven('3.5.x', '');
    const mavenDir = path.join(toolDir, 'maven', '3.5.4', 'x64');

    expect(fs.existsSync(`${mavenDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(mavenDir, 'bin'))).toBe(true);
  }, 100000);

  it('Throws if invalid directory to maven', async () => {
    let thrown = false;
    try {
      await installer.getMaven('1000', 'bad path');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Uses version of Maven installed in cache', async () => {
    const mavenDir: string = path.join(toolDir, 'maven', '250.0.0', 'x64');
    await io.mkdirP(mavenDir);
    fs.writeFileSync(`${mavenDir}.complete`, 'hello');
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await installer.getMaven('250', 'path shouldnt matter, found in cache');
    return;
  });

  it('Doesnt use version of Maven that was only partially installed in cache', async () => {
    const mavenDir: string = path.join(toolDir, 'maven', '251.0.0', 'x64');
    await io.mkdirP(mavenDir);
    let thrown = false;
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await installer.getMaven('251', 'bad path');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    return;
  });
});

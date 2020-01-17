import io = require('@actions/io');
import fs = require('fs');
import path = require('path');
import child_process = require('child_process');

const toolDir = path.join(__dirname, 'runnerg', 'tools');
const tempDir = path.join(__dirname, 'runnerg', 'temp');
const gradleDir = path.join(__dirname, 'runnerg', 'gradle');

process.env['RUNNER_TOOL_CACHE'] = toolDir;
process.env['RUNNER_TEMP'] = tempDir;
import * as installer from '../src/gradle-installer';

let gradleFilePath = '';
let gradleUrl = '';
if (process.platform === 'win32') {
  gradleFilePath = path.join(gradleDir, 'gradle_win.zip');
  gradleUrl = 'https://services.gradle.org/distributions/gradle-6.0.1-bin.zip';
} else if (process.platform === 'darwin') {
  gradleFilePath = path.join(gradleDir, 'gradle_mac.zip');
  gradleUrl = 'https://services.gradle.org/distributions/gradle-6.0.1-bin.zip';
} else {
  gradleFilePath = path.join(gradleDir, 'gradle_linux.zip');
  gradleUrl = 'https://services.gradle.org/distributions/gradle-6.0.1-bin.zip';
}

describe('gradle installer tests', () => {
  beforeAll(async () => {
    await io.rmRF(toolDir);
    await io.rmRF(tempDir);
    await io.rmRF(gradleDir);
    if (!fs.existsSync(`${gradleFilePath}.complete`)) {
      // Download gradle
      await io.mkdirP(gradleDir);

      console.log('Downloading gradle');
      child_process.execSync(`curl -L "${gradleUrl}" > "${gradleFilePath}"`);
      // Write complete file so we know it was successful
      fs.writeFileSync(`${gradleFilePath}.complete`, 'content');
    }
  }, 300000);

  afterAll(async () => {
    try {
      await io.rmRF(toolDir);
      await io.rmRF(tempDir);
      await io.rmRF(gradleDir);
    } catch {
      console.log('Failed to remove test directories');
    }
  }, 100000);

  it('Installs version of Gradle from gradleFile if no matching version is installed', async () => {
    await installer.getGradle('6.0.1', gradleFilePath);
    const gradleDir = path.join(toolDir, 'gradle', '6.0.1', 'x64');

    expect(fs.existsSync(`${gradleDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(gradleDir, 'bin'))).toBe(true);
  }, 100000);

  it('Throws if invalid directory to gradle', async () => {
    let thrown = false;
    try {
      await installer.getGradle('1000', 'bad path');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Downloads gradle if no file given', async () => {
    await installer.getGradle('5.6.3', '');
    const gradleDir = path.join(toolDir, 'gradle', '5.6.3', 'x64');

    expect(fs.existsSync(`${gradleDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(gradleDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads gradle with 1.x syntax', async () => {
    await installer.getGradle('4.10', '');
    const gradleDir = path.join(toolDir, 'gradle', '4.10.3', 'x64');

    expect(fs.existsSync(`${gradleDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(gradleDir, 'bin'))).toBe(true);
  }, 100000);

  it('Downloads gradle with normal semver syntax', async () => {
    await installer.getGradle('4.8.x', '');
    const gradleDir = path.join(toolDir, 'gradle', '4.8.1', 'x64');

    expect(fs.existsSync(`${gradleDir}.complete`)).toBe(true);
    expect(fs.existsSync(path.join(gradleDir, 'bin'))).toBe(true);
  }, 100000);

  it('Throws if invalid directory to gradle', async () => {
    let thrown = false;
    try {
      await installer.getGradle('1000', 'bad path');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
  });

  it('Uses version of gradle installed in cache', async () => {
    const gradleDir: string = path.join(toolDir, 'gradle', '250.0.0', 'x64');
    await io.mkdirP(gradleDir);
    fs.writeFileSync(`${gradleDir}.complete`, 'hello');
    // This will throw if it doesn't find it in the cache (because no such version exists)
    await installer.getGradle('250', 'path shouldnt matter, found in cache');
    return;
  });

  it('Doesnt use version of gradle that was only partially installed in cache', async () => {
    const gradleDir: string = path.join(toolDir, 'gradle', '251.0.0', 'x64');
    await io.mkdirP(gradleDir);
    let thrown = false;
    try {
      // This will throw if it doesn't find it in the cache (because no such version exists)
      await installer.getGradle('251', 'bad path');
    } catch {
      thrown = true;
    }
    expect(thrown).toBe(true);
    return;
  });
});

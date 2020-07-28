import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as util from './util';

import {getJavaAdoptOpenJDK} from './distro/adoptopenjdk';
import {getJavaZulu} from './distro/zulu';

const tempDirectory = util.getTempDir();
const IS_WINDOWS = util.isWindows();

export async function getJava(
  version: string,
  distro: string,
  arch: string,
  jdkFile: string,
  javaPackage: string
): Promise<void> {
  let toolPath = tc.find(javaPackage, version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    let compressedFileExtension = '';

    if (!jdkFile) {
      async function setupVendor(distro: string) {
        switch (distro) {
          case 'adoptopenjdk':
            [jdkFile, version] = await getJavaAdoptOpenJDK(
              version,
              javaPackage,
              arch
            );
            break;
          case 'zulu':
            [jdkFile, version] = await getJavaZulu(version, javaPackage);
            break;
        }
        return [jdkFile, version];
      }

      [jdkFile, version] = await setupVendor(distro);

      compressedFileExtension = IS_WINDOWS ? '.zip' : '.tar.gz';
    } else {
      core.debug('Retrieving Jdk from local path');
    }
    compressedFileExtension = compressedFileExtension || getFileEnding(jdkFile);
    let tempDir: string = path.join(
      tempDirectory,
      'temp_' + Math.floor(Math.random() * 2000000000)
    );
    const jdkDir = await unzipJavaDownload(
      jdkFile,
      compressedFileExtension,
      tempDir
    );
    core.debug(`jdk extracted to ${jdkDir}`);
    toolPath = await tc.cacheDir(
      jdkDir,
      javaPackage,
      getCacheVersionString(version),
      arch
    );
  }

  if (process.platform === 'darwin') toolPath += '/Contents/Home';

  let extendedJavaHome = 'JAVA_HOME_' + version + '_' + arch;
  core.exportVariable(extendedJavaHome, toolPath); //TODO: remove for v2
  // For portability reasons environment variables should only consist of
  // uppercase letters, digits, and the underscore. Therefore we convert
  // the extendedJavaHome variable to upper case and replace '.' symbols and
  // any other non-alphanumeric characters with an underscore.
  extendedJavaHome = extendedJavaHome.toUpperCase().replace(/[^0-9A-Z_]/g, '_');
  core.exportVariable('JAVA_HOME', toolPath);
  core.exportVariable(extendedJavaHome, toolPath);
  core.addPath(path.join(toolPath, 'bin'));
  core.setOutput('path', toolPath);
  core.setOutput('version', version);
}

function getCacheVersionString(version: string) {
  const versionArray = version.split('.');
  const major = versionArray[0];
  const minor = versionArray.length > 1 ? versionArray[1] : '0';
  const patch = versionArray.length > 2 ? versionArray[2] : '0';
  return `${major}.${minor}.${patch}`;
}

function getFileEnding(file: string): string {
  let fileEnding = '';

  if (file.endsWith('.tar')) {
    fileEnding = '.tar';
  } else if (file.endsWith('.tar.gz')) {
    fileEnding = '.tar.gz';
  } else if (file.endsWith('.zip')) {
    fileEnding = '.zip';
  } else if (file.endsWith('.7z')) {
    fileEnding = '.7z';
  } else {
    throw new Error(`${file} has an unsupported file extension`);
  }

  return fileEnding;
}

async function extractFiles(
  file: string,
  fileEnding: string,
  destinationFolder: string
): Promise<void> {
  const stats = fs.statSync(file);
  if (!stats) {
    throw new Error(`Failed to extract ${file} - it doesn't exist`);
  } else if (stats.isDirectory()) {
    throw new Error(`Failed to extract ${file} - it is a directory`);
  }

  if ('.tar' === fileEnding || '.tar.gz' === fileEnding) {
    await tc.extractTar(file, destinationFolder);
  } else if ('.zip' === fileEnding) {
    await tc.extractZip(file, destinationFolder);
  } else {
    // fall through and use sevenZip
    await tc.extract7z(file, destinationFolder);
  }
}

// This method recursively finds all .pack files under fsPath and unpacks them with the unpack200 tool
async function unpackJars(fsPath: string, javaBinPath: string) {
  if (fs.existsSync(fsPath)) {
    if (fs.lstatSync(fsPath).isDirectory()) {
      for (const file in fs.readdirSync(fsPath)) {
        const curPath = path.join(fsPath, file);
        await unpackJars(curPath, javaBinPath);
      }
    } else if (path.extname(fsPath).toLowerCase() === '.pack') {
      // Unpack the pack file synchonously
      const p = path.parse(fsPath);
      const toolName = IS_WINDOWS ? 'unpack200.exe' : 'unpack200';
      const args = IS_WINDOWS ? '-r -v -l ""' : '';
      const name = path.join(p.dir, p.name);
      await exec.exec(`"${path.join(javaBinPath, toolName)}"`, [
        `${args} "${name}.pack" "${name}.jar"`
      ]);
    }
  }
}

async function unzipJavaDownload(
  repoRoot: string,
  fileEnding: string,
  destinationFolder: string,
  extension?: string
): Promise<string> {
  // Create the destination folder if it doesn't exist
  await io.mkdirP(destinationFolder);

  const jdkFile = path.normalize(repoRoot);
  const stats = fs.statSync(jdkFile);
  if (stats.isFile()) {
    await extractFiles(jdkFile, fileEnding, destinationFolder);
    const jdkDirectory = path.join(
      destinationFolder,
      fs.readdirSync(destinationFolder)[0]
    );
    await unpackJars(jdkDirectory, path.join(jdkDirectory, 'bin'));
    return jdkDirectory;
  } else {
    throw new Error(`Jdk argument ${jdkFile} is not a file`);
  }
}

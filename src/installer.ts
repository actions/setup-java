let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as httpm from 'typed-rest-client/HttpClient';

const IS_WINDOWS = process.platform === 'win32';

if (!tempDirectory) {
  let baseLocation;
  if (IS_WINDOWS) {
    // On windows use the USERPROFILE env variable
    baseLocation = process.env['USERPROFILE'] || 'C:\\';
  } else {
    if (process.platform === 'darwin') {
      baseLocation = '/Users';
    } else {
      baseLocation = '/home';
    }
  }
  tempDirectory = path.join(baseLocation, 'actions', 'temp');
}

export async function getJava(
  version: string,
  arch: string,
  jdkFile: string
): Promise<void> {
  let toolPath = tc.find('Java', version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    let compressedFileExtension = '';
    if (!jdkFile) {
      core.debug('Downloading Jdk from Azul');
      jdkFile = await downloadJava(version);
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
      'Java',
      normalizeVersion(version),
      arch
    );
  }

  let extendedJavaHome = 'JAVA_HOME_' + version + '_' + arch;
  core.exportVariable('JAVA_HOME', toolPath);
  core.exportVariable(extendedJavaHome, toolPath);
  core.addPath(path.join(toolPath, 'bin'));
}

function normalizeVersion(version: string) {
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

async function downloadJava(version: string): Promise<string> {
  let filterString = '';
  if (IS_WINDOWS) {
    filterString = `jdk${version}-win_x64.zip`;
  } else {
    if (process.platform === 'darwin') {
      filterString = `jdk${version}-macosx_x64.tar.gz`;
    } else {
      filterString = `jdk${version}-linux_x64.tar.gz`;
    }
  }
  let http: httpm.HttpClient = new httpm.HttpClient('setup-java');
  let contents = await (await http.get(
    'https://static.azul.com/zulu/bin/'
  )).readBody();
  let refs = contents.match(/<a href.*\">/gi) || [];
  refs = refs.filter(val => {
    if (val.indexOf(filterString) > -1) {
      return true;
    }
  });

  if (refs.length == 0) {
    throw new Error(
      `No valid download found for version ${version}. Check https://static.azul.com/zulu/bin/ for a list of valid versions or download your own jdk file and add the jdkFile argument`
    );
  }

  const fileName = refs[0].slice(
    '<a href="'.length,
    refs[0].length - '">'.length
  );
  return await tc.downloadTool(`https://static.azul.com/zulu/bin/${fileName}`);
}

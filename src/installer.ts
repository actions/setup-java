let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';

if (!tempDirectory) {
  let baseLocation;
  if (process.platform === 'win32') {
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

const IS_WINDOWS = process.platform === 'win32';

export async function getJava(
  versionSpec: string,
  arch: string,
  jdkFile: string
): Promise<void> {
  let toolPath = tc.find('Java', versionSpec);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    core.debug('Retrieving Jdk from local path');
    const compressedFileExtension = getFileEnding(jdkFile);
    let tempDir: string = path.join(
      tempDirectory,
      'temp_' + Math.floor(Math.random() * 2000000000)
    );
    await unzipJavaDownload(jdkFile, compressedFileExtension, tempDir);
    toolPath = await tc.cacheDir(tempDir, 'Java', versionSpec, arch);
  }

  let extendedJavaHome = 'JAVA_HOME_' + versionSpec + '_' + arch;
  core.exportVariable('JAVA_HOME', toolPath);
  core.exportVariable(extendedJavaHome, toolPath);
  core.addPath(path.join(toolPath, 'bin'));
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

async function getSevenZipLocation(): Promise<string> {
  if (IS_WINDOWS) {
    return path.join(__dirname, '7zip/7z.exe');
  } else {
    return await io.which('7z', true);
  }
}

function isTar(file: string): boolean {
  const name = file.toLowerCase();
  // standard gnu-tar extension formats with recognized auto compression formats
  // https://www.gnu.org/software/tar/manual/html_section/tar_69.html
  return (
    name.endsWith('.tar') || // no compression
    name.endsWith('.tar.gz') || // gzip
    name.endsWith('.tgz') || // gzip
    name.endsWith('.taz') || // gzip
    name.endsWith('.tar.z') || // compress
    name.endsWith('.tar.bz2') || // bzip2
    name.endsWith('.tz2') || // bzip2
    name.endsWith('.tbz2') || // bzip2
    name.endsWith('.tbz') || // bzip2
    name.endsWith('.tar.lz') || // lzip
    name.endsWith('.tar.lzma') || // lzma
    name.endsWith('.tlz') || // lzma
    name.endsWith('.tar.lzo') || // lzop
    name.endsWith('.tar.xz') || // xz
    name.endsWith('.txz')
  ); // xz
}

async function sevenZipExtract(file: string, destinationFolder: string) {
  console.log(`Using 7zip to extract ${file}`);
  await tc.extract7z(file, destinationFolder, await getSevenZipLocation());
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

  if (IS_WINDOWS) {
    if ('.tar' === fileEnding) {
      // a simple tar
      await sevenZipExtract(file, destinationFolder);
    } else if (isTar(file)) {
      // a compressed tar, e.g. 'fullFilePath/test.tar.gz'
      // e.g. 'fullFilePath/test.tar.gz' --> 'test.tar.gz'
      const shortFileName = path.basename(file);
      // e.g. 'destinationFolder/_test.tar.gz_'
      const tempFolder = path.normalize(
        destinationFolder + path.sep + '_' + shortFileName + '_'
      );

      // 0 create temp folder
      await io.mkdirP(tempFolder);

      // 1 extract compressed tar
      await sevenZipExtract(file, tempFolder);
      const tempTar = tempFolder + path.sep + fs.readdirSync(tempFolder)[0]; // should be only one

      // 2 expand extracted tar
      await sevenZipExtract(tempTar, destinationFolder);

      // 3 cleanup temp folder
      await io.rmRF(tempFolder);
    } else {
      // use sevenZip
      await sevenZipExtract(file, destinationFolder);
    }
  } else {
    // not windows
    if ('.tar' === fileEnding || '.tar.gz' === fileEnding) {
      await tc.extractTar(file, destinationFolder);
    } else if ('.zip' === fileEnding) {
      await tc.extractZip(file, destinationFolder);
    } else {
      // fall through and use sevenZip
      await sevenZipExtract(file, destinationFolder);
    }
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
      const toolName = process.platform.match(/^win/i)
        ? 'unpack200.exe'
        : 'unpack200';
      const args = process.platform.match(/^win/i) ? '-r -v -l ""' : '';
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
  destinationFolder: string
): Promise<string> {
  let initialDirectoriesList: string[];
  let finalDirectoriesList: string[];
  let jdkDirectory: string;

  // Create the destination folder if it doesn't exist
  await io.mkdirP(destinationFolder);

  const jdkFile = path.normalize(repoRoot);
  const stats = fs.statSync(jdkFile);
  if (stats.isFile()) {
    await extractFiles(jdkFile, fileEnding, destinationFolder);
    jdkDirectory = fs.readdirSync(tempDirectory)[0];
    await unpackJars(jdkDirectory, path.join(jdkDirectory, 'bin'));
    return jdkDirectory;
  } else {
    throw new Error(`Jdk argument ${jdkFile} is not a file`);
  }
}

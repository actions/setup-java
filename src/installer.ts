import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as util from './util';

const tempDirectory = util.getTempDir();
const IS_WINDOWS = util.isWindows();

export async function getJava(
  version: string,
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
      core.debug('Downloading JDK from Azul');
      const http = new httpm.HttpClient('setup-java', undefined, {
        allowRetries: true,
        maxRetries: 3
      });
      const url = 'https://static.azul.com/zulu/bin/';
      const response = await http.get(url);
      const statusCode = response.message.statusCode || 0;
      if (statusCode < 200 || statusCode > 299) {
        let body = '';
        try {
          body = await response.readBody();
        } catch (err) {
          core.debug(`Unable to read body: ${err.message}`);
        }
        const message = `Unexpected HTTP status code '${response.message.statusCode}' when retrieving versions from '${url}'. ${body}`.trim();
        throw new Error(message);
      }

      const contents = await response.readBody();
      const refs = contents.match(/<a href.*\">/gi) || [];
      const downloadInfo = getDownloadInfo(refs, version, arch, javaPackage);
      jdkFile = await tc.downloadTool(downloadInfo.url);
      version = downloadInfo.version;
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

function getDownloadInfo(
  refs: string[],
  version: string,
  arch: string,
  javaPackage: string
): {version: string; url: string} {
  version = normalizeVersion(version);

  const archExtension = arch === 'x86' ? 'i686' : 'x64';

  let extension = '';
  if (IS_WINDOWS) {
    extension = `-win_${archExtension}.zip`;
  } else {
    if (process.platform === 'darwin') {
      extension = `-macosx_${archExtension}.tar.gz`;
    } else {
      extension = `-linux_${archExtension}.tar.gz`;
    }
  }

  core.debug(`Searching for files with extension: ${extension}`);

  let pkgRegexp = new RegExp('');
  let pkgTypeLength = 0;
  if (javaPackage === 'jdk') {
    pkgRegexp = /jdk.*-/gi;
    pkgTypeLength = 'jdk'.length;
  } else if (javaPackage == 'jre') {
    pkgRegexp = /jre.*-/gi;
    pkgTypeLength = 'jre'.length;
  } else if (javaPackage == 'jdk+fx') {
    pkgRegexp = /fx-jdk.*-/gi;
    pkgTypeLength = 'fx-jdk'.length;
  } else {
    throw new Error(
      `package argument ${javaPackage} is not in [jdk | jre | jdk+fx]`
    );
  }

  // Maps version to url
  let versionMap = new Map();

  // Filter by platform
  refs.forEach(ref => {
    if (!ref.endsWith(extension + '">')) {
      return;
    }

    // If we haven't returned, means we're looking at the correct platform
    let versions = ref.match(pkgRegexp) || [];
    if (versions.length > 1) {
      throw new Error(
        `Invalid ref received from https://static.azul.com/zulu/bin/: ${ref}`
      );
    }
    if (versions.length == 0) {
      return;
    }
    const refVersion = versions[0].slice(pkgTypeLength, versions[0].length - 1);

    if (semver.satisfies(refVersion, version)) {
      versionMap.set(
        refVersion,
        'https://static.azul.com/zulu/bin/' +
          ref.slice('<a href="'.length, ref.length - '">'.length)
      );
    }
  });

  // Choose the most recent satisfying version
  let curVersion = '0.0.0';
  let curUrl = '';
  for (const entry of versionMap.entries()) {
    const entryVersion = entry[0];
    const entryUrl = entry[1];
    if (semver.gt(entryVersion, curVersion)) {
      curUrl = entryUrl;
      curVersion = entryVersion;
    }
  }

  if (curUrl == '') {
    throw new Error(
      `No valid download found for version ${version} and package ${javaPackage}. Check https://static.azul.com/zulu/bin/ for a list of valid versions or download your own jdk file and add the jdkFile argument`
    );
  }

  return {version: curVersion, url: curUrl};
}

function normalizeVersion(version: string): string {
  if (version.slice(0, 2) === '1.') {
    // Trim leading 1. for versions like 1.8
    version = version.slice(2);
    if (!version) {
      throw new Error('1. is not a valid version');
    }
  }

  if (version.endsWith('-ea')) {
    // convert e.g. 14-ea to 14.0.0-ea
    if (version.indexOf('.') == -1) {
      version = version.slice(0, version.length - 3) + '.0.0-ea';
    }
    // match anything in -ea.X (semver won't do .x matching on pre-release versions)
    if (version[0] >= '0' && version[0] <= '9') {
      version = '>=' + version;
    }
  } else if (version.split('.').length < 3) {
    // For non-ea versions, add trailing .x if it is missing
    if (version[version.length - 1] != 'x') {
      version = version + '.x';
    }
  }

  return version;
}

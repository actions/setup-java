import * as core from '@actions/core';
import * as io from '@actions/io';
import * as exec from '@actions/exec';
import * as httpm from '@actions/http-client';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
import * as util from './util';
import * as constants from './constants';
import {DISCO_URL, DISTROS, PACKAGES_PATH} from './constants';

const tempDirectory = util.getTempDir();
const IS_WINDOWS = util.isWindows();

export async function getJava(
  version: string,
  arch: string,
  jdkFile: string,
  javaPackage: string,
  distro: string = 'zulu'
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
      const downloadInfo = await getDownloadInfo(
        refs,
        version,
        arch,
        javaPackage,
        distro
      );
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
    const jdkDirectory = getJdkDirectory(destinationFolder);
    await unpackJars(jdkDirectory, path.join(jdkDirectory, 'bin'));
    return jdkDirectory;
  } else {
    throw new Error(`Jdk argument ${jdkFile} is not a file`);
  }
}

async function getDownloadInfo(
  refs: string[],
  version: string,
  arch: string,
  javaPackage: string,
  distro: string = 'zulu'
): Promise<{version: string; url: string}> {
  const architecture = arch === 'x86' ? 'i686' : 'x64';
  let operatingSystem = '';
  let packageType = '';
  if (javaPackage === 'jdk') {
    packageType = 'jdk';
  } else if (javaPackage === 'jre') {
    packageType = 'jre';
  } else if (javaPackage === 'jdk+fx') {
    packageType = 'jdk+fx';
  } else {
    throw new Error(
      `package argument ${javaPackage} is not in [jdk | jre | jdk+fx]`
    );
  }
  let distribution = '';
  if (distro) {
    if (distro === '') {
      distribution = 'zulu';
    } else if (DISTROS.indexOf(distro.toLowerCase()) > -1) {
      distribution = distro.toLowerCase();
    } else {
      throw new Error(
        `distro argument '${distro}' is not in [aoj | aoj_openj9 | corretto | dragonwell | liberica | microsoft | ojdk_build | openlogic | oracle_openjdk | sap_machine | trava | zulu]`
      );
    }
  } else {
    distribution = 'zulu';
  }
  let archiveType;
  let libcType;
  if (IS_WINDOWS) {
    operatingSystem = 'windows';
    archiveType = 'zip';
    libcType = 'c_std_lib';
  } else {
    if (process.platform === 'darwin') {
      operatingSystem = 'macos';
      let zipArchive =
        distribution === 'liberica' || distribution === 'openlogic';
      archiveType = zipArchive ? 'zip' : 'tar.gz';
      libcType = 'libc';
    } else {
      operatingSystem = 'linux';
      archiveType = distribution === 'ojdk_build' ? 'zip' : 'tar.gz';
      libcType = 'glibc';
    }
  }

  let url = DISCO_URL + PACKAGES_PATH;
  url += '?distro=' + distribution;
  if (version.length != 0) {
    url += '&version=' + version;
  }
  if (javaPackage === 'jdk+fx') {
    url += '&package_type=jdk';
    url += '&javafx_bundled=true';
  } else {
    url += '&package_type=' + packageType;
  }
  if (version.includes('ea')) {
    url += '&release_status=ea';
  }
  url += '&release_status=ga';
  url += '&architecture=' + architecture;
  url += '&operating_system=' + operatingSystem;
  url += '&archive_type=' + archiveType;
  url += '&libc_type=' + libcType;
  if (
    version.includes('x') ||
    version.includes('ea') ||
    version.startsWith('1.')
  ) {
    url += '&latest=overall';
  }

  const http = new httpm.HttpClient('bundles', undefined, {
    allowRetries: true,
    maxRetries: 3
  });
  let json: any = '';

  const response = await http.get(url);
  const statusCode = response.message.statusCode || 0;
  if (statusCode == 200) {
    let body = '';
    try {
      body = await response.readBody();
      json = JSON.parse(body);
    } catch (err) {
      core.debug(`Unable to read body: ${err.message}`);
    }
  } else {
    const message =
      'Unexpected HTTP status code ' +
      response.message.statusCode +
      ' when retrieving versions from ' +
      url;
    throw new Error(message);
  }

  // Choose the most recent satisfying version
  let curVersion = '0.0.0';
  let curUrl = '';
  if (json.length > 0) {
    curVersion = json[0].java_version;
    curUrl = await getPackageFileUrl(json[0].ephemeral_id);
  }

  if (curUrl == '') {
    throw new Error(
      `No valid download found for ${distribution} with version ${version} and package ${packageType}. Please download your own jdk file and add the jdkFile argument`
    );
  }

  return {version: curVersion, url: curUrl};
}

async function getPackageFileUrl(ephemeralId: string) {
  let url: string =
    constants.DISCO_URL + constants.EPHEMERAL_IDS_PATH + '/' + ephemeralId;
  const http = new httpm.HttpClient('bundle-info', undefined, {
    allowRetries: true,
    maxRetries: 3
  });

  const response = await http.get(url);
  const statusCode = response.message.statusCode || 0;
  if (statusCode == 200) {
    let body = '';
    try {
      body = await response.readBody();
      let json = JSON.parse(body);
      return json.direct_download_uri;
    } catch (err) {
      core.debug(`Unable to read body: ${err.message}`);
    }
    const message = `Unexpected HTTP status code '${response.message.statusCode}' when retrieving versions from '${url}'. ${body}`.trim();
    throw new Error(message);
  }
  return '';
}

function getJdkDirectory(destinationFolder: string): string {
  const jdkRoot: string = path.join(
    destinationFolder,
    fs.readdirSync(destinationFolder)[0]
  );
  if (process.platform === 'darwin') {
    const binDirectory: string = path.join(jdkRoot, 'bin');
    if (fs.existsSync(binDirectory)) {
      return jdkRoot;
    } else {
      return path.join(jdkRoot, 'Contents', 'Home');
    }
  } else {
    return jdkRoot;
  }
}

let tempDirectory = process.env['RUNNER_TEMP'] || '';

import * as core from '@actions/core';
import * as io from '@actions/io';
import * as tc from '@actions/tool-cache';
import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';
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

export async function getMaven(
  version: string,
  mavenFile: string,
  mavenMirror: string = 'https://archive.apache.org/dist/maven/maven-3/'
): Promise<void> {
  const toolName = 'maven';
  let toolPath = tc.find(toolName, version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    let compressedFileExtension = '';
    if (!mavenFile) {
      core.debug('Downloading Maven from Apache Mirror');
      let http: httpm.HttpClient = new httpm.HttpClient('spring-build-action');
      let contents = await (await http.get(mavenMirror)).readBody();
      let refs: string[] = [];
      const regex = /<a href=\"\d.*\">([\d\.]+)\/<\/a>/g;
      let match = regex.exec(contents);
      while (match != null) {
        refs.push(match[1]);
        match = regex.exec(contents);
      }
      core.debug(`Found refs ${refs}`);

      const downloadInfo = getDownloadInfo(refs, version, mavenMirror);

      mavenFile = await tc.downloadTool(downloadInfo.url);
      version = downloadInfo.version;
      compressedFileExtension = IS_WINDOWS ? '.zip' : '.tar.gz';
    } else {
      core.debug('Retrieving Maven from local path');
    }
    compressedFileExtension =
      compressedFileExtension || getFileEnding(mavenFile);
    let tempDir: string = path.join(
      tempDirectory,
      'temp_' + Math.floor(Math.random() * 2000000000)
    );
    const mavenDir = await unzipMavenDownload(
      mavenFile,
      compressedFileExtension,
      tempDir
    );
    core.debug(`maven extracted to ${mavenDir}`);
    toolPath = await tc.cacheDir(
      mavenDir,
      toolName,
      getCacheVersionString(version)
    );
  }

  core.exportVariable('M2_HOME', toolPath);
  core.addPath(path.join(toolPath, 'bin'));
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

  if (file.endsWith('.tar.gz')) {
    fileEnding = '.tar.gz';
  } else if (file.endsWith('.zip')) {
    fileEnding = '.zip';
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

  if ('.tar.gz' === fileEnding) {
    await tc.extractTar(file, destinationFolder);
  } else if ('.zip' === fileEnding) {
    await tc.extractZip(file, destinationFolder);
  } else {
    throw new Error(
      `Failed to extract ${file} - only .zip or .tar.gz supported`
    );
  }
}

async function unzipMavenDownload(
  repoRoot: string,
  fileEnding: string,
  destinationFolder: string
): Promise<string> {
  // Create the destination folder if it doesn't exist
  await io.mkdirP(destinationFolder);

  const mavenFile = path.normalize(repoRoot);
  const stats = fs.statSync(mavenFile);
  if (stats.isFile()) {
    await extractFiles(path.resolve(mavenFile), fileEnding, destinationFolder);
    const mavenDirectory = path.join(
      destinationFolder,
      fs.readdirSync(destinationFolder)[0]
    );
    return mavenDirectory;
  } else {
    throw new Error(`Maven argument ${mavenFile} is not a file`);
  }
}

function getDownloadInfo(
  refs: string[],
  version: string,
  mavenMirror: string
): {version: string; url: string} {
  version = normalizeVersion(version);
  let extension = '';
  if (IS_WINDOWS) {
    extension = `.zip`;
  } else {
    extension = `.tar.gz`;
  }

  // Maps version to url
  let versionMap = new Map();

  // Filter by platform
  refs.forEach(ref => {
    if (semver.satisfies(ref, version)) {
      core.debug(`VersionMap add  ${ref} ${version}`);
      versionMap.set(
        ref,
        `${mavenMirror}${ref}/binaries/apache-maven-${ref}-bin${extension}`
      );
    }
  });

  // Choose the most recent satisfying version
  let curVersion = '0.0.0';
  let curUrl = '';
  for (const entry of versionMap.entries()) {
    const entryVersion = entry[0];
    const entryUrl = entry[1];
    core.debug(`VersionMap Entry ${entryVersion} ${entryUrl}`);
    if (semver.gt(entryVersion, curVersion)) {
      core.debug(`VersionMap semver gt ${entryVersion} ${entryUrl}`);
      curUrl = entryUrl;
      curVersion = entryVersion;
    }
  }

  if (curUrl == '') {
    throw new Error(
      `No valid download found for version ${version}. Check ${mavenMirror} for a list of valid versions or download your own maven file and add the mavenFile argument`
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

  if (version.split('.').length < 3) {
    // Add trailing .x if it is missing
    if (version[version.length - 1] != 'x') {
      version = version + '.x';
    }
  }

  return version;
}

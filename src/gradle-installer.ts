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

export async function getGradle(
  version: string,
  gradleFile: string,
  gradleMirror: string = 'https://services.gradle.org/distributions/'
): Promise<void> {
  const toolName = 'gradle';
  let toolPath = tc.find(toolName, version);

  if (toolPath) {
    core.debug(`Tool found in cache ${toolPath}`);
  } else {
    let compressedFileExtension = '';
    if (!gradleFile) {
      core.debug('Downloading Gradle from gradle.org');
      let http: httpm.HttpClient = new httpm.HttpClient('spring-build-action');
      let contents = await (await http.get(gradleMirror)).readBody();
      let refs: string[] = [];
      const regex = /<span class=\"name\">gradle-([\d\.]+)-bin\.zip<\/span>/g;
      let match = regex.exec(contents);
      while (match != null) {
        refs.push(match[1]);
        match = regex.exec(contents);
      }
      core.debug(`Found refs ${refs}`);

      const downloadInfo = getDownloadInfo(refs, version, gradleMirror);

      gradleFile = await tc.downloadTool(downloadInfo.url);
      version = downloadInfo.version;
      compressedFileExtension = '.zip';
    } else {
      core.debug('Retrieving Gradle from local path');
    }
    compressedFileExtension =
      compressedFileExtension || getFileEnding(gradleFile);
    let tempDir: string = path.join(
      tempDirectory,
      'temp_' + Math.floor(Math.random() * 2000000000)
    );
    const gradleDir = await unzipGradleDownload(
      gradleFile,
      compressedFileExtension,
      tempDir
    );
    core.debug(`gradle extracted to ${gradleDir}`);
    toolPath = await tc.cacheDir(
      gradleDir,
      toolName,
      getCacheVersionString(version)
    );
  }

  core.exportVariable('GRADLE_HOME', toolPath);
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

  if (file.endsWith('.zip')) {
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

  if ('.zip' === fileEnding) {
    await tc.extractZip(file, destinationFolder);
  } else {
    throw new Error(`Failed to extract ${file} - only .zip supported`);
  }
}

async function unzipGradleDownload(
  repoRoot: string,
  fileEnding: string,
  destinationFolder: string
): Promise<string> {
  // Create the destination folder if it doesn't exist
  await io.mkdirP(destinationFolder);

  const gradleFile = path.normalize(repoRoot);
  const stats = fs.statSync(gradleFile);
  if (stats.isFile()) {
    await extractFiles(path.resolve(gradleFile), fileEnding, destinationFolder);
    const gradleDirectory = path.join(
      destinationFolder,
      fs.readdirSync(destinationFolder)[0]
    );
    return gradleDirectory;
  } else {
    throw new Error(`Gradle argument ${gradleFile} is not a file`);
  }
}

function getDownloadInfo(
  refs: string[],
  version: string,
  gradleMirror: string
): {version: string; url: string} {
  version = normalizeVersion(version);
  const extension = '.zip';

  // Maps version to url
  let versionMap = new Map();

  // Filter by platform
  refs.forEach(ref => {
    if (semver.satisfies(ref, version)) {
      core.debug(`VersionMap add  ${ref} ${version}`);
      versionMap.set(ref, `${gradleMirror}gradle-${ref}-bin${extension}`);
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
      `No valid download found for version ${version}. Check ${gradleMirror} for a list of valid versions or download your own gradle file and add the gradleFile argument`
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

import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as httpm from '@actions/http-client';
import * as semver from 'semver';

const IS_WINDOWS = process.platform === 'win32';

export async function getJavaZulu(version: string, javaPackage: string) {
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
  const downloadInfo = getDownloadInfo(refs, version, javaPackage);
  const jdkFile = await tc.downloadTool(downloadInfo.url);

  version = downloadInfo.version;
  return [jdkFile, version];
}

function getDownloadInfo(
  refs: string[],
  version: string,
  javaPackage: string
): {version: string; url: string} {
  version = normalizeVersion(version);
  let extension = '';
  if (IS_WINDOWS) {
    extension = `-win_x64.zip`;
  } else {
    if (process.platform === 'darwin') {
      extension = `-macosx_x64.tar.gz`;
    } else {
      extension = `-linux_x64.tar.gz`;
    }
  }

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

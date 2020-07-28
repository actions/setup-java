import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';
import * as httpm from '@actions/http-client';

export async function getJavaAdoptOpenJDK(
  version: string,
  javaPackage: string,
  arch: string
) {
  core.debug('Downloading JDK from AdoptOpenJDK');

  let OS = process.platform.toString();

  switch(process.platform) {
    case 'darwin':
      OS = 'mac';
      break;
  }

  const http = new httpm.HttpClient('setup-java', undefined, {
    allowRetries: true,
    maxRetries: 3
  });

  const url = `https://api.adoptopenjdk.net/v3/assets/version/${normalizeVersion(
    version
  )}?architecture=${arch}&heap_size=normal&image_type=${javaPackage}&jvm_impl=hotspot&os=${OS}&page_size=1&release_type=ga&vendor=adoptopenjdk`;

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

  const parsedContents = JSON.parse(contents)[0];

  // turn 13.0.2+8.1 into 13.0.2
  version = parsedContents.version_data.semver.split('+')[0];

  const jdkFile = await tc.downloadTool(
    parsedContents.binaries[0].package.link
  );
  return [jdkFile, version];
}

function normalizeVersion(version: string): string {
  if (version.slice(0, 2) === '1.') {
    // Trim leading 1. for versions like 1.8
    version = version.slice(2);
    if (!version) {
      throw new Error('1. is not a valid version');
    }
  }
  const parsedVersion = version.split('.');
  let versionNumber: number;
  if (parsedVersion[1]) {
    versionNumber = parseInt(parsedVersion[parsedVersion.length - 1]) + 1;
    version = `%28%2C${version.replace(
      parsedVersion[parsedVersion.length - 1],
      versionNumber.toString()
    )}%29`;
  } else {
    versionNumber = parseInt(version) + 1;
    version = `%28%2C${versionNumber!.toString()}%29`;
  }
  return version;
}

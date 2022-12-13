import os from 'os';
import path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import * as cache from '@actions/cache';
import * as core from '@actions/core';

import * as tc from '@actions/tool-cache';
import { INPUT_JOB_STATUS, DISTRIBUTIONS_ONLY_MAJOR_VERSION } from './constants';

export function getTempDir() {
  let tempDirectory = process.env['RUNNER_TEMP'] || os.tmpdir();

  return tempDirectory;
}

export function getBooleanInput(inputName: string, defaultValue: boolean = false) {
  return (core.getInput(inputName) || String(defaultValue)).toUpperCase() === 'TRUE';
}

export function getVersionFromToolcachePath(toolPath: string) {
  if (toolPath) {
    return path.basename(path.dirname(toolPath));
  }

  return toolPath;
}

export async function extractJdkFile(toolPath: string, extension?: string) {
  if (!extension) {
    extension = toolPath.endsWith('.tar.gz') ? 'tar.gz' : path.extname(toolPath);
    if (extension.startsWith('.')) {
      extension = extension.substring(1);
    }
  }

  switch (extension) {
    case 'tar.gz':
    case 'tar':
      return await tc.extractTar(toolPath);
    case 'zip':
      return await tc.extractZip(toolPath);
    default:
      return await tc.extract7z(toolPath);
  }
}

export function getDownloadArchiveExtension() {
  return process.platform === 'win32' ? 'zip' : 'tar.gz';
}

export function isVersionSatisfies(range: string, version: string): boolean {
  if (semver.valid(range)) {
    // if full version with build digit is provided as a range (such as '1.2.3+4')
    // we should check for exact equal via compareBuild
    // since semver.satisfies doesn't handle 4th digit
    const semRange = semver.parse(range);
    if (semRange && semRange.build?.length > 0) {
      return semver.compareBuild(range, version) === 0;
    }
  }

  return semver.satisfies(version, range);
}

export function getToolcachePath(toolName: string, version: string, architecture: string) {
  const toolcacheRoot = process.env['RUNNER_TOOL_CACHE'] ?? '';
  const fullPath = path.join(toolcacheRoot, toolName, version, architecture);
  if (fs.existsSync(fullPath)) {
    return fullPath;
  }

  return null;
}

export function isJobStatusSuccess() {
  const jobStatus = core.getInput(INPUT_JOB_STATUS);

  return jobStatus === 'success';
}

export function isGhes(): boolean {
  const ghUrl = new URL(process.env['GITHUB_SERVER_URL'] || 'https://github.com');
  return ghUrl.hostname.toUpperCase() !== 'GITHUB.COM';
}

export function isCacheFeatureAvailable(): boolean {
  if (!cache.isFeatureAvailable()) {
    if (isGhes()) {
      throw new Error(
        'Caching is only supported on GHES version >= 3.5. If you are on a version >= 3.5, please check with your GHES admin if the Actions cache service is enabled or not.'
      );
    } else {
      core.warning('The runner was not able to contact the cache service. Caching will be skipped');
    }

    return false;
  }

  return true;
}

export function getVersionFromFileContent(
  content: string,
  distributionName: string
): string | null {
  const javaVersionRegExp = /(?<version>(?<=(^|\s|\-))(\d+\S*))(\s|$)/;
  const fileContent = content.match(javaVersionRegExp)?.groups?.version
    ? (content.match(javaVersionRegExp)?.groups?.version as string)
    : '';
  if (!fileContent) {
    return null;
  }

  core.debug(`Version from file '${fileContent}'`);

  const tentativeVersion = avoidOldNotation(fileContent);
  const rawVersion = tentativeVersion.split('-')[0];

  let version = semver.validRange(rawVersion) ? tentativeVersion : semver.coerce(tentativeVersion);

  core.debug(`Range version from file is '${version}'`);

  if (!version) {
    return null;
  }

  if (DISTRIBUTIONS_ONLY_MAJOR_VERSION.includes(distributionName)) {
    const coerceVersion = semver.coerce(version) ?? version;
    version = semver.major(coerceVersion).toString();
  }

  return version.toString();
}

// By convention, action expects version 8 in the format `8.*` instead of `1.8`
function avoidOldNotation(content: string): string {
  return content.startsWith('1.') ? content.substring(2) : content;
}

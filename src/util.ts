import os from 'os';
import path from 'path';
import * as fs from 'fs';
import * as semver from 'semver';
import * as core from '@actions/core';

import * as tc from '@actions/tool-cache';
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
  const jobStatus = core.getInput('job-status');

  return jobStatus === 'success';
}

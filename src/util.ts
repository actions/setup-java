import os from 'os';
import path from 'path';

import * as tc from '@actions/tool-cache';

export function getTempDir() {
  let tempDirectory = process.env['RUNNER_TEMP'] || os.tmpdir();

  return tempDirectory;
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

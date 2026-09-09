import fs from 'fs';
import {fileURLToPath} from 'url';

export function isMainModule(moduleUrl: string): boolean {
  const entrypoint = process.argv[1];
  if (!entrypoint || entrypoint === '-') {
    return false;
  }

  let entrypointPath: string;
  try {
    entrypointPath = fs.realpathSync(entrypoint);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      (error.code === 'ENOENT' || error.code === 'ENOTDIR')
    ) {
      return false;
    }
    throw error;
  }

  // Resolve both paths for runtimes using --preserve-symlinks-main.
  return entrypointPath === fs.realpathSync(fileURLToPath(moduleUrl));
}

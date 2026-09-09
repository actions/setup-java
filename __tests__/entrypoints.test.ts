import {afterAll, beforeAll, describe, expect, it} from '@jest/globals';
import {spawnSync} from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {fileURLToPath, pathToFileURL} from 'url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
let tempDir: string;
let linkedDist: string;

beforeAll(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-java-entrypoints-'));
  linkedDist = path.join(tempDir, 'linked # dist');
  fs.symlinkSync(dist, linkedDist, 'junction');
});

afterAll(() => {
  fs.rmSync(tempDir, {recursive: true, force: true});
});

function execute(args: string[], input?: string) {
  return spawnSync(process.execPath, args, {
    encoding: 'utf8',
    input,
    timeout: 10000,
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot
    }
  });
}

describe.each([
  ['setup', 1, 'java-version or java-version-file input expected'],
  ['cleanup', 0, '']
] as const)('%s entrypoint', (name, exitCode, output) => {
  it.each(['direct', 'symlink', 'preserved symlink'])(
    'executes through a %s path',
    mode => {
      const entry = path.join(
        mode === 'direct' ? dist : linkedDist,
        name,
        'index.js'
      );
      const args =
        mode === 'preserved symlink'
          ? ['--preserve-symlinks-main', entry]
          : [entry];
      const result = execute(args);

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(exitCode);
      expect(result.stderr).toBe('');
      expect(result.stdout).not.toContain('skipping the execution');
      if (output) {
        expect(result.stdout).toContain(output);
      } else {
        expect(result.stdout).toBe('');
      }
    }
  );

  it.each(['eval', 'stdin', 'file'])(
    'does not execute when imported from %s',
    mode => {
      const moduleUrl = pathToFileURL(path.join(dist, name, 'index.js')).href;
      const source = `const {run} = await import(${JSON.stringify(moduleUrl)}); console.log(typeof run);`;
      const importer = path.join(tempDir, `${name}-importer.mjs`);
      fs.writeFileSync(importer, source);
      const args =
        mode === 'file'
          ? [importer]
          : mode === 'eval'
            ? ['--input-type=module', '-e', source]
            : ['--input-type=module', '-'];
      const result = execute(args, mode === 'stdin' ? source : undefined);

      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stderr).toBe('');
      expect(result.stdout).toContain('skipping the execution');
      expect(result.stdout).toContain('function');
      expect(result.stdout).not.toContain('::error::');
    }
  );
});

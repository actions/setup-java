import {jest, describe, it, expect, beforeEach, afterEach} from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.unstable_mockModule('@actions/core', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
  getInput: jest.fn(() => ''),
  isDebug: jest.fn(() => false),
  addPath: jest.fn(),
  exportVariable: jest.fn(),
  setOutput: jest.fn()
}));

jest.unstable_mockModule('@actions/tool-cache', () => ({
  cacheDir: jest.fn(),
  extractTar: jest.fn(),
  extractZip: jest.fn(),
  extract7z: jest.fn()
}));

jest.unstable_mockModule('@actions/exec', () => ({
  exec: jest.fn()
}));

jest.unstable_mockModule('@actions/io', () => ({
  which: jest.fn(),
  rmRF: jest.fn(async (target: string) =>
    fs.rmSync(target, {recursive: true, force: true})
  ),
  mkdirP: jest.fn(async (target: string) =>
    fs.mkdirSync(target, {recursive: true})
  )
}));

jest.unstable_mockModule('@actions/http-client', () => ({
  HttpClient: jest.fn(),
  HttpClientError: class HttpClientError extends Error {}
}));

const tc = await import('@actions/tool-cache');
const exec = await import('@actions/exec');
const io = await import('@actions/io');
const {
  cacheJdkDir,
  extractJdkFile,
  getArtifactFingerprint,
  getJavaVersionFromReleaseFile
} = await import('../src/util.js');

const originalToolCache = process.env['RUNNER_TOOL_CACHE'];
const originalTemp = process.env['RUNNER_TEMP'];
const originalPlatform = process.platform;

let workDir: string;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true
  });
}

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-java-util-'));
  process.env['RUNNER_TOOL_CACHE'] = path.join(workDir, 'toolcache');
  process.env['RUNNER_TEMP'] = path.join(workDir, 'temp');
  fs.mkdirSync(process.env['RUNNER_TEMP'], {recursive: true});
});

afterEach(() => {
  jest.clearAllMocks();
  setPlatform(originalPlatform);
  while (lockedDirs.length) {
    fs.chmodSync(lockedDirs.pop()!, 0o755);
  }
  fs.rmSync(workDir, {recursive: true, force: true});
  if (originalToolCache === undefined) {
    delete process.env['RUNNER_TOOL_CACHE'];
  } else {
    process.env['RUNNER_TOOL_CACHE'] = originalToolCache;
  }
  if (originalTemp === undefined) {
    delete process.env['RUNNER_TEMP'];
  } else {
    process.env['RUNNER_TEMP'] = originalTemp;
  }
});

function createJdkDir(name = 'jdk-source'): string {
  const sourceDir = path.join(workDir, name);
  fs.mkdirSync(path.join(sourceDir, 'bin'), {recursive: true});
  fs.writeFileSync(path.join(sourceDir, 'bin', 'java'), 'binary');
  fs.writeFileSync(path.join(sourceDir, 'release'), 'JAVA_VERSION="17"');

  return sourceDir;
}

// A rename needs write permission on the source's parent directory, so making
// that parent read-only is a portable way to force the same failure a
// cross-device tool-cache (EXDEV) or a Windows anti-virus handle (EPERM) would.
// Root ignores the permission bits, so those tests are skipped there.
const canForceRenameFailure =
  process.platform !== 'win32' &&
  typeof process.getuid === 'function' &&
  process.getuid() !== 0;
const itUnlessRoot = canForceRenameFailure ? it : it.skip;
const lockedDirs: string[] = [];

function createUnrenameableJdkDir(): string {
  const parent = path.join(workDir, 'locked');
  fs.mkdirSync(parent, {recursive: true});
  const sourceDir = path.join(parent, 'jdk-source');
  fs.mkdirSync(path.join(sourceDir, 'bin'), {recursive: true});
  fs.writeFileSync(path.join(sourceDir, 'bin', 'java'), 'binary');
  fs.chmodSync(parent, 0o555);
  lockedDirs.push(parent);

  return sourceDir;
}

describe('cacheJdkDir', () => {
  it('moves the JDK into the tool-cache instead of copying it', async () => {
    const sourceDir = createJdkDir();

    const javaPath = await cacheJdkDir(
      sourceDir,
      'Java_temurin_jdk',
      '17.0.1',
      'x64'
    );

    expect(javaPath).toBe(
      path.join(
        process.env['RUNNER_TOOL_CACHE']!,
        'Java_temurin_jdk',
        '17.0.1',
        'x64'
      )
    );
    expect(fs.existsSync(path.join(javaPath, 'bin', 'java'))).toBe(true);
    expect(fs.existsSync(path.join(javaPath, 'release'))).toBe(true);
    // the source is moved, not copied, so it no longer exists
    expect(fs.existsSync(sourceDir)).toBe(false);
    expect(tc.cacheDir).not.toHaveBeenCalled();
  });

  it('writes the .complete marker expected by the tool-cache', async () => {
    const javaPath = await cacheJdkDir(
      createJdkDir(),
      'Java_temurin_jdk',
      '17.0.1',
      'x64'
    );

    expect(fs.existsSync(`${javaPath}.complete`)).toBe(true);
  });

  it('replaces an existing tool-cache entry', async () => {
    const destPath = path.join(
      process.env['RUNNER_TOOL_CACHE']!,
      'Java_temurin_jdk',
      '17.0.1',
      'x64'
    );
    fs.mkdirSync(destPath, {recursive: true});
    fs.writeFileSync(path.join(destPath, 'stale'), 'stale');

    const javaPath = await cacheJdkDir(
      createJdkDir(),
      'Java_temurin_jdk',
      '17.0.1',
      'x64'
    );

    expect(fs.existsSync(path.join(javaPath, 'stale'))).toBe(false);
    expect(fs.existsSync(path.join(javaPath, 'bin', 'java'))).toBe(true);
  });

  it('normalizes the version the same way as tc.cacheDir', async () => {
    const javaPath = await cacheJdkDir(
      createJdkDir(),
      'Java_temurin_jdk',
      'v17.0.1',
      'x64'
    );

    expect(path.basename(path.dirname(javaPath))).toBe('17.0.1');
  });

  it('keeps unparseable versions as-is', async () => {
    const javaPath = await cacheJdkDir(
      createJdkDir(),
      'Java_temurin_jdk',
      '17.0.1-ea.3',
      'x64'
    );

    expect(path.basename(path.dirname(javaPath))).toBe('17.0.1-ea.3');
  });

  it('falls back to tc.cacheDir when the move fails', async () => {
    (tc.cacheDir as jest.Mock).mockResolvedValue('/fallback/path' as never);
    const missingDir = path.join(workDir, 'does-not-exist');

    const javaPath = await cacheJdkDir(
      missingDir,
      'Java_temurin_jdk',
      '17.0.1',
      'x64'
    );

    expect(javaPath).toBe('/fallback/path');
    expect(tc.cacheDir).toHaveBeenCalledWith(
      missingDir,
      'Java_temurin_jdk',
      '17.0.1',
      'x64'
    );
  });

  itUnlessRoot(
    'falls back to tc.cacheDir when the rename itself fails',
    async () => {
      const sourceDir = createUnrenameableJdkDir();
      (tc.cacheDir as jest.Mock).mockResolvedValue('/fallback/path' as never);

      await expect(
        cacheJdkDir(sourceDir, 'Java_temurin_jdk', '17.0.1', 'x64')
      ).resolves.toBe('/fallback/path');
      // the source must survive so the copy-based fallback can still read it
      expect(fs.existsSync(path.join(sourceDir, 'bin', 'java'))).toBe(true);
    }
  );

  itUnlessRoot(
    'does not leave a .complete marker behind when the rename fails',
    async () => {
      const destPath = path.join(
        process.env['RUNNER_TOOL_CACHE']!,
        'Java_temurin_jdk',
        '17.0.1',
        'x64'
      );
      fs.mkdirSync(destPath, {recursive: true});
      fs.writeFileSync(`${destPath}.complete`, '');
      (tc.cacheDir as jest.Mock).mockResolvedValue('/fallback/path' as never);

      await cacheJdkDir(
        createUnrenameableJdkDir(),
        'Java_temurin_jdk',
        '17.0.1',
        'x64'
      );

      // a stale marker without a matching installation would make the
      // tool-cache resolve a directory that is no longer there
      expect(fs.existsSync(`${destPath}.complete`)).toBe(false);
    }
  );

  it('falls back to tc.cacheDir for symlinked sources', async () => {
    const realDir = createJdkDir('real-jdk');
    const linkDir = path.join(workDir, 'linked-jdk');
    fs.symlinkSync(realDir, linkDir, 'dir');
    (tc.cacheDir as jest.Mock).mockResolvedValue('/fallback/path' as never);

    await expect(
      cacheJdkDir(linkDir, 'Java_temurin_jdk', '17.0.1', 'x64')
    ).resolves.toBe('/fallback/path');
    // moving the symlink itself would leave a dangling tool-cache entry
    expect(fs.lstatSync(linkDir).isSymbolicLink()).toBe(true);
  });

  it('defaults the architecture the same way as tc.cacheDir', async () => {
    const javaPath = await cacheJdkDir(
      createJdkDir(),
      'Java_temurin_jdk',
      '17.0.1',
      ''
    );

    expect(javaPath).toBe(
      path.join(
        process.env['RUNNER_TOOL_CACHE']!,
        'Java_temurin_jdk',
        '17.0.1',
        os.arch()
      )
    );
  });

  it('falls back to tc.cacheDir when the tool-cache location is unknown', async () => {
    delete process.env['RUNNER_TOOL_CACHE'];
    (tc.cacheDir as jest.Mock).mockResolvedValue('/fallback/path' as never);

    await expect(
      cacheJdkDir(createJdkDir(), 'Java_temurin_jdk', '17.0.1', 'x64')
    ).resolves.toBe('/fallback/path');
  });
});

describe('getJavaVersionFromReleaseFile', () => {
  it.each([
    ['JAVA_RUNTIME_VERSION="21.0.9+7-LTS-123"', '21.0.9+7'],
    ['JAVA_RUNTIME_VERSION="17.0.12+8-jvmci-23.1-b52"', '17.0.12+8'],
    ['JAVA_RUNTIME_VERSION="25+36-LTS"', '25.0.0+36'],
    ['JAVA_VERSION="25.0.1"', '25.0.1'],
    ['JAVA_VERSION="25"', '25.0.0']
  ])('reads a concrete version from %s', (contents, expected) => {
    const javaHome = createJdkDir();
    fs.writeFileSync(path.join(javaHome, 'release'), contents);

    expect(getJavaVersionFromReleaseFile(javaHome)).toBe(expected);
  });

  it('reads the macOS Contents/Home release file', () => {
    const javaHome = path.join(workDir, 'macos-jdk');
    fs.mkdirSync(path.join(javaHome, 'Contents', 'Home'), {recursive: true});
    fs.writeFileSync(
      path.join(javaHome, 'Contents', 'Home', 'release'),
      'JAVA_RUNTIME_VERSION="21.0.9+7-LTS"'
    );

    expect(getJavaVersionFromReleaseFile(javaHome)).toBe('21.0.9+7');
  });

  it('fails when the JDK release metadata has no usable version', () => {
    const javaHome = createJdkDir();
    fs.writeFileSync(path.join(javaHome, 'release'), 'IMPLEMENTOR="Oracle"');

    expect(() => getJavaVersionFromReleaseFile(javaHome)).toThrow(
      /Unable to determine the installed Java version/
    );
  });
});

describe('extractJdkFile', () => {
  it('uses pigz for tarballs when it is available', async () => {
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/pigz' as never);
    (tc.extractTar as jest.Mock).mockResolvedValue('/extracted' as never);

    await expect(extractJdkFile('/tmp/jdk.tar.gz')).resolves.toBe('/extracted');
    expect(tc.extractTar).toHaveBeenCalledWith(
      '/tmp/jdk.tar.gz',
      expect.stringContaining(process.env['RUNNER_TEMP']!),
      ['--use-compress-program', '/usr/bin/pigz -d', '-x']
    );
  });

  it('falls back to gzip when pigz is not installed', async () => {
    (io.which as jest.Mock).mockResolvedValue('' as never);
    (tc.extractTar as jest.Mock).mockResolvedValue('/extracted' as never);

    await expect(extractJdkFile('/tmp/jdk.tar.gz')).resolves.toBe('/extracted');
    expect(tc.extractTar).toHaveBeenCalledWith('/tmp/jdk.tar.gz');
  });

  it('falls back to gzip when pigz extraction fails', async () => {
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/pigz' as never);
    (tc.extractTar as jest.Mock)
      .mockRejectedValueOnce(new Error('pigz exploded') as never)
      .mockResolvedValue('/extracted' as never);

    await expect(extractJdkFile('/tmp/jdk.tar.gz')).resolves.toBe('/extracted');
    expect(tc.extractTar).toHaveBeenNthCalledWith(2, '/tmp/jdk.tar.gz');
  });

  it('cleans up the abandoned folder when pigz extraction fails', async () => {
    (io.which as jest.Mock).mockResolvedValue('/usr/bin/pigz' as never);
    let pigzDest: string | undefined;
    (tc.extractTar as jest.Mock)
      .mockImplementationOnce((...args: unknown[]) => {
        pigzDest = args[1] as string;
        throw new Error('pigz exploded');
      })
      .mockResolvedValue('/extracted' as never);

    await extractJdkFile('/tmp/jdk.tar.gz');

    expect(pigzDest).toBeDefined();
    expect(fs.existsSync(pigzDest!)).toBe(false);
  });

  it('ignores pigz when its path contains whitespace', async () => {
    (io.which as jest.Mock).mockResolvedValue(
      'C:\\Program Files\\pigz.exe' as never
    );
    (tc.extractTar as jest.Mock).mockResolvedValue('/extracted' as never);

    await extractJdkFile('/tmp/jdk.tar.gz');

    // tar word-splits --use-compress-program, so a spaced path is unusable
    expect(tc.extractTar).toHaveBeenCalledWith('/tmp/jdk.tar.gz');
  });

  it('leaves uncompressed tarballs on the default extraction path', async () => {
    (tc.extractTar as jest.Mock).mockResolvedValue('/extracted' as never);

    await expect(extractJdkFile('/tmp/jdk.tar')).resolves.toBe('/extracted');
    expect(tc.extractTar).toHaveBeenCalledWith('/tmp/jdk.tar');
    expect(io.which).not.toHaveBeenCalled();
  });

  it('uses the bundled tar.exe for zip archives on Windows', async () => {
    setPlatform('win32');
    const systemRoot = path.join(workDir, 'Windows');
    fs.mkdirSync(path.join(systemRoot, 'System32'), {recursive: true});
    const systemTar = path.join(systemRoot, 'System32', 'tar.exe');
    fs.writeFileSync(systemTar, '');
    process.env['SystemRoot'] = systemRoot;

    const javaPath = await extractJdkFile('/tmp/jdk.zip');

    expect(tc.extractZip).not.toHaveBeenCalled();
    expect(exec.exec).toHaveBeenCalledWith(
      `"${systemTar}"`,
      ['-xf', '/tmp/jdk.zip', '-C', javaPath],
      {silent: true}
    );
    expect(fs.existsSync(javaPath)).toBe(true);
  });

  it('falls back to tc.extractZip when tar.exe fails', async () => {
    setPlatform('win32');
    const systemRoot = path.join(workDir, 'Windows');
    fs.mkdirSync(path.join(systemRoot, 'System32'), {recursive: true});
    fs.writeFileSync(path.join(systemRoot, 'System32', 'tar.exe'), '');
    process.env['SystemRoot'] = systemRoot;
    let tarDest: string | undefined;
    (exec.exec as jest.Mock).mockImplementation((...args: unknown[]) => {
      tarDest = (args[1] as string[])[3];
      throw new Error('boom');
    });
    (tc.extractZip as jest.Mock).mockResolvedValue('/extracted' as never);

    await expect(extractJdkFile('/tmp/jdk.zip')).resolves.toBe('/extracted');
    expect(tarDest).toBeDefined();
    expect(fs.existsSync(tarDest!)).toBe(false);
  });

  it('uses tc.extractZip on non-Windows platforms', async () => {
    setPlatform('linux');
    (tc.extractZip as jest.Mock).mockResolvedValue('/extracted' as never);

    await expect(extractJdkFile('/tmp/jdk.zip')).resolves.toBe('/extracted');
    expect(exec.exec).not.toHaveBeenCalled();
  });
});

describe('getArtifactFingerprint', () => {
  it('prefers the ETag over the other validators', () => {
    expect(
      getArtifactFingerprint({
        etag: '"abc123"',
        'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
        'content-length': '195000000'
      })
    ).toBe('etag:"abc123"');
  });

  it('combines the last-modified date and the content length without an ETag', () => {
    expect(
      getArtifactFingerprint({
        'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
        'content-length': '195000000'
      })
    ).toBe('mtime:Wed, 21 Oct 2026 07:28:00 GMT;length:195000000');
  });

  it.each([
    ['no validators', {}],
    [
      'only a last-modified date',
      {'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT'}
    ],
    ['only a content length', {'content-length': '195000000'}],
    [
      'blank validators',
      {etag: '   ', 'last-modified': '', 'content-length': ''}
    ],
    ['missing headers', undefined]
  ])('returns undefined for %s', (_label, headers) => {
    expect(getArtifactFingerprint(headers)).toBeUndefined();
  });

  it('uses the first value of a repeated header', () => {
    expect(getArtifactFingerprint({etag: ['"first"', '"second"'] as any})).toBe(
      'etag:"first"'
    );
  });

  it('distinguishes a republished artifact from the previous one', () => {
    const before = getArtifactFingerprint({
      'last-modified': 'Wed, 21 Oct 2026 07:28:00 GMT',
      'content-length': '195000000'
    });
    const after = getArtifactFingerprint({
      'last-modified': 'Thu, 22 Oct 2026 09:03:00 GMT',
      'content-length': '195400000'
    });

    expect(before).not.toBe(after);
  });
});

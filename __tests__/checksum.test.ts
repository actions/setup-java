import {afterEach, describe, expect, it, jest} from '@jest/globals';
import {createHash} from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {calculateChecksum, verifyChecksum} from '../src/checksum.js';
import type {ChecksumMetadata} from '../src/distributions/base-models.js';

const temporaryPaths: string[] = [];

async function temporaryFile(contents: string): Promise<string> {
  const directory = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'setup-java-checksum-')
  );
  const file = path.join(directory, 'archive');
  await fs.promises.writeFile(file, contents);
  temporaryPaths.push(directory);
  return file;
}

afterEach(async () => {
  await Promise.all(
    temporaryPaths
      .splice(0)
      .map(item => fs.promises.rm(item, {recursive: true, force: true}))
  );
  jest.restoreAllMocks();
});

describe('verifyChecksum', () => {
  it.each(['sha256', 'sha512'] as const)(
    'verifies a matching %s digest',
    async algorithm => {
      const contents = `jdk archive for ${algorithm}`;
      const file = await temporaryFile(contents);
      const value = createHash(algorithm).update(contents).digest('hex');

      await expect(
        verifyChecksum(
          file,
          {algorithm, value: value.toUpperCase()},
          {distribution: 'Test', version: '21.0.1'}
        )
      ).resolves.toBeUndefined();
    }
  );

  it('reports mismatch context and both digests', async () => {
    const file = await temporaryFile('corrupt archive');
    const expected = 'a'.repeat(64);
    const actual = await calculateChecksum(file, 'sha256');

    await expect(
      verifyChecksum(
        file,
        {algorithm: 'sha256', value: expected},
        {distribution: 'Corretto', version: '21.0.8'}
      )
    ).rejects.toThrow(
      `Checksum verification failed for Corretto version 21.0.8: sha256 expected ${expected}, actual ${actual}.`
    );
  });

  it('rejects malformed digest metadata before reading the file', async () => {
    await expect(
      verifyChecksum(
        '/missing/archive',
        {algorithm: 'sha512', value: 'not-a-digest'},
        {distribution: 'Test', version: '17'}
      )
    ).rejects.toThrow(
      'Malformed sha512 checksum metadata: expected a 128-character hexadecimal digest.'
    );
  });

  it('rejects unsupported algorithms without leaking source query parameters', async () => {
    const checksum = {
      algorithm: 'md5',
      value: 'a'.repeat(32),
      source: 'https://vendor.example/checksum.txt?token=secret-value#private'
    } as unknown as ChecksumMetadata;

    let message = '';
    try {
      await verifyChecksum('/missing/archive', checksum, {
        distribution: 'Test',
        version: '17'
      });
    } catch (error) {
      message = (error as Error).message;
    }

    expect(message).toContain(
      "Unsupported checksum algorithm 'md5' from https://vendor.example/checksum.txt"
    );
    expect(message).not.toContain('secret-value');
    expect(message).not.toContain('token=');
    expect(message).not.toContain('#private');
  });

  it('surfaces file read errors', async () => {
    await expect(
      verifyChecksum(
        '/missing/archive',
        {algorithm: 'sha256', value: 'a'.repeat(64)},
        {distribution: 'Test', version: '17'}
      )
    ).rejects.toMatchObject({code: 'ENOENT'});
  });
});

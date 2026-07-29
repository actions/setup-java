import {createHash, timingSafeEqual} from 'crypto';
import {createReadStream} from 'fs';
import {pipeline} from 'stream/promises';

import {ChecksumMetadata} from './distributions/base-models.js';

export interface ChecksumVerificationContext {
  distribution: string;
  version: string;
}

function sanitizedSource(source: string | undefined): string {
  if (!source) {
    return '';
  }

  try {
    const url = new URL(source);
    return ` from ${url.origin}${url.pathname}`;
  } catch {
    return ' from an invalid checksum source';
  }
}

// Length, in hex characters, of a digest produced by each supported algorithm.
// Exported so callers (e.g. fetchChecksum) can infer which algorithm a vendor
// actually used when it doesn't disclose it via the checksum URL/filename.
export function expectedDigestLength(
  algorithm: ChecksumMetadata['algorithm']
): number {
  return algorithm === 'sha256' ? 64 : algorithm === 'sha512' ? 128 : 0;
}

function normalizeExpectedDigest(checksum: ChecksumMetadata): string {
  const algorithm = checksum.algorithm;
  const digest =
    typeof checksum.value === 'string'
      ? checksum.value.trim().toLowerCase()
      : '';
  const expectedLength = expectedDigestLength(algorithm);

  if (expectedLength === 0) {
    throw new Error(
      `Unsupported checksum algorithm '${String(algorithm)}'${sanitizedSource(checksum.source)}. Supported algorithms are sha256 and sha512.`
    );
  }

  if (!new RegExp(`^[a-f0-9]{${expectedLength}}$`).test(digest)) {
    throw new Error(
      `Malformed ${algorithm} checksum metadata${sanitizedSource(checksum.source)}: expected a ${expectedLength}-character hexadecimal digest.`
    );
  }

  return digest;
}

export async function calculateChecksum(
  filePath: string,
  algorithm: ChecksumMetadata['algorithm']
): Promise<string> {
  const hash = createHash(algorithm);
  await pipeline(createReadStream(filePath), hash);
  return hash.digest('hex');
}

export async function verifyChecksum(
  filePath: string,
  checksum: ChecksumMetadata,
  context: ChecksumVerificationContext
): Promise<void> {
  const expected = normalizeExpectedDigest(checksum);
  const actual = await calculateChecksum(filePath, checksum.algorithm);
  const matches = timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(actual, 'hex')
  );

  if (!matches) {
    throw new Error(
      `Checksum verification failed for ${context.distribution} version ${context.version}: ${checksum.algorithm} expected ${expected}, actual ${actual}.`
    );
  }
}

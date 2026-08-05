export interface JavaInstallerOptions {
  version: string;
  architecture: string;
  packageType: string;
  checkLatest: boolean;
  forceDownload?: boolean;
  cacheJdk?: boolean;
  setDefault?: boolean;
  verifySignature?: boolean;
  verifySignaturePublicKey?: string;
}

export interface JavaInstallerResults {
  version: string;
  path: string;
}

export type ChecksumAlgorithm = 'sha256' | 'sha512';

export interface ChecksumMetadata {
  algorithm: ChecksumAlgorithm;
  value: string;
  source?: string;
}

export interface JavaDownloadRelease {
  version: string;
  url: string;
  signatureUrl?: string;
  checksum?: ChecksumMetadata;
  /**
   * Whether `url` points at a location whose contents change over time, such as
   * a vendor's `/latest/` path. The URL and its checksum are only consistent
   * with each other at the moment they are resolved, so such a release must not
   * be reused by a later job.
   */
  floating?: boolean;
  /**
   * Validator identifying the exact bytes a mutable `url` currently serves,
   * derived from the response headers of the HEAD request that resolved it.
   * Used as the cache identity for a floating release when the vendor
   * publishes no checksum, so that a republished artifact produces a different
   * identity instead of being masked by the constant URL.
   */
  fingerprint?: string;
}

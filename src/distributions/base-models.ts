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
}

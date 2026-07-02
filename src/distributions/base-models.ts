export interface JavaInstallerOptions {
  version: string;
  architecture: string;
  packageType: string;
  checkLatest: boolean;
  verifySignature?: boolean;
  verifySignaturePublicKey?: string;
}

export interface JavaInstallerResults {
  version: string;
  path: string;
}

export interface JavaDownloadRelease {
  version: string;
  url: string;
  signatureUrl?: string;
}

export interface JavaInstallerOptions {
  version: string;
  architecture: string;
  packageType: string;
  jmod?: boolean;
  checkLatest: boolean;
  forceDownload?: boolean;
  setDefault?: boolean;
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

export interface JavaInstallerOptions {
  version: string;
  architecture: string;
  packageType: string;
  checkLatest: boolean;
  remoteRepositoryBaseUrl?: string;
  replaceDownloadLinkBaseUrl?: string;
  downloadLinkContext?: string;
}

export interface JavaInstallerResults {
  version: string;
  path: string;
}

export interface JavaDownloadRelease {
  version: string;
  url: string;
}

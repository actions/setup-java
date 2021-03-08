export interface JavaInstallerOptions {
  version: string;
  arch: string;
  packageType: string;
}

export interface JavaInstallerResults {
  version: string;
  path: string;
}

export interface JavaDownloadRelease {
  version: string;
  url: string;
}

export interface IKonaReleaseInfo {
  [majorVersion: string]: {
    version: string;
    jdkVersion: string;
    latest: boolean;

    baseUrl: string;
    files: {
      os: string; // linux, macos, windows
      arch: string; // x86_64, aarch64

      filename: string;
      checksum: string;
    }[];
  }[];
}

export interface IKonaRelease {
  version: string;
  jdkVersion: string;
  os: string; // linux, macos, windows
  arch: string; // x86_64, aarch64
  downloadUrl: string;
  checksum: string; // SHA-256 digest
}

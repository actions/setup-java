export type OsVersions = 'linux' | 'macos' | 'windows';
export type ArchiveType = 'tar.gz' | 'zip';

export interface PlatformOptions {
  archive: ArchiveType;
  os: OsVersions;
}

export interface MicrosoftVersion {
  downloadUrl?: string;
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  fullVersion: string;
}

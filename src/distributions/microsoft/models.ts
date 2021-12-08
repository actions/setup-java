type OsVersions = 'linux' | 'macos' | 'windows';
type ArchiveType = 'tar.gz' | 'zip';

export interface PlatformOptions {
  archive: ArchiveType;
  os: OsVersions;
}

export interface MicrosoftVersion {
  downloadUrl?: string;
  version: Array<number>;
}

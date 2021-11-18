export type Bitness = '32' | '64';
export type ArchType = 'arm' | 'ppc' | 'sparc' | 'x86';

export type OsVersions = 'linux' | 'linux-musl' | 'macos' | 'solaris' | 'windows';

export interface ArchitectureOptions {
  bitness: Bitness;
  arch: ArchType;
}

export interface MicrosoftVersion {
  downloadUrl?: string;
  majorVersion: number;
  minorVersion: number;
  patchVersion: number;
  fullVersion: string;
}

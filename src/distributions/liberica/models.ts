// Models from https://api.bell-sw.com/api.html

export type Bitness = '32' | '64';
export type ArchType = 'arm' | 'ppc' | 'sparc' | 'x86';

export type OsVersions =
  | 'linux'
  | 'linux-musl'
  | 'macos'
  | 'solaris'
  | 'windows';

export interface ArchitectureOptions {
  bitness: Bitness;
  arch: ArchType;
}

export interface LibericaVersion {
  downloadUrl: string;
  version: string;
  featureVersion: number;
  interimVersion: number;
  updateVersion: number;
  buildVersion: number;
}

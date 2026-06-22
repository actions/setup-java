export type OsVersions = 'linux' | 'macos' | 'windows';

export interface GraalVMEAFile {
  filename: string;
  arch: 'aarch64' | 'x64';
  platform: 'darwin' | 'linux' | 'windows';
}

export interface GraalVMEAVersion {
  version: string;
  latest?: boolean;
  download_base_url: string;
  files: GraalVMEAFile[];
}

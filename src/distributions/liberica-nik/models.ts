// Models from https://api.bell-sw.com/api.html (NIK product)

export type Bitness = '32' | '64';
export type ArchType = 'arm' | 'ppc' | 'sparc' | 'x86';

export type OsVersions = 'linux' | 'linux-musl' | 'macos' | 'windows';

export interface ArchitectureOptions {
  bitness: Bitness;
  arch: ArchType;
}

export interface NikComponent {
  component: string;
  version: string;
  embedded?: boolean;
}

export interface NikVersion {
  // The main Liberica NIK VM bundle download URL.
  downloadUrl: string;
  // NIK/GraalVM version (e.g. '24.1.0+1'), kept for logging only.
  version: string;
  // The embedded `liberica` component carries the actual JDK version.
  components: NikComponent[];
}

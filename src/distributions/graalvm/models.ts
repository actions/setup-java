// Models from https://docs.github.com/en/rest/reference/releases#list-releases

export interface IGithubAsset {
  name: string;
  url: string;
}

export interface IGithubRelease {
  name: string;
  tag_name: string;
  draft: boolean;
  prereleaes: boolean;
  assets: IGithubAsset[];
}

export type GraalAssetType = 'jvm' | 'espresso' | 'llvm-toolchain' | 'native-image' | 'wasm';

export type GraalPlatform = 'darwin' | 'linux' | 'windows';

export type GraalArchitecture = 'amd64' | 'aarch64';

export interface IGraalAsset {
  type: GraalAssetType;
  javaVersion: string;
  graalVersion: string;
  platform: GraalPlatform;
  arch: GraalArchitecture;
  url: string;
}

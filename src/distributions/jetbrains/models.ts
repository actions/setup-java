// Raw Model from https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases

export interface IJetBrainsRawVersion {
  tag_name: string;
  name: string;
  prerelease: boolean;
}

export interface IJetBrainsVersion {
  tag_name: string;
  semver: string;
  build: string;
  url: string;
}

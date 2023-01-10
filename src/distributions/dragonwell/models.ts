export interface IDragonwellAllVersions {
  [major: string]: {
    [jdk_version: string]: {
      [os: string]: {
        [arch: string]: {
          [edition: string]: {
            content_type: string;
            sha256: string;
            name: string;
            download_url: string;
          };
        };
      };
    };
  };
}

export interface IDragonwellVersions {
  os: string;
  architecture: string;
  jdk_version: string;
  checksum: string;
  download_link: string;
  edition: string;
  image_type: string;
}

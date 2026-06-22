export interface ISapMachineAllVersions {
  [major: string]: {
    lts: string;
    updates: {
      [full_version: string]: {
        [sapmachineBuild: string]: {
          release_url: string;
          ea: string;
          assets: {
            [packageType: string]: {
              [arch: string]: {
                [content_type: string]: {
                  name: string;
                  checksum: string;
                  url: string;
                };
              };
            };
          };
        };
      };
    };
  };
}

export interface ISapMachineVersions {
  os: string;
  architecture: string;
  version: string;
  checksum: string;
  downloadLink: string;
  packageType: string;
}

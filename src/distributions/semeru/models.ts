export interface ISemeruAvailableVersions {
  binaries: [
    {
      architecture: string;
      heap_size: string;
      image_type: string;
      jvm_impl: string;
      os: string;
      package: {
        checksum: string;
        checksum_link: string;
        download_count: number;
        link: string;
        metadata_link: string;
        name: string;
        size: string;
      };
      project: string;
      scm_ref: string;
      updated_at: string;
    }
  ];
  id: string;
  release_link: string;
  release_name: string;
  release_type: string;
  vendor: string;
  version_data: {
    build: number;
    major: number;
    minor: number;
    openjdk_version: string;
    security: string;
    semver: string;
  };
}

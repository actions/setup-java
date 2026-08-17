export interface IDiscoPackage {
  id: string;
  archive_type: string;
  distribution: string;
  java_version: string;
  release_status: string;
  operating_system: string;
  architecture: string;
  package_type: string;
  directly_downloadable: boolean;
}

export interface IDiscoPackageListResponse {
  result: IDiscoPackage[];
  message: string;
}

export interface IDiscoPackageDetails {
  filename: string;
  direct_download_uri: string;
  checksum: string;
  checksum_type: string;
}

export interface IDiscoPackageDetailsResponse {
  result: IDiscoPackageDetails[];
  message: string;
}

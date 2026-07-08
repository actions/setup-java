// Models from https://app.swaggerhub.com/apis/azul/metadata/1.0

export interface IZuluVersions {
  package_uuid: string;
  name: string;
  download_url: string;
  java_version: Array<number>;
  distro_version: Array<number>;
  openjdk_build_number: number;
  latest: boolean;
  availability_type: string;
}

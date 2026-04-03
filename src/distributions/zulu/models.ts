// Models from https://api.azul.com/metadata/v1/docs/swagger (metadata API v1)

export interface IZuluVersions {
  package_uuid: string;
  name: string;
  download_url: string;
  java_version: Array<number>;
  distro_version: Array<number>;
  availability_type: string;
  javafx_bundled: boolean;
  crac_supported?: boolean;
}

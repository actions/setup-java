// Models from https://app.swaggerhub.com/apis-docs/azul/zulu-download-community/1.0

export interface IZuluVersions {
  id: number;
  name: string;
  url: string;
  jdk_version: Array<number>;
  zulu_version: Array<number>;
}

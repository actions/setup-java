import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

export async function getJavaAdoptOpenJDK(
  version: string,
  javaPackage: string,
  arch: string,
  OS: string
) {
  core.debug('Downloading JDK from AdoptOpenJDK');

  const jdkFile = await tc.downloadTool(
    `https://api.adoptopenjdk.net/v3/binary/latest/${normalize(
      version
    )}/ga/${OS}/${arch}/${javaPackage}/hotspot/normal/adoptopenjdk`
  );
  return [jdkFile, version];
}

function normalize(version: string): string {
  if (version == '1.8') return '8';
  return version;
}
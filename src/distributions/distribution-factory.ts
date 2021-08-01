import { JavaBase } from './base-installer';
import { JavaInstallerOptions } from './base-models';
import { LocalDistribution } from './local/installer';
import { ZuluDistribution } from './zulu/installer';
import { AdoptDistribution, AdoptImplementation } from './adopt/installer';
import { TemurinDistribution, TemurinImplementation } from './temurin/installer';

enum JavaDistribution {
  Adopt = 'adopt',
  AdoptHotspot = 'adopt-hotspot',
  AdoptOpenJ9 = 'adopt-openj9',
  Temurin = 'temurin',
  Zulu = 'zulu',
  JdkFile = 'jdkfile'
}

export function getJavaDistribution(
  distributionName: string,
  installerOptions: JavaInstallerOptions,
  jdkFile?: string
): JavaBase | null {
  switch (distributionName) {
    case JavaDistribution.JdkFile:
      return new LocalDistribution(installerOptions, jdkFile);
    case JavaDistribution.Adopt:
    case JavaDistribution.AdoptHotspot:
      return new AdoptDistribution(installerOptions, AdoptImplementation.Hotspot);
    case JavaDistribution.AdoptOpenJ9:
      return new AdoptDistribution(installerOptions, AdoptImplementation.OpenJ9);
    case JavaDistribution.Temurin:
      return new TemurinDistribution(installerOptions, TemurinImplementation.Hotspot);
    case JavaDistribution.Zulu:
      return new ZuluDistribution(installerOptions);
    default:
      return null;
  }
}

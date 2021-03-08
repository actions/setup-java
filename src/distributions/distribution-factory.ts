import { AdoptiumDistribution } from './adoptium/installer';
import { JavaBase } from './base-installer';
import { JavaInstallerOptions } from './base-models';
import { LocalDistribution } from './local/installer';
import { ZuluDistribution } from './zulu/installer';

enum JavaDistribution {
  Adoptium = 'adoptium',
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
    case JavaDistribution.Adoptium:
      return new AdoptiumDistribution(installerOptions);
    case JavaDistribution.Zulu:
      return new ZuluDistribution(installerOptions);
    default:
      return null;
  }
}

import {JavaBase} from './base-installer.js';
import {JavaInstallerOptions} from './base-models.js';
import {LocalDistribution} from './local/installer.js';
import {ZuluDistribution} from './zulu/installer.js';
import {AdoptDistribution, AdoptImplementation} from './adopt/installer.js';
import {
  TemurinDistribution,
  TemurinImplementation
} from './temurin/installer.js';
import {LibericaDistributions} from './liberica/installer.js';
import {LibericaNikDistributions} from './liberica-nik/installer.js';
import {MicrosoftDistributions} from './microsoft/installer.js';
import {SemeruDistribution} from './semeru/installer.js';
import {CorrettoDistribution} from './corretto/installer.js';
import {OracleDistribution} from './oracle/installer.js';
import {DragonwellDistribution} from './dragonwell/installer.js';
import {SapMachineDistribution} from './sapmachine/installer.js';
import {
  GraalVMCommunityDistribution,
  GraalVMDistribution
} from './graalvm/installer.js';
import {JetBrainsDistribution} from './jetbrains/installer.js';
import {KonaDistribution} from './kona/installer.js';

enum JavaDistribution {
  Adopt = 'adopt',
  AdoptHotspot = 'adopt-hotspot',
  AdoptOpenJ9 = 'adopt-openj9',
  Temurin = 'temurin',
  Zulu = 'zulu',
  Liberica = 'liberica',
  LibericaNik = 'liberica-nik',
  JdkFile = 'jdkfile',
  Microsoft = 'microsoft',
  Semeru = 'semeru',
  Corretto = 'corretto',
  Oracle = 'oracle',
  Dragonwell = 'dragonwell',
  SapMachine = 'sapmachine',
  GraalVM = 'graalvm',
  GraalVMCommunity = 'graalvm-community',
  JetBrains = 'jetbrains',
  Kona = 'kona'
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
      return new AdoptDistribution(
        installerOptions,
        AdoptImplementation.Hotspot
      );
    case JavaDistribution.AdoptOpenJ9:
      return new AdoptDistribution(
        installerOptions,
        AdoptImplementation.OpenJ9
      );
    case JavaDistribution.Temurin:
      return new TemurinDistribution(
        installerOptions,
        TemurinImplementation.Hotspot
      );
    case JavaDistribution.Zulu:
      return new ZuluDistribution(installerOptions);
    case JavaDistribution.Liberica:
      return new LibericaDistributions(installerOptions);
    case JavaDistribution.LibericaNik:
      return new LibericaNikDistributions(installerOptions);
    case JavaDistribution.Microsoft:
      return new MicrosoftDistributions(installerOptions);
    case JavaDistribution.Semeru:
      return new SemeruDistribution(installerOptions);
    case JavaDistribution.Corretto:
      return new CorrettoDistribution(installerOptions);
    case JavaDistribution.Oracle:
      return new OracleDistribution(installerOptions);
    case JavaDistribution.Dragonwell:
      return new DragonwellDistribution(installerOptions);
    case JavaDistribution.SapMachine:
      return new SapMachineDistribution(installerOptions);
    case JavaDistribution.GraalVM:
      return new GraalVMDistribution(installerOptions);
    case JavaDistribution.GraalVMCommunity:
      return new GraalVMCommunityDistribution(installerOptions);
    case JavaDistribution.JetBrains:
      return new JetBrainsDistribution(installerOptions);
    case JavaDistribution.Kona:
      return new KonaDistribution(installerOptions);
    default:
      return null;
  }
}

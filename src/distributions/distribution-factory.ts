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
import {OpenJdkDistribution} from './openjdk/installer.js';
import {JavaDistribution, validateJavaPackage} from './package-types.js';
import os from 'os';
import {validateJavaPlatform} from './platform-types.js';

export function getJavaDistribution(
  distributionName: string,
  installerOptions: JavaInstallerOptions,
  jdkFile?: string
): JavaBase | null {
  validateJavaPackage(
    distributionName,
    installerOptions.packageType,
    installerOptions.version
  );
  const architecture = validateJavaPlatform(
    distributionName,
    process.platform,
    installerOptions.architecture || os.arch(),
    installerOptions.version
  );
  const normalizedInstallerOptions = {
    ...installerOptions,
    architecture
  };

  switch (distributionName) {
    case JavaDistribution.JdkFile:
      return new LocalDistribution(normalizedInstallerOptions, jdkFile);
    case JavaDistribution.Adopt:
    case JavaDistribution.AdoptHotspot:
      return new AdoptDistribution(
        normalizedInstallerOptions,
        AdoptImplementation.Hotspot
      );
    case JavaDistribution.AdoptOpenJ9:
      return new AdoptDistribution(
        normalizedInstallerOptions,
        AdoptImplementation.OpenJ9
      );
    case JavaDistribution.Temurin:
      return new TemurinDistribution(
        normalizedInstallerOptions,
        TemurinImplementation.Hotspot
      );
    case JavaDistribution.Zulu:
      return new ZuluDistribution(normalizedInstallerOptions);
    case JavaDistribution.Liberica:
      return new LibericaDistributions(normalizedInstallerOptions);
    case JavaDistribution.LibericaNik:
      return new LibericaNikDistributions(normalizedInstallerOptions);
    case JavaDistribution.Microsoft:
      return new MicrosoftDistributions(normalizedInstallerOptions);
    case JavaDistribution.Semeru:
      return new SemeruDistribution(normalizedInstallerOptions);
    case JavaDistribution.Corretto:
      return new CorrettoDistribution(normalizedInstallerOptions);
    case JavaDistribution.Oracle:
      return new OracleDistribution(normalizedInstallerOptions);
    case JavaDistribution.Dragonwell:
      return new DragonwellDistribution(normalizedInstallerOptions);
    case JavaDistribution.SapMachine:
      return new SapMachineDistribution(normalizedInstallerOptions);
    case JavaDistribution.GraalVM:
      return new GraalVMDistribution(normalizedInstallerOptions);
    case JavaDistribution.GraalVMCommunity:
      return new GraalVMCommunityDistribution(normalizedInstallerOptions);
    case JavaDistribution.JetBrains:
      return new JetBrainsDistribution(normalizedInstallerOptions);
    case JavaDistribution.Kona:
      return new KonaDistribution(normalizedInstallerOptions);
    case JavaDistribution.OracleOpenJdk:
      return new OpenJdkDistribution(normalizedInstallerOptions);
    default:
      return null;
  }
}

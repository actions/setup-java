import {JavaBase} from './base-installer.js';
import {JavaInstallerOptions} from './base-models.js';
import {JavaDistribution, validateJavaPackage} from './package-types.js';
import os from 'os';
import {validateJavaPlatform} from './platform-types.js';

export async function getJavaDistribution(
  distributionName: string,
  installerOptions: JavaInstallerOptions,
  jdkFile?: string
): Promise<JavaBase | null> {
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
    case JavaDistribution.JdkFile: {
      const {LocalDistribution} = await import('./local/installer.js');
      return new LocalDistribution(normalizedInstallerOptions, jdkFile);
    }
    case JavaDistribution.Temurin: {
      const {TemurinDistribution, TemurinImplementation} =
        await import('./temurin/installer.js');
      return new TemurinDistribution(
        normalizedInstallerOptions,
        TemurinImplementation.Hotspot
      );
    }
    case JavaDistribution.Zulu: {
      const {ZuluDistribution} = await import('./zulu/installer.js');
      return new ZuluDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.Liberica: {
      const {LibericaDistributions} = await import('./liberica/installer.js');
      return new LibericaDistributions(normalizedInstallerOptions);
    }
    case JavaDistribution.LibericaNik: {
      const {LibericaNikDistributions} =
        await import('./liberica-nik/installer.js');
      return new LibericaNikDistributions(normalizedInstallerOptions);
    }
    case JavaDistribution.Microsoft: {
      const {MicrosoftDistributions} = await import('./microsoft/installer.js');
      return new MicrosoftDistributions(normalizedInstallerOptions);
    }
    case JavaDistribution.Semeru: {
      const {SemeruDistribution} = await import('./semeru/installer.js');
      return new SemeruDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.Corretto: {
      const {CorrettoDistribution} = await import('./corretto/installer.js');
      return new CorrettoDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.Oracle: {
      const {OracleDistribution} = await import('./oracle/installer.js');
      return new OracleDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.Dragonwell: {
      const {DragonwellDistribution} =
        await import('./dragonwell/installer.js');
      return new DragonwellDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.SapMachine: {
      const {SapMachineDistribution} =
        await import('./sapmachine/installer.js');
      return new SapMachineDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.GraalVM: {
      const {GraalVMDistribution} = await import('./graalvm/installer.js');
      return new GraalVMDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.GraalVMCommunity: {
      const {GraalVMCommunityDistribution} =
        await import('./graalvm/installer.js');
      return new GraalVMCommunityDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.JetBrains: {
      const {JetBrainsDistribution} = await import('./jetbrains/installer.js');
      return new JetBrainsDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.Kona: {
      const {KonaDistribution} = await import('./kona/installer.js');
      return new KonaDistribution(normalizedInstallerOptions);
    }
    case JavaDistribution.OracleOpenJdk: {
      const {OpenJdkDistribution} = await import('./openjdk/installer.js');
      return new OpenJdkDistribution(normalizedInstallerOptions);
    }
    default:
      return null;
  }
}

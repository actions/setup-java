import {getJavaDistribution} from '../../src/distributions/distribution-factory';
import {
  AdoptDistribution,
  AdoptImplementation
} from '../../src/distributions/adopt/installer';
import {
  TemurinDistribution,
  TemurinImplementation
} from '../../src/distributions/temurin/installer';
import {ZuluDistribution} from '../../src/distributions/zulu/installer';
import {LibericaDistributions} from '../../src/distributions/liberica/installer';
import {MicrosoftDistributions} from '../../src/distributions/microsoft/installer';
import {SemeruDistribution} from '../../src/distributions/semeru/installer';
import {CorrettoDistribution} from '../../src/distributions/corretto/installer';
import {OracleDistribution} from '../../src/distributions/oracle/installer';
import {DragonwellDistribution} from '../../src/distributions/dragonwell/installer';
import {SapMachineDistribution} from '../../src/distributions/sapmachine/installer';
import {GraalVMDistribution} from '../../src/distributions/graalvm/installer';
import {JetBrainsDistribution} from '../../src/distributions/jetbrains/installer';
import {LocalDistribution} from '../../src/distributions/local/installer';
import {JavaInstallerOptions} from '../../src/distributions/base-models';

const installerOptions: JavaInstallerOptions = {
  version: '11',
  architecture: 'x64',
  packageType: 'jdk',
  checkLatest: false
};

describe('getJavaDistribution', () => {
  it.each([
    ['adopt', AdoptDistribution],
    ['adopt-hotspot', AdoptDistribution]
  ])(
    'returns AdoptDistribution for "%s"',
    (distributionName, ExpectedClass) => {
      const distribution = getJavaDistribution(
        distributionName,
        installerOptions
      );
      expect(distribution).toBeInstanceOf(ExpectedClass);
    }
  );

  it.each(['adopt', 'adopt-hotspot'])(
    'passes a TemurinDistribution to AdoptDistribution for "%s"',
    distributionName => {
      const distribution = getJavaDistribution(
        distributionName,
        installerOptions
      ) as AdoptDistribution;
      expect(distribution).toBeInstanceOf(AdoptDistribution);
      // @ts-ignore - accessing private field to verify TemurinDistribution is wired in
      expect(distribution['temurinDistribution']).toBeInstanceOf(
        TemurinDistribution
      );
    }
  );

  it('adopt-openj9 creates AdoptDistribution without TemurinDistribution', () => {
    const distribution = getJavaDistribution(
      'adopt-openj9',
      installerOptions
    ) as AdoptDistribution;
    expect(distribution).toBeInstanceOf(AdoptDistribution);
    // @ts-ignore - accessing private field
    expect(distribution['temurinDistribution']).toBeNull();
  });

  it.each([
    ['temurin', TemurinDistribution],
    ['zulu', ZuluDistribution],
    ['liberica', LibericaDistributions],
    ['microsoft', MicrosoftDistributions],
    ['semeru', SemeruDistribution],
    ['corretto', CorrettoDistribution],
    ['oracle', OracleDistribution],
    ['dragonwell', DragonwellDistribution],
    ['sapmachine', SapMachineDistribution],
    ['graalvm', GraalVMDistribution],
    ['jetbrains', JetBrainsDistribution]
  ])(
    'returns %s distribution instance for "%s"',
    (distributionName, ExpectedClass) => {
      const distribution = getJavaDistribution(
        distributionName,
        installerOptions
      );
      expect(distribution).toBeInstanceOf(ExpectedClass);
    }
  );

  it('returns LocalDistribution for "jdkfile" with jdkFile provided', () => {
    const distribution = getJavaDistribution(
      'jdkfile',
      installerOptions,
      '/path/to/jdk.tar.gz'
    );
    expect(distribution).toBeInstanceOf(LocalDistribution);
  });

  it('returns null for unknown distribution name', () => {
    const distribution = getJavaDistribution(
      'unknown-distro',
      installerOptions
    );
    expect(distribution).toBeNull();
  });

  it('temurin distribution uses Hotspot implementation', () => {
    const distribution = getJavaDistribution(
      'temurin',
      installerOptions
    ) as TemurinDistribution;
    expect(distribution).toBeInstanceOf(TemurinDistribution);
    // @ts-ignore - accessing private field
    expect(distribution['jvmImpl']).toBe(TemurinImplementation.Hotspot);
  });

  it('adopt distribution TemurinDistribution uses Hotspot implementation', () => {
    const distribution = getJavaDistribution(
      'adopt',
      installerOptions
    ) as AdoptDistribution;
    // @ts-ignore - accessing private fields
    const temurin = distribution['temurinDistribution'] as TemurinDistribution;
    // @ts-ignore - accessing private field
    expect(temurin['jvmImpl']).toBe(TemurinImplementation.Hotspot);
  });

  it('adopt distribution uses Hotspot JVM implementation', () => {
    const distribution = getJavaDistribution(
      'adopt',
      installerOptions
    ) as AdoptDistribution;
    // @ts-ignore - accessing private field
    expect(distribution['jvmImpl']).toBe(AdoptImplementation.Hotspot);
  });

  it('adopt-hotspot distribution uses Hotspot JVM implementation', () => {
    const distribution = getJavaDistribution(
      'adopt-hotspot',
      installerOptions
    ) as AdoptDistribution;
    // @ts-ignore - accessing private field
    expect(distribution['jvmImpl']).toBe(AdoptImplementation.Hotspot);
  });

  it('adopt-openj9 distribution uses OpenJ9 JVM implementation', () => {
    const distribution = getJavaDistribution(
      'adopt-openj9',
      installerOptions
    ) as AdoptDistribution;
    // @ts-ignore - accessing private field
    expect(distribution['jvmImpl']).toBe(AdoptImplementation.OpenJ9);
  });
});

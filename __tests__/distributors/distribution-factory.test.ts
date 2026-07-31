import * as core from '@actions/core';
import {
  AdoptDistribution,
  AdoptImplementation
} from '../../src/distributions/adopt/installer';
import {JavaInstallerOptions} from '../../src/distributions/base-models';
import {getJavaDistribution} from '../../src/distributions/distribution-factory';

describe('getJavaDistribution', () => {
  const installerOptions: JavaInstallerOptions = {
    version: '11',
    architecture: 'x64',
    packageType: 'jdk',
    checkLatest: false
  };

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ['adopt', AdoptImplementation.Hotspot, 'temurin'],
    ['adopt-hotspot', AdoptImplementation.Hotspot, 'temurin'],
    ['adopt-openj9', AdoptImplementation.OpenJ9, 'semeru']
  ])(
    'warns that %s is deprecated while preserving its installer',
    (
      distributionName: string,
      implementation: AdoptImplementation,
      replacement: string
    ) => {
      const warningSpy = jest
        .spyOn(core, 'warning')
        .mockImplementation(() => {});

      const distribution = getJavaDistribution(
        distributionName,
        installerOptions
      );

      expect(distribution).toBeInstanceOf(AdoptDistribution);
      if (!(distribution instanceof AdoptDistribution)) {
        throw new Error(`Expected an Adopt installer for ${distributionName}`);
      }
      expect(distribution['jvmImpl']).toBe(implementation);
      expect(warningSpy).toHaveBeenCalledWith(
        `The '${distributionName}' legacy AdoptOpenJDK distribution is deprecated and will be removed in setup-java v6. Please migrate to the '${replacement}' distribution.`
      );
    }
  );
});

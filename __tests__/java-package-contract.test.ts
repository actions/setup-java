import fs from 'fs';
import path from 'path';
import {
  JAVA_PACKAGE_CAPABILITIES,
  JavaDistribution
} from '../src/distributions/package-types.js';

const repositoryRoot = process.cwd();
const readRepositoryFile = (filePath: string) =>
  fs.readFileSync(path.join(repositoryRoot, filePath), 'utf8');
const allPackageTypes = [
  ...new Set(Object.values(JAVA_PACKAGE_CAPABILITIES).flat())
];

describe('java-package published contract', () => {
  it.each(['action.yml', 'README.md'])(
    'documents every supported package type in %s',
    filePath => {
      const content = readRepositoryFile(filePath);
      const contractLine =
        filePath === 'action.yml'
          ? content.match(/ {2}java-package:\n(?: {4}.+\n)+/)?.[0]
          : content
              .split('\n')
              .find(line => line.includes('- `java-package`:'));

      expect(contractLine).toBeDefined();
      for (const packageType of allPackageTypes) {
        expect(contractLine).toContain(`\`${packageType}\``);
      }
    }
  );

  it.each(Object.entries(JAVA_PACKAGE_CAPABILITIES))(
    'keeps the advanced compatibility table aligned for %s',
    (distributionName, packageTypes) => {
      const advancedUsage = readRepositoryFile('docs/advanced-usage.md');
      const compatibilityTable = advancedUsage.slice(
        advancedUsage.indexOf('### Package compatibility')
      );
      const compatibilityRow = compatibilityTable
        .split('\n')
        .find(
          line =>
            line.startsWith('|') && line.includes(`\`${distributionName}\``)
        );

      expect(compatibilityRow).toBeDefined();
      for (const packageType of packageTypes) {
        expect(compatibilityRow).toContain(`\`${packageType}\``);
      }
    }
  );

  it('only exercises supported distribution/package combinations in E2E', () => {
    const workflow = readRepositoryFile('.github/workflows/e2e-versions.yml');
    const defaultMatrix = workflow.match(
      /distribution:\s*\n\s*\[([^\]]+)\]\s*\n\s*java-package:\s*\['([^']+)'\]/
    );
    expect(defaultMatrix).not.toBeNull();

    const defaultDistributions = [
      ...defaultMatrix![1].matchAll(/'([^']+)'/g)
    ].map(match => match[1]);
    const defaultPackage = defaultMatrix![2];
    for (const distributionName of defaultDistributions) {
      expect(supportedPackagesFor(distributionName)).toContain(defaultPackage);
    }

    const includedPackages = workflow.matchAll(
      /- distribution: '([^']+)'\s*\n\s*java-package: ([^\s]+)/g
    );
    for (const match of includedPackages) {
      const [, distributionName, packageType] = match;
      expect(supportedPackagesFor(distributionName)).toContain(packageType);
    }
  });
});

function supportedPackagesFor(distributionName: string): readonly string[] {
  return JAVA_PACKAGE_CAPABILITIES[distributionName as JavaDistribution] ?? [];
}

import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';

const [checkout, ref, destination] = process.argv.slice(2);
if (!checkout || !ref || !destination) {
  throw new Error(
    'Usage: node scripts/build-report-resolver.mjs <checkout> <ref> <output-dir>'
  );
}

const root = path.resolve(checkout);
const output = path.resolve(destination);
const ts = createRequire(path.join(root, 'package.json'))('typescript');
const packageJson = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8')
);
const source = {
  ref,
  sha: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8'
  }).trim(),
  version: packageJson.version
};
const capabilityFile = path.join(root, 'src/distributions/platform-types.ts');
const packageFile = path.join(root, 'src/distributions/package-types.ts');
const enumFile = fs.existsSync(packageFile)
  ? packageFile
  : path.join(root, 'src/distributions/distribution-factory.ts');
const syntax = ts.createSourceFile(
  enumFile,
  fs.readFileSync(enumFile, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const declaration = syntax.statements.find(
  statement =>
    ts.isEnumDeclaration(statement) &&
    statement.name.text === 'JavaDistribution'
);
if (!declaration) {
  throw new Error(`Cannot find the distribution enum in ${enumFile}`);
}
const distributions = declaration.members
  .map(member => {
    if (!member.initializer || !ts.isStringLiteral(member.initializer)) {
      throw new Error(`Expected a string-valued distribution in ${enumFile}`);
    }
    return member.initializer.text;
  })
  .filter(value => value !== 'jdkfile');

// Keep source and dependencies from the selected checkout. Only this small
// reporting entrypoint is injected; no installer or version matcher is replaced.
const entrypoint = path.join(root, 'report-resolver-entry.js');
fs.writeFileSync(
  entrypoint,
  `
export {getJavaDistribution} from './src/distributions/distribution-factory.ts';
import {LibericaDistributions} from './src/distributions/liberica/installer.ts';
${fs.existsSync(capabilityFile) ? "export {JAVA_PLATFORM_CAPABILITIES as capabilities} from './src/distributions/platform-types.ts';" : ''}
export const source = ${JSON.stringify(source)};
export const distributions = ${JSON.stringify(distributions)};
export function createSolarisInstaller(options) {
  const installer = new LibericaDistributions(options);
  const getPlatformOption = installer.getPlatformOption.bind(installer);
  installer.getPlatformOption = () => getPlatformOption('sunos');
  return installer;
}
`,
  {flag: 'wx'}
);
try {
  execFileSync(
    process.execPath,
    [
      path.join(root, 'node_modules/@vercel/ncc/dist/ncc/cli.js'),
      'build',
      entrypoint,
      '-o',
      output
    ],
    {cwd: root, stdio: 'inherit'}
  );
  // v5 is CommonJS even when the artifact is loaded from an ESM workspace.
  fs.writeFileSync(
    path.join(output, 'package.json'),
    JSON.stringify({
      type: packageJson.type ?? 'commonjs'
    })
  );
} finally {
  fs.rmSync(entrypoint, {force: true});
}

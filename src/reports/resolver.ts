import {pathToFileURL} from 'url';
import path from 'path';
import {getJavaDistribution} from '../distributions/distribution-factory.js';
import type {JavaInstallerOptions} from '../distributions/base-models.js';
import {LibericaDistributions} from '../distributions/liberica/installer.js';
import {JavaDistribution} from '../distributions/package-types.js';
import {
  JAVA_PLATFORM_CAPABILITIES,
  type JavaPlatformCapability
} from '../distributions/platform-types.js';

export interface ActionSource {
  ref: string;
  sha?: string;
  version?: string;
}

export interface MetadataResolver {
  source: ActionSource;
  distributions: string[];
  capabilities?: Record<string, JavaPlatformCapability>;
  getJavaDistribution(
    distribution: string,
    options: JavaInstallerOptions
  ): unknown;
  createSolarisInstaller(options: JavaInstallerOptions): unknown;
}

class SolarisLibericaDistribution extends LibericaDistributions {
  protected override getPlatformOption() {
    return super.getPlatformOption('sunos');
  }
}

export const currentResolver: MetadataResolver = {
  source: {ref: 'main'},
  distributions: Object.values(JavaDistribution).filter(
    distribution => distribution !== JavaDistribution.JdkFile
  ),
  capabilities: JAVA_PLATFORM_CAPABILITIES,
  getJavaDistribution,
  createSolarisInstaller: options => new SolarisLibericaDistribution(options)
};

const LEGACY_ARCHITECTURES = [
  'x64',
  'aarch64',
  'x86',
  'armv7',
  'ppc64le',
  'ppc64',
  'riscv64',
  's390x'
];

export function getResolverArchitectures(
  resolver: MetadataResolver,
  distribution: string,
  platform: string
): string[] {
  if (!resolver.distributions.includes(distribution)) {
    return [];
  }
  // v5 has no centralized capability map. Probe candidates with its own
  // installer instead of imposing main's newer support restrictions on it.
  if (!resolver.capabilities) {
    if (platform === 'solaris' && distribution !== 'liberica') {
      return [];
    }
    return [...LEGACY_ARCHITECTURES];
  }
  const capability = resolver.capabilities[distribution];
  if (!capability || capability.unrestricted) {
    return [];
  }
  const os = platform === 'linux-musl' ? 'linux' : platform;
  const architectures = Object.entries(capability.platforms).find(
    ([name]) => name === os
  )?.[1];
  return [
    ...new Set(
      (architectures ?? []).map(item =>
        typeof item === 'string' ? item : item.architecture
      )
    )
  ];
}

/** Load the separately bundled checkout, including that revision's dependencies. */
export async function loadMetadataResolver(
  directory: string
): Promise<MetadataResolver> {
  const module: unknown = await import(
    /* webpackIgnore: true */ pathToFileURL(
      path.join(path.resolve(directory), 'index.js')
    ).href
  );
  // NCC emits ESM for v6/main and CommonJS for v5.
  const candidate =
    isRecord(module) && isRecord(module.default) ? module.default : module;
  if (!isMetadataResolver(candidate)) {
    throw new Error(`Invalid metadata resolver bundle in '${directory}'.`);
  }
  return candidate;
}

function isMetadataResolver(value: unknown): value is MetadataResolver {
  return (
    isRecord(value) &&
    isRecord(value.source) &&
    typeof value.source.ref === 'string' &&
    typeof value.source.sha === 'string' &&
    /^[a-f0-9]{40}$/.test(value.source.sha) &&
    typeof value.source.version === 'string' &&
    Array.isArray(value.distributions) &&
    value.distributions.every(item => typeof item === 'string') &&
    (value.capabilities === undefined || isRecord(value.capabilities)) &&
    typeof value.getJavaDistribution === 'function' &&
    typeof value.createSolarisInstaller === 'function'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

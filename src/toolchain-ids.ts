export function validateToolchainIds(
  versions: string[],
  versionFile: string,
  toolchainIds: string[]
) {
  if (!toolchainIds.length) {
    return;
  }

  const versionCount = versions.length || (versionFile ? 1 : 0);
  if (versionCount !== toolchainIds.length) {
    throw new Error(
      `The number of Maven toolchain IDs (${toolchainIds.length}) must match the number of Java versions (${versionCount})`
    );
  }
}

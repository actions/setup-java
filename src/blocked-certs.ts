import * as core from '@actions/core';
import * as fs from 'fs';
import path from 'path';

/**
 * SHA-256 fingerprints of compromised eMudhra intermediate CA certificates.
 * The JDK refuses to trust any certificate chain containing one of these.
 */
export const COMPROMISED_CERT_FINGERPRINTS: readonly string[] = [
  '42C4ACCD12C4F59597925E1A08A7A90102608543809308D50EC427E118BA1493',
  '45A883F349AEDFD5F3A649B5498FFB121712BA8B448F3F2A91DBC5A766FCDDBE',
  '98B896625C0C230ADEEC3EB2CF6AAD5001ECF9156A68644E82374CE5833BC25B',
  '5F1DED4DD590AF74631290CF073B122A2AAC6A1FA479778A0BD43579BD832699',
  'E7568FE6E12331F4FD7DE61DA4C7559D0F8EB192A218D4741A3BA75184333838',
  '579480AEA166290BD3C643589E795FC0D0E54E86505D180F1DFF99EFD3199512',
  '0164D7CEAE5BB909C272AF151FF44B1177AE9B47D9424B94F1D9558C30934D19',
  '62B7F9868263F72F6911FC78CEAF72C1979158B7368BF648683BB2AA39B02E72',
  'CB6E15165AC802E9B3F993F16C25D41F4E81C21EBDE71AE1B012AC00BF9C7C3F',
  '7485B51C0ED192878FA1D2F948FB529AE1842CC5086C4B67F7BE5B2039DE9489',
  '432EC25F0D28DE9006D97BF752F17BBB2CD41F669933FCB072D9A1148D0261F3',
  'FD9D5C2DBBD4995AB69B8D50C439D9527B00529199C2FD01B2174EB58F07021F',
  '9E39DE2881273ACC225A149C72BA3E0F51424963669AB633EE1DC7DF5DB067B4',
  'A496E23AC0CAB8155FC9B117B97EAE368EFCBB9041AEC8804D5A308D2D01C2D8',
  '4B2460A466F95FD40113BCDCCA2CEB29B3B093921DE45474DA7DF48874C630B1',
  '84112972B8E59D14560AE7E7119654474AAD119990CF3722BFC1E3B91615E1FD'
];

// Newer JDKs use blocked.certs; older ones (JDK 8/11) use blacklisted.certs.
// A JDK 8 bundles a separate JRE under jre/ that has its own copy.
const BLOCKED_CERTS_CANDIDATES = [
  ['lib', 'security', 'blocked.certs'],
  ['lib', 'security', 'blacklisted.certs'],
  ['jre', 'lib', 'security', 'blocked.certs'],
  ['jre', 'lib', 'security', 'blacklisted.certs']
];

const SHA256_ALGORITHM_LINE = /^\s*Algorithm\s*=\s*SHA-256\s*$/i;

/**
 * Adds the compromised CA fingerprints to the blocked certificates list of
 * the JDK at `javaHome`. Fingerprints already present are left alone, so
 * running this repeatedly on a tool-cached JDK is safe.
 */
export function blockCompromisedCertificates(
  javaHome: string,
  fingerprints: readonly string[] = COMPROMISED_CERT_FINGERPRINTS
): void {
  const files = BLOCKED_CERTS_CANDIDATES.map(parts =>
    path.join(javaHome, ...parts)
  ).filter(file => fs.existsSync(file));

  if (!files.length) {
    core.warning(
      `Could not find a blocked certificates list in ${javaHome}; compromised CA certificates were not blocked.`
    );
    return;
  }

  for (const file of files) {
    try {
      appendFingerprints(file, fingerprints);
    } catch (error) {
      core.warning(
        `Failed to block compromised CA certificates in ${file}: ${(error as Error).message}`
      );
    }
  }
}

function appendFingerprints(
  file: string,
  fingerprints: readonly string[]
): void {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/).map(line => line.trim());

  const algorithmLine = lines.find(line => line.startsWith('Algorithm'));
  if (!algorithmLine || !SHA256_ALGORITHM_LINE.test(algorithmLine)) {
    core.warning(
      `${file} does not use SHA-256 fingerprints; compromised CA certificates were not blocked.`
    );
    return;
  }

  const existing = new Set(lines.map(line => line.toUpperCase()));
  const missing = fingerprints
    .map(fingerprint => fingerprint.toUpperCase())
    .filter(fingerprint => !existing.has(fingerprint));

  if (!missing.length) {
    core.debug(`${file} already blocks the compromised CA certificates`);
    return;
  }

  const prefix = content.length && !content.endsWith('\n') ? '\n' : '';
  fs.appendFileSync(file, `${prefix}${missing.join('\n')}\n`);
  core.info(
    `Blocked ${missing.length} compromised CA certificate(s) in ${file}`
  );
}

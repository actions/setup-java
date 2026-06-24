import * as core from '@actions/core';
import * as tc from '@actions/tool-cache';

import fs from 'fs';
import path from 'path';
import semver from 'semver';
import * as gpg from '../../gpg';

import {JavaBase} from '../base-installer';
import {ITemurinAvailableVersions} from './models';
import {
  JavaDownloadRelease,
  JavaInstallerOptions,
  JavaInstallerResults
} from '../base-models';
import {
  extractJdkFile,
  getNextPageUrlFromLinkHeader,
  getDownloadArchiveExtension,
  isVersionSatisfies,
  renameWinArchive,
  MAX_PAGINATION_PAGES,
  validatePaginationUrl
} from '../../util';

export enum TemurinImplementation {
  Hotspot = 'Hotspot'
}

// Adoptium GPG signing key (fingerprint: 3B04D753C9050D9A5D343F39843C48A565F8F04B)
// Retrieved from: https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x3B04D753C9050D9A5D343F39843C48A565F8F04B
export const ADOPTIUM_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

xsBNBGGTvTQBCAC6ey144n7CG8foafF6mwgIBN1fIm1ILZDuGS4tMr0/XI8pgJnT
QvsPxZWEvtSm7bEMObzEoZJcXwjBcJl1B0ui8k5kHMTI75gCmZPsoKLFWIEpuRBQ
PBocusw80apDmLnNDQLVQvDFtEua5gaNa/fRw9YsmBoXBqvgrjFUIdGyWoQvH5+a
9OYlWD9n5VV0gnVMb+aclwVzB/zJw3kHGSgzuMtlAHeQiah7Y8yomQn/UIX8yqDf
+11sP3+c87YcjkRqImRTtmKEDcEtGPAIXC6SYA+uEEkbYE0Fy0chkvtnVWJ597fa
Epai4rnICU8zoJ6X5z3v1aM2WerhX9oq9X8PABEBAAHNQEFkb3B0aXVtIEdQRyBL
ZXkgKERFQi9SUE0gU2lnbmluZyBLZXkpIDx0ZW11cmluLWRldkBlY2xpcHNlLm9y
Zz7CwJIEEwEIADwWIQQ7BNdTyQUNml00PzmEPEilZfjwSwUCYZO9NAIbAwULCQgH
AgMiAgEGFQoJCAsCBBYCAwECHgcCF4AACgkQhDxIpWX48Et4AggAjjJzYWuKV3nG
7ngInngl8G/m9JoHr7BmwgcQXYhdy5hVkMcUx5JLeXz2LMBUH/F2nD595hgjMabk
kVib20X8lq9RsNbdfc2hBcWU6qyHKxsIqT4boI2/XDyEzzMyyZWWNGo/27Ci7Xmj
pWu31nh0pDdPqdyWDIKojbVVnxlCRY8as8Sm+1ufi709KCi4MuwHNsUlCSwb/fju
NKeHkrHbLcHKUUIEcmTSKRWrpMYBzm1HYOGBz4xPuELwUfUp71ehfoyBZlp6RDRf
l5TYI1FmCyHuvjNhrJgWv7bOTcf8yObGY+TEUhzc4xQqCrF4ur9d3opvsuPBQsv+
Klqi5KSZgs7ATQRhk700AQgAq14okly8cFrpYVenEQPiB75AUZfKRpMduiR6IxAj
SKcH7aSoFZ9AubUEBVpZsyT5svxoEPe1i4TdbF+m9FGy42EcOlLa3ArLTj5H8FRl
UdGZB9I5mk4GptOzPM+aHMMu92vW/ZwjuS8DvOiQSp+cUmG1EqOMJSM7e/4BM71z
E+OKaVJCj79pEzhG3SK/IC/OlxxyETT66NSfYJd7Sw5R6Vr19am/uNU690W0CJ+q
VQeFpmDMr7LnfdFRIh+lJe05+PvWXeidkGjox5cbG52wf8aRIR/FgkfcFvqRMN1f
B+dVOWueloUeVAnzcUznOKmUEs7LP9ObJhYHHgup4IAU2wARAQABwsB2BBgBCAAg
FiEEOwTXU8kFDZpdND85hDxIpWX48EsFAmGTvTQCGwwACgkQhDxIpWX48EvXHQf/
Q0nZsGDXnZHiBoojeSdpkO7WBjMIP3w1GdLvRpPQrS8TfOPbZuoevzCNh38Y3gwF
yelJspvzDQrBXhgkzAGlucYg8Y7KHa5Ebm7iDgMzc37L1hYSZTYCqwd7aowfgy34
hOk3B67LffkJpIh738Oa9CtlwxQ9xcytmBmQ1fBBOwm/9IhAwHPQuydYIs4DxWbj
0MGSP4fDntU7e4UjsHNmhudDcYol0FaqdHHIIB9C/G4CzetRwHFOn3b4JwXMU7YU
6aJA3mXhi3hggMC3wkT2HHZ/TquuOdNc02fypWOCDOHz0alBBJNqoVUNFNqU3tfJ
wI4qF/KKq9BfyfucAs0ykA==
=XLag
-----END PGP PUBLIC KEY BLOCK-----`;

export class TemurinDistribution extends JavaBase {
  constructor(
    installerOptions: JavaInstallerOptions,
    private readonly jvmImpl: TemurinImplementation
  ) {
    super(`Temurin-${jvmImpl}`, installerOptions);
  }

  /**
   * @internal For cross-distribution reuse only. Not intended as a public API.
   */
  public async findPackageForDownload(
    version: string
  ): Promise<JavaDownloadRelease> {
    const availableVersionsRaw = await this.getAvailableVersions();
    const availableVersionsWithBinaries = availableVersionsRaw
      .filter(item => item.binaries.length > 0)
      .map(item => {
        // normalize 17.0.0-beta+33.0.202107301459 to 17.0.0+33.0.202107301459 for earlier access versions
        const formattedVersion = this.stable
          ? item.version_data.semver
          : item.version_data.semver.replace('-beta+', '+');
        return {
          version: formattedVersion,
          url: item.binaries[0].package.link,
          signatureUrl: item.binaries[0].package.signature_link
        } as JavaDownloadRelease;
      });

    const satisfiedVersions = availableVersionsWithBinaries
      .filter(item => isVersionSatisfies(version, item.version))
      .sort((a, b) => {
        return -semver.compareBuild(a.version, b.version);
      });

    const resolvedFullVersion =
      satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
    if (!resolvedFullVersion) {
      const availableVersionStrings = availableVersionsWithBinaries.map(
        item => item.version
      );
      throw this.createVersionNotFoundError(version, availableVersionStrings);
    }

    return resolvedFullVersion;
  }

  protected async downloadTool(
    javaRelease: JavaDownloadRelease
  ): Promise<JavaInstallerResults> {
    core.info(
      `Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`
    );
    let javaArchivePath = await tc.downloadTool(javaRelease.url);

    if (this.verifySignature) {
      if (!javaRelease.signatureUrl) {
        throw new Error(
          `Input 'verify-signature' is enabled, but no signature URL was found for Temurin version ${javaRelease.version}.`
        );
      }
      core.info(`Verifying Java package signature...`);
      try {
        await gpg.verifyPackageSignature(
          javaArchivePath,
          javaRelease.signatureUrl,
          this.verifySignaturePublicKey ?? ADOPTIUM_PUBLIC_KEY
        );
      } catch (error) {
        throw new Error(
          `Failed to verify signature for Temurin version ${javaRelease.version} from ${javaRelease.signatureUrl}: ${
            (error as Error).message
          }`
        );
      }
    }

    core.info(`Extracting Java archive...`);
    const extension = getDownloadArchiveExtension();
    if (process.platform === 'win32') {
      javaArchivePath = renameWinArchive(javaArchivePath);
    }
    const extractedJavaPath = await extractJdkFile(javaArchivePath, extension);

    const archiveName = fs.readdirSync(extractedJavaPath)[0];
    const archivePath = path.join(extractedJavaPath, archiveName);
    const version = this.getToolcacheVersionName(javaRelease.version);

    const javaPath = await tc.cacheDir(
      archivePath,
      this.toolcacheFolderName,
      version,
      this.architecture
    );

    return {version: javaRelease.version, path: javaPath};
  }

  protected get toolcacheFolderName(): string {
    return super.toolcacheFolderName;
  }

  protected supportsSignatureVerification(): boolean {
    return true;
  }

  private async getAvailableVersions(): Promise<ITemurinAvailableVersions[]> {
    const platform = this.getPlatformOption();
    const arch = this.distributionArchitecture();
    const imageType = this.packageType;
    const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
    const releaseType = this.stable ? 'ga' : 'ea';

    if (core.isDebug()) {
      console.time('Retrieving available versions for Temurin took'); // eslint-disable-line no-console
    }

    const baseRequestArguments = [
      `project=jdk`,
      'vendor=adoptium',
      `heap_size=normal`,
      'sort_method=DEFAULT',
      'sort_order=DESC',
      `os=${platform}`,
      `architecture=${arch}`,
      `image_type=${imageType}`,
      `release_type=${releaseType}`,
      `jvm_impl=${this.jvmImpl.toLowerCase()}`
    ].join('&');

    const requestArguments = `${baseRequestArguments}&page_size=20&page=0`;
    let availableVersionsUrl: string | null =
      `https://api.adoptium.net/v3/assets/version/${versionRange}?${requestArguments}`;
    const availableVersions: ITemurinAvailableVersions[] = [];
    let pageCount = 0;
    if (core.isDebug()) {
      core.debug(`Gathering available versions from '${availableVersionsUrl}'`);
    }

    while (availableVersionsUrl) {
      pageCount++;
      const response =
        await this.http.getJson<ITemurinAvailableVersions[]>(
          availableVersionsUrl
        );
      const paginationPage = response.result;
      const nextUrl = getNextPageUrlFromLinkHeader(response.headers);
      if (
        nextUrl &&
        !validatePaginationUrl(nextUrl, 'https://api.adoptium.net')
      ) {
        core.warning(
          `Ignoring pagination link with unexpected origin: ${nextUrl}`
        );
        availableVersionsUrl = null;
      } else {
        availableVersionsUrl = nextUrl;
      }

      if (paginationPage === null || paginationPage.length === 0) {
        break;
      }

      availableVersions.push(...paginationPage);

      if (pageCount >= MAX_PAGINATION_PAGES) {
        core.warning(
          `Reached pagination safeguard limit (${MAX_PAGINATION_PAGES} pages) while listing Temurin releases.`
        );
        break;
      }
    }

    if (core.isDebug()) {
      core.startGroup('Print information about available versions');
      console.timeEnd('Retrieving available versions for Temurin took'); // eslint-disable-line no-console
      core.debug(`Available versions: [${availableVersions.length}]`);
      core.debug(
        availableVersions.map(item => item.version_data.semver).join(', ')
      );
      core.endGroup();
    }

    return availableVersions;
  }

  private getPlatformOption(): string {
    // Adoptium has own platform names so need to map them
    switch (process.platform) {
      case 'darwin':
        return 'mac';
      case 'win32':
        return 'windows';
      case 'linux':
        if (fs.existsSync('/etc/alpine-release')) {
          return 'alpine-linux';
        }
        return 'linux';
      default:
        return process.platform;
    }
  }
}

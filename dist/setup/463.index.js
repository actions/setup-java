export const id = 463;
export const ids = [463];
export const modules = {

/***/ 463:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  TemurinDistribution: () => (/* binding */ TemurinDistribution),
  TemurinImplementation: () => (/* binding */ TemurinImplementation)
});

// UNUSED EXPORTS: ADOPTIUM_PUBLIC_KEY

// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js + 7 modules
var core = __webpack_require__(3838);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(9896);
var external_fs_default = /*#__PURE__*/__webpack_require__.n(external_fs_);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
var external_path_default = /*#__PURE__*/__webpack_require__.n(external_path_);
// EXTERNAL MODULE: ./node_modules/semver/index.js
var semver = __webpack_require__(2088);
var semver_default = /*#__PURE__*/__webpack_require__.n(semver);
// EXTERNAL MODULE: ./src/gpg.ts
var gpg = __webpack_require__(8343);
;// CONCATENATED MODULE: ./src/distributions/temurin/adoptium-key.ts
// Adoptium GPG signing key (fingerprint: 3B04D753C9050D9A5D343F39843C48A565F8F04B)
// Retrieved from: https://keyserver.ubuntu.com/pks/lookup?op=get&search=0x3B04D753C9050D9A5D343F39843C48A565F8F04B
const ADOPTIUM_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----

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

// EXTERNAL MODULE: ./src/distributions/base-installer.ts + 2 modules
var base_installer = __webpack_require__(6242);
// EXTERNAL MODULE: ./src/constants.ts
var constants = __webpack_require__(7242);
// EXTERNAL MODULE: ./src/util.ts
var util = __webpack_require__(4527);
;// CONCATENATED MODULE: ./src/distributions/temurin/installer.ts










var TemurinImplementation;
(function (TemurinImplementation) {
    TemurinImplementation["Hotspot"] = "Hotspot";
})(TemurinImplementation || (TemurinImplementation = {}));
class TemurinDistribution extends base_installer/* JavaBase */.O {
    jvmImpl;
    includeJmods;
    constructor(installerOptions, jvmImpl) {
        super(`Temurin-${jvmImpl}`, installerOptions);
        this.jvmImpl = jvmImpl;
        this.includeJmods = this.packageType === 'jdk+jmods';
    }
    /**
     * @internal For cross-distribution reuse only. Not intended as a public API.
     */
    async findPackageForDownload(version) {
        return this.resolvePackage(version, this.includeJmods ? 'jdk' : this.packageType);
    }
    async resolvePackage(version, imageType) {
        const availableVersionsRaw = await this.getAvailableVersions(imageType);
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
                signatureUrl: item.binaries[0].package.signature_link,
                checksum: {
                    algorithm: 'sha256',
                    value: item.binaries[0].package.checksum,
                    source: item.binaries[0].package.checksum_link
                }
            };
        });
        const satisfiedVersions = availableVersionsWithBinaries
            .filter(item => (0,util/* isVersionSatisfies */.y)(version, item.version))
            .sort((a, b) => {
            return -semver_default().compareBuild(a.version, b.version);
        });
        const resolvedFullVersion = satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
        if (!resolvedFullVersion) {
            const availableVersionStrings = availableVersionsWithBinaries.map(item => item.version);
            throw this.createVersionNotFoundError(version, availableVersionStrings);
        }
        return resolvedFullVersion;
    }
    async downloadTool(javaRelease) {
        core/* info */.pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadPackage(javaRelease);
        core/* info */.pq(`Extracting Java archive...`);
        const extension = (0,util/* getDownloadArchiveExtension */.ag)();
        if (process.platform === 'win32') {
            javaArchivePath = (0,util/* renameWinArchive */.n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,util/* extractJdkFile */.PE)(javaArchivePath, extension);
        const archiveName = external_fs_default().readdirSync(extractedJavaPath)[0];
        const archivePath = external_path_default().join(extractedJavaPath, archiveName);
        const javaHome = process.platform === 'darwin'
            ? external_path_default().join(archivePath, constants/* MACOS_JAVA_CONTENT_POSTFIX */.PG)
            : archivePath;
        if (this.includeJmods && !external_fs_default().existsSync(external_path_default().join(javaHome, 'jmods'))) {
            await this.installJmods(javaRelease.version, javaHome);
        }
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await (0,util/* cacheJdkDir */.Vj)(archivePath, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    supportsSignatureVerification() {
        return true;
    }
    async downloadPackage(release) {
        const archivePath = await this.downloadAndVerify(release);
        if (this.verifySignature) {
            if (!release.signatureUrl) {
                throw new Error(`Input 'verify-signature' is enabled, but no signature URL was found for Temurin version ${release.version}.`);
            }
            core/* info */.pq(`Verifying Java package signature...`);
            try {
                await gpg/* verifyPackageSignature */.Yi(archivePath, release.signatureUrl, this.verifySignaturePublicKey ?? ADOPTIUM_PUBLIC_KEY);
            }
            catch (error) {
                throw new Error(`Failed to verify signature for Temurin version ${release.version} from ${release.signatureUrl}: ${error.message}`, { cause: error });
            }
        }
        return archivePath;
    }
    async installJmods(version, javaHome) {
        const jmodsRelease = await this.resolvePackage(version, 'jmods');
        core/* info */.pq(`Downloading JMODs ${jmodsRelease.version} (${this.distribution}) from ${jmodsRelease.url} ...`);
        let jmodsArchivePath = await this.downloadPackage(jmodsRelease);
        if (process.platform === 'win32') {
            jmodsArchivePath = (0,util/* renameWinArchive */.n2)(jmodsArchivePath);
        }
        const extractedJmodsPath = await (0,util/* extractJdkFile */.PE)(jmodsArchivePath, (0,util/* getDownloadArchiveExtension */.ag)());
        const jmodsDirectory = external_path_default().join(extractedJmodsPath, external_fs_default().readdirSync(extractedJmodsPath)[0]);
        external_fs_default().cpSync(jmodsDirectory, external_path_default().join(javaHome, 'jmods'), { recursive: true });
    }
    async getAvailableVersions(imageType = this.includeJmods ? 'jdk' : this.packageType) {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
        const releaseType = this.stable ? 'ga' : 'ea';
        if (core/* isDebug */._o()) {
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
        let availableVersionsUrl = `https://api.adoptium.net/v3/assets/version/${versionRange}?${requestArguments}`;
        const availableVersions = [];
        let pageCount = 0;
        if (core/* isDebug */._o()) {
            core/* debug */.Yz(`Gathering available versions from '${availableVersionsUrl}'`);
        }
        while (availableVersionsUrl) {
            pageCount++;
            const response = await this.http.getJson(availableVersionsUrl);
            const paginationPage = response.result;
            const nextUrl = (0,util/* getNextPageUrlFromLinkHeader */.rC)(response.headers);
            if (nextUrl &&
                !(0,util/* validatePaginationUrl */.SA)(nextUrl, 'https://api.adoptium.net')) {
                core/* warning */.$e(`Ignoring pagination link with unexpected origin: ${nextUrl}`);
                availableVersionsUrl = null;
            }
            else {
                availableVersionsUrl = nextUrl;
            }
            if (paginationPage === null || paginationPage.length === 0) {
                break;
            }
            availableVersions.push(...paginationPage);
            if (pageCount >= util/* MAX_PAGINATION_PAGES */.Tp) {
                core/* warning */.$e(`Reached pagination safeguard limit (${util/* MAX_PAGINATION_PAGES */.Tp} pages) while listing Temurin releases.`);
                break;
            }
        }
        if (core/* isDebug */._o()) {
            core/* startGroup */.Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Temurin took'); // eslint-disable-line no-console
            core/* debug */.Yz(`Available versions: [${availableVersions.length}]`);
            core/* debug */.Yz(availableVersions.map(item => item.version_data.semver).join(', '));
            core/* endGroup */.N4();
        }
        return availableVersions;
    }
    getPlatformOption() {
        // Adoptium has own platform names so need to map them
        switch (process.platform) {
            case 'darwin':
                return 'mac';
            case 'win32':
                return 'windows';
            case 'linux':
                if (external_fs_default().existsSync('/etc/alpine-release')) {
                    return 'alpine-linux';
                }
                return 'linux';
            default:
                return process.platform;
        }
    }
    distributionArchitecture() {
        const architecture = super.distributionArchitecture();
        return architecture === 'armv7' ? 'arm' : architecture;
    }
}


/***/ }),

/***/ 8343:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Fh: () => (/* binding */ importKey),
/* harmony export */   Yi: () => (/* binding */ verifyPackageSignature),
/* harmony export */   mS: () => (/* binding */ removeGpgHome)
/* harmony export */ });
/* unused harmony exports GPG_HOME_PREFIX, toGpgPath */
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6982);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _actions_io__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(8701);
/* harmony import */ var _actions_exec__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(5260);
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(9805);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4527);







const GPG_HOME_PREFIX = 'setup-java-gpg-';
const VERIFY_GPG_HOME_PREFIX = 'verify-signature-gpg-home-';
// Convert a Windows path (D:\a\_temp\...) to a POSIX path (/d/a/_temp/...).
// The Git-bundled GPG on Windows (MSYS2-based) uses POSIX path conventions
// internally. Passing Windows paths with backslashes can cause fatal GPG errors
// (exit code 2), so all paths passed to GPG must be in POSIX format on Windows.
function toGpgPath(p) {
    if (process.platform !== 'win32')
        return p;
    return p
        .replace(/\\/g, '/')
        .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
}
function createGpgHome(prefix) {
    const gpgHome = fs__WEBPACK_IMPORTED_MODULE_0__.mkdtempSync(path__WEBPACK_IMPORTED_MODULE_1__.join(_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getTempDir */ .G4(), prefix));
    if (process.platform !== 'win32') {
        fs__WEBPACK_IMPORTED_MODULE_0__.chmodSync(gpgHome, 0o700);
    }
    return gpgHome;
}
async function importKey(privateKey) {
    const gpgHome = createGpgHome(GPG_HOME_PREFIX);
    const privateKeyFile = path__WEBPACK_IMPORTED_MODULE_1__.join(gpgHome, `private-key-${(0,crypto__WEBPACK_IMPORTED_MODULE_2__.randomUUID)()}.asc`);
    try {
        fs__WEBPACK_IMPORTED_MODULE_0__.writeFileSync(privateKeyFile, privateKey, {
            encoding: 'utf-8',
            flag: 'wx',
            mode: 0o600
        });
        try {
            await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpg', [
                '--homedir',
                toGpgPath(gpgHome),
                '--batch',
                '--import',
                toGpgPath(privateKeyFile)
            ], { silent: true });
        }
        finally {
            fs__WEBPACK_IMPORTED_MODULE_0__.rmSync(privateKeyFile, { force: true });
        }
        return gpgHome;
    }
    catch (error) {
        await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(gpgHome);
        throw error;
    }
}
async function removeGpgHome(gpgHome) {
    if (!gpgHome) {
        return;
    }
    const resolvedGpgHome = path__WEBPACK_IMPORTED_MODULE_1__.resolve(gpgHome);
    const resolvedTempDir = path__WEBPACK_IMPORTED_MODULE_1__.resolve(_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getTempDir */ .G4());
    if (path__WEBPACK_IMPORTED_MODULE_1__.dirname(resolvedGpgHome) !== resolvedTempDir ||
        !path__WEBPACK_IMPORTED_MODULE_1__.basename(resolvedGpgHome).startsWith(GPG_HOME_PREFIX)) {
        throw new Error(`Refusing to remove unexpected GPG home: ${gpgHome}`);
    }
    await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(resolvedGpgHome);
}
async function verifyPackageSignature(archivePath, signatureUrl, publicKeyContent) {
    const signaturePath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_5__/* .downloadTool */ .bq(signatureUrl);
    let gpgHome;
    try {
        gpgHome = createGpgHome(VERIFY_GPG_HOME_PREFIX);
    }
    catch (error) {
        try {
            await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(signaturePath);
        }
        catch {
            // ignore cleanup failures
        }
        throw new Error(`Failed to create temporary GPG home directory for signature verification: ${error.message}`, { cause: error });
    }
    try {
        const publicKeyFile = path__WEBPACK_IMPORTED_MODULE_1__.join(gpgHome, 'public-key.asc');
        fs__WEBPACK_IMPORTED_MODULE_0__.writeFileSync(publicKeyFile, publicKeyContent, { encoding: 'utf-8' });
        const options = { silent: true };
        await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpg', [
            '--homedir',
            toGpgPath(gpgHome),
            '--batch',
            '--import',
            toGpgPath(publicKeyFile)
        ], options);
        await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpg', [
            '--homedir',
            toGpgPath(gpgHome),
            '--batch',
            '--verify',
            toGpgPath(signaturePath),
            toGpgPath(archivePath)
        ], options);
    }
    finally {
        await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(signaturePath);
        await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(gpgHome);
    }
}


/***/ })

};

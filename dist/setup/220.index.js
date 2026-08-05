export const id = 220;
export const ids = [220];
export const modules = {

/***/ 3220:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  MicrosoftDistributions: () => (/* binding */ MicrosoftDistributions)
});

// UNUSED EXPORTS: MICROSOFT_PUBLIC_KEY

// EXTERNAL MODULE: ./src/distributions/base-installer.ts + 2 modules
var base_installer = __webpack_require__(6242);
// EXTERNAL MODULE: ./src/util.ts
var util = __webpack_require__(4527);
// EXTERNAL MODULE: ./src/gpg.ts
var gpg = __webpack_require__(8343);
;// CONCATENATED MODULE: ./src/distributions/microsoft/microsoft-key.ts
// Microsoft Build of OpenJDK GPG signing key
// Retrieved from: https://download.visualstudio.microsoft.com/download/pr/b90071e2-e0cf-4411-98be-dbeb09d67bf0/8622862bcd54206e158c5abca0582c9b/464279_464280_aoc_20210208.asc
const MICROSOFT_PUBLIC_KEY = `-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: BSN Pgp v1.1.0.0

mQENBGAhlWcBCADCQjj6huLTenvZSLej35e9YKEHm4lix2uvPOONexMaU8V2v7KL
RGdoXF7jwHci7efnPZ+9zpS2+g3rhvv8M7yWy9E/1psEtGzvmp1IL/qIabMEQqi+
UlhPGh7MQ/BkXAlic8Dyl3XYqr0EXS11iCiTr6Zkxs9Ee4V54gxL4gogRn4wk9sl
/nrjgDzMsUwla0pynoQQvYpqCdiAr3gKKllT1skCDqgVOMMyZxsx9HjZxg/3AJz6
r5i512L2R+3Hkv+XmxT+mnGBCFcny0DM7PjNXEmIK3ZSkro1tQML90zx3Fyh5esx
fpVvuIXGFV75o35VVCBZoiD3hcfOnIJsPQ9nABEBAAG0OE1pY3Jvc29mdCBKYXZh
IEVuZ2luZWVyaW5nIDxqYXZhcGxhdGluZnJhQG1pY3Jvc29mdC5jb20+iQE4BBMB
CAAiBQJgIZVnAhsDBgsJCAcDAgYVCAIJCgsEFgIDAQIeAQIXgAAKCRA1Ux0xWyHB
icwTCACJO2FGNocNvdUtAb+eDKuGwt0chAJdCES2ZtgBScwrwDyWpxpRznoXWBHL
MJeLyxJoKsCG3vVlY4uh48psCzVm3OKvi7MCPT955t8W6TzfSBxTpjR8zRgJkjPJ
EGhHTlusUfz7TtM5etJF0qscSJH1grcNsgtee97mk4QyEzT8Di83NQmYxKcBrliq
yK/SWWt8VkTyYAEO6L5PoB4L9r8ka27uQs+jgCw+/Z0JMtNmmhyNGY3+a1YtPeoy
JdQaI9LphfKGbVaz6SK2aol7vj+c2TG3TLUYdOYGMH1OZlri2GTkCVjwna2GC7p4
Fa133tP85xzJEq1XeXm8WeLFo2wV
=rHCS
-----END PGP PUBLIC KEY BLOCK-----`;

// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js + 7 modules
var core = __webpack_require__(3838);
// EXTERNAL MODULE: ./node_modules/@actions/tool-cache/lib/tool-cache.js + 2 modules
var tool_cache = __webpack_require__(9805);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(9896);
var external_fs_default = /*#__PURE__*/__webpack_require__.n(external_fs_);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
var external_path_default = /*#__PURE__*/__webpack_require__.n(external_path_);
;// CONCATENATED MODULE: ./src/distributions/microsoft/installer.ts









class MicrosoftDistributions extends base_installer/* JavaBase */.O {
    constructor(installerOptions) {
        super('Microsoft', installerOptions);
    }
    async downloadTool(javaRelease) {
        core/* info */.pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        if (this.verifySignature) {
            if (!javaRelease.signatureUrl) {
                throw new Error(`Input 'verify-signature' is enabled, but no signature URL was found for Microsoft Build of OpenJDK version ${javaRelease.version}.`);
            }
            core/* info */.pq(`Verifying Java package signature...`);
            try {
                await gpg/* verifyPackageSignature */.Yi(javaArchivePath, javaRelease.signatureUrl, this.verifySignaturePublicKey ?? MICROSOFT_PUBLIC_KEY);
            }
            catch (error) {
                throw new Error(`Failed to verify signature for Microsoft Build of OpenJDK version ${javaRelease.version}. Signature URL: ${javaRelease.signatureUrl}. Error: ${error.message}`, { cause: error });
            }
        }
        core/* info */.pq(`Extracting Java archive...`);
        const extension = (0,util/* getDownloadArchiveExtension */.ag)();
        if (process.platform === 'win32') {
            javaArchivePath = (0,util/* renameWinArchive */.n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,util/* extractJdkFile */.PE)(javaArchivePath, extension);
        const archiveName = external_fs_default().readdirSync(extractedJavaPath)[0];
        const archivePath = external_path_default().join(extractedJavaPath, archiveName);
        const javaPath = await (0,util/* cacheJdkDir */.Vj)(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaRelease.version), this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async findPackageForDownload(range) {
        const arch = this.distributionArchitecture();
        if (arch !== 'x64' && arch !== 'aarch64') {
            throw new Error(`Unsupported architecture: ${this.architecture}`);
        }
        if (!this.stable) {
            throw new Error('Early access versions are not supported');
        }
        if (this.packageType !== 'jdk') {
            throw new Error('Microsoft Build of OpenJDK provides only the `jdk` package type');
        }
        const manifest = await this.getAvailableVersions();
        if (!manifest) {
            throw new Error('Could not load manifest for Microsoft Build of OpenJDK');
        }
        const foundRelease = await tool_cache/* findFromManifest */.DC(range, true, manifest, arch);
        if (!foundRelease) {
            const availableVersionStrings = manifest.map(item => item.version);
            throw this.createVersionNotFoundError(range, availableVersionStrings);
        }
        const file = foundRelease.files[0];
        const signatureUrl = file.signature_url ?? `${file.download_url}.sig`;
        return {
            url: file.download_url,
            signatureUrl,
            version: foundRelease.version,
            checksum: await this.fetchChecksum(`${file.download_url}.sha256sum.txt`, 'sha256')
        };
    }
    supportsSignatureVerification() {
        return true;
    }
    async getAvailableVersions() {
        // TODO get these dynamically!
        // We will need Microsoft to add an endpoint where we can query for versions.
        const owner = 'actions';
        const repository = 'setup-java';
        const branch = 'main';
        const filePath = 'src/distributions/microsoft/microsoft-openjdk-versions.json';
        let releases = null;
        const fileUrl = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;
        const headers = (0,util/* getGitHubHttpHeaders */.U_)();
        let response = null;
        if (core/* isDebug */._o()) {
            console.time('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
        }
        try {
            response = await this.http.getJson(fileUrl, headers);
            if (!response.result) {
                return null;
            }
        }
        catch (err) {
            core/* debug */.Yz(`Http request for microsoft-openjdk-versions.json failed with status code: ${response?.statusCode}. Error: ${err}`);
            return null;
        }
        if (response.result) {
            releases = response.result;
        }
        if (core/* isDebug */._o() && releases) {
            core/* startGroup */.Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Microsoft took'); // eslint-disable-line no-console
            core/* debug */.Yz(`Available versions: [${releases.length}]`);
            core/* debug */.Yz(releases.map(item => item.version).join(', '));
            core/* endGroup */.N4();
        }
        return releases;
    }
}


/***/ }),

/***/ 8343:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Fh: () => (/* binding */ importKey),
/* harmony export */   Yi: () => (/* binding */ verifyPackageSignature)
/* harmony export */ });
/* unused harmony exports PRIVATE_KEY_FILE, toGpgPath, deleteKey */
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _actions_io__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8701);
/* harmony import */ var _actions_exec__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(5260);
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(9805);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4527);






const PRIVATE_KEY_FILE = path__WEBPACK_IMPORTED_MODULE_1__.join(_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getTempDir */ .G4(), 'private-key.asc');
const PRIVATE_KEY_FINGERPRINT_REGEX = /\w{40}/;
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
async function importKey(privateKey) {
    fs__WEBPACK_IMPORTED_MODULE_0__.writeFileSync(PRIVATE_KEY_FILE, privateKey, {
        encoding: 'utf-8',
        flag: 'w'
    });
    let output = '';
    const options = {
        silent: true,
        listeners: {
            stdout: (data) => {
                output += data.toString();
            }
        }
    };
    await _actions_exec__WEBPACK_IMPORTED_MODULE_3__/* .exec */ .m('gpg', [
        '--batch',
        '--import-options',
        'import-show',
        '--import',
        PRIVATE_KEY_FILE
    ], options);
    await _actions_io__WEBPACK_IMPORTED_MODULE_2__/* .rmRF */ .Yz(PRIVATE_KEY_FILE);
    const match = output.match(PRIVATE_KEY_FINGERPRINT_REGEX);
    return match && match[0];
}
async function deleteKey(keyFingerprint) {
    await exec.exec('gpg', ['--batch', '--yes', '--delete-secret-and-public-key', keyFingerprint], {
        silent: true
    });
}
async function verifyPackageSignature(archivePath, signatureUrl, publicKeyContent) {
    const signaturePath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_4__/* .downloadTool */ .bq(signatureUrl);
    let gpgHome;
    try {
        gpgHome = fs__WEBPACK_IMPORTED_MODULE_0__.mkdtempSync(path__WEBPACK_IMPORTED_MODULE_1__.join(_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getTempDir */ .G4(), 'verify-signature-gpg-home-'));
    }
    catch (error) {
        try {
            await _actions_io__WEBPACK_IMPORTED_MODULE_2__/* .rmRF */ .Yz(signaturePath);
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
        await _actions_exec__WEBPACK_IMPORTED_MODULE_3__/* .exec */ .m('gpg', [
            '--homedir',
            toGpgPath(gpgHome),
            '--batch',
            '--import',
            toGpgPath(publicKeyFile)
        ], options);
        await _actions_exec__WEBPACK_IMPORTED_MODULE_3__/* .exec */ .m('gpg', [
            '--homedir',
            toGpgPath(gpgHome),
            '--batch',
            '--verify',
            toGpgPath(signaturePath),
            toGpgPath(archivePath)
        ], options);
    }
    finally {
        await _actions_io__WEBPACK_IMPORTED_MODULE_2__/* .rmRF */ .Yz(signaturePath);
        await _actions_io__WEBPACK_IMPORTED_MODULE_2__/* .rmRF */ .Yz(gpgHome);
    }
}


/***/ })

};

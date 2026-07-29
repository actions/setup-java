export const id = 978;
export const ids = [978];
export const modules = {

/***/ 9597:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   ZuluDistribution: () => (/* binding */ ZuluDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9805);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(6242);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4527);







class ZuluDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Zulu', installerOptions);
    }
    async findPackageForDownload(version) {
        const availableVersionsRaw = await this.getAvailableVersions();
        const availableVersions = availableVersionsRaw.map(item => {
            // The Azul Metadata API reports the JDK build number separately from
            // java_version (e.g. java_version=[17,0,7], openjdk_build_number=7).
            // Append it so the resulting semver retains the build (e.g. 17.0.7+7).
            const javaVersion = item.openjdk_build_number != null
                ? [...item.java_version, item.openjdk_build_number]
                : item.java_version;
            return {
                version: (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .convertVersionToSemver */ .ZY)(javaVersion),
                url: item.download_url,
                zuluVersion: (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .convertVersionToSemver */ .ZY)(item.distro_version),
                packageUuid: item.package_uuid
            };
        });
        const satisfiedVersions = availableVersions
            .filter(item => (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .isVersionSatisfies */ .y)(version, item.version))
            .sort((a, b) => {
            // Azul provides two versions: java_version and distro_version
            // we should sort by both fields by descending
            return (-semver__WEBPACK_IMPORTED_MODULE_4___default().compareBuild(a.version, b.version) ||
                -semver__WEBPACK_IMPORTED_MODULE_4___default().compareBuild(a.zuluVersion, b.zuluVersion));
        })
            .map((item) => ({
            version: item.version,
            url: item.url,
            packageUuid: item.packageUuid
        }));
        const resolvedFullVersion = satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
        if (!resolvedFullVersion) {
            const availableVersionStrings = availableVersions.map(item => item.version);
            throw this.createVersionNotFoundError(version, availableVersionStrings);
        }
        const packageDetailsUrl = `https://api.azul.com/metadata/v1/zulu/packages/${resolvedFullVersion.packageUuid}`;
        const packageDetails = (await this.http.getJson(packageDetailsUrl)).result;
        const digest = packageDetails?.sha256_hash?.match(/^[a-f0-9]{64}$/i)?.[0];
        if (!digest) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`No authoritative sha256 checksum is available for Zulu version ${resolvedFullVersion.version} from ${packageDetailsUrl}; skipping checksum verification.`);
        }
        return {
            version: resolvedFullVersion.version,
            url: resolvedFullVersion.url,
            checksum: digest
                ? {
                    algorithm: 'sha256',
                    value: digest,
                    source: packageDetailsUrl
                }
                : undefined
        };
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getDownloadArchiveExtension */ .ag)();
        if (process.platform === 'win32') {
            javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .renameWinArchive */ .n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .extractJdkFile */ .PE)(javaArchivePath, extension);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_3___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_2___default().join(extractedJavaPath, archiveName);
        const javaPath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_1__/* .cacheDir */ .e8(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaRelease.version), this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async getAvailableVersions() {
        const arch = this.getArchitectureOptions();
        const [bundleType, features] = this.packageType.split('+');
        const platform = this.getPlatformOption();
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getDownloadArchiveExtension */ .ag)();
        const javafx = features?.includes('fx') ?? false;
        const crac = features?.includes('crac') ?? false;
        const releaseStatus = this.stable ? 'ga' : 'ea';
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            console.time('Retrieving available versions for Zulu took'); // eslint-disable-line no-console
        }
        const baseRequestArguments = [
            `os=${platform}`,
            `archive_type=${extension}`,
            `java_package_type=${bundleType}`,
            `javafx_bundled=${javafx}`,
            `crac_supported=${crac}`,
            `arch=${arch}`,
            `release_status=${releaseStatus}`,
            `availability_types=ca`
        ].join('&');
        // Need to iterate through all pages to retrieve the list of all versions.
        // The Azul API doesn't return a total page count, so paginate until a page
        // comes back empty (or short), guarding against a runaway loop with a cap.
        const pageSize = 100;
        const maxPages = 100;
        let pageIndex = 1;
        const availableVersions = [];
        while (pageIndex <= maxPages) {
            const requestArguments = `${baseRequestArguments}&page=${pageIndex}&page_size=${pageSize}`;
            const availableVersionsUrl = `https://api.azul.com/metadata/v1/zulu/packages/?${requestArguments}`;
            if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o() && pageIndex === 1) {
                // the url is identical except for the page number, so print it once for debug
                _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Gathering available versions from '${availableVersionsUrl}'`);
            }
            const paginationPage = (await this.http.getJson(availableVersionsUrl)).result;
            if (!paginationPage || paginationPage.length === 0) {
                // stop paginating because we have reached the end of the results
                break;
            }
            availableVersions.push(...paginationPage);
            if (paginationPage.length < pageSize) {
                // a short page means this was the last one; avoid an extra empty request
                break;
            }
            pageIndex++;
        }
        if (pageIndex > maxPages) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .warning */ .$e(`Reached the maximum of ${maxPages} pages while listing Zulu versions; results may be truncated.`);
        }
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .startGroup */ .Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Zulu took'); // eslint-disable-line no-console
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Available versions: [${availableVersions.length}]`);
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(availableVersions.map(item => item.java_version.join('.')).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .endGroup */ .N4();
        }
        return availableVersions;
    }
    getArchitectureOptions() {
        const arch = this.distributionArchitecture();
        switch (arch) {
            case 'x64':
                return 'x64';
            case 'x86':
                // The Azul Metadata API's "x86" value returns both 32-bit (i686) and
                // 64-bit (x64) packages, which are indistinguishable by version and
                // would let a 32-bit request resolve to a 64-bit JDK. Use "i686" to
                // target only genuine 32-bit builds, matching the legacy API behavior.
                return 'i686';
            case 'armv7':
                return 'arm';
            case 'aarch64':
            case 'arm64':
                return 'aarch64';
            default:
                return arch;
        }
    }
    getPlatformOption() {
        // Azul has own platform names so need to map them
        switch (process.platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
                return 'windows';
            case 'linux':
                // The new Metadata API's "linux" value returns both glibc and musl packages;
                // use "linux_glibc" to target only glibc, which is what standard runners use.
                return 'linux_glibc';
            default:
                return process.platform;
        }
    }
}


/***/ })

};

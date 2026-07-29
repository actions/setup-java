export const id = 939;
export const ids = [939];
export const modules = {

/***/ 9939:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SemeruDistribution: () => (/* binding */ SemeruDistribution)
/* harmony export */ });
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6242);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4527);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3838);
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(9805);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_6__);







const supportedArchitectures = [
    'x64',
    'x86',
    'ppc64le',
    'ppc64',
    's390x',
    'aarch64'
];
class SemeruDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_0__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('IBM_Semeru', installerOptions);
    }
    async findPackageForDownload(version) {
        const arch = this.distributionArchitecture();
        if (!supportedArchitectures.includes(arch)) {
            throw new Error(`Unsupported architecture for IBM Semeru: ${this.architecture} for your current OS version, the following are supported: ${supportedArchitectures.join(', ')}`);
        }
        if (!this.stable) {
            throw new Error('IBM Semeru does not provide builds for early access versions');
        }
        if (this.packageType !== 'jdk' && this.packageType !== 'jre') {
            throw new Error('IBM Semeru only provide `jdk` and `jre` package types');
        }
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
                checksum: {
                    algorithm: 'sha256',
                    value: item.binaries[0].package.checksum,
                    source: item.binaries[0].package.checksum_link
                }
            };
        });
        const satisfiedVersions = availableVersionsWithBinaries
            .filter(item => (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .isVersionSatisfies */ .y)(version, item.version))
            .sort((a, b) => {
            return -semver__WEBPACK_IMPORTED_MODULE_1___default().compareBuild(a.version, b.version);
        });
        const resolvedFullVersion = satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
        if (!resolvedFullVersion) {
            const availableVersionStrings = availableVersionsWithBinaries.map(item => item.version);
            // Include platform context to help users understand OS-specific version availability
            // IBM Semeru builds are OS-specific, so platform info aids in troubleshooting
            const platformContext = `Platform: ${process.platform}`;
            throw this.createVersionNotFoundError(version, availableVersionStrings, platformContext);
        }
        return resolvedFullVersion;
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Extracting Java archive...`);
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .getDownloadArchiveExtension */ .ag)();
        if (process.platform === 'win32') {
            javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .renameWinArchive */ .n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .extractJdkFile */ .PE)(javaArchivePath, extension);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_5___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_6___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_4__/* .cacheDir */ .e8(archivePath, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    get toolcacheFolderName() {
        return super.toolcacheFolderName;
    }
    async getAvailableVersions() {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        const imageType = this.packageType;
        const versionRange = encodeURI('[1.0,100.0]'); // retrieve all available versions
        const releaseType = this.stable ? 'ga' : 'ea';
        if (_actions_core__WEBPACK_IMPORTED_MODULE_3__/* .isDebug */ ._o()) {
            console.time('Retrieving available versions for Semeru took'); // eslint-disable-line no-console
        }
        const baseRequestArguments = [
            `project=jdk`,
            'vendor=ibm',
            `heap_size=normal`,
            'sort_method=DEFAULT',
            'sort_order=DESC',
            `os=${platform}`,
            `architecture=${arch}`,
            `image_type=${imageType}`,
            `release_type=${releaseType}`,
            `jvm_impl=openj9`
        ].join('&');
        const requestArguments = `${baseRequestArguments}&page_size=20&page=0`;
        let availableVersionsUrl = `https://api.adoptopenjdk.net/v3/assets/version/${versionRange}?${requestArguments}`;
        const availableVersions = [];
        let pageCount = 0;
        if (_actions_core__WEBPACK_IMPORTED_MODULE_3__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`Gathering available versions from '${availableVersionsUrl}'`);
        }
        while (availableVersionsUrl) {
            pageCount++;
            const response = await this.http.getJson(availableVersionsUrl);
            const paginationPage = response.result;
            const nextUrl = (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .getNextPageUrlFromLinkHeader */ .rC)(response.headers);
            if (nextUrl &&
                !(0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .validatePaginationUrl */ .SA)(nextUrl, 'https://api.adoptopenjdk.net')) {
                _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .warning */ .$e(`Ignoring pagination link with unexpected origin: ${nextUrl}`);
                availableVersionsUrl = null;
            }
            else {
                availableVersionsUrl = nextUrl;
            }
            if (paginationPage === null || paginationPage.length === 0) {
                break;
            }
            availableVersions.push(...paginationPage);
            if (pageCount >= _util_js__WEBPACK_IMPORTED_MODULE_2__/* .MAX_PAGINATION_PAGES */ .Tp) {
                _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .warning */ .$e(`Reached pagination safeguard limit (${_util_js__WEBPACK_IMPORTED_MODULE_2__/* .MAX_PAGINATION_PAGES */ .Tp} pages) while listing Semeru releases.`);
                break;
            }
        }
        if (_actions_core__WEBPACK_IMPORTED_MODULE_3__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .startGroup */ .Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Semeru took'); // eslint-disable-line no-console
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`Available versions: [${availableVersions.length}]`);
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(availableVersions.map(item => item.version_data.semver).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .endGroup */ .N4();
        }
        return availableVersions;
    }
    getPlatformOption() {
        // Adopt has own platform names so need to map them
        switch (process.platform) {
            case 'darwin':
                return 'mac';
            case 'win32':
                return 'windows';
            default:
                return process.platform;
        }
    }
}


/***/ })

};

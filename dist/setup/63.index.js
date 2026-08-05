export const id = 63;
export const ids = [63];
export const modules = {

/***/ 2063:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LibericaDistributions: () => (/* binding */ LibericaDistributions)
/* harmony export */ });
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6242);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4527);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3838);
/* harmony import */ var _platform_types_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(7444);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_5__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_6___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_6__);







const supportedPlatform = `'linux', 'linux-musl', 'macos', 'solaris', 'windows'`;
const supportedArchitectures = `'x86', 'x64', 'armv7', 'aarch64', 'ppc64le'`;
class LibericaDistributions extends _base_installer_js__WEBPACK_IMPORTED_MODULE_0__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Liberica', installerOptions);
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
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaRelease.version), this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async findPackageForDownload(range) {
        const availableVersionsRaw = await this.getAvailableVersions();
        const availableVersions = availableVersionsRaw.map(item => ({
            url: item.downloadUrl,
            version: this.convertVersionToSemver(item)
        }));
        const satisfiedVersion = availableVersions
            .filter(item => (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .isVersionSatisfies */ .y)(range, item.version))
            .sort((a, b) => -semver__WEBPACK_IMPORTED_MODULE_1___default().compareBuild(a.version, b.version))[0];
        if (!satisfiedVersion) {
            const availableVersionStrings = availableVersions.map(item => item.version);
            throw this.createVersionNotFoundError(range, availableVersionStrings);
        }
        return satisfiedVersion;
    }
    async getAvailableVersions() {
        if (_actions_core__WEBPACK_IMPORTED_MODULE_3__/* .isDebug */ ._o()) {
            console.time('Retrieving available versions for Liberica took'); // eslint-disable-line no-console
        }
        const url = this.prepareAvailableVersionsUrl();
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`Gathering available versions from '${url}'`);
        const availableVersions = (await this.http.getJson(url)).result ?? [];
        if (_actions_core__WEBPACK_IMPORTED_MODULE_3__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .startGroup */ .Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Liberica took'); // eslint-disable-line no-console
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`Available versions: [${availableVersions.length}]`);
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(availableVersions.map(item => item.version).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .endGroup */ .N4();
        }
        return availableVersions;
    }
    prepareAvailableVersionsUrl() {
        const urlOptions = {
            os: this.getPlatformOption(),
            'bundle-type': this.getBundleType(),
            ...this.getArchitectureOptions(),
            'build-type': this.stable ? 'all' : 'ea',
            'installation-type': 'archive',
            fields: 'downloadUrl,version,featureVersion,interimVersion,updateVersion,buildVersion'
        };
        const searchParams = new URLSearchParams(urlOptions).toString();
        return `https://api.bell-sw.com/v1/liberica/releases?${searchParams}`;
    }
    getBundleType() {
        const [bundleType, feature] = this.packageType.split('+');
        if (feature?.includes('fx')) {
            return bundleType + '-full';
        }
        return bundleType;
    }
    getArchitectureOptions() {
        const arch = this.distributionArchitecture();
        switch (arch) {
            case 'x86':
                return { bitness: '32', arch: 'x86' };
            case 'x64':
                return { bitness: '64', arch: 'x86' };
            case 'armv7':
                return { bitness: '32', arch: 'arm' };
            case 'aarch64':
                return { bitness: '64', arch: 'arm' };
            case 'ppc64le':
                return { bitness: '64', arch: 'ppc' };
            default:
                throw new Error(`Architecture '${this.architecture}' is not supported. Supported architectures: ${supportedArchitectures}`);
        }
    }
    getPlatformOption(platform = process.platform) {
        switch (platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
            case 'cygwin':
                return 'windows';
            case 'linux':
                return (0,_platform_types_js__WEBPACK_IMPORTED_MODULE_4__/* .isAlpineLinux */ .G6)(platform) ? 'linux-musl' : 'linux';
            case 'sunos':
                return 'solaris';
            default:
                throw new Error(`Platform '${platform}' is not supported. Supported platforms: ${supportedPlatform}`);
        }
    }
    convertVersionToSemver(version) {
        const { buildVersion, featureVersion, interimVersion, updateVersion } = version;
        const mainVersion = [featureVersion, interimVersion, updateVersion].join('.');
        if (buildVersion != 0) {
            return `${mainVersion}+${buildVersion}`;
        }
        return mainVersion;
    }
    distributionArchitecture() {
        const arch = super.distributionArchitecture();
        switch (arch) {
            case 'arm':
                return 'armv7';
            default:
                return arch;
        }
    }
}


/***/ })

};

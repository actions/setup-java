export const id = 524;
export const ids = [524];
export const modules = {

/***/ 8524:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LibericaNikDistributions: () => (/* binding */ LibericaNikDistributions)
/* harmony export */ });
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6242);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4527);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3838);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_5___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_5__);






const supportedPlatform = `'linux', 'macos', 'windows'`;
const supportedArchitectures = `'x64', 'aarch64'`;
class LibericaNikDistributions extends _base_installer_js__WEBPACK_IMPORTED_MODULE_0__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Liberica_NIK', installerOptions);
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
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_4___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_5___default().join(extractedJavaPath, archiveName);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaRelease.version), this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async findPackageForDownload(range) {
        const availableVersionsRaw = await this.getAvailableVersions();
        const availableVersions = availableVersionsRaw
            .map(item => {
            const jdkVersion = this.getJdkVersion(item);
            return jdkVersion ? { url: item.downloadUrl, version: jdkVersion } : null;
        })
            .filter((item) => item !== null);
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
            console.time('Retrieving available versions for Liberica NIK took'); // eslint-disable-line no-console
        }
        const url = this.prepareAvailableVersionsUrl();
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`Gathering available versions from '${url}'`);
        const availableVersions = (await this.http.getJson(url)).result ?? [];
        if (_actions_core__WEBPACK_IMPORTED_MODULE_3__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .startGroup */ .Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Liberica NIK took'); // eslint-disable-line no-console
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
            fields: 'downloadUrl,version,components,component,embedded'
        };
        const searchParams = new URLSearchParams(urlOptions).toString();
        return `https://api.bell-sw.com/v1/nik/releases?${searchParams}`;
    }
    // NIK's top-level `version` is the GraalVM/NIK version; the JDK version that
    // users select on lives in the embedded `liberica` component.
    getJdkVersion(release) {
        const liberica = release.components?.find(component => component.component === 'liberica');
        return liberica ? this.convertVersionToSemver(liberica.version) : null;
    }
    // The `full` bundle adds JavaFX/Swing GUI support; otherwise use `standard`.
    getBundleType() {
        const [, feature] = this.packageType.split('+');
        return feature?.includes('fx') ? 'full' : 'standard';
    }
    getArchitectureOptions() {
        const arch = this.distributionArchitecture();
        switch (arch) {
            case 'x64':
                return { bitness: '64', arch: 'x86' };
            case 'aarch64':
                return { bitness: '64', arch: 'arm' };
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
                return 'linux';
            default:
                throw new Error(`Platform '${platform}' is not supported. Supported platforms: ${supportedPlatform}`);
        }
    }
    // JDK versions come as strings like '25.0.1+16', '23+38' or '11.0.15.1+2'.
    // Normalize them to valid SemVer while preserving build metadata so newer
    // NIK builds of the same JDK sort ahead of older ones.
    convertVersionToSemver(jdkVersion) {
        const [main, build] = jdkVersion.split('+');
        const parts = main.split('.');
        while (parts.length < 3) {
            parts.push('0');
        }
        const base = parts.slice(0, 3).join('.');
        const buildMeta = [...parts.slice(3), ...(build ? [build] : [])];
        return buildMeta.length ? `${base}+${buildMeta.join('.')}` : base;
    }
}


/***/ })

};

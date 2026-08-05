export const id = 182;
export const ids = [182];
export const modules = {

/***/ 1182:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OracleDistribution: () => (/* binding */ OracleDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6242);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4527);
/* harmony import */ var _actions_http_client__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4942);






const ORACLE_DL_BASE = 'https://download.oracle.com/java';
class OracleDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_3__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Oracle', installerOptions);
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .getDownloadArchiveExtension */ .ag)();
        if (process.platform === 'win32') {
            javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .renameWinArchive */ .n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .extractJdkFile */ .PE)(javaArchivePath, extension);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_1___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_2___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, version, this.architecture);
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
            throw new Error('Oracle JDK provides only the `jdk` package type');
        }
        const platform = this.getPlatform();
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .getDownloadArchiveExtension */ .ag)();
        // The `latest` alias is normalized to the SemVer wildcard. Oracle builds its
        // download URLs from a concrete major and has no endpoint to list releases,
        // so resolve the newest available GA major from the Adoptium API and use it.
        if (this.latest) {
            const latestMajor = await (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .getLatestMajorVersion */ .ri)(this.http);
            range = latestMajor.toString();
        }
        const isOnlyMajorProvided = !range.includes('.');
        const major = isOnlyMajorProvided ? range : range.split('.')[0];
        const possibleUrls = [];
        /**
         * NOTE
         * If only major version was provided we will check it under /latest first
         * in order to retrieve the latest possible version if possible,
         * otherwise we will fall back to /archive where we are guaranteed to
         * find any version if it exists
         */
        if (isOnlyMajorProvided) {
            possibleUrls.push(`${ORACLE_DL_BASE}/${major}/latest/jdk-${major}_${platform}-${arch}_bin.${extension}`);
        }
        const floatingUrl = isOnlyMajorProvided ? possibleUrls[0] : undefined;
        possibleUrls.push(`${ORACLE_DL_BASE}/${major}/archive/jdk-${range}_${platform}-${arch}_bin.${extension}`);
        if (parseInt(major) < 17) {
            throw new Error('Oracle JDK is only supported for JDK 17 and later');
        }
        for (const url of possibleUrls) {
            const response = await this.http.head(url);
            if (response.message.statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_5__/* .HttpCodes */ .Hv.OK) {
                return {
                    url,
                    version: range,
                    checksum: await this.fetchChecksum(`${url}.sha256`, 'sha256'),
                    floating: url === floatingUrl
                };
            }
            if (response.message.statusCode !== _actions_http_client__WEBPACK_IMPORTED_MODULE_5__/* .HttpCodes */ .Hv.NotFound) {
                throw new Error(`Http request for Oracle JDK failed with status code: ${response.message.statusCode}`);
            }
        }
        if (this.latest) {
            const error = this.createVersionNotFoundError(range);
            error.message += `\nThe latest Java major version (${range}) is not yet available for the Oracle JDK distribution. Please specify a concrete version instead of 'latest'.`;
            throw error;
        }
        throw this.createVersionNotFoundError(range);
    }
    getPlatform(platform = process.platform) {
        switch (platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
                return 'windows';
            case 'linux':
                return 'linux';
            default:
                throw new Error(`Platform '${platform}' is not supported. Supported platforms: 'linux', 'macos', 'windows'`);
        }
    }
}


/***/ })

};

export const id = 151;
export const ids = [151];
export const modules = {

/***/ 8151:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   KonaDistribution: () => (/* binding */ KonaDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(6242);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4527);






const KONA_RELEASES_URL = 'https://tencent.github.io/konajdk/releases/kona-v1.json';
class KonaDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_4__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Kona', installerOptions);
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Kona JDK ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        const javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getDownloadArchiveExtension */ .ag)();
        const archivePath = process.platform === 'win32'
            ? (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .renameWinArchive */ .n2)(javaArchivePath)
            : javaArchivePath;
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .extractJdkFile */ .PE)(archivePath, extension);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath)[0];
        const jdkDirectory = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .cacheJdkDir */ .Vj)(jdkDirectory, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async findPackageForDownload(version) {
        if (!this.stable) {
            throw new Error('Kona provides stable releases only');
        }
        if (this.packageType !== 'jdk') {
            throw new Error('Kona provides jdk only');
        }
        const availableReleases = await this.getAvailableReleases();
        const releases = availableReleases
            .filter(item => {
            return (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .isVersionSatisfies */ .y)(version, item.version);
        })
            .map(item => {
            return {
                version: item.version,
                url: item.downloadUrl,
                checksum: item.checksum
                    ? {
                        algorithm: 'sha256',
                        value: item.checksum,
                        source: KONA_RELEASES_URL
                    }
                    : undefined
            };
        })
            .sort((a, b) => -semver__WEBPACK_IMPORTED_MODULE_1___default().compareBuild(a.version, b.version));
        if (!releases.length) {
            throw new Error(`No Kona release for the specified version "${version}" on OS "${this.getOs()}" and arch "${this.getArch()}".`);
        }
        return releases[0];
    }
    async getAvailableReleases() {
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            console.time('Retrieving available releases for Kona took'); // eslint-disable-line no-console
        }
        const releaseInfo = await this.fetchReleaseInfo();
        if (!releaseInfo) {
            throw new Error(`Couldn't fetch Kona release information`);
        }
        const availableReleases = this.chooseReleases(this.getOs(), this.getArch(), releaseInfo);
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .startGroup */ .Oh('Print information about available releases');
            console.timeEnd('Retrieving available releases for Kona took'); // eslint-disable-line no-console
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(availableReleases.map(item => item.version).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .endGroup */ .N4();
        }
        return availableReleases;
    }
    async fetchReleaseInfo() {
        try {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Fetching Kona release info from URL: ${KONA_RELEASES_URL}`);
            return (await this.http.getJson(KONA_RELEASES_URL))
                .result;
        }
        catch (err) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Fetching Kona release info from the URL: ${KONA_RELEASES_URL} failed with the error: ${err.message}`);
            return null;
        }
    }
    chooseReleases(os, arch, releaseInfo) {
        const releases = [];
        for (const majorVersion in releaseInfo) {
            const versions = releaseInfo[majorVersion];
            for (const version of versions) {
                if (!version.latest) {
                    continue;
                }
                for (const file of version.files) {
                    if (file.os === os && file.arch === arch) {
                        releases.push({
                            version: version.version,
                            jdkVersion: version.jdkVersion,
                            os: os,
                            arch: arch,
                            downloadUrl: version.baseUrl + file.filename,
                            checksum: file.checksum
                        });
                        break;
                    }
                }
            }
        }
        return releases;
    }
    getOs() {
        switch (process.platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
                return 'windows';
            default:
                return process.platform;
        }
    }
    getArch() {
        switch (this.architecture) {
            case 'arm64':
                return 'aarch64';
            case 'x64':
                return 'x86_64';
            default:
                return this.architecture;
        }
    }
}


/***/ })

};

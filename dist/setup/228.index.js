export const id = 228;
export const ids = [228];
export const modules = {

/***/ 8228:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   RedHatDistribution: () => (/* binding */ RedHatDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4527);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(6242);
/* harmony import */ var _platform_types_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(7444);







const DISCO_API_URL = 'https://api.foojay.io/disco/v3.0';
class RedHatDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('RedHat', installerOptions);
    }
    async findPackageForDownload(range) {
        if (!this.stable) {
            throw new Error('Early access versions are not supported');
        }
        const availablePackages = await this.getAvailablePackages();
        const normalizedPackages = availablePackages
            .map(item => ({
            item,
            version: this.normalizeDiscoVersion(item.java_version)
        }))
            .filter((item) => item.version !== null)
            .sort((left, right) => -semver__WEBPACK_IMPORTED_MODULE_3___default().compareBuild(left.version, right.version));
        const selectedPackage = normalizedPackages.find(item => (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .isVersionSatisfies */ .y)(range, item.version));
        if (!selectedPackage) {
            throw this.createVersionNotFoundError(range, normalizedPackages.map(item => item.version), `Operating system: ${this.getOperatingSystem()}`);
        }
        const detailsUrl = `${DISCO_API_URL}/ids/${selectedPackage.item.id}`;
        const response = await this.http.getJson(detailsUrl);
        const details = response.result?.result?.[0];
        if (!details?.direct_download_uri) {
            throw new Error(`Foojay Disco returned no direct Red Hat download URL for package '${selectedPackage.item.id}'.`);
        }
        if (details.checksum_type?.toLowerCase() !== 'sha256' ||
            !details.checksum.trim()) {
            throw new Error(`Foojay Disco returned no SHA-256 checksum for Red Hat package '${selectedPackage.item.id}'.`);
        }
        return {
            version: selectedPackage.version,
            url: details.direct_download_uri,
            checksum: {
                algorithm: 'sha256',
                value: details.checksum,
                source: detailsUrl
            }
        };
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq('Extracting Java archive...');
        const archiveType = this.getArchiveType();
        if (archiveType === 'zip') {
            javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .renameWinArchive */ .n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .extractJdkFile */ .PE)(javaArchivePath, archiveType);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_1___default().readdirSync(extractedJavaPath)[0];
        if (!archiveName) {
            throw new Error(`The Red Hat archive for Java ${javaRelease.version} was empty.`);
        }
        const archivePath = path__WEBPACK_IMPORTED_MODULE_2___default().join(extractedJavaPath, archiveName);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaRelease.version), this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async getAvailablePackages() {
        const operatingSystem = this.getOperatingSystem();
        const archiveType = this.getArchiveType();
        const query = new URLSearchParams({
            distro: 'redhat',
            release_status: 'ga',
            operating_system: operatingSystem,
            architecture: this.distributionArchitecture(),
            package_type: this.packageType,
            archive_type: archiveType,
            directly_downloadable: 'true'
        });
        const url = `${DISCO_API_URL}/packages?${query.toString()}`;
        const response = await this.http.getJson(url);
        const packages = response.result?.result;
        if (!Array.isArray(packages)) {
            throw new Error(`Could not fetch Red Hat package metadata from Foojay Disco: ${url}`);
        }
        return packages.filter(item => item.distribution === 'redhat' &&
            item.release_status === 'ga' &&
            item.operating_system === operatingSystem &&
            item.architecture === this.distributionArchitecture() &&
            item.package_type === this.packageType &&
            item.archive_type === archiveType &&
            item.directly_downloadable);
    }
    getOperatingSystem(alpine = (0,_platform_types_js__WEBPACK_IMPORTED_MODULE_6__/* .isAlpineLinux */ .G6)()) {
        if (alpine) {
            throw new Error("Distribution 'redhat' does not support Alpine Linux because Red Hat portable archives require glibc.");
        }
        return process.platform === 'win32' ? 'windows' : 'linux';
    }
    getArchiveType() {
        return process.platform === 'win32' ? 'zip' : 'tar.xz';
    }
    normalizeDiscoVersion(version) {
        let normalizedVersion = version.trim();
        if (/^\d+\+\d+$/.test(normalizedVersion)) {
            normalizedVersion = normalizedVersion.replace('+', '.0.0+');
        }
        else if (/^\d+$/.test(normalizedVersion)) {
            normalizedVersion = `${normalizedVersion}.0.0`;
        }
        else if (/^\d+\.\d+$/.test(normalizedVersion)) {
            normalizedVersion = `${normalizedVersion}.0`;
        }
        return semver__WEBPACK_IMPORTED_MODULE_3___default().valid(normalizedVersion) ? normalizedVersion : null;
    }
}


/***/ })

};

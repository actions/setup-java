export const id = 675;
export const ids = [675];
export const modules = {

/***/ 7675:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   DragonwellDistribution: () => (/* binding */ DragonwellDistribution)
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
/* harmony import */ var _platform_types_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(7444);







class DragonwellDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_4__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Dragonwell', installerOptions);
    }
    async findPackageForDownload(version) {
        if (!this.stable) {
            throw new Error('Early access versions are not supported by Dragonwell');
        }
        if (this.packageType !== 'jdk') {
            throw new Error('Dragonwell provides only the `jdk` package type');
        }
        const availableVersions = await this.getAvailableVersions();
        const matchedVersions = availableVersions
            .filter(item => {
            return (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .isVersionSatisfies */ .y)(version, item.jdk_version);
        })
            .map(item => {
            return {
                version: item.jdk_version,
                url: item.download_link,
                checksum: item.checksum
                    ? {
                        algorithm: 'sha256',
                        value: item.checksum
                    }
                    : undefined
            };
        });
        if (!matchedVersions.length) {
            const availableVersionStrings = availableVersions.map(item => item.jdk_version);
            throw this.createVersionNotFoundError(version, availableVersionStrings);
        }
        const resolvedVersion = matchedVersions[0];
        return resolvedVersion;
    }
    async getAvailableVersions() {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        let fetchedDragonwellJson = await this.fetchJsonFromPrimaryUrl();
        if (!fetchedDragonwellJson) {
            fetchedDragonwellJson = await this.fetchJsonFromBackupUrl();
        }
        if (!fetchedDragonwellJson) {
            throw new Error(`Couldn't fetch Dragonwell versions information from both primary and backup urls`);
        }
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz('Successfully fetched information about available Dragonwell versions');
        const availableVersions = this.parseVersions(platform, arch, fetchedDragonwellJson);
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .startGroup */ .Oh('Print information about available versions');
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(availableVersions.map(item => item.jdk_version).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .endGroup */ .N4();
        }
        return availableVersions;
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getDownloadArchiveExtension */ .ag)();
        if (process.platform === 'win32') {
            javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .renameWinArchive */ .n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .extractJdkFile */ .PE)(javaArchivePath, extension);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    parseVersions(platform, arch, dragonwellVersions) {
        const eligibleVersions = [];
        for (const majorVersion in dragonwellVersions) {
            const majorVersionMap = dragonwellVersions[majorVersion];
            for (let jdkVersion in majorVersionMap) {
                const jdkVersionMap = majorVersionMap[jdkVersion];
                if (!(platform in jdkVersionMap)) {
                    continue;
                }
                const platformMap = jdkVersionMap[platform];
                if (!(arch in platformMap)) {
                    continue;
                }
                const archMap = platformMap[arch];
                if (jdkVersion === 'latest') {
                    continue;
                }
                // Some version of Dragonwell JDK are numerated with help of non-semver notation (more then 3 digits).
                // Common practice is to transform excess digits to the so-called semver build part, which is prefixed with the plus sign, to be able to operate with them using semver tools.
                const jdkVersionNums = jdkVersion
                    .replace('+', '.')
                    .split('.');
                jdkVersion = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .convertVersionToSemver */ .ZY)(`${jdkVersionNums.slice(0, 3).join('.')}.${jdkVersionNums[jdkVersionNums.length - 1]}`);
                for (const edition in archMap) {
                    eligibleVersions.push({
                        os: platform,
                        architecture: arch,
                        jdk_version: jdkVersion,
                        checksum: archMap[edition].sha256 ?? '',
                        download_link: archMap[edition].download_url,
                        edition: edition,
                        image_type: 'jdk'
                    });
                    break; // Get the first available link to the JDK. In most cases it should point to the Extended version of JDK, in rare cases like with v17 it points to the Standard version (the only available).
                }
            }
        }
        const sortedVersions = this.sortParsedVersions(eligibleVersions);
        return sortedVersions;
    }
    // Sorts versions in descending order as by default data in JSON isn't sorted
    sortParsedVersions(eligibleVersions) {
        const sortedVersions = eligibleVersions.sort((versionObj1, versionObj2) => {
            const version1 = versionObj1.jdk_version;
            const version2 = versionObj2.jdk_version;
            return semver__WEBPACK_IMPORTED_MODULE_1___default().compareBuild(version1, version2);
        });
        return sortedVersions.reverse();
    }
    getPlatformOption() {
        switch (process.platform) {
            case 'win32':
                return 'windows';
            case 'linux':
                return (0,_platform_types_js__WEBPACK_IMPORTED_MODULE_6__/* .isAlpineLinux */ .G6)() ? 'alpine-linux' : 'linux';
            default:
                return process.platform;
        }
    }
    async fetchJsonFromPrimaryUrl() {
        const primaryUrl = 'https://dragonwell-jdk.io/map_with_checksum.json';
        try {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Trying to fetch available Dragonwell versions info from the primary url: ${primaryUrl}`);
            const fetchedDragonwellJson = (await this.http.getJson(primaryUrl)).result;
            return fetchedDragonwellJson;
        }
        catch (err) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Fetching Dragonwell versions info from the primary link: ${primaryUrl} ended up with the error: ${err.message}`);
            return null;
        }
    }
    async fetchJsonFromBackupUrl() {
        const owner = 'dragonwell-releng';
        const repository = 'dragonwell-setup-java';
        const branch = 'main';
        const filePath = 'releases.json';
        const backupUrl = `https://api.github.com/repos/${owner}/${repository}/contents/${filePath}?ref=${branch}`;
        const headers = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getGitHubHttpHeaders */ .U_)();
        try {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Trying to fetch available Dragonwell versions info from the backup url: ${backupUrl}`);
            const fetchedDragonwellJson = (await this.http.getJson(backupUrl, headers)).result;
            return fetchedDragonwellJson;
        }
        catch (err) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Fetching Dragonwell versions info from the backup url: ${backupUrl} ended up with the error: ${err.message}`);
            return null;
        }
    }
}


/***/ })

};

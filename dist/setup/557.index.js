export const id = 557;
export const ids = [557];
export const modules = {

/***/ 7557:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   SapMachineDistribution: () => (/* binding */ SapMachineDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4527);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(6242);






class SapMachineDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('SapMachine', installerOptions);
    }
    async findPackageForDownload(version) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Only stable versions: ${this.stable}`);
        if (!['jdk', 'jre'].includes(this.packageType)) {
            throw new Error('SapMachine provides only the `jdk` and `jre` package type');
        }
        const availableVersions = await this.getAvailableVersions();
        const matchedVersions = availableVersions
            .filter(item => {
            return (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .isVersionSatisfies */ .y)(version, item.version);
        })
            .map(item => {
            return {
                version: item.version,
                url: item.downloadLink
            };
        });
        if (!matchedVersions.length) {
            const availableVersionStrings = availableVersions.map(item => item.version);
            throw this.createVersionNotFoundError(version, availableVersionStrings);
        }
        const resolvedVersion = matchedVersions[0];
        const checksumUrl = resolvedVersion.url.replace(/\.(?:tar\.gz|zip)$/, '.sha256.txt');
        return {
            ...resolvedVersion,
            checksum: await this.fetchChecksum(checksumUrl, 'sha256')
        };
    }
    async getAvailableVersions() {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        let fetchedReleasesJson = await this.fetchReleasesFromUrl('https://sapmachine.io/assets/data/sapmachine-releases-all.json');
        if (!fetchedReleasesJson) {
            fetchedReleasesJson = await this.fetchReleasesFromUrl('https://sap.github.io/SapMachine/assets/data/sapmachine-releases-all.json');
        }
        if (!fetchedReleasesJson) {
            throw new Error(`Couldn't fetch SapMachine versions information from both primary and backup urls`);
        }
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz('Successfully fetched information about available SapMachine versions');
        const availableVersions = this.parseVersions(platform, arch, fetchedReleasesJson);
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .startGroup */ .Oh('Print information about available versions');
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(availableVersions.map(item => item.version).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .endGroup */ .N4();
        }
        return availableVersions;
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
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    parseVersions(platform, arch, versions) {
        const eligibleVersions = [];
        for (const [, majorVersionMap] of Object.entries(versions)) {
            for (const [, jdkVersionMap] of Object.entries(majorVersionMap.updates)) {
                for (const [buildVersion, buildVersionMap] of Object.entries(jdkVersionMap)) {
                    let buildVersionWithoutPrefix = buildVersion.replace('sapmachine-', '');
                    if (!buildVersionWithoutPrefix.includes('.')) {
                        // replace major version with major.minor.patch and keep the remaining build identifier after the + as is with regex
                        buildVersionWithoutPrefix = buildVersionWithoutPrefix.replace(/(\d+)(\+.*)?/, '$1.0.0$2');
                    }
                    // replace + with . to convert to semver format if we have more than 3 version digits
                    if (buildVersionWithoutPrefix.split('.').length > 3) {
                        buildVersionWithoutPrefix = buildVersionWithoutPrefix.replace('+', '.');
                    }
                    buildVersionWithoutPrefix = (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .convertVersionToSemver */ .ZY)(buildVersionWithoutPrefix);
                    // ignore invalid version
                    if (!semver__WEBPACK_IMPORTED_MODULE_1___default().valid(buildVersionWithoutPrefix)) {
                        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Invalid version: ${buildVersionWithoutPrefix}`);
                        continue;
                    }
                    const isEarlyAccess = buildVersionMap.ea === true || buildVersionMap.ea === 'true';
                    if (this.stable === isEarlyAccess) {
                        continue;
                    }
                    for (const [edition, editionAssets] of Object.entries(buildVersionMap.assets)) {
                        if (this.packageType !== edition) {
                            continue;
                        }
                        for (const [archAndPlatForm, archAssets] of Object.entries(editionAssets)) {
                            let expectedArchAndPlatform = `${platform}-${arch}`;
                            if (platform === 'linux-musl') {
                                expectedArchAndPlatform = `linux-${arch}-musl`;
                            }
                            if (archAndPlatForm !== expectedArchAndPlatform) {
                                continue;
                            }
                            for (const [contentType, contentTypeAssets] of Object.entries(archAssets)) {
                                // skip if not tar.gz and zip files
                                if (contentType !== 'tar.gz' && contentType !== 'zip') {
                                    continue;
                                }
                                eligibleVersions.push({
                                    os: platform,
                                    architecture: arch,
                                    version: buildVersionWithoutPrefix,
                                    checksum: contentTypeAssets.checksum,
                                    downloadLink: contentTypeAssets.url,
                                    packageType: edition
                                });
                            }
                        }
                    }
                }
            }
        }
        const sortedVersions = this.sortParsedVersions(eligibleVersions);
        return sortedVersions;
    }
    // Sorts versions in descending order as by default data in JSON isn't sorted
    sortParsedVersions(eligibleVersions) {
        const sortedVersions = eligibleVersions.sort((versionObj1, versionObj2) => {
            const version1 = versionObj1.version;
            const version2 = versionObj2.version;
            return semver__WEBPACK_IMPORTED_MODULE_1___default().compareBuild(version1, version2);
        });
        return sortedVersions.reverse();
    }
    getPlatformOption() {
        switch (process.platform) {
            case 'win32':
                return 'windows';
            case 'darwin':
                return 'macos';
            case 'linux':
                // figure out if alpine/musl
                if (fs__WEBPACK_IMPORTED_MODULE_2___default().existsSync('/etc/alpine-release')) {
                    return 'linux-musl';
                }
                return 'linux';
            default:
                return process.platform;
        }
    }
    async fetchReleasesFromUrl(url, headers = {}) {
        try {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Trying to fetch available SapMachine versions info from the primary url: ${url}`);
            const releases = (await this.http.getJson(url, headers)).result;
            return releases;
        }
        catch (err) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Fetching SapMachine versions info from the link: ${url} ended up with the error: ${err.message}`);
            return null;
        }
    }
}


/***/ })

};

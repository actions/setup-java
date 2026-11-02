export const id = 126;
export const ids = [126];
export const modules = {

/***/ 4126:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   CorrettoDistribution: () => (/* binding */ CorrettoDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _actions_http_client__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(4942);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(4527);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(6242);
/* harmony import */ var _platform_types_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(7444);







const CORRETTO_VERSIONS_URL = 'https://corretto.github.io/corretto-downloads/latest_links/indexmap_with_checksum.json';
class CorrettoDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    requestedVersion;
    constructor(installerOptions) {
        super('Corretto', {
            ...installerOptions,
            // Java 8 releases use zero-padded fields, e.g. 8.472.08.1.
            version: (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .isExactCorrettoVersion */ .kI)(installerOptions.version)
                ? installerOptions.version.replace(/(^|\.)0+(?=\d)/g, '$1')
                : installerOptions.version
        });
        this.requestedVersion = installerOptions.version
            .replace('+', '.')
            .replace(/^8\.(\d+)\.(\d)\./, '8.$1.0$2.');
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
    async findPackageForDownload(version) {
        if (!this.stable) {
            throw new Error('Early access versions are not supported');
        }
        if ((0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .isExactCorrettoVersion */ .kI)(this.requestedVersion)) {
            return this.findExactRelease();
        }
        const availableVersions = await this.getAvailableVersions();
        // The `latest` alias is normalized to the SemVer wildcard, but Corretto
        // matches on an exact major version, so resolve it to the newest available
        // major from Corretto's own list.
        if (this.latest) {
            const majors = availableVersions
                .map(item => parseInt(item.version, 10))
                .filter(major => Number.isFinite(major) && major > 0);
            if (majors.length === 0) {
                throw new Error('Could not determine the latest available Corretto major version from remote metadata');
            }
            version = Math.max(...majors).toString();
        }
        if (version.includes('.')) {
            throw new Error('Specify a major version or a full Corretto release, such as 25.0.5.0.10');
        }
        const matchingVersions = availableVersions
            .filter(item => item.version == version)
            .map(item => {
            return {
                version: (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .convertVersionToSemver */ .ZY)(item.correttoVersion),
                url: item.downloadLink,
                checksum: {
                    algorithm: 'sha256',
                    value: item.checksum_sha256,
                    source: CORRETTO_VERSIONS_URL
                }
            };
        });
        const resolvedVersion = matchingVersions.length > 0 ? matchingVersions[0] : null;
        if (!resolvedVersion) {
            const availableVersionStrings = availableVersions.map(item => item.version);
            throw this.createVersionNotFoundError(version, availableVersionStrings);
        }
        return resolvedVersion;
    }
    async findExactRelease() {
        const version = this.requestedVersion;
        const major = version.split('.')[0];
        const platform = this.getPlatformOption();
        const arch = this.architecture;
        if (platform !== 'windows' && this.packageType !== 'jdk') {
            throw new Error('Corretto JRE archives are only available for Windows');
        }
        const os = platform === 'macos'
            ? 'macosx'
            : platform === 'alpine'
                ? 'alpine-linux'
                : platform;
        const suffix = platform === 'windows' ? `-${this.packageType}.zip` : '.tar.gz';
        const url = `https://corretto.aws/downloads/resources/${version}/amazon-corretto-${version}-${os}-${arch}${suffix}`;
        // Versioned archives have no checksum sidecar; Amazon publishes their SHA-256s in the release notes.
        const source = `https://api.github.com/repos/corretto/corretto-${major}/releases/tags/${version}`;
        const response = await this.http.getJson(source, {
            ...(0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .getGitHubHttpHeaders */ .U_)(),
            accept: 'application/vnd.github+json'
        });
        const row = response.result?.body
            ?.split(/\r?\n/)
            .find(line => line.includes(`](${url})`));
        const checksum = row?.match(/`([a-fA-F0-9]{64})`/)?.[1];
        if (checksum) {
            return {
                version: this.version,
                url,
                checksum: { algorithm: 'sha256', value: checksum, source }
            };
        }
        // The current catalog also covers releases missing from GitHub, such as Corretto 15 and 16.
        const archive = (await this.getAvailableVersions()).find(item => item.downloadLink === url);
        if (archive) {
            return {
                version: this.version,
                url,
                checksum: {
                    algorithm: 'sha256',
                    value: archive.checksum_sha256,
                    source: CORRETTO_VERSIONS_URL
                }
            };
        }
        if (response.statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_3__/* .HttpCodes */ .Hv.NotFound) {
            throw new Error(`Corretto release ${version} was not found in Amazon's GitHub releases or current download catalog`);
        }
        if (!row) {
            throw new Error(`No ${platform}/${arch} ${this.packageType} archive is listed for Corretto ${version}`);
        }
        throw new Error(`No SHA-256 checksum is published for Corretto ${version} (${platform}, ${arch}, ${this.packageType})`);
    }
    async getAvailableVersions() {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        const imageType = this.packageType;
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            console.time('Retrieving available versions for Corretto took'); // eslint-disable-line no-console
        }
        const fetchCurrentVersions = await this.http.getJson(CORRETTO_VERSIONS_URL);
        const fetchedCurrentVersions = fetchCurrentVersions.result;
        if (!fetchedCurrentVersions) {
            throw Error(`Could not fetch latest corretto versions from ${CORRETTO_VERSIONS_URL}`);
        }
        const eligibleVersions = fetchedCurrentVersions?.[platform]?.[arch]?.[imageType];
        const availableVersions = this.getAvailableVersionsForPlatform(eligibleVersions);
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .startGroup */ .Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for Corretto took'); // eslint-disable-line no-console
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Available versions: [${availableVersions.length}]`);
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(availableVersions
                .map(item => `${item.version}: ${item.correttoVersion}`)
                .join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .endGroup */ .N4();
        }
        return availableVersions;
    }
    getAvailableVersionsForPlatform(eligibleVersions) {
        const availableVersions = [];
        for (const version in eligibleVersions) {
            const availableVersion = eligibleVersions[version];
            for (const fileType in availableVersion) {
                const skipNonExtractableBinaries = fileType != (0,_util_js__WEBPACK_IMPORTED_MODULE_4__/* .getDownloadArchiveExtension */ .ag)();
                if (skipNonExtractableBinaries) {
                    continue;
                }
                const availableVersionDetails = availableVersion[fileType];
                const correttoVersion = this.getCorrettoVersion(availableVersionDetails.resource);
                availableVersions.push({
                    checksum: availableVersionDetails.checksum,
                    checksum_sha256: availableVersionDetails.checksum_sha256,
                    fileType,
                    resource: availableVersionDetails.resource,
                    downloadLink: `https://corretto.aws${availableVersionDetails.resource}`,
                    version: version,
                    correttoVersion
                });
            }
        }
        return availableVersions;
    }
    getPlatformOption() {
        // Corretto has its own platform names so we need to map them
        switch (process.platform) {
            case 'darwin':
                return 'macos';
            case 'win32':
                return 'windows';
            case 'linux':
                return (0,_platform_types_js__WEBPACK_IMPORTED_MODULE_6__/* .isAlpineLinux */ .G6)() ? 'alpine' : 'linux';
            default:
                return process.platform;
        }
    }
    distributionArchitecture() {
        const architecture = super.distributionArchitecture();
        return architecture === 'armv7' ? 'arm' : architecture;
    }
    getCorrettoVersion(resource) {
        const regex = /(\d+.+)\//;
        const match = regex.exec(resource);
        if (match === null) {
            throw Error(`Could not parse corretto version from ${resource}`);
        }
        return match[1];
    }
}


/***/ })

};

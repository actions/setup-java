export const id = 735;
export const ids = [735];
export const modules = {

/***/ 3735:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   OpenJdkDistribution: () => (/* binding */ OpenJdkDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9805);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(6242);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4527);







const OPENJDK_BASE_URL = 'https://jdk.java.net';
class OpenJdkDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('Oracle OpenJDK', installerOptions);
    }
    async findPackageForDownload(range) {
        if (this.packageType !== 'jdk') {
            throw new Error('Oracle OpenJDK provides only the `jdk` package type');
        }
        const arch = this.distributionArchitecture();
        if (!['x64', 'aarch64'].includes(arch)) {
            throw new Error(`Unsupported architecture: ${this.architecture}`);
        }
        const platform = this.getPlatform();
        const releases = await this.getAvailableVersions(platform, arch);
        const matchingReleases = releases
            .filter(release => (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .isVersionSatisfies */ .y)(range, release.version))
            .sort((left, right) => -semver__WEBPACK_IMPORTED_MODULE_4___default().compareBuild(left.version, right.version));
        if (!matchingReleases.length) {
            throw this.createVersionNotFoundError(range, releases.map(release => release.version), `Platform: ${platform}`);
        }
        const release = matchingReleases[0];
        return {
            ...release,
            checksum: await this.fetchChecksum(`${release.url}.sha256`, 'sha256')
        };
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        let javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extension = javaRelease.url.endsWith('.zip') ? 'zip' : 'tar.gz';
        if (extension === 'zip') {
            javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .renameWinArchive */ .n2)(javaArchivePath);
        }
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .extractJdkFile */ .PE)(javaArchivePath, extension);
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, archiveName);
        const javaPath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_1__/* .cacheDir */ .e8(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaRelease.version), this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async getAvailableVersions(platform, arch) {
        const homePage = await this.fetchPage(`${OPENJDK_BASE_URL}/`);
        const releasePageUrls = Array.from(homePage.matchAll(/href="\/(\d+)\/">JDK\s+\d+/g), match => `${OPENJDK_BASE_URL}/${match[1]}/`);
        const pages = await Promise.all(releasePageUrls.map(url => this.fetchPage(url)));
        if (this.stable) {
            pages.push(await this.fetchPage(`${OPENJDK_BASE_URL}/archive/`));
        }
        const releases = pages.flatMap(page => this.parseReleases(page, platform, arch));
        return releases.filter(release => release.url.includes('/early_access/') !== this.stable);
    }
    async fetchPage(url) {
        const response = await this.http.get(url);
        return response.readBody();
    }
    parseReleases(html, platform, arch) {
        const platformPattern = platform === 'macos' ? '(?:macos|osx)' : platform;
        const extensionPattern = platform === 'windows' ? '(?:zip|tar\\.gz)' : 'tar\\.gz';
        const pattern = new RegExp(`href="(https://download\\.java\\.net/[^"]+/openjdk-([^"_]+)_${platformPattern}-${arch}_bin\\.${extensionPattern})"`, 'g');
        return Array.from(html.matchAll(pattern), match => {
            const url = match[1];
            const build = url.match(/\/(\d+)\/(?:GPL\/)?openjdk-/)?.[1] ??
                this.findBuildInArchiveHeading(html, match.index, match[2]);
            return {
                version: this.toSemver(match[2], build),
                url
            };
        });
    }
    findBuildInArchiveHeading(html, assetIndex, version) {
        const headings = Array.from(html.slice(0, assetIndex).matchAll(/\(build\s+([^)]+)\)/g));
        const headingVersion = headings.at(-1)?.[1];
        if (!headingVersion) {
            return undefined;
        }
        const [javaVersion, build] = headingVersion.split('+');
        return javaVersion === version ? build : undefined;
    }
    toSemver(version, urlBuild) {
        const [javaVersion, filenameBuild] = version.replace('-ea', '').split('+');
        const versionParts = javaVersion.split('.');
        const normalizedVersion = (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .convertVersionToSemver */ .ZY)(versionParts.length === 1 ? `${javaVersion}.0.0` : javaVersion);
        const build = filenameBuild ?? (versionParts.length <= 3 ? urlBuild : undefined);
        return build ? `${normalizedVersion}+${build}` : normalizedVersion;
    }
    getPlatform(platform = process.platform) {
        switch (platform) {
            case 'darwin':
                return 'macos';
            case 'linux':
                return 'linux';
            case 'win32':
                return 'windows';
            default:
                throw new Error(`Platform '${platform}' is not supported. Supported platforms: 'linux', 'macos', 'windows'`);
        }
    }
}


/***/ })

};

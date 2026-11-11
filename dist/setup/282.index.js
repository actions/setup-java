export const id = 282;
export const ids = [282];
export const modules = {

/***/ 2282:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   JetBrainsDistribution: () => (/* binding */ JetBrainsDistribution)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(2088);
/* harmony import */ var semver__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(semver__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(6242);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4527);
/* harmony import */ var _actions_http_client__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4942);







const JETBRAINS_RELEASES_URL = 'https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases?per_page=100';
const GITHUB_API_ORIGIN = 'https://api.github.com';
class JetBrainsDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_4__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('JetBrains', installerOptions);
    }
    async findPackageForDownload(range) {
        const versionsRaw = await this.getAvailableVersions();
        const versions = versionsRaw.map(v => {
            const formattedVersion = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .normalizeJavaVersionToSemver */ .zZ)(`${v.semver}+${v.build}`);
            return {
                version: formattedVersion,
                url: v.url
            };
        });
        const satisfiedVersions = versions
            .filter(item => this.isVersionSatisfied(range, item.version))
            .sort((a, b) => {
            return -this.compareVersions(a.version, b.version);
        });
        const resolvedFullVersion = satisfiedVersions.length > 0 ? satisfiedVersions[0] : null;
        if (!resolvedFullVersion) {
            const availableVersionStrings = versionsRaw.map(item => `${item.tag_name} (${item.semver}+${item.build})`);
            throw this.createVersionNotFoundError(range, availableVersionStrings);
        }
        return {
            ...resolvedFullVersion,
            // JetBrains' `.checksum` sibling doesn't disclose its algorithm via the
            // filename, and older JBR builds (e.g. JBR 11) publish a SHA-256 digest
            // there while newer builds publish SHA-512. Accept either, preferring
            // the stronger SHA-512 when the digest length is ambiguous.
            checksum: await this.fetchChecksum(`${resolvedFullVersion.url}.checksum`, ['sha512', 'sha256'])
        };
    }
    normalizeVersion(version) {
        const normalized = super.normalizeVersion(version);
        if (/^\d+\.\d+\.\d+(?:\.\d+)+(?:-ea)?$/.test(version)) {
            // A patch-only request must match any JBR build of that patch.
            normalized.version = version.replace(/-ea$/, '');
        }
        return normalized;
    }
    isVersionSatisfied(range, version) {
        const patchRequest = range.match(/^(\d+\.\d+\.\d+)((?:\.\d+)+)$/);
        if (patchRequest) {
            const candidate = semver__WEBPACK_IMPORTED_MODULE_3___default().parse(version);
            return (candidate !== null &&
                semver__WEBPACK_IMPORTED_MODULE_3___default().eq(patchRequest[1], candidate) &&
                (candidate.build.slice(0, -2).join('.') || '0') ===
                    patchRequest[2].slice(1));
        }
        return super.isVersionSatisfied(range, version);
    }
    compareVersions(a, b) {
        const mainComparison = semver__WEBPACK_IMPORTED_MODULE_3___default().compare(a, b);
        if (mainComparison !== 0) {
            return mainComparison;
        }
        // JBR builds have two components (one in older releases). Any preceding
        // metadata components are Java patch fields and take priority over builds.
        const first = new (semver__WEBPACK_IMPORTED_MODULE_3___default().SemVer)(a).build;
        const second = new (semver__WEBPACK_IMPORTED_MODULE_3___default().SemVer)(b).build;
        const firstPatch = first.slice(0, -2);
        const secondPatch = second.slice(0, -2);
        for (let index = 0; index < Math.max(firstPatch.length, secondPatch.length); index++) {
            const patchComparison = semver__WEBPACK_IMPORTED_MODULE_3___default().compareIdentifiers(firstPatch[index] ?? '0', secondPatch[index] ?? '0');
            if (patchComparison !== 0) {
                return patchComparison;
            }
        }
        return semver__WEBPACK_IMPORTED_MODULE_3___default().compareBuild(first.length ? `0.0.0+${first.slice(-2).join('.')}` : '0.0.0', second.length ? `0.0.0+${second.slice(-2).join('.')}` : '0.0.0');
    }
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        const javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .extractJdkFile */ .PE)(javaArchivePath, 'tar.gz');
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_1___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_2___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .cacheJdkDir */ .Vj)(archivePath, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async getAvailableVersions() {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            console.time('Retrieving available versions for JBR took'); // eslint-disable-line no-console
        }
        const rawVersions = [];
        const bearerToken = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getGitHubToken */ .lK)();
        const requestHeaders = {
            Accept: 'application/vnd.github+json'
        };
        if (bearerToken) {
            requestHeaders.Authorization = `Bearer ${bearerToken}`;
        }
        let releasesUrl = JETBRAINS_RELEASES_URL;
        let pageCount = 0;
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Gathering available versions from '${releasesUrl}'`);
        }
        while (releasesUrl) {
            pageCount++;
            const response = await this.http.getJson(releasesUrl, requestHeaders);
            const paginationPageResult = response.result;
            if (!paginationPageResult || paginationPageResult.length === 0) {
                break;
            }
            rawVersions.push(...paginationPageResult.filter(version => this.stable ? !version.prerelease : version.prerelease));
            const nextUrl = (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .getNextPageUrlFromLinkHeader */ .rC)(response.headers);
            if (nextUrl && !(0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .validatePaginationUrl */ .SA)(nextUrl, GITHUB_API_ORIGIN)) {
                _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .warning */ .$e(`Ignoring pagination link with unexpected origin: ${nextUrl}`);
                releasesUrl = null;
            }
            else {
                releasesUrl = nextUrl;
            }
            if (pageCount >= _util_js__WEBPACK_IMPORTED_MODULE_5__/* .MAX_PAGINATION_PAGES */ .Tp) {
                if (releasesUrl) {
                    _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .warning */ .$e(`Reached pagination safeguard limit (${_util_js__WEBPACK_IMPORTED_MODULE_5__/* .MAX_PAGINATION_PAGES */ .Tp} pages) while listing JetBrains Runtime releases.`);
                }
                break;
            }
        }
        if (this.stable) {
            // Add versions not available from the API but are downloadable
            const hidden = ['11_0_10b1145.115', '11_0_11b1341.60'];
            rawVersions.push(...hidden.map(tag => ({ tag_name: tag, name: tag, prerelease: false })));
        }
        const versions0 = rawVersions.map(async (v) => {
            // Release tags look like one of these:
            // jbr-release-21.0.3b465.3
            // jbr17-b87.7
            // jb11_0_11-b87.7
            // jbr11_0_15b2043.56
            // 11_0_11b1536.2
            // 11_0_11-b1522
            const tag = v.tag_name;
            // Extract version string
            const vstring = tag
                .replace('jbr-release-', '')
                .replace('jbr', '')
                .replace('jb', '')
                .replace('-', '');
            const vsplit = vstring.split('b');
            let semver = vsplit[0];
            const build = vsplit[1];
            // Normalize semver
            if (!semver.includes('.') && !semver.includes('_'))
                semver = `${semver}.0.0`;
            // Construct URL
            let type;
            switch (this.packageType ?? '') {
                case 'jre':
                    type = 'jbr';
                    break;
                case 'jdk+jcef':
                    type = 'jbrsdk_jcef';
                    break;
                case 'jre+jcef':
                    type = 'jbr_jcef';
                    break;
                case 'jdk+ft':
                    type = 'jbrsdk_ft';
                    break;
                case 'jre+ft':
                    type = 'jbr_ft';
                    break;
                default:
                    type = 'jbrsdk';
                    break;
            }
            let url = `https://cache-redirector.jetbrains.com/intellij-jbr/${type}-${semver}-${platform}-${arch}-b${build}.tar.gz`;
            let include = false;
            const res = await this.http.head(url);
            if (res.message.statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_6__/* .HttpCodes */ .Hv.OK) {
                include = true;
            }
            else {
                url = `https://cache-redirector.jetbrains.com/intellij-jbr/${type}_nomod-${semver}-${platform}-${arch}-b${build}.tar.gz`;
                const res2 = await this.http.head(url);
                if (res2.message.statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_6__/* .HttpCodes */ .Hv.OK) {
                    include = true;
                }
            }
            const version = {
                tag_name: tag,
                semver: semver.replace(/_/g, '.'),
                build: build,
                url: url
            };
            return {
                item: version,
                include: include
            };
        });
        const versions = await Promise.all(versions0).then(res => res.filter(item => item.include).map(item => item.item));
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .startGroup */ .Oh('Print information about available versions');
            console.timeEnd('Retrieving available versions for JBR took'); // eslint-disable-line no-console
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Available versions: [${versions.length}]`);
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(versions.map(item => item.semver).join(', '));
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .endGroup */ .N4();
        }
        return versions;
    }
    getPlatformOption() {
        // Jetbrains has own platform names so need to map them
        switch (process.platform) {
            case 'darwin':
                return 'osx';
            case 'win32':
                return 'windows';
            default:
                return process.platform;
        }
    }
}


/***/ })

};

export const id = 282;
export const ids = [282];
export const modules = {

/***/ 2282:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   JetBrainsDistribution: () => (/* binding */ JetBrainsDistribution)
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
/* harmony import */ var _actions_http_client__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(4942);








class JetBrainsDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    constructor(installerOptions) {
        super('JetBrains', installerOptions);
    }
    async findPackageForDownload(range) {
        const versionsRaw = await this.getAvailableVersions();
        const versions = versionsRaw.map(v => {
            const formattedVersion = `${v.semver}+${v.build}`;
            return {
                version: formattedVersion,
                url: v.url
            };
        });
        const satisfiedVersions = versions
            .filter(item => (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .isVersionSatisfies */ .y)(range, item.version))
            .sort((a, b) => {
            return -semver__WEBPACK_IMPORTED_MODULE_4___default().compareBuild(a.version, b.version);
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
    async downloadTool(javaRelease) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
        const javaArchivePath = await this.downloadAndVerify(javaRelease);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
        const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .extractJdkFile */ .PE)(javaArchivePath, 'tar.gz');
        const archiveName = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath)[0];
        const archivePath = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, archiveName);
        const version = this.getToolcacheVersionName(javaRelease.version);
        const javaPath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_1__/* .cacheDir */ .e8(archivePath, this.toolcacheFolderName, version, this.architecture);
        return { version: javaRelease.version, path: javaPath };
    }
    async getAvailableVersions() {
        const platform = this.getPlatformOption();
        const arch = this.distributionArchitecture();
        if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o()) {
            console.time('Retrieving available versions for JBR took'); // eslint-disable-line no-console
        }
        // need to iterate through all pages to retrieve the list of all versions
        // GitHub API doesn't provide way to retrieve the count of pages to iterate so infinity loop
        let page_index = 1;
        const rawVersions = [];
        const bearerToken = process.env.GITHUB_TOKEN;
        while (true) {
            const requestArguments = `per_page=100&page=${page_index}`;
            const requestHeaders = {};
            if (bearerToken) {
                requestHeaders['Authorization'] = `Bearer ${bearerToken}`;
            }
            const rawUrl = `https://api.github.com/repos/JetBrains/JetBrainsRuntime/releases?${requestArguments}`;
            if (_actions_core__WEBPACK_IMPORTED_MODULE_0__/* .isDebug */ ._o() && page_index === 1) {
                // url is identical except page_index so print it once for debug
                _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Gathering available versions from '${rawUrl}'`);
            }
            const paginationPageResult = (await this.http.getJson(rawUrl, requestHeaders)).result;
            if (!paginationPageResult || paginationPageResult.length === 0) {
                // break infinity loop because we have reached end of pagination
                break;
            }
            const paginationPage = paginationPageResult.filter(version => this.stable ? !version.prerelease : version.prerelease);
            if (!paginationPage || paginationPage.length === 0) {
                // break infinity loop because we have reached end of pagination
                break;
            }
            rawVersions.push(...paginationPage);
            page_index++;
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
            if (res.message.statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_7__/* .HttpCodes */ .Hv.OK) {
                include = true;
            }
            else {
                url = `https://cache-redirector.jetbrains.com/intellij-jbr/${type}_nomod-${semver}-${platform}-${arch}-b${build}.tar.gz`;
                const res2 = await this.http.head(url);
                if (res2.message.statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_7__/* .HttpCodes */ .Hv.OK) {
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

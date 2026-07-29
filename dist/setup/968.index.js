export const id = 968;
export const ids = [968];
export const modules = {

/***/ 6968:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   GraalVMCommunityDistribution: () => (/* binding */ GraalVMCommunityDistribution),
/* harmony export */   GraalVMDistribution: () => (/* binding */ GraalVMDistribution)
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
/* harmony import */ var _actions_http_client__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4942);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(4527);








const GRAALVM_DL_BASE = 'https://download.oracle.com/graalvm';
const GRAALVM_DOWNLOAD_URL = 'https://www.graalvm.org/downloads/';
const GRAALVM_COMMUNITY_RELEASES_URL = 'https://api.github.com/repos/graalvm/graalvm-ce-builds/releases?per_page=100';
const GRAALVM_COMMUNITY_RELEASES_PAGE_ORIGIN = 'https://api.github.com';
const GRAALVM_COMMUNITY_DOWNLOAD_URL = 'https://github.com/graalvm/graalvm-ce-builds/releases';
const GRAALVM_COMMUNITY_ASSET_PREFIX = 'graalvm-community-jdk-';
const GRAALVM_COMMUNITY_VERSION_PATTERN = /^\d+(?:\.\d+)*$/;
const IS_WINDOWS = process.platform === 'win32';
const GRAALVM_PLATFORM = IS_WINDOWS ? 'windows' : process.platform;
const GRAALVM_MIN_VERSION = 17;
const SUPPORTED_ARCHITECTURES = ['x64', 'aarch64'];
class GraalVMDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_5__/* .JavaBase */ .O {
    constructor(installerOptions, distributionName = 'GraalVM') {
        super(distributionName, installerOptions);
    }
    async downloadTool(javaRelease) {
        try {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Downloading Java ${javaRelease.version} (${this.distribution}) from ${javaRelease.url} ...`);
            let javaArchivePath = await this.downloadAndVerify(javaRelease);
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Extracting Java archive...`);
            const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getDownloadArchiveExtension */ .ag)();
            if (IS_WINDOWS) {
                javaArchivePath = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .renameWinArchive */ .n2)(javaArchivePath);
            }
            const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .extractJdkFile */ .PE)(javaArchivePath, extension);
            // Add validation for extracted path
            if (!fs__WEBPACK_IMPORTED_MODULE_2___default().existsSync(extractedJavaPath)) {
                throw new Error(`Extraction failed: path ${extractedJavaPath} does not exist`);
            }
            const dirContents = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath);
            if (dirContents.length === 0) {
                throw new Error('Extraction failed: no files found in extracted directory');
            }
            const archivePath = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, dirContents[0]);
            const version = this.getToolcacheVersionName(javaRelease.version);
            const javaPath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_1__/* .cacheDir */ .e8(archivePath, this.toolcacheFolderName, version, this.architecture);
            return { version: javaRelease.version, path: javaPath };
        }
        catch (error) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .error */ .z3(`Failed to download and extract GraalVM: ${error}`);
            throw error;
        }
    }
    setJavaDefault(version, toolPath) {
        super.setJavaDefault(version, toolPath);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .exportVariable */ .dN('GRAALVM_HOME', toolPath);
    }
    async findPackageForDownload(range) {
        this.validateVersionRange(range);
        const arch = this.getSupportedArchitecture();
        if (!this.stable) {
            return this.findEABuildDownloadUrl(`${range}-ea`);
        }
        // The `latest` alias is normalized to the SemVer wildcard. Oracle GraalVM
        // builds its download URLs from a concrete major and has no endpoint to list
        // releases, so resolve the newest available GA major from the Adoptium API.
        if (this.latest) {
            range = (await (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getLatestMajorVersion */ .ri)(this.http)).toString();
        }
        const { platform, extension, major } = this.validateStableBuildRequest(range);
        const fileUrl = this.constructFileUrl(range, major, platform, arch, extension);
        const response = await this.http.head(fileUrl);
        this.handleHttpResponse(response, range);
        return {
            url: fileUrl,
            version: range,
            checksum: await this.fetchChecksum(`${fileUrl}.sha256`, 'sha256')
        };
    }
    validateVersionRange(range) {
        if (!range || typeof range !== 'string') {
            throw new Error('Version range is required and must be a string');
        }
    }
    getSupportedArchitecture() {
        const arch = this.distributionArchitecture();
        if (!SUPPORTED_ARCHITECTURES.includes(arch)) {
            throw new Error(`Unsupported architecture: ${this.architecture}. Supported architectures are: ${SUPPORTED_ARCHITECTURES.join(', ')}`);
        }
        return arch;
    }
    validateStableBuildRequest(range) {
        if (this.packageType !== 'jdk') {
            throw new Error(`${this.distribution} provides only the \`jdk\` package type`);
        }
        const platform = this.getPlatform();
        const extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getDownloadArchiveExtension */ .ag)();
        const major = range.includes('.') ? range.split('.')[0] : range;
        const majorVersion = parseInt(major);
        if (isNaN(majorVersion)) {
            throw new Error(`Invalid version format: ${range}`);
        }
        if (majorVersion < GRAALVM_MIN_VERSION) {
            throw new Error(`${this.distribution} is only supported for JDK ${GRAALVM_MIN_VERSION} and later. Requested version: ${major}`);
        }
        return {
            platform,
            major,
            extension
        };
    }
    constructFileUrl(range, major, platform, arch, extension) {
        return range.includes('.')
            ? `${GRAALVM_DL_BASE}/${major}/archive/graalvm-jdk-${range}_${platform}-${arch}_bin.${extension}`
            : `${GRAALVM_DL_BASE}/${range}/latest/graalvm-jdk-${range}_${platform}-${arch}_bin.${extension}`;
    }
    handleHttpResponse(response, range) {
        const statusCode = response.message.statusCode;
        if (statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_6__/* .HttpCodes */ .Hv.NotFound) {
            // Create the standard error with additional hint about checking the download URL
            const error = this.createVersionNotFoundError(range);
            if (this.latest) {
                error.message += `\nThe latest Java major version (${range}) is not yet available for the ${this.distribution} distribution. Please specify a concrete version instead of 'latest'.`;
            }
            error.message += `\nPlease check if this version is available at ${GRAALVM_DOWNLOAD_URL} . Pick a version from the list.`;
            throw error;
        }
        if (statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_6__/* .HttpCodes */ .Hv.Unauthorized ||
            statusCode === _actions_http_client__WEBPACK_IMPORTED_MODULE_6__/* .HttpCodes */ .Hv.Forbidden) {
            throw new Error(`Access denied when downloading GraalVM. Status code: ${statusCode}. Please check your credentials or permissions.`);
        }
        if (statusCode !== _actions_http_client__WEBPACK_IMPORTED_MODULE_6__/* .HttpCodes */ .Hv.OK) {
            throw new Error(`HTTP request for GraalVM failed with status code: ${statusCode} (${response.message.statusMessage || 'Unknown error'})`);
        }
    }
    async findEABuildDownloadUrl(javaEaVersion) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Searching for EA build: ${javaEaVersion}`);
        const versions = await this.fetchEAJson(javaEaVersion);
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Found ${versions.length} EA versions`);
        const latestVersion = versions.find(v => v.latest);
        if (!latestVersion) {
            const availableVersions = versions.map(v => v.version);
            throw this.createVersionNotFoundError(javaEaVersion, availableVersions, 'Note: No EA build is marked as latest for this version.');
        }
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Latest version found: ${latestVersion.version}`);
        const arch = this.distributionArchitecture();
        const file = latestVersion.files.find(f => f.arch === arch && f.platform === GRAALVM_PLATFORM);
        if (!file) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .error */ .z3(`Available files for architecture ${arch}: ${JSON.stringify(latestVersion.files)}`);
            throw new Error(`Unable to find file for architecture '${arch}' and platform '${GRAALVM_PLATFORM}'`);
        }
        if (!file.filename.startsWith('graalvm-jdk-')) {
            throw new Error(`Invalid filename format: ${file.filename}. Expected to start with 'graalvm-jdk-'`);
        }
        const downloadUrl = `${latestVersion.download_base_url}${file.filename}`;
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Download URL: ${downloadUrl}`);
        return {
            url: downloadUrl,
            version: latestVersion.version,
            checksum: await this.fetchChecksum(`${downloadUrl}.sha256`, 'sha256')
        };
    }
    async fetchEAJson(javaEaVersion) {
        const url = `https://api.github.com/repos/graalvm/oracle-graalvm-ea-builds/contents/versions/${javaEaVersion}.json?ref=main`;
        const headers = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getGitHubHttpHeaders */ .U_)();
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`Trying to fetch available version info for GraalVM EA builds from '${url}'`);
        try {
            const response = await this.http.getJson(url, headers);
            if (!response.result) {
                throw new Error(`No GraalVM EA build found for version '${javaEaVersion}'. Please check if the version is correct.`);
            }
            return response.result;
        }
        catch (error) {
            if (error instanceof Error) {
                // Check if it's a 404 error (file not found)
                if (error.message?.includes('404')) {
                    throw new Error(`GraalVM EA version '${javaEaVersion}' not found. Please verify the version exists in the EA builds repository.`, { cause: error });
                }
                // Re-throw with more context
                throw new Error(`Failed to fetch GraalVM EA version information for '${javaEaVersion}': ${error.message}`, { cause: error });
            }
            // If it's not an Error instance, throw a generic error
            throw new Error(`Failed to fetch GraalVM EA version information for '${javaEaVersion}'`, { cause: error });
        }
    }
    getPlatform(platform = process.platform) {
        const platformMap = {
            darwin: 'macos',
            win32: 'windows',
            linux: 'linux'
        };
        const result = platformMap[platform];
        if (!result) {
            throw new Error(`Platform '${platform}' is not supported. Supported platforms: 'linux', 'macos', 'windows'`);
        }
        return result;
    }
}
class GraalVMCommunityDistribution extends GraalVMDistribution {
    constructor(installerOptions) {
        super(installerOptions, 'GraalVM Community');
    }
    get toolcacheFolderName() {
        return `Java_GraalVM_Community_${this.packageType}`;
    }
    async findPackageForDownload(range) {
        this.validateVersionRange(range);
        if (!this.stable) {
            throw new Error('GraalVM Community does not provide early access builds');
        }
        const arch = this.getSupportedArchitecture();
        // GraalVM Community publishes its releases on GitHub, so the `latest` alias
        // (normalized to the SemVer wildcard `x`) can float to the newest GA it
        // actually ships. Unlike Oracle GraalVM (which has no listing endpoint and
        // must derive the newest major from the Adoptium API), we match against the
        // real release list here, so `latest` never fails when GraalVM lags behind a
        // brand-new Java major.
        let platform;
        let extension;
        if (this.latest) {
            if (this.packageType !== 'jdk') {
                throw new Error(`${this.distribution} provides only the \`jdk\` package type`);
            }
            platform = this.getPlatform();
            extension = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getDownloadArchiveExtension */ .ag)();
        }
        else {
            ({ platform, extension } = this.validateStableBuildRequest(range));
        }
        // GraalVM Community asset names embed the platform, architecture and
        // archive type, e.g. `graalvm-community-jdk-21.0.2_linux-x64_bin.tar.gz`.
        const assetSuffix = `_${platform}-${arch}_bin.${extension}`;
        const availableVersions = await this.getAvailableVersions(assetSuffix);
        const satisfiedVersion = availableVersions
            .filter(item => (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .isVersionSatisfies */ .y)(range, item.version))
            .sort((a, b) => -semver__WEBPACK_IMPORTED_MODULE_4___default().compareBuild(a.version, b.version))[0];
        if (!satisfiedVersion) {
            const error = this.createVersionNotFoundError(range, availableVersions.map(item => item.version), `Platform: ${platform}`);
            error.message += `\nPlease check if this version is available at ${GRAALVM_COMMUNITY_DOWNLOAD_URL}.`;
            throw error;
        }
        return satisfiedVersion;
    }
    async getAvailableVersions(assetSuffix) {
        const headers = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getGitHubHttpHeaders */ .U_)();
        const versions = new Map();
        let releasesUrl = GRAALVM_COMMUNITY_RELEASES_URL;
        for (let pageIndex = 0; releasesUrl && pageIndex < _util_js__WEBPACK_IMPORTED_MODULE_7__/* .MAX_PAGINATION_PAGES */ .Tp; pageIndex++) {
            const response = await this.http.getJson(releasesUrl, headers);
            // A successful GitHub releases listing is always a JSON array (possibly
            // empty). Anything else indicates an unexpected/error payload (rate
            // limiting, auth failure, etc.) that must be surfaced instead of being
            // silently treated as "no releases", which would later look like a
            // misleading "version not found" error.
            if (!Array.isArray(response.result)) {
                throw new Error(`Unexpected response while listing GraalVM Community releases from ${releasesUrl} ` +
                    `(HTTP status code: ${response.statusCode}). Expected a JSON array of releases. ` +
                    `Please check if the service is available at ${GRAALVM_COMMUNITY_DOWNLOAD_URL}.`);
            }
            const releases = response.result;
            if (releases.length === 0) {
                break;
            }
            for (const release of releases) {
                if (release.draft || release.prerelease) {
                    continue;
                }
                for (const asset of release.assets ?? []) {
                    const version = this.extractAssetVersion(asset.name, assetSuffix);
                    if (version) {
                        const digest = asset.digest?.match(/^sha256:([a-f0-9]{64})$/i)?.[1];
                        if (!digest) {
                            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`No authoritative sha256 digest is available for ${asset.name}; skipping checksum verification for this asset.`);
                        }
                        versions.set(version, {
                            version,
                            url: asset.browser_download_url,
                            checksum: digest
                                ? {
                                    algorithm: 'sha256',
                                    value: digest,
                                    source: GRAALVM_COMMUNITY_RELEASES_URL
                                }
                                : undefined
                        });
                    }
                }
            }
            releasesUrl = this.getNextReleasesUrl(response.headers);
        }
        return [...versions.values()];
    }
    // Returns the GraalVM JDK version encoded in a release asset name when it
    // matches the requested platform/architecture/archive suffix, otherwise null.
    extractAssetVersion(assetName, assetSuffix) {
        if (!assetName.startsWith(GRAALVM_COMMUNITY_ASSET_PREFIX) ||
            !assetName.endsWith(assetSuffix)) {
            return null;
        }
        const rawVersion = assetName.slice(GRAALVM_COMMUNITY_ASSET_PREFIX.length, -assetSuffix.length);
        if (!GRAALVM_COMMUNITY_VERSION_PATTERN.test(rawVersion)) {
            return null;
        }
        return (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .convertVersionToSemver */ .ZY)(rawVersion);
    }
    getNextReleasesUrl(headers) {
        const nextUrl = (0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .getNextPageUrlFromLinkHeader */ .rC)(headers);
        if (nextUrl &&
            !(0,_util_js__WEBPACK_IMPORTED_MODULE_7__/* .validatePaginationUrl */ .SA)(nextUrl, GRAALVM_COMMUNITY_RELEASES_PAGE_ORIGIN)) {
            _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .warning */ .$e(`Ignoring pagination link with unexpected origin: ${nextUrl}`);
            return null;
        }
        return nextUrl;
    }
}


/***/ })

};

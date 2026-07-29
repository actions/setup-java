export const id = 242;
export const ids = [242];
export const modules = {

/***/ 6242:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  O: () => (/* binding */ JavaBase)
});

// EXTERNAL MODULE: ./node_modules/@actions/tool-cache/lib/tool-cache.js + 2 modules
var tool_cache = __webpack_require__(9805);
// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js + 7 modules
var core = __webpack_require__(3838);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(9896);
// EXTERNAL MODULE: ./node_modules/semver/index.js
var semver = __webpack_require__(2088);
var semver_default = /*#__PURE__*/__webpack_require__.n(semver);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
var external_path_default = /*#__PURE__*/__webpack_require__.n(external_path_);
// EXTERNAL MODULE: ./node_modules/@actions/http-client/lib/index.js + 1 modules
var lib = __webpack_require__(4942);
// EXTERNAL MODULE: ./src/util.ts
var util = __webpack_require__(4527);
// EXTERNAL MODULE: ./src/constants.ts
var constants = __webpack_require__(7242);
;// CONCATENATED MODULE: ./src/retrying-http-client.ts


const RETRYABLE_HTTP_STATUS_CODES = new Set([429, 502, 503, 504, 522]);
const RETRYABLE_NETWORK_ERROR_CODES = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ENOTFOUND',
    'ECONNREFUSED'
]);
const RETRYABLE_HTTP_VERBS = new Set(['OPTIONS', 'GET', 'DELETE', 'HEAD']);
class RetryingHttpClient extends lib/* HttpClient */.Qq {
    maxAttempts;
    baseDelayMs;
    maxDelayMs;
    sleep;
    random;
    now;
    constructor(userAgent, retryOptions = {}) {
        super(userAgent, undefined, { allowRetries: false });
        this.maxAttempts = retryOptions.maxAttempts ?? 4;
        this.baseDelayMs = retryOptions.baseDelayMs ?? 1000;
        this.maxDelayMs = retryOptions.maxDelayMs ?? 10000;
        this.sleep =
            retryOptions.sleep ??
                (delayMs => new Promise(resolve => setTimeout(resolve, delayMs)));
        this.random = retryOptions.random ?? Math.random;
        this.now = retryOptions.now ?? Date.now;
        if (this.maxAttempts < 1) {
            throw new Error('maxAttempts must be at least 1');
        }
        if (this.baseDelayMs < 0 || this.maxDelayMs < this.baseDelayMs) {
            throw new Error('baseDelayMs must be non-negative and no greater than maxDelayMs');
        }
    }
    async request(verb, requestUrl, data, headers) {
        if (!RETRYABLE_HTTP_VERBS.has(verb)) {
            return super.request(verb, requestUrl, data, headers);
        }
        for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
            try {
                const response = await super.request(verb, requestUrl, data, headers);
                const statusCode = response.message.statusCode;
                if (!statusCode ||
                    !RETRYABLE_HTTP_STATUS_CODES.has(statusCode) ||
                    attempt === this.maxAttempts) {
                    return response;
                }
                const delayMs = this.getDelayMs(attempt, response.message.headers['retry-after']);
                await response.readBody();
                this.logRetry(attempt, delayMs, `HTTP ${statusCode}`);
                await this.sleep(delayMs);
            }
            catch (error) {
                if (!isRetryableNetworkError(error) || attempt === this.maxAttempts) {
                    throw error;
                }
                const delayMs = this.getDelayMs(attempt);
                this.logRetry(attempt, delayMs, getErrorMessage(error));
                await this.sleep(delayMs);
            }
        }
        throw new Error('HTTP retry attempts exhausted unexpectedly');
    }
    getDelayMs(failedAttempt, retryAfter) {
        const exponentialDelay = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** (failedAttempt - 1));
        const jitteredDelay = Math.floor(exponentialDelay / 2 + this.random() * (exponentialDelay / 2));
        const retryAfterDelay = parseRetryAfter(retryAfter, this.now());
        return Math.min(this.maxDelayMs, Math.max(jitteredDelay, retryAfterDelay ?? 0));
    }
    logRetry(failedAttempt, delayMs, reason) {
        core/* info */.pq(`Request attempt ${failedAttempt} of ${this.maxAttempts} failed (${reason}); retrying in ${delayMs} ms`);
    }
}
function parseRetryAfter(value, nowMs) {
    const retryAfter = Array.isArray(value) ? value[0] : value;
    if (!retryAfter) {
        return undefined;
    }
    if (/^\d+$/.test(retryAfter.trim())) {
        return Number(retryAfter) * 1000;
    }
    const retryAt = Date.parse(retryAfter);
    if (Number.isNaN(retryAt) || retryAt <= nowMs) {
        return undefined;
    }
    return retryAt - nowMs;
}
function isRetryableNetworkError(error) {
    if (!isErrorRecord(error)) {
        return false;
    }
    if (typeof error.code === 'string' &&
        RETRYABLE_NETWORK_ERROR_CODES.has(error.code)) {
        return true;
    }
    return (Array.isArray(error.errors) &&
        error.errors.some(nestedError => isRetryableNetworkError(nestedError)));
}
function isErrorRecord(error) {
    return typeof error === 'object' && error !== null;
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : 'network error';
}

// EXTERNAL MODULE: external "os"
var external_os_ = __webpack_require__(857);
var external_os_default = /*#__PURE__*/__webpack_require__.n(external_os_);
// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6982);
// EXTERNAL MODULE: external "stream/promises"
var promises_ = __webpack_require__(4548);
;// CONCATENATED MODULE: ./src/checksum.ts



function sanitizedSource(source) {
    if (!source) {
        return '';
    }
    try {
        const url = new URL(source);
        return ` from ${url.origin}${url.pathname}`;
    }
    catch {
        return ' from an invalid checksum source';
    }
}
// Length, in hex characters, of a digest produced by each supported algorithm.
// Exported so callers (e.g. fetchChecksum) can infer which algorithm a vendor
// actually used when it doesn't disclose it via the checksum URL/filename.
function expectedDigestLength(algorithm) {
    return algorithm === 'sha256' ? 64 : algorithm === 'sha512' ? 128 : 0;
}
function normalizeExpectedDigest(checksum) {
    const algorithm = checksum.algorithm;
    const digest = typeof checksum.value === 'string'
        ? checksum.value.trim().toLowerCase()
        : '';
    const expectedLength = expectedDigestLength(algorithm);
    if (expectedLength === 0) {
        throw new Error(`Unsupported checksum algorithm '${String(algorithm)}'${sanitizedSource(checksum.source)}. Supported algorithms are sha256 and sha512.`);
    }
    if (!new RegExp(`^[a-f0-9]{${expectedLength}}$`).test(digest)) {
        throw new Error(`Malformed ${algorithm} checksum metadata${sanitizedSource(checksum.source)}: expected a ${expectedLength}-character hexadecimal digest.`);
    }
    return digest;
}
async function calculateChecksum(filePath, algorithm) {
    const hash = (0,external_crypto_.createHash)(algorithm);
    await (0,promises_.pipeline)((0,external_fs_.createReadStream)(filePath), hash);
    return hash.digest('hex');
}
async function verifyChecksum(filePath, checksum, context) {
    const expected = normalizeExpectedDigest(checksum);
    const actual = await calculateChecksum(filePath, checksum.algorithm);
    const matches = (0,external_crypto_.timingSafeEqual)(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
    if (!matches) {
        throw new Error(`Checksum verification failed for ${context.distribution} version ${context.version}: ${checksum.algorithm} expected ${expected}, actual ${actual}.`);
    }
}

// EXTERNAL MODULE: ./src/distributions/platform-types.ts
var platform_types = __webpack_require__(7444);
;// CONCATENATED MODULE: ./src/distributions/base-installer.ts












class JavaBase {
    distribution;
    http;
    version;
    architecture;
    packageType;
    stable;
    latest;
    checkLatest;
    forceDownload;
    setDefault;
    verifySignature;
    verifySignaturePublicKey;
    constructor(distribution, installerOptions) {
        this.distribution = distribution;
        this.http = new RetryingHttpClient('actions/setup-java');
        ({
            version: this.version,
            stable: this.stable,
            latest: this.latest
        } = this.normalizeVersion(installerOptions.version));
        this.architecture = (0,platform_types/* normalizeArchitecture */.dV)(installerOptions.architecture || external_os_default().arch());
        this.packageType = installerOptions.packageType;
        this.checkLatest = installerOptions.checkLatest;
        this.forceDownload = installerOptions.forceDownload ?? false;
        this.setDefault =
            installerOptions.setDefault !== undefined
                ? installerOptions.setDefault
                : true;
        this.verifySignature = installerOptions.verifySignature ?? false;
        this.verifySignaturePublicKey = installerOptions.verifySignaturePublicKey;
    }
    async downloadAndVerify(javaRelease) {
        const archivePath = await tool_cache/* downloadTool */.bq(javaRelease.url);
        const checksum = javaRelease.checksum;
        if (!checksum || !checksum.value?.trim()) {
            core/* debug */.Yz(`No authoritative checksum is available for ${this.distribution} version ${javaRelease.version}; skipping checksum verification.`);
            return archivePath;
        }
        try {
            await verifyChecksum(archivePath, checksum, {
                distribution: this.distribution,
                version: javaRelease.version
            });
            core/* debug */.Yz(`Verified ${checksum.algorithm} checksum for ${this.distribution} version ${javaRelease.version}.`);
            return archivePath;
        }
        catch (error) {
            let cleanupError;
            let cleanupFailed = false;
            try {
                await external_fs_.promises.rm(archivePath, { force: true });
            }
            catch (caughtCleanupError) {
                cleanupError = caughtCleanupError;
                cleanupFailed = true;
            }
            if (cleanupFailed) {
                throw new Error(`${error.message} Failed to remove the downloaded archive after verification failure: ${cleanupError.message}`, { cause: error });
            }
            throw error;
        }
    }
    async fetchChecksum(checksumUrl, algorithm) {
        // Some vendors (e.g. JetBrains) publish a single, generically-named
        // checksum sibling (`.checksum`) whose digest algorithm isn't disclosed
        // by the URL and has changed across releases. Accepting a list of
        // candidate algorithms lets callers pass every algorithm the vendor is
        // known to use; the actual algorithm is then inferred from the length of
        // the returned digest.
        const algorithms = Array.isArray(algorithm) ? algorithm : [algorithm];
        const algorithmLabel = algorithms.join(' or ');
        const response = await this.http.get(checksumUrl);
        const statusCode = response.message.statusCode;
        const source = (() => {
            try {
                const url = new URL(checksumUrl);
                return `${url.origin}${url.pathname}`;
            }
            catch {
                return 'an invalid checksum URL';
            }
        })();
        if (statusCode === lib/* HttpCodes */.Hv.NotFound) {
            core/* debug */.Yz(`No authoritative ${algorithmLabel} checksum is available for ${this.distribution} from ${source}; skipping checksum verification.`);
            return undefined;
        }
        if (statusCode !== lib/* HttpCodes */.Hv.OK) {
            throw new Error(`Failed to fetch the authoritative ${algorithmLabel} checksum for ${this.distribution} from ${source} (HTTP ${statusCode}).`);
        }
        const body = await response.readBody();
        const value = body.trim().split(/\s+/, 1)[0] ?? '';
        if (!value) {
            throw new Error(`Received an empty authoritative ${algorithmLabel} checksum for ${this.distribution} from ${source}.`);
        }
        // Prefer the strongest algorithm whose digest length matches what was
        // actually returned; fall back to the first candidate (preserving prior
        // behavior/error messages) when the digest doesn't match any of them.
        const resolvedAlgorithm = algorithms.find(algo => value.length === expectedDigestLength(algo)) ??
            algorithms[0];
        return { algorithm: resolvedAlgorithm, value, source: checksumUrl };
    }
    async setupJava() {
        if (this.verifySignature && !this.supportsSignatureVerification()) {
            throw new Error(`Input 'verify-signature' is not supported for distribution '${this.distribution}'.`);
        }
        let foundJava = this.forceDownload ? null : this.findInToolcache();
        if (foundJava && !this.checkLatest && !this.latest) {
            core/* info */.pq(`Resolved Java ${foundJava.version} from tool-cache`);
        }
        else {
            core/* info */.pq('Trying to resolve the latest version from remote');
            try {
                const javaRelease = await this.findPackageForDownload(this.version);
                core/* info */.pq(`Resolved latest version as ${javaRelease.version}`);
                if (!this.forceDownload && foundJava?.version === javaRelease.version) {
                    core/* info */.pq(`Resolved Java ${foundJava.version} from tool-cache`);
                }
                else {
                    core/* info */.pq('Trying to download...');
                    foundJava = await this.downloadTool(javaRelease);
                    core/* info */.pq(`Java ${foundJava.version} was downloaded`);
                }
            }
            catch (error) {
                this.logSetupError(error);
                throw error;
            }
        }
        if (!foundJava) {
            throw new Error('Failed to resolve Java version');
        }
        // JDK folder may contain postfix "Contents/Home" on macOS
        const macOSPostfixPath = external_path_default().join(foundJava.path, constants/* MACOS_JAVA_CONTENT_POSTFIX */.PG);
        if (process.platform === 'darwin' && external_fs_.existsSync(macOSPostfixPath)) {
            foundJava.path = macOSPostfixPath;
        }
        if (this.setDefault) {
            core/* info */.pq(`Setting Java ${foundJava.version} as the default`);
            this.setJavaDefault(foundJava.version, foundJava.path);
        }
        else {
            core/* info */.pq(`Installing Java ${foundJava.version} (not setting as default)`);
            this.setJavaEnvironment(foundJava.version, foundJava.path);
        }
        return foundJava;
    }
    logSetupError(error) {
        const httpStatusCode = error instanceof tool_cache/* HTTPError */.Hl
            ? error.httpStatusCode
            : error instanceof lib/* HttpClientError */.Kg
                ? error.statusCode
                : undefined;
        if (httpStatusCode) {
            if (httpStatusCode === 403) {
                core/* error */.z3('HTTP 403: Permission denied or access restricted.');
            }
            else if (httpStatusCode === 429) {
                core/* warning */.$e('HTTP 429: Rate limit exceeded. Please retry later.');
            }
            else {
                core/* error */.z3(`HTTP ${httpStatusCode}: ${error.message}`);
            }
        }
        else if (error && error.errors && Array.isArray(error.errors)) {
            core/* error */.z3(`Java setup failed due to network or configuration error(s)`);
            if (error instanceof Error && error.stack) {
                core/* debug */.Yz(error.stack);
            }
            for (const err of error.errors) {
                const endpoint = err?.address || err?.hostname || '';
                const port = err?.port ? `:${err.port}` : '';
                const message = err?.message || 'Aggregate error';
                const endpointInfo = !message.includes(endpoint)
                    ? ` ${endpoint}${port}`
                    : '';
                const localInfo = err.localAddress && err.localPort
                    ? ` - Local (${err.localAddress}:${err.localPort})`
                    : '';
                const logMessage = `${message}${endpointInfo}${localInfo}`;
                core/* error */.z3(logMessage);
                core/* debug */.Yz(`${err.stack || err.message}`);
                Object.entries(err).forEach(([key, value]) => {
                    core/* debug */.Yz(`"${key}": ${JSON.stringify(value)}`);
                });
            }
        }
        else {
            const message = error instanceof Error ? error.message : JSON.stringify(error);
            core/* error */.z3(`Java setup process failed due to: ${message}`);
            if (typeof error?.code === 'string') {
                core/* debug */.Yz(error.stack);
            }
            const errorDetails = {
                name: error.name,
                message: error.message,
                ...Object.getOwnPropertyNames(error)
                    .filter(prop => !['name', 'message', 'stack'].includes(prop))
                    .reduce((acc, prop) => {
                    acc[prop] = error[prop];
                    return acc;
                }, {})
            };
            Object.entries(errorDetails).forEach(([key, value]) => {
                core/* debug */.Yz(`"${key}": ${JSON.stringify(value)}`);
            });
        }
    }
    get toolcacheFolderName() {
        return `Java_${this.distribution}_${this.packageType}`;
    }
    supportsSignatureVerification() {
        return false;
    }
    getToolcacheVersionName(version) {
        if (!this.stable) {
            if (version.includes('+')) {
                return version.replace('+', '-ea.');
            }
            else {
                return `${version}-ea`;
            }
        }
        // Kotlin and some Java dependencies don't work properly when Java path contains "+" sign
        // so replace "/hostedtoolcache/Java/11.0.3+4/x64" to "/hostedtoolcache/Java/11.0.3-4/x64" when saves to cache
        // related issue: https://github.com/actions/virtual-environments/issues/3014
        return version.replace('+', '-');
    }
    findInToolcache() {
        // we can't use tc.find directly because firstly, we need to filter versions by stability flag
        // if *-ea is provided, take only ea versions from toolcache, otherwise - only stable versions
        const availableVersions = tool_cache/* findAllVersions */.iq(this.toolcacheFolderName, this.architecture)
            .map(item => {
            return {
                version: item
                    .replace('-ea.', '+')
                    .replace(/-ea$/, '')
                    // Kotlin and some Java dependencies don't work properly when Java path contains "+" sign
                    // so replace "/hostedtoolcache/Java/11.0.3-4/x64" to "/hostedtoolcache/Java/11.0.3+4/x64" when retrieves  to cache
                    // related issue: https://github.com/actions/virtual-environments/issues/3014
                    .replace('-', '+'),
                path: (0,util/* getToolcachePath */.yH)(this.toolcacheFolderName, item, this.architecture) || '',
                stable: !item.includes('-ea')
            };
        })
            .filter(item => item.stable === this.stable);
        const satisfiedVersions = availableVersions
            .filter(item => (0,util/* isVersionSatisfies */.y)(this.version, item.version))
            .filter(item => item.path)
            .sort((a, b) => {
            return -semver_default().compareBuild(a.version, b.version);
        });
        if (!satisfiedVersions || satisfiedVersions.length === 0) {
            return null;
        }
        return {
            version: satisfiedVersions[0].version,
            path: satisfiedVersions[0].path
        };
    }
    normalizeVersion(version) {
        let stable = true;
        const latest = false;
        // Support the `latest` alias (case-insensitive), which floats to the newest
        // available stable/GA release. It is translated to the SemVer wildcard `x`
        // so the existing "newest satisfying version wins" resolution applies.
        const normalized = version.trim().toLowerCase();
        if (normalized === 'latest') {
            return {
                version: 'x',
                stable: true,
                latest: true
            };
        }
        // Reject `latest` combined with any qualifier (e.g. `latest-ea`). Such inputs
        // would otherwise have their `-ea` suffix stripped and fall through to the
        // generic SemVer check, which fails with a confusing "'latest' is not valid
        // SemVer" message even though `latest` is a supported value. Fail early with a
        // targeted explanation instead.
        if (normalized.startsWith('latest')) {
            throw new Error(`The 'latest' alias resolves stable (GA) releases only and cannot be combined with '-ea' or other qualifiers (received '${version}'). Use 'latest' on its own, or specify a concrete version.`);
        }
        if (version.endsWith('-ea')) {
            version = version.replace(/-ea$/, '');
            stable = false;
        }
        else if (version.includes('-ea.')) {
            // transform '11.0.3-ea.2' -> '11.0.3+2'
            version = version.replace('-ea.', '+');
            stable = false;
        }
        // Java uses a versioning scheme (JEP 322) that can contain more numeric
        // fields than SemVer allows, e.g. '18.0.1.1' or '11.0.9.1'. Convert such
        // exact versions to SemVer build notation ('18.0.1+1') so they are
        // accepted. Ranges and versions that already carry build metadata are
        // left untouched.
        if (/^\d+(\.\d+){3,}$/.test(version)) {
            version = (0,util/* convertVersionToSemver */.ZY)(version);
        }
        if (!semver_default().validRange(version)) {
            throw new Error(`The string '${version}' is not valid SemVer notation for a Java version. Please check README file for code snippets and more detailed information`);
        }
        return {
            version,
            stable,
            latest
        };
    }
    createVersionNotFoundError(versionOrRange, availableVersions, additionalContext) {
        const parts = [
            `No matching version found for SemVer '${versionOrRange}'.`,
            `Distribution: ${this.distribution}`,
            `Package type: ${this.packageType}`,
            `Architecture: ${this.architecture}`
        ];
        // Add additional context if provided (e.g., platform/OS info)
        if (additionalContext) {
            parts.push(additionalContext);
        }
        if (availableVersions && availableVersions.length > 0) {
            const maxVersionsToShow = core/* isDebug */._o() ? availableVersions.length : 50;
            const versionsToShow = availableVersions.slice(0, maxVersionsToShow);
            const truncated = availableVersions.length > maxVersionsToShow;
            parts.push(`Available versions: ${versionsToShow.join(', ')}${truncated ? ', ...' : ''}`);
            if (truncated) {
                parts.push(`(showing first ${maxVersionsToShow} of ${availableVersions.length} versions, enable debug mode to see all)`);
            }
        }
        const error = new Error(parts.join('\n'));
        error.name = 'VersionNotFoundError';
        return error;
    }
    setJavaDefault(version, toolPath) {
        core/* exportVariable */.dN('JAVA_HOME', toolPath);
        core/* addPath */.fM(external_path_default().join(toolPath, 'bin'));
        this.setJavaEnvironment(version, toolPath);
    }
    setJavaEnvironment(version, toolPath) {
        const majorVersion = version.split('.')[0];
        core/* setOutput */.uH('distribution', this.distribution);
        core/* setOutput */.uH('path', toolPath);
        core/* setOutput */.uH('version', version);
        core/* exportVariable */.dN(`JAVA_HOME_${majorVersion}_${this.architecture.toUpperCase()}`, toolPath);
    }
    distributionArchitecture() {
        return this.architecture;
    }
}


/***/ })

};

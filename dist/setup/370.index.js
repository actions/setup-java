export const id = 370;
export const ids = [370];
export const modules = {

/***/ 370:
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
var promises_ = __webpack_require__(9786);
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
;// CONCATENATED MODULE: ./src/blocked-certs.ts



/**
 * SHA-256 fingerprints of compromised eMudhra intermediate CA certificates.
 * The JDK refuses to trust any certificate chain containing one of these.
 */
const COMPROMISED_CERT_FINGERPRINTS = [
    '42C4ACCD12C4F59597925E1A08A7A90102608543809308D50EC427E118BA1493',
    '45A883F349AEDFD5F3A649B5498FFB121712BA8B448F3F2A91DBC5A766FCDDBE',
    '98B896625C0C230ADEEC3EB2CF6AAD5001ECF9156A68644E82374CE5833BC25B',
    '5F1DED4DD590AF74631290CF073B122A2AAC6A1FA479778A0BD43579BD832699',
    'E7568FE6E12331F4FD7DE61DA4C7559D0F8EB192A218D4741A3BA75184333838',
    '579480AEA166290BD3C643589E795FC0D0E54E86505D180F1DFF99EFD3199512',
    '0164D7CEAE5BB909C272AF151FF44B1177AE9B47D9424B94F1D9558C30934D19',
    '62B7F9868263F72F6911FC78CEAF72C1979158B7368BF648683BB2AA39B02E72',
    'CB6E15165AC802E9B3F993F16C25D41F4E81C21EBDE71AE1B012AC00BF9C7C3F',
    '7485B51C0ED192878FA1D2F948FB529AE1842CC5086C4B67F7BE5B2039DE9489',
    '432EC25F0D28DE9006D97BF752F17BBB2CD41F669933FCB072D9A1148D0261F3',
    'FD9D5C2DBBD4995AB69B8D50C439D9527B00529199C2FD01B2174EB58F07021F',
    '9E39DE2881273ACC225A149C72BA3E0F51424963669AB633EE1DC7DF5DB067B4',
    'A496E23AC0CAB8155FC9B117B97EAE368EFCBB9041AEC8804D5A308D2D01C2D8',
    '4B2460A466F95FD40113BCDCCA2CEB29B3B093921DE45474DA7DF48874C630B1',
    '84112972B8E59D14560AE7E7119654474AAD119990CF3722BFC1E3B91615E1FD'
];
// Newer JDKs use blocked.certs; older ones (JDK 8/11) use blacklisted.certs.
// A JDK 8 bundles a separate JRE under jre/ that has its own copy.
const BLOCKED_CERTS_CANDIDATES = [
    ['lib', 'security', 'blocked.certs'],
    ['lib', 'security', 'blacklisted.certs'],
    ['jre', 'lib', 'security', 'blocked.certs'],
    ['jre', 'lib', 'security', 'blacklisted.certs']
];
const SHA256_ALGORITHM_LINE = /^\s*Algorithm\s*=\s*SHA-256\s*$/i;
/**
 * Adds the compromised CA fingerprints to the blocked certificates list of
 * the JDK at `javaHome`. Fingerprints already present are left alone, so
 * running this repeatedly on a tool-cached JDK is safe.
 */
function blockCompromisedCertificates(javaHome, fingerprints = COMPROMISED_CERT_FINGERPRINTS) {
    const files = BLOCKED_CERTS_CANDIDATES.map(parts => external_path_default().join(javaHome, ...parts)).filter(file => external_fs_.existsSync(file));
    if (!files.length) {
        core/* warning */.$e(`Could not find a blocked certificates list in ${javaHome}; compromised CA certificates were not blocked.`);
        return;
    }
    for (const file of files) {
        try {
            appendFingerprints(file, fingerprints);
        }
        catch (error) {
            core/* warning */.$e(`Failed to block compromised CA certificates in ${file}: ${error.message}`);
        }
    }
}
function appendFingerprints(file, fingerprints) {
    const content = external_fs_.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/).map(line => line.trim());
    const algorithmLine = lines.find(line => line.startsWith('Algorithm'));
    if (!algorithmLine || !SHA256_ALGORITHM_LINE.test(algorithmLine)) {
        core/* warning */.$e(`${file} does not use SHA-256 fingerprints; compromised CA certificates were not blocked.`);
        return;
    }
    const existing = new Set(lines.map(line => line.toUpperCase()));
    const missing = fingerprints
        .map(fingerprint => fingerprint.toUpperCase())
        .filter(fingerprint => !existing.has(fingerprint));
    if (!missing.length) {
        core/* debug */.Yz(`${file} already blocks the compromised CA certificates`);
        return;
    }
    const prefix = content.length && !content.endsWith('\n') ? '\n' : '';
    external_fs_.appendFileSync(file, `${prefix}${missing.join('\n')}\n`);
    core/* info */.pq(`Blocked ${missing.length} compromised CA certificate(s) in ${file}`);
}

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
    cacheJdk;
    /**
     * Whether the concrete version of a floating release has been established
     * from the checksum-bound resolution cache. Until then the release version is
     * only the requested major and says nothing about the bytes behind the URL.
     */
    floatingVersionVerified = false;
    setDefault;
    blockCompromisedCerts;
    verifySignature;
    verifySignatureExplicitlyRequested;
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
        this.cacheJdk = installerOptions.cacheJdk ?? false;
        this.setDefault =
            installerOptions.setDefault !== undefined
                ? installerOptions.setDefault
                : true;
        this.blockCompromisedCerts = installerOptions.blockCompromisedCerts ?? true;
        this.verifySignature =
            installerOptions.verifySignature ?? this.supportsSignatureVerification();
        this.verifySignatureExplicitlyRequested =
            installerOptions.verifySignature === true;
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
        if (foundJava &&
            !this.checkLatest &&
            !this.latest &&
            !this.requiresRemoteResolution()) {
            core/* info */.pq(`Resolved Java ${foundJava.version} from tool-cache`);
        }
        else {
            core/* info */.pq('Trying to resolve the latest version from remote');
            try {
                let javaRelease = await this.resolveJavaRelease();
                core/* info */.pq(`Resolved latest version as ${javaRelease.version}`);
                if (javaRelease.floating) {
                    // A tool-cache entry has no source identity, and until the
                    // checksum-bound resolution cache maps the current artifact to a
                    // concrete version the release version is still just the requested
                    // major — so nothing already on the runner can be trusted. Once that
                    // mapping is known, an installation of exactly that version is the
                    // artifact we would otherwise download.
                    foundJava =
                        this.floatingVersionVerified && !this.forceDownload
                            ? this.findConcreteVersionInToolcache(javaRelease.version)
                            : null;
                }
                if (!this.forceDownload && foundJava?.version === javaRelease.version) {
                    core/* info */.pq(`Resolved Java ${foundJava.version} from tool-cache`);
                }
                else {
                    let jdkCache = this.cacheJdk &&
                        (!javaRelease.floating ||
                            (this.hasStableReleaseIdentity(javaRelease) &&
                                semver_default().valid(javaRelease.version)))
                        ? await this.createJdkCache(javaRelease)
                        : undefined;
                    if (!this.forceDownload && jdkCache) {
                        const { restoreJdk } = await Promise.all(/* import() */[__webpack_require__.e(824), __webpack_require__.e(971), __webpack_require__.e(779)]).then(__webpack_require__.bind(__webpack_require__, 5779));
                        const restored = await restoreJdk(jdkCache);
                        if (restored) {
                            const restoredPath = this.getRestoredJdkPath(javaRelease.version);
                            if (restoredPath) {
                                foundJava = {
                                    version: javaRelease.version,
                                    path: restoredPath
                                };
                            }
                        }
                    }
                    if (!foundJava || foundJava.version !== javaRelease.version) {
                        core/* info */.pq('Trying to download...');
                        foundJava = await this.downloadTool(javaRelease);
                        core/* info */.pq(`Java ${foundJava.version} was downloaded`);
                        if (javaRelease.floating) {
                            if (!semver_default().valid(foundJava.version) ||
                                !this.isVersionSatisfied(this.version, foundJava.version)) {
                                throw new Error(`The downloaded ${this.distribution} artifact reported Java ${foundJava.version}, which does not satisfy '${this.version}'.`);
                            }
                            javaRelease = { ...javaRelease, version: foundJava.version };
                            await this.registerFloatingResolution(javaRelease);
                            jdkCache =
                                this.cacheJdk && this.hasStableReleaseIdentity(javaRelease)
                                    ? await this.createJdkCache(javaRelease)
                                    : undefined;
                        }
                        if (jdkCache) {
                            // Register after the installation exists so its identity is
                            // captured; the post-job save refuses to upload a path whose
                            // installation was replaced afterwards.
                            const { registerJdk } = await Promise.all(/* import() */[__webpack_require__.e(824), __webpack_require__.e(971), __webpack_require__.e(779)]).then(__webpack_require__.bind(__webpack_require__, 5779));
                            registerJdk(jdkCache);
                        }
                    }
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
        if (this.blockCompromisedCerts) {
            blockCompromisedCertificates(foundJava.path);
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
    /**
     * Resolves the release to install, preferring a cached resolution over the
     * distribution's metadata API.
     *
     * Only Temurin is preinstalled on hosted runners, so for every other
     * distribution the tool-cache lookup misses and the vendor API becomes a
     * per-job dependency even when the JDK itself is already in the GitHub
     * Actions cache. A cached resolution removes that dependency, and because it
     * carries the download URL and checksum it also keeps a job working when the
     * vendor API is unavailable but the JDK still has to be downloaded.
     */
    async resolveJavaRelease() {
        if (!this.cacheJdk ||
            this.checkLatest ||
            this.latest ||
            this.forceDownload ||
            this.requiresRemoteResolution()) {
            const release = await this.findPackageForDownload(this.version);
            return this.restoreFloatingResolution(release);
        }
        const { restoreJdkResolution, registerJdkResolution } = await Promise.all(/* import() */[__webpack_require__.e(824), __webpack_require__.e(971), __webpack_require__.e(348)]).then(__webpack_require__.bind(__webpack_require__, 967));
        const request = {
            distribution: this.distribution,
            packageType: this.packageType,
            platform: (0,platform_types/* getJavaPlatformIdentity */.U)(),
            architecture: this.architecture,
            versionSpec: this.version,
            stable: this.stable
        };
        const restored = await restoreJdkResolution(request);
        if (restored?.fresh) {
            core/* info */.pq(`Resolved ${this.distribution} ${restored.release.version} from the resolution cache`);
            return restored.release;
        }
        try {
            const javaRelease = await this.findPackageForDownload(this.version);
            if (!javaRelease.floating) {
                registerJdkResolution(request, javaRelease);
            }
            return this.restoreFloatingResolution(javaRelease);
        }
        catch (error) {
            if (!restored) {
                throw error;
            }
            // The cached resolution is older than the current bucket, but falling
            // back to it is strictly better than failing the job because the vendor
            // metadata API is down.
            core/* warning */.$e(`Failed to resolve ${this.distribution} ${this.version} from remote (${error instanceof Error ? error.message : String(error)}); falling back to the cached resolution for ${restored.release.version}.`);
            return restored.release;
        }
    }
    requiresRemoteResolution() {
        return false;
    }
    async createJdkCache(javaRelease) {
        const { getJdkVerificationIdentity } = await Promise.all(/* import() */[__webpack_require__.e(824), __webpack_require__.e(971), __webpack_require__.e(779)]).then(__webpack_require__.bind(__webpack_require__, 5779));
        return {
            distribution: this.distribution,
            packageType: this.packageType,
            architecture: this.architecture,
            version: javaRelease.version,
            source: this.getJdkReleaseIdentity(javaRelease),
            verification: getJdkVerificationIdentity(this.verifySignature, this.verifySignatureExplicitlyRequested, this.verifySignaturePublicKey),
            path: this.getJdkCachePath(javaRelease.version)
        };
    }
    async restoreFloatingResolution(javaRelease) {
        if (!javaRelease.floating ||
            !this.hasStableReleaseIdentity(javaRelease) ||
            !this.cacheJdk ||
            this.forceDownload) {
            return javaRelease;
        }
        const { restoreJdkResolution } = await Promise.all(/* import() */[__webpack_require__.e(824), __webpack_require__.e(971), __webpack_require__.e(348)]).then(__webpack_require__.bind(__webpack_require__, 967));
        const restored = await restoreJdkResolution(this.getFloatingResolutionRequest(javaRelease));
        if (!restored) {
            return javaRelease;
        }
        if (!semver_default().valid(restored.release.version) ||
            !this.isVersionSatisfied(this.version, restored.release.version)) {
            core/* debug */.Yz(`Ignoring the cached concrete version '${restored.release.version}' for ${this.distribution} ${this.version}.`);
            return javaRelease;
        }
        core/* info */.pq(`Resolved ${this.distribution} ${restored.release.version} for the current floating artifact`);
        this.floatingVersionVerified = true;
        return { ...javaRelease, version: restored.release.version };
    }
    async registerFloatingResolution(javaRelease) {
        if (!this.hasStableReleaseIdentity(javaRelease) ||
            !this.cacheJdk ||
            this.forceDownload) {
            return;
        }
        const { registerJdkResolution } = await Promise.all(/* import() */[__webpack_require__.e(824), __webpack_require__.e(971), __webpack_require__.e(348)]).then(__webpack_require__.bind(__webpack_require__, 967));
        registerJdkResolution(this.getFloatingResolutionRequest(javaRelease), javaRelease);
    }
    getFloatingResolutionRequest(javaRelease) {
        return {
            distribution: this.distribution,
            packageType: this.packageType,
            platform: (0,platform_types/* getJavaPlatformIdentity */.U)(),
            architecture: this.architecture,
            versionSpec: this.version,
            stable: this.stable,
            source: this.getJdkReleaseIdentity(javaRelease)
        };
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
    getJdkCachePath(version) {
        const toolCache = process.env['RUNNER_TOOL_CACHE'];
        if (!toolCache) {
            return '';
        }
        return external_path_default().join(toolCache, this.toolcacheFolderName, this.getToolcacheVersionName(version));
    }
    getRestoredJdkPath(version) {
        const basePath = this.getJdkCachePath(version);
        if (!basePath) {
            return null;
        }
        const architecturePath = external_path_default().join(basePath, this.architecture);
        return external_fs_.existsSync(architecturePath) &&
            external_fs_.existsSync(`${architecturePath}.complete`)
            ? architecturePath
            : null;
    }
    /**
     * Locates an installation of an exact version in the tool cache, unlike
     * `findInToolcache()` which returns the newest entry satisfying the requested
     * range. Used to reuse a JDK the runner already holds instead of downloading
     * the identical artifact again.
     */
    findConcreteVersionInToolcache(version) {
        if (!semver_default().valid(version)) {
            return null;
        }
        const installedPath = this.getRestoredJdkPath(version);
        return installedPath ? { version, path: installedPath } : null;
    }
    getJdkReleaseIdentity(javaRelease) {
        if (javaRelease.checksum) {
            return `${javaRelease.checksum.algorithm}:${javaRelease.checksum.value}`;
        }
        if (javaRelease.fingerprint) {
            return javaRelease.fingerprint;
        }
        try {
            const url = new URL(javaRelease.url);
            return `${url.origin}${url.pathname}`;
        }
        catch {
            return javaRelease.url;
        }
    }
    /**
     * Whether the release identity pins the exact bytes behind `url`. A floating
     * URL is a constant string, so it only becomes a safe cache identity once a
     * checksum or a response validator distinguishes one published build from the
     * next.
     */
    hasStableReleaseIdentity(javaRelease) {
        return Boolean(javaRelease.checksum ?? javaRelease.fingerprint);
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
            .filter(item => this.isVersionSatisfied(this.version, item.version))
            .filter(item => item.path)
            .sort((a, b) => {
            return -this.compareVersions(a.version, b.version);
        });
        if (!satisfiedVersions || satisfiedVersions.length === 0) {
            return null;
        }
        return {
            version: satisfiedVersions[0].version,
            path: satisfiedVersions[0].path
        };
    }
    isVersionSatisfied(range, version) {
        return (0,util/* isVersionSatisfies */.y)(range, version);
    }
    compareVersions(a, b) {
        return semver_default().compareBuild(a, b);
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
        // exact versions to SemVer build notation ('18.0.1+1', or '26.0.2+1.1'
        // for '26.0.2.1+1') so they are accepted. Ranges are left untouched.
        version = (0,util/* normalizeJavaVersionToSemver */.zZ)(version);
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

export const id = 348;
export const ids = [348];
export const modules = {

/***/ 967:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   saveJdkResolutionCaches: () => (/* binding */ saveJdkResolutionCaches)
/* harmony export */ });
/* unused harmony exports restoreJdkResolution, registerJdkResolution */
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6982);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _actions_cache__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(5767);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3838);





const STATE_JDK_RESOLUTIONS = 'jdk-resolutions';
const JDK_RESOLUTION_KEY_VERSION = 1;
const RESOLUTION_DIRECTORY = 'setup-java-jdk-resolution';
const RESOLUTION_FILE_NAME = 'release.json';
const pendingResolutions = (/* unused pure expression or super */ null && ([]));
/**
 * Restores a previously resolved release so a distribution can skip its vendor
 * metadata API.
 *
 * The cache path deliberately excludes the freshness window: `@actions/cache`
 * derives
 * a cache version by hashing the requested paths, so a bucket-independent path
 * is what allows the restore keys to fall back to an older bucket.
 */
async function restoreJdkResolution(request) {
    // Deliberately not `isCacheFeatureAvailable()`: this is an optional
    // optimization, and the JDK cache already warns once when the service is
    // unreachable.
    if (!cache.isFeatureAvailable()) {
        return undefined;
    }
    const cachePath = getResolutionCachePath(request);
    if (!cachePath) {
        return undefined;
    }
    const keyPrefix = getResolutionKeyPrefix(request);
    const primaryKey = `${keyPrefix}${getFreshnessBucket()}`;
    let matchedKey;
    try {
        matchedKey = await cache.restoreCache([cachePath], primaryKey, [keyPrefix]);
    }
    catch (error) {
        core.debug(`Failed to restore the JDK resolution cache: ${getErrorMessage(error)}`);
        return undefined;
    }
    if (!matchedKey) {
        return undefined;
    }
    let release;
    try {
        const contents = fs.readFileSync(path.join(cachePath, RESOLUTION_FILE_NAME), 'utf8');
        release = parseResolvedRelease(contents);
    }
    catch (error) {
        core.debug(`Ignoring the JDK resolution cache entry ${matchedKey}: ${getErrorMessage(error)}`);
        return undefined;
    }
    return { release, fresh: matchedKey === primaryKey };
}
/**
 * Persists a freshly resolved release for later jobs. The entry is written to
 * disk immediately and uploaded by the post-job step.
 */
function registerJdkResolution(request, release) {
    if (!cache.isFeatureAvailable()) {
        return;
    }
    const cachePath = getResolutionCachePath(request);
    if (!cachePath) {
        return;
    }
    const payload = JSON.stringify(release);
    try {
        fs.mkdirSync(cachePath, { recursive: true });
        fs.writeFileSync(path.join(cachePath, RESOLUTION_FILE_NAME), payload);
    }
    catch (error) {
        core.debug(`Failed to record the JDK resolution cache entry: ${getErrorMessage(error)}`);
        return;
    }
    const key = `${getResolutionKeyPrefix(request)}${getFreshnessBucket()}`;
    if (!pendingResolutions.some(item => item.key === key)) {
        pendingResolutions.push({ key, path: cachePath, release: payload });
    }
    core.saveState(STATE_JDK_RESOLUTIONS, JSON.stringify(pendingResolutions));
}
async function saveJdkResolutionCaches() {
    const state = _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .getState */ .Gu(STATE_JDK_RESOLUTIONS);
    if (!state) {
        return;
    }
    let resolutions;
    try {
        resolutions = parseJdkResolutionState(state);
    }
    catch (error) {
        _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .debug */ .Yz(`Invalid JDK resolution cache state, not saving: ${getErrorMessage(error)}`);
        return;
    }
    for (const resolution of resolutions) {
        // A restore performed by a later step overwrites this path, so the payload
        // the key was computed for is written again rather than trusted to still be
        // on disk.
        try {
            fs__WEBPACK_IMPORTED_MODULE_1___default().mkdirSync(resolution.path, { recursive: true });
            fs__WEBPACK_IMPORTED_MODULE_1___default().writeFileSync(path__WEBPACK_IMPORTED_MODULE_2___default().join(resolution.path, RESOLUTION_FILE_NAME), resolution.release);
        }
        catch (error) {
            _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .debug */ .Yz(`Failed to write the JDK resolution cache entry for the key ${resolution.key}: ${getErrorMessage(error)}`);
            continue;
        }
        try {
            await _actions_cache__WEBPACK_IMPORTED_MODULE_3__/* .saveCache */ .Io([resolution.path], resolution.key);
        }
        catch (error) {
            // A matrix of jobs resolving the same JDK races on the same daily key, so
            // an already-reserved key is the expected outcome rather than a problem.
            _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .debug */ .Yz(`Failed to save the JDK resolution cache with the key ${resolution.key}: ${getErrorMessage(error)}`);
        }
    }
}
function getResolutionCachePath(request) {
    const runnerTemp = process.env['RUNNER_TEMP'];
    if (!runnerTemp) {
        return undefined;
    }
    return path.join(runnerTemp, RESOLUTION_DIRECTORY, getResolutionIdentity(request));
}
function getResolutionIdentity(request) {
    const identity = JSON.stringify({
        keyVersion: JDK_RESOLUTION_KEY_VERSION,
        runnerOs: getRunnerOs(),
        distribution: request.distribution.toLowerCase(),
        packageType: request.packageType.toLowerCase(),
        architecture: request.architecture.toLowerCase(),
        versionSpec: request.versionSpec,
        stable: request.stable
    });
    return createHash('sha256').update(identity).digest('hex');
}
function getResolutionKeyPrefix(request) {
    const architecture = request.architecture.toLowerCase();
    const digest = getResolutionIdentity(request);
    return `setup-java-jdkres-v${JDK_RESOLUTION_KEY_VERSION}-${getRunnerOs()}-${architecture}-${digest}-`;
}
function getRunnerOs() {
    return process.env['RUNNER_OS'] ?? process.platform;
}
/**
 * Start of the seven-day window the entry was resolved in, which bounds how long
 * a floating version spec such as `21` can keep resolving to an already known
 * release.
 *
 * Seven days is the longest usable window: GitHub evicts cache entries that have
 * not been accessed for seven days, so a longer one would mean the previous
 * entry is already gone when the window rolls over, taking the stale-fallback
 * path with it. It also comfortably covers the real release cadence, which is
 * monthly at its fastest and usually quarterly.
 */
function getFreshnessBucket() {
    const week = 7 * 24 * 60 * 60 * 1000;
    return new Date(Math.floor(Date.now() / week) * week)
        .toISOString()
        .slice(0, 10);
}
/**
 * The restored payload drives a download, so it is validated as untrusted input
 * rather than trusted because it came back from the cache service.
 */
function parseResolvedRelease(contents) {
    const value = JSON.parse(contents);
    if (typeof value !== 'object' || value === null) {
        throw new Error('The cached resolution is not an object.');
    }
    const candidate = value;
    const version = candidate['version'];
    const url = candidate['url'];
    const signatureUrl = candidate['signatureUrl'];
    if (typeof version !== 'string' || !version) {
        throw new Error('The cached resolution has no version.');
    }
    assertHttpsUrl(url, 'url');
    if (signatureUrl !== undefined) {
        assertHttpsUrl(signatureUrl, 'signatureUrl');
    }
    const release = {
        version,
        url: url
    };
    if (signatureUrl !== undefined) {
        release.signatureUrl = signatureUrl;
    }
    const checksum = candidate['checksum'];
    if (checksum !== undefined) {
        release.checksum = parseChecksum(checksum);
    }
    return release;
}
function parseChecksum(value) {
    if (typeof value !== 'object' || value === null) {
        throw new Error('The cached checksum is not an object.');
    }
    const candidate = value;
    const algorithm = candidate['algorithm'];
    const checksumValue = candidate['value'];
    const source = candidate['source'];
    if (algorithm !== 'sha256' && algorithm !== 'sha512') {
        throw new Error(`Unsupported cached checksum algorithm: ${algorithm}`);
    }
    if (typeof checksumValue !== 'string' || !checksumValue) {
        throw new Error('The cached checksum has no value.');
    }
    if (source !== undefined && typeof source !== 'string') {
        throw new Error('The cached checksum source is not a string.');
    }
    const checksum = { algorithm, value: checksumValue };
    if (source !== undefined) {
        checksum.source = source;
    }
    return checksum;
}
function assertHttpsUrl(value, field) {
    if (typeof value !== 'string' || !value) {
        throw new Error(`The cached resolution has no ${field}.`);
    }
    let parsed;
    try {
        parsed = new URL(value);
    }
    catch {
        throw new Error(`The cached resolution has a malformed ${field}.`);
    }
    if (parsed.protocol !== 'https:') {
        throw new Error(`The cached resolution ${field} does not use HTTPS: ${parsed.protocol}`);
    }
}
function parseJdkResolutionState(state) {
    const value = JSON.parse(state);
    if (!Array.isArray(value) ||
        !value.every(item => typeof item === 'object' &&
            item !== null &&
            typeof item.key === 'string' &&
            typeof item.path === 'string' &&
            typeof item.release === 'string')) {
        throw new Error('Invalid JDK resolution information retrieved from state.');
    }
    return value;
}
function getErrorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}


/***/ })

};

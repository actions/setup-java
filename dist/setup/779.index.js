export const id = 779;
export const ids = [779,394];
export const modules = {

/***/ 1394:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   isCacheFeatureAvailable: () => (/* binding */ isCacheFeatureAvailable)
/* harmony export */ });
/* harmony import */ var _actions_cache__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6971);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3838);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(4527);



function isCacheFeatureAvailable() {
    if (_actions_cache__WEBPACK_IMPORTED_MODULE_0__/* .isFeatureAvailable */ .w3()) {
        return true;
    }
    if ((0,_util_js__WEBPACK_IMPORTED_MODULE_2__/* .isGhes */ .aT)()) {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .warning */ .$e('Caching is only supported on GHES version >= 3.5. If you are on a version >= 3.5, please check with your GHES admin if the Actions cache service is enabled or not.');
        return false;
    }
    _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .warning */ .$e('The runner was not able to contact the cache service. Caching will be skipped');
    return false;
}


/***/ }),

/***/ 5779:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   buildJdkCacheKey: () => (/* binding */ buildJdkCacheKey),
/* harmony export */   getJdkVerificationIdentity: () => (/* binding */ getJdkVerificationIdentity),
/* harmony export */   registerJdk: () => (/* binding */ registerJdk),
/* harmony export */   restoreJdk: () => (/* binding */ restoreJdk),
/* harmony export */   saveJdkCaches: () => (/* binding */ saveJdkCaches)
/* harmony export */ });
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6982);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _actions_cache__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6971);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(3838);
/* harmony import */ var _cache_feature_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(1394);






const STATE_JDK_CACHES = 'jdk-caches';
const JDK_CACHE_KEY_VERSION = 1;
const restoredCaches = [];
async function restoreJdk(jdk) {
    if (!jdk.path || !(0,_cache_feature_js__WEBPACK_IMPORTED_MODULE_5__.isCacheFeatureAvailable)()) {
        return false;
    }
    const key = buildJdkCacheKey(jdk);
    let matchedKey;
    try {
        matchedKey = await _actions_cache__WEBPACK_IMPORTED_MODULE_3__/* .restoreCache */ .P3([jdk.path], key);
    }
    catch (error) {
        _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .warning */ .$e(`Failed to restore JDK cache: ${error.message}`);
    }
    const architecturePath = path__WEBPACK_IMPORTED_MODULE_2___default().join(jdk.path, jdk.architecture);
    if (matchedKey &&
        (!fs__WEBPACK_IMPORTED_MODULE_1___default().existsSync(architecturePath) ||
            !fs__WEBPACK_IMPORTED_MODULE_1___default().existsSync(`${architecturePath}.complete`))) {
        _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .warning */ .$e(`JDK cache key ${matchedKey} was restored without the expected tool-cache path; downloading the JDK instead.`);
        matchedKey = undefined;
    }
    recordJdkCache({ key, path: jdk.path, matchedKey });
    if (matchedKey) {
        _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .info */ .pq(`JDK cache restored from key: ${matchedKey}`);
        return true;
    }
    _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .info */ .pq(`JDK cache is not found for ${jdk.distribution} ${jdk.version}`);
    return false;
}
function registerJdk(jdk) {
    if (!jdk.path) {
        return;
    }
    recordJdkCache({ key: buildJdkCacheKey(jdk), path: jdk.path });
}
function getJdkVerificationIdentity(verifySignature, publicKey) {
    if (!verifySignature) {
        return 'unverified';
    }
    if (!publicKey) {
        return 'verified:bundled';
    }
    const normalizedKey = publicKey.replace(/\r\n?/g, '\n').trim();
    const fingerprint = (0,crypto__WEBPACK_IMPORTED_MODULE_0__.createHash)('sha256').update(normalizedKey).digest('hex');
    return `verified:custom:sha256:${fingerprint}`;
}
async function saveJdkCaches() {
    const state = _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .getState */ .Gu(STATE_JDK_CACHES);
    if (!state) {
        return;
    }
    const caches = parseJdkCacheState(state);
    for (const jdk of caches) {
        if (jdk.matchedKey === jdk.key) {
            _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .info */ .pq(`Cache hit occurred on the JDK primary key ${jdk.key}, not saving cache.`);
            continue;
        }
        if (!fs__WEBPACK_IMPORTED_MODULE_1___default().existsSync(jdk.path)) {
            _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .debug */ .Yz(`JDK cache path does not exist, not saving: ${jdk.path}`);
            continue;
        }
        try {
            const cacheId = await _actions_cache__WEBPACK_IMPORTED_MODULE_3__/* .saveCache */ .Io([jdk.path], jdk.key);
            if (cacheId !== -1) {
                _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .info */ .pq(`JDK cache saved with the key: ${jdk.key}`);
            }
        }
        catch (error) {
            const err = error;
            if (err.name === _actions_cache__WEBPACK_IMPORTED_MODULE_3__/* .ReserveCacheError */ .Zh.name) {
                _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .info */ .pq(err.message);
            }
            else {
                throw error;
            }
        }
    }
}
function buildJdkCacheKey(jdk) {
    const runnerOs = normalizeRunnerOs(process.env['RUNNER_OS'] ?? process.platform);
    const normalizedArchitecture = jdk.architecture.toLowerCase();
    const identity = JSON.stringify({
        keyVersion: JDK_CACHE_KEY_VERSION,
        runnerOs,
        distribution: jdk.distribution.toLowerCase(),
        packageType: jdk.packageType.toLowerCase(),
        architecture: normalizedArchitecture,
        version: jdk.version,
        source: jdk.source,
        verification: jdk.verification
    });
    const digest = (0,crypto__WEBPACK_IMPORTED_MODULE_0__.createHash)('sha256').update(identity).digest('hex');
    return `setup-java-jdk-v${JDK_CACHE_KEY_VERSION}-${runnerOs}-${normalizedArchitecture}-${digest}`;
}
function normalizeRunnerOs(runnerOs) {
    switch (runnerOs.toLowerCase()) {
        case 'win32':
            return 'windows';
        case 'darwin':
            return 'macos';
        default:
            return runnerOs.toLowerCase();
    }
}
function recordJdkCache(jdk) {
    const existing = restoredCaches.findIndex(item => item.key === jdk.key && item.path === jdk.path);
    if (existing === -1) {
        restoredCaches.push(jdk);
    }
    else {
        restoredCaches[existing] = jdk;
    }
    _actions_core__WEBPACK_IMPORTED_MODULE_4__/* .saveState */ .LZ(STATE_JDK_CACHES, JSON.stringify(restoredCaches));
}
function parseJdkCacheState(state) {
    const value = JSON.parse(state);
    if (!Array.isArray(value) ||
        !value.every(item => typeof item === 'object' &&
            item !== null &&
            typeof item.key === 'string' &&
            typeof item.path === 'string' &&
            (item.matchedKey === undefined ||
                typeof item.matchedKey === 'string'))) {
        throw new Error('Invalid JDK cache information retrieved from state.');
    }
    return value;
}


/***/ })

};

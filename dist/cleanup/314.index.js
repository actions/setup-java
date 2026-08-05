export const id = 314;
export const ids = [314];
export const modules = {

/***/ 2314:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  saveJdkCaches: () => (/* binding */ saveJdkCaches)
});

// UNUSED EXPORTS: buildJdkCacheKey, getJdkVerificationIdentity, registerJdk, restoreJdk

// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6982);
// EXTERNAL MODULE: external "fs"
var external_fs_ = __webpack_require__(9896);
var external_fs_default = /*#__PURE__*/__webpack_require__.n(external_fs_);
// EXTERNAL MODULE: external "path"
var external_path_ = __webpack_require__(6928);
// EXTERNAL MODULE: ./node_modules/@actions/cache/lib/cache.js + 291 modules
var lib_cache = __webpack_require__(5767);
// EXTERNAL MODULE: ./node_modules/@actions/core/lib/core.js + 7 modules
var lib_core = __webpack_require__(3838);
// EXTERNAL MODULE: ./src/util.ts
var util = __webpack_require__(4527);
;// CONCATENATED MODULE: ./src/cache-feature.ts



function cache_feature_isCacheFeatureAvailable() {
    if (cache.isFeatureAvailable()) {
        return true;
    }
    if (isGhes()) {
        core.warning('Caching is only supported on GHES version >= 3.5. If you are on a version >= 3.5, please check with your GHES admin if the Actions cache service is enabled or not.');
        return false;
    }
    core.warning('The runner was not able to contact the cache service. Caching will be skipped');
    return false;
}

;// CONCATENATED MODULE: ./src/jdk-cache.ts






const STATE_JDK_CACHES = 'jdk-caches';
const JDK_CACHE_KEY_VERSION = 1;
const restoredCaches = (/* unused pure expression or super */ null && ([]));
async function restoreJdk(jdk) {
    if (!jdk.path || !isCacheFeatureAvailable()) {
        return false;
    }
    const key = buildJdkCacheKey(jdk);
    let matchedKey;
    try {
        matchedKey = await cache.restoreCache([jdk.path], key);
    }
    catch (error) {
        core.warning(`Failed to restore JDK cache: ${error.message}`);
    }
    const architecturePath = path.join(jdk.path, jdk.architecture);
    if (matchedKey &&
        (!fs.existsSync(architecturePath) ||
            !fs.existsSync(`${architecturePath}.complete`))) {
        core.warning(`JDK cache key ${matchedKey} was restored without the expected tool-cache path; downloading the JDK instead.`);
        matchedKey = undefined;
    }
    recordJdkCache({ key, path: jdk.path, matchedKey });
    if (matchedKey) {
        core.info(`JDK cache restored from key: ${matchedKey}`);
        return true;
    }
    core.info(`JDK cache is not found for ${jdk.distribution} ${jdk.version}`);
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
    const fingerprint = createHash('sha256').update(normalizedKey).digest('hex');
    return `verified:custom:sha256:${fingerprint}`;
}
async function saveJdkCaches() {
    const state = lib_core/* getState */.Gu(STATE_JDK_CACHES);
    if (!state) {
        return;
    }
    const caches = parseJdkCacheState(state);
    for (const jdk of caches) {
        if (jdk.matchedKey === jdk.key) {
            lib_core/* info */.pq(`Cache hit occurred on the JDK primary key ${jdk.key}, not saving cache.`);
            continue;
        }
        if (!external_fs_default().existsSync(jdk.path)) {
            lib_core/* debug */.Yz(`JDK cache path does not exist, not saving: ${jdk.path}`);
            continue;
        }
        try {
            const cacheId = await lib_cache/* saveCache */.Io([jdk.path], jdk.key);
            if (cacheId !== -1) {
                lib_core/* info */.pq(`JDK cache saved with the key: ${jdk.key}`);
            }
        }
        catch (error) {
            const err = error;
            if (err.name === lib_cache/* ReserveCacheError */.Zh.name) {
                lib_core/* info */.pq(err.message);
            }
            else {
                throw error;
            }
        }
    }
}
function buildJdkCacheKey(jdk) {
    const runnerOs = process.env['RUNNER_OS'] ?? process.platform;
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
    const digest = createHash('sha256').update(identity).digest('hex');
    return `setup-java-jdk-v${JDK_CACHE_KEY_VERSION}-${runnerOs}-${normalizedArchitecture}-${digest}`;
}
function recordJdkCache(jdk) {
    const existing = restoredCaches.findIndex(item => item.key === jdk.key && item.path === jdk.path);
    if (existing === -1) {
        restoredCaches.push(jdk);
    }
    else {
        restoredCaches[existing] = jdk;
    }
    core.saveState(STATE_JDK_CACHES, JSON.stringify(restoredCaches));
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

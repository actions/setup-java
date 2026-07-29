export const id = 377;
export const ids = [377];
export const modules = {

/***/ 7377:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   save: () => (/* binding */ save)
/* harmony export */ });
/* unused harmony export restore */
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(857);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(os__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var _actions_cache__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(5767);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3838);
/* harmony import */ var _actions_glob__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(2377);
/**
 * @fileoverview this file provides methods handling dependency cache
 */





const STATE_CACHE_PRIMARY_KEY = 'cache-primary-key';
const STATE_CACHE_PATHS = 'cache-paths';
const CACHE_MATCHED_KEY = 'cache-matched-key';
const CACHE_KEY_PREFIX = 'setup-java';
const supportedPackageManager = [
    {
        id: 'maven',
        path: [(0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.m2', 'repository')],
        // https://github.com/actions/cache/blob/0638051e9af2c23d10bb70fa9beffcad6cff9ce3/examples.md#java---maven
        pattern: [
            '**/pom.xml',
            '**/.mvn/wrapper/maven-wrapper.properties',
            '**/.mvn/extensions.xml'
        ],
        // The Maven wrapper distribution only depends on the wrapper properties,
        // which change very rarely, so it is cached separately from the local
        // repository. This keeps it available across the frequent pom.xml changes
        // that rotate the main cache key. See issue #1095.
        additionalCaches: [
            {
                name: 'maven-wrapper',
                path: [(0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.m2', 'wrapper', 'dists')],
                pattern: ['**/.mvn/wrapper/maven-wrapper.properties']
            }
        ]
    },
    {
        id: 'gradle',
        path: [(0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.gradle', 'caches')],
        // https://github.com/actions/cache/blob/0638051e9af2c23d10bb70fa9beffcad6cff9ce3/examples.md#java---gradle
        pattern: [
            '**/*.gradle*',
            '**/gradle-wrapper.properties',
            'buildSrc/**/Versions.kt',
            'buildSrc/**/Dependencies.kt',
            'gradle/*.versions.toml',
            '**/versions.properties'
        ],
        // The Gradle wrapper distribution only depends on the wrapper properties,
        // which change very rarely, so it is cached separately from the Gradle
        // caches. This keeps it available across the frequent *.gradle* changes
        // that rotate the main cache key. See issue #269.
        additionalCaches: [
            {
                name: 'gradle-wrapper',
                path: [(0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.gradle', 'wrapper')],
                pattern: ['**/gradle-wrapper.properties']
            }
        ]
    },
    {
        id: 'sbt',
        path: [
            (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.ivy2', 'cache'),
            (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.sbt'),
            getCoursierCachePath(),
            // Some files should not be cached to avoid resolution problems.
            // In particular the resolution of snapshots (ideological gap between maven/ivy).
            '!' + (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.sbt', '*.lock'),
            '!' + (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '**', 'ivydata-*.properties')
        ],
        pattern: [
            '**/*.sbt',
            '**/project/build.properties',
            '**/project/**.scala',
            '**/project/**.sbt'
        ]
    }
];
function getCoursierCachePath() {
    if (os__WEBPACK_IMPORTED_MODULE_1___default().type() === 'Linux')
        return (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), '.cache', 'coursier');
    if (os__WEBPACK_IMPORTED_MODULE_1___default().type() === 'Darwin')
        return (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), 'Library', 'Caches', 'Coursier');
    return (0,path__WEBPACK_IMPORTED_MODULE_0__.join)(os__WEBPACK_IMPORTED_MODULE_1___default().homedir(), 'AppData', 'Local', 'Coursier', 'Cache');
}
function findPackageManager(id) {
    const packageManager = supportedPackageManager.find(packageManager => packageManager.id === id);
    if (packageManager === undefined) {
        throw new Error(`unknown package manager specified: ${id}`);
    }
    return packageManager;
}
function resolveCachePaths(packageManager, cachePaths) {
    return cachePaths.length > 0 ? cachePaths : packageManager.path;
}
function getCachePathsFromState(packageManager) {
    const cachePathsState = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getState */ .Gu(STATE_CACHE_PATHS);
    if (!cachePathsState) {
        return packageManager.path;
    }
    const cachePaths = JSON.parse(cachePathsState);
    if (!Array.isArray(cachePaths) ||
        !cachePaths.every(cachePath => typeof cachePath === 'string')) {
        throw new Error('Invalid cache paths retrieved from state.');
    }
    return cachePaths;
}
/**
 * State keys used to carry an additional cache's restore-time information over
 * to the post (save) action, scoped by the additional cache name.
 */
function additionalCachePrimaryKeyState(name) {
    return `${STATE_CACHE_PRIMARY_KEY}-${name}`;
}
function additionalCacheMatchedKeyState(name) {
    return `${CACHE_MATCHED_KEY}-${name}`;
}
function buildCacheKey(id, fileHash) {
    return `${CACHE_KEY_PREFIX}-${process.env['RUNNER_OS']}-${process.arch}-${id}-${fileHash}`;
}
/**
 * A function that generates a cache key to use.
 * Format of the generated key will be "${{ platform }}-${{ id }}-${{ fileHash }}"".
 * @see {@link https://docs.github.com/en/actions/guides/caching-dependencies-to-speed-up-workflows#matching-a-cache-key|spec of cache key}
 */
async function computeCacheKey(packageManager, cacheDependencyPath) {
    const pattern = cacheDependencyPath
        ? cacheDependencyPath.trim().split('\n')
        : packageManager.pattern;
    const fileHash = await glob.hashFiles(pattern.join('\n'));
    if (!fileHash) {
        throw new Error(`No file in ${process.cwd()} matched to [${pattern}], make sure you have checked out the target repository`);
    }
    return buildCacheKey(packageManager.id, fileHash);
}
/**
 * Computes the cache key for an additional cache. Unlike {@link computeCacheKey}
 * this returns undefined (instead of throwing) when no file matches the pattern,
 * because additional caches are optional features that many projects do not use.
 */
async function computeAdditionalCacheKey(additionalCache) {
    const fileHash = await glob.hashFiles(additionalCache.pattern.join('\n'));
    if (!fileHash) {
        return undefined;
    }
    return buildCacheKey(additionalCache.name, fileHash);
}
/**
 * Restore the dependency cache
 * @param id ID of the package manager, should be "maven", "gradle", or "sbt"
 * @param cacheDependencyPath The path to a dependency file
 * @param cachePaths Paths to cache instead of the package manager defaults
 */
async function restore(id, cacheDependencyPath, cachePaths = []) {
    const packageManager = findPackageManager(id);
    const resolvedCachePaths = resolveCachePaths(packageManager, cachePaths);
    const [primaryKey, preparedAdditionalCaches] = await Promise.all([
        computeCacheKey(packageManager, cacheDependencyPath),
        prepareAdditionalCaches(packageManager.additionalCaches ?? [])
    ]);
    core.debug(`primary key is ${primaryKey}`);
    core.saveState(STATE_CACHE_PRIMARY_KEY, primaryKey);
    core.saveState(STATE_CACHE_PATHS, JSON.stringify(resolvedCachePaths));
    core.setOutput(STATE_CACHE_PRIMARY_KEY, primaryKey);
    for (const preparedCache of preparedAdditionalCaches) {
        core.debug(`${preparedCache.cache.name} primary key is ${preparedCache.primaryKey}`);
        core.saveState(additionalCachePrimaryKeyState(preparedCache.cache.name), preparedCache.primaryKey);
    }
    await Promise.all([
        restorePrimaryCache(packageManager, resolvedCachePaths, primaryKey),
        ...preparedAdditionalCaches.map(preparedCache => restoreAdditionalCache(preparedCache))
    ]);
}
async function restorePrimaryCache(packageManager, cachePaths, primaryKey) {
    // No "restoreKeys" is set, to start with a clear cache after dependency update (see https://github.com/actions/setup-java/issues/269)
    const matchedKey = await cache.restoreCache(cachePaths, primaryKey);
    if (matchedKey) {
        core.saveState(CACHE_MATCHED_KEY, matchedKey);
        core.setOutput('cache-hit', matchedKey === primaryKey);
        core.info(`Cache restored from key: ${matchedKey}`);
    }
    else {
        core.setOutput('cache-hit', false);
        core.info(`${packageManager.id} cache is not found`);
    }
}
/**
 * Compute keys for additional caches (e.g. build-tool wrapper distributions).
 * Additional caches without a matching configuration file are omitted.
 */
async function prepareAdditionalCaches(additionalCaches) {
    const preparedCaches = await Promise.all(additionalCaches.map(async (additionalCache) => {
        const primaryKey = await computeAdditionalCacheKey(additionalCache);
        if (!primaryKey) {
            core.debug(`No file matched [${additionalCache.pattern}] for the ${additionalCache.name} cache, skipping.`);
            return undefined;
        }
        return { cache: additionalCache, primaryKey };
    }));
    return preparedCaches.filter((preparedCache) => preparedCache !== undefined);
}
/**
 * Restore an additional cache keyed independently of the main dependency cache.
 */
async function restoreAdditionalCache(preparedCache) {
    const { cache: additionalCache, primaryKey } = preparedCache;
    const matchedKey = await cache.restoreCache(additionalCache.path, primaryKey);
    if (matchedKey) {
        core.saveState(additionalCacheMatchedKeyState(additionalCache.name), matchedKey);
        core.info(`${additionalCache.name} cache restored from key: ${matchedKey}`);
    }
    else {
        core.info(`${additionalCache.name} cache is not found`);
    }
}
/**
 * Save the dependency cache
 * @param id ID of the package manager, should be "maven" or "gradle"
 */
async function save(id) {
    const packageManager = findPackageManager(id);
    const cachePaths = getCachePathsFromState(packageManager);
    const matchedKey = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getState */ .Gu(CACHE_MATCHED_KEY);
    // Inputs are re-evaluated before the post action, so we want the original key used for restore
    const primaryKey = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getState */ .Gu(STATE_CACHE_PRIMARY_KEY);
    for (const additionalCache of packageManager.additionalCaches ?? []) {
        try {
            await saveAdditionalCache(packageManager, additionalCache);
        }
        catch (error) {
            const err = error;
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .warning */ .$e(`Failed to save ${additionalCache.name} cache: ${err.message}. Continuing with primary cache save.`);
        }
    }
    if (!primaryKey) {
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .warning */ .$e('Error retrieving key from state.');
        return;
    }
    else if (matchedKey === primaryKey) {
        // no change in target directories
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Cache hit occurred on the primary key ${primaryKey}, not saving cache.`);
        return;
    }
    try {
        const cacheId = await _actions_cache__WEBPACK_IMPORTED_MODULE_2__/* .saveCache */ .Io(cachePaths, primaryKey);
        if (cacheId === -1) {
            // saveCache returns -1 without throwing when the cache was not saved,
            // e.g. a reserve collision or a read-only token (fork PR). @actions/cache
            // has already logged the reason at the appropriate severity, so just
            // trace it instead of misreporting that the cache was saved.
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`Cache was not saved for the key: ${primaryKey}`);
            return;
        }
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Cache saved with the key: ${primaryKey}`);
    }
    catch (error) {
        const err = error;
        if (err.name === _actions_cache__WEBPACK_IMPORTED_MODULE_2__/* .ReserveCacheError */ .Zh.name) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(err.message);
        }
        else {
            if (isProbablyGradleDaemonProblem(packageManager, err)) {
                _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .warning */ .$e('Failed to save Gradle cache on Windows. If tar.exe reported "Permission denied", try to run Gradle with `--no-daemon` option. Refer to https://github.com/actions/cache/issues/454 for details.');
            }
            throw error;
        }
    }
}
/**
 * Save an additional cache under its own key. Skips when no key was recorded at
 * restore time (feature unused) or when the exact key was already restored.
 */
async function saveAdditionalCache(packageManager, additionalCache) {
    const primaryKey = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getState */ .Gu(additionalCachePrimaryKeyState(additionalCache.name));
    const matchedKey = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getState */ .Gu(additionalCacheMatchedKeyState(additionalCache.name));
    if (!primaryKey) {
        // The feature is not used by this project, nothing to save.
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`No primary key for the ${additionalCache.name} cache, not saving cache.`);
        return;
    }
    else if (matchedKey === primaryKey) {
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Cache hit occurred on the ${additionalCache.name} primary key ${primaryKey}, not saving cache.`);
        return;
    }
    const globber = await _actions_glob__WEBPACK_IMPORTED_MODULE_4__/* .create */ .v(additionalCache.path.join('\n'), {
        implicitDescendants: false
    });
    const cachePaths = await globber.glob();
    if (cachePaths.length === 0) {
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`${additionalCache.name} cache paths do not exist, not saving cache.`);
        return;
    }
    try {
        const cacheId = await _actions_cache__WEBPACK_IMPORTED_MODULE_2__/* .saveCache */ .Io(cachePaths, primaryKey);
        if (cacheId === -1) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`${additionalCache.name} cache was not saved for the key: ${primaryKey}`);
            return;
        }
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`${additionalCache.name} cache saved with the key: ${primaryKey}`);
    }
    catch (error) {
        const err = error;
        if (err.name === _actions_cache__WEBPACK_IMPORTED_MODULE_2__/* .ValidationError */ .yI.name) {
            // The cache paths did not resolve, e.g. the wrapper distribution was
            // never downloaded because a system build tool was used or the download
            // failed. Optional wrapper caches must not fail the post step, so skip.
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .debug */ .Yz(`${additionalCache.name} cache paths do not exist, not saving cache: ${err.message}`);
            return;
        }
        if (err.name === _actions_cache__WEBPACK_IMPORTED_MODULE_2__/* .ReserveCacheError */ .Zh.name) {
            _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(err.message);
        }
        else {
            if (isProbablyGradleDaemonProblem(packageManager, err)) {
                _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .warning */ .$e(`Failed to save ${additionalCache.name} cache on Windows. If tar.exe reported "Permission denied", try to run Gradle with \`--no-daemon\` option. Refer to https://github.com/actions/cache/issues/454 for details.`);
            }
            throw error;
        }
    }
}
/**
 * @param packageManager the specified package manager by user
 * @param error the error thrown by the saveCache
 * @returns true if the given error seems related to the {@link https://github.com/actions/cache/issues/454|running Gradle Daemon issue}.
 * @see {@link https://github.com/actions/cache/issues/454#issuecomment-840493935|why --no-daemon is necessary}
 */
function isProbablyGradleDaemonProblem(packageManager, error) {
    if (packageManager.id !== 'gradle' ||
        process.env['RUNNER_OS'] !== 'Windows') {
        return false;
    }
    const message = error.message || '';
    return message.startsWith('Tar failed with error: ');
}


/***/ })

};

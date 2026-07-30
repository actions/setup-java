export const id = 172;
export const ids = [172];
export const modules = {

/***/ 8172:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   configureMavenArgs: () => (/* binding */ configureMavenArgs)
/* harmony export */ });
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(3838);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(4527);
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(7242);



/**
 * Configures the MAVEN_ARGS environment variable so that Maven suppresses
 * artifact transfer/download progress output by default, producing cleaner
 * CI logs.
 *
 * Behavior:
 * - When `show-download-progress` is `false` (the default), `-ntp`
 *   (`--no-transfer-progress`) is appended to any existing MAVEN_ARGS value.
 * - When `show-download-progress` is `true`, MAVEN_ARGS is left untouched so
 *   the user's own configuration (and Maven's default progress output) is
 *   preserved.
 *
 * The change is idempotent: if MAVEN_ARGS already disables transfer progress
 * (via `-ntp` or `--no-transfer-progress`) nothing is added. Any pre-existing
 * MAVEN_ARGS value is preserved.
 *
 * MAVEN_ARGS is honored by Maven 3.9.0+ and the Maven Wrapper; older Maven
 * versions ignore it, so this is a no-op there. It has no effect on non-Maven
 * builds such as Gradle or sbt.
 */
function configureMavenArgs() {
    const showDownloadProgress = (0,_util_js__WEBPACK_IMPORTED_MODULE_1__/* .getBooleanInput */ .Vt)(_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .INPUT_SHOW_DOWNLOAD_PROGRESS */ .wX, false);
    if (showDownloadProgress) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .INPUT_SHOW_DOWNLOAD_PROGRESS */ .wX} is true; leaving ${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_ARGS_ENV */ .qm} unchanged`);
        return;
    }
    const existingArgs = (process.env[_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_ARGS_ENV */ .qm] ?? '').trim();
    const alreadyDisabled = existingArgs
        .split(/\s+/)
        .some(arg => arg === _constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_NO_TRANSFER_PROGRESS_FLAG */ .ti ||
        arg === _constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_NO_TRANSFER_PROGRESS_LONG_FLAG */ .kN);
    if (alreadyDisabled) {
        _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .debug */ .Yz(`${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_ARGS_ENV */ .qm} already disables transfer progress; leaving it unchanged`);
        return;
    }
    const updatedArgs = existingArgs
        ? `${existingArgs} ${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_NO_TRANSFER_PROGRESS_FLAG */ .ti}`
        : _constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_NO_TRANSFER_PROGRESS_FLAG */ .ti;
    _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .exportVariable */ .dN(_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_ARGS_ENV */ .qm, updatedArgs);
    _actions_core__WEBPACK_IMPORTED_MODULE_0__/* .info */ .pq(`Configured ${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_ARGS_ENV */ .qm} to include ${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .MAVEN_NO_TRANSFER_PROGRESS_FLAG */ .ti} to suppress Maven transfer progress logs. ` +
        `Set '${_constants_js__WEBPACK_IMPORTED_MODULE_2__/* .INPUT_SHOW_DOWNLOAD_PROGRESS */ .wX}: true' to keep the download progress output.`);
}


/***/ })

};

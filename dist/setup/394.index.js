export const id = 394;
export const ids = [394];
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


/***/ })

};

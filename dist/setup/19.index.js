export const id = 19;
export const ids = [19];
export const modules = {

/***/ 1019:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   LocalDistribution: () => (/* binding */ LocalDistribution)
/* harmony export */ });
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9805);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3838);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var _base_installer_js__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(6242);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(4527);
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(7242);







class LocalDistribution extends _base_installer_js__WEBPACK_IMPORTED_MODULE_4__/* .JavaBase */ .O {
    jdkFile;
    constructor(installerOptions, jdkFile) {
        super('jdkfile', installerOptions);
        this.jdkFile = jdkFile;
    }
    async setupJava() {
        if (this.latest) {
            throw new Error("The 'latest' version alias is not supported for the 'jdkfile' distribution. Please specify a concrete version.");
        }
        let foundJava = this.forceDownload ? null : this.findInToolcache();
        if (foundJava) {
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Resolved Java ${foundJava.version} from tool-cache`);
        }
        else {
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Java ${this.version} was not found in tool-cache. Trying to unpack JDK file...`);
            if (!this.jdkFile) {
                throw new Error("'jdkFile' is not specified");
            }
            const jdkFilePath = path__WEBPACK_IMPORTED_MODULE_3___default().resolve(this.jdkFile);
            const stats = fs__WEBPACK_IMPORTED_MODULE_2___default().statSync(jdkFilePath);
            if (!stats.isFile()) {
                throw new Error(`JDK file was not found in path '${jdkFilePath}'`);
            }
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Extracting Java from '${jdkFilePath}'`);
            const extractedJavaPath = await (0,_util_js__WEBPACK_IMPORTED_MODULE_5__/* .extractJdkFile */ .PE)(jdkFilePath);
            const archiveName = fs__WEBPACK_IMPORTED_MODULE_2___default().readdirSync(extractedJavaPath)[0];
            const archivePath = path__WEBPACK_IMPORTED_MODULE_3___default().join(extractedJavaPath, archiveName);
            const javaVersion = this.version;
            const javaPath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_0__/* .cacheDir */ .e8(archivePath, this.toolcacheFolderName, this.getToolcacheVersionName(javaVersion), this.architecture);
            foundJava = {
                version: javaVersion,
                path: javaPath
            };
        }
        // JDK folder may contain postfix "Contents/Home" on macOS
        const macOSPostfixPath = path__WEBPACK_IMPORTED_MODULE_3___default().join(foundJava.path, _constants_js__WEBPACK_IMPORTED_MODULE_6__/* .MACOS_JAVA_CONTENT_POSTFIX */ .PG);
        if (process.platform === 'darwin' && fs__WEBPACK_IMPORTED_MODULE_2___default().existsSync(macOSPostfixPath)) {
            foundJava.path = macOSPostfixPath;
        }
        if (this.setDefault) {
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Setting Java ${foundJava.version} as the default`);
            this.setJavaDefault(foundJava.version, foundJava.path);
        }
        else {
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Installing Java ${foundJava.version} (not setting as default)`);
            this.setJavaEnvironment(foundJava.version, foundJava.path);
        }
        return foundJava;
    }
    async findPackageForDownload(version // eslint-disable-line @typescript-eslint/no-unused-vars
    ) {
        throw new Error('This method should not be implemented in local file provider');
    }
    async downloadTool(javaRelease // eslint-disable-line @typescript-eslint/no-unused-vars
    ) {
        throw new Error('This method should not be implemented in local file provider');
    }
}


/***/ })

};

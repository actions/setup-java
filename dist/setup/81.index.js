export const id = 81;
export const ids = [81];
export const modules = {

/***/ 9081:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   configureAuthentication: () => (/* binding */ configureAuthentication),
/* harmony export */   createAuthenticationSettings: () => (/* binding */ createAuthenticationSettings),
/* harmony export */   generate: () => (/* binding */ generate),
/* harmony export */   getInputWithDeprecatedAlias: () => (/* binding */ getInputWithDeprecatedAlias)
/* harmony export */ });
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(3838);
/* harmony import */ var _actions_io__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(8701);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_3___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_3__);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(857);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_4___default = /*#__PURE__*/__webpack_require__.n(os__WEBPACK_IMPORTED_MODULE_4__);
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(7242);
/* harmony import */ var _gpg_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(8343);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4527);
/* harmony import */ var _xml_js__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(22);









async function configureAuthentication() {
    const id = _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .getInput */ .V4(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_SERVER_ID */ .fd);
    const usernameEnvVar = getInputWithDeprecatedAlias(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_SERVER_USERNAME_ENV_VAR */ .sc, _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_SERVER_USERNAME_DEPRECATED */ .sp, _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_DEFAULT_SERVER_USERNAME */ .Wj);
    const passwordEnvVar = getInputWithDeprecatedAlias(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_SERVER_PASSWORD_ENV_VAR */ .r4, _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_SERVER_PASSWORD_DEPRECATED */ .Vt, _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_DEFAULT_SERVER_PASSWORD */ .xp);
    const settingsDirectory = _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .getInput */ .V4(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_SETTINGS_PATH */ .Xh) ||
        path__WEBPACK_IMPORTED_MODULE_0__.join(os__WEBPACK_IMPORTED_MODULE_4__.homedir(), _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .M2_DIR */ .iT);
    const overwriteSettings = (0,_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getBooleanInput */ .Vt)(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_OVERWRITE_SETTINGS */ .TS, true);
    const gpgPrivateKey = _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .getInput */ .V4(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_GPG_PRIVATE_KEY */ .wz) ||
        _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_DEFAULT_GPG_PRIVATE_KEY */ .OD;
    const gpgPassphraseEnvVar = getInputWithDeprecatedAlias(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_GPG_PASSPHRASE_ENV_VAR */ .db, _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_GPG_PASSPHRASE_DEPRECATED */ .TY, gpgPrivateKey ? _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .INPUT_DEFAULT_GPG_PASSPHRASE */ .RX : undefined);
    if (gpgPrivateKey) {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .setSecret */ .Pq(gpgPrivateKey);
    }
    await createAuthenticationSettings(id, usernameEnvVar, passwordEnvVar, settingsDirectory, overwriteSettings, gpgPassphraseEnvVar);
    if (gpgPrivateKey) {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq('Importing private gpg key');
        const gpgHome = await _gpg_js__WEBPACK_IMPORTED_MODULE_5__/* .importKey */ .Fh(gpgPrivateKey);
        try {
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .saveState */ .LZ(_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .STATE_GPG_HOME */ .Fi, gpgHome);
            _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .exportVariable */ .dN('GNUPGHOME', _gpg_js__WEBPACK_IMPORTED_MODULE_5__/* .toGpgPath */ .nY(gpgHome));
        }
        catch (error) {
            await _gpg_js__WEBPACK_IMPORTED_MODULE_5__/* .removeGpgHome */ .mS(gpgHome);
            throw error;
        }
    }
}
function getInputWithDeprecatedAlias(inputName, deprecatedInputName, defaultValue) {
    const value = _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .getInput */ .V4(inputName);
    const deprecatedValue = _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .getInput */ .V4(deprecatedInputName);
    if (deprecatedValue) {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .warning */ .$e(`The '${deprecatedInputName}' input is deprecated and may be removed in a future release. Please use '${inputName}' instead.`);
    }
    return value || deprecatedValue || defaultValue || '';
}
async function createAuthenticationSettings(id, usernameEnvVar, passwordEnvVar, settingsDirectory, overwriteSettings, gpgPassphraseEnvVar = undefined) {
    _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Creating ${_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .MVN_SETTINGS_FILE */ .vO} with server-id: ${id}`);
    // when an alternate m2 location is specified use only that location (no .m2 directory)
    // otherwise use the home/.m2/ path
    await _actions_io__WEBPACK_IMPORTED_MODULE_2__/* .mkdirP */ .U$(settingsDirectory);
    await write(settingsDirectory, generate(id, usernameEnvVar, passwordEnvVar, gpgPassphraseEnvVar), overwriteSettings);
}
// only exported for testing purposes
function generate(id, usernameEnvVar, passwordEnvVar, gpgPassphraseEnvVar) {
    // The maven-gpg-plugin reads the passphrase from the environment variable
    // named by the `gpg.passphraseEnvName` property (default MAVEN_GPG_PASSPHRASE).
    // Only configure it when the requested env var name differs from that default;
    // otherwise the plugin already reads the right variable and no extra settings
    // are needed. Writing `gpg.passphrase` to settings.xml is deprecated and fails
    // when the plugin's `bestPractices` mode is enabled.
    const includeGpgPassphraseProfile = gpgPassphraseEnvVar &&
        gpgPassphraseEnvVar !== _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .MAVEN_GPG_PASSPHRASE_DEFAULT_ENV */ .ko;
    const lines = [
        '<settings xmlns="http://maven.apache.org/SETTINGS/1.0.0"',
        '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '  xsi:schemaLocation="http://maven.apache.org/SETTINGS/1.0.0 https://maven.apache.org/xsd/settings-1.0.0.xsd">',
        '  <interactiveMode>false</interactiveMode>',
        '  <servers>',
        '    <server>',
        `      <id>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_8__/* .escapeXmlText */ .I)(id)}</id>`,
        `      <username>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_8__/* .escapeXmlText */ .I)(`\${env.${usernameEnvVar}}`)}</username>`,
        `      <password>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_8__/* .escapeXmlText */ .I)(`\${env.${passwordEnvVar}}`)}</password>`,
        '    </server>',
        '  </servers>'
    ];
    if (includeGpgPassphraseProfile) {
        lines.push('  <profiles>', '    <profile>', `      <id>${_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .GPG_PASSPHRASE_PROFILE_ID */ .K$}</id>`, '      <properties>', `        <gpg.passphraseEnvName>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_8__/* .escapeXmlText */ .I)(gpgPassphraseEnvVar)}</gpg.passphraseEnvName>`, '      </properties>', '    </profile>', '  </profiles>', '  <activeProfiles>', `    <activeProfile>${_constants_js__WEBPACK_IMPORTED_MODULE_7__/* .GPG_PASSPHRASE_PROFILE_ID */ .K$}</activeProfile>`, '  </activeProfiles>');
    }
    lines.push('</settings>');
    return lines.join('\n');
}
async function write(directory, settings, overwriteSettings) {
    const location = path__WEBPACK_IMPORTED_MODULE_0__.join(directory, _constants_js__WEBPACK_IMPORTED_MODULE_7__/* .MVN_SETTINGS_FILE */ .vO);
    const settingsExists = fs__WEBPACK_IMPORTED_MODULE_3__.existsSync(location);
    if (settingsExists && overwriteSettings) {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Overwriting existing file ${location}`);
    }
    else if (!settingsExists) {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Writing to ${location}`);
    }
    else {
        _actions_core__WEBPACK_IMPORTED_MODULE_1__/* .info */ .pq(`Skipping generation ${location} because file already exists and overwriting is not required`);
        return;
    }
    return fs__WEBPACK_IMPORTED_MODULE_3__.writeFileSync(location, settings, {
        encoding: 'utf-8',
        flag: 'w'
    });
}


/***/ }),

/***/ 8343:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Fh: () => (/* binding */ importKey),
/* harmony export */   Yi: () => (/* binding */ verifyPackageSignature),
/* harmony export */   mS: () => (/* binding */ removeGpgHome),
/* harmony export */   nY: () => (/* binding */ toGpgPath)
/* harmony export */ });
/* unused harmony export GPG_HOME_PREFIX */
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6982);
/* harmony import */ var crypto__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(crypto__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _actions_io__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(8701);
/* harmony import */ var _actions_exec__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(5260);
/* harmony import */ var _actions_tool_cache__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(9805);
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(4527);







const GPG_HOME_PREFIX = 'setup-java-gpg-';
const VERIFY_GPG_HOME_PREFIX = 'verify-signature-gpg-home-';
// Convert a Windows path (D:\a\_temp\...) to a POSIX path (/d/a/_temp/...).
// The Git-bundled GPG on Windows (MSYS2-based) uses POSIX path conventions
// internally. Passing Windows paths with backslashes can cause fatal GPG errors
// (exit code 2), so all paths passed to GPG must be in POSIX format on Windows.
function toGpgPath(p) {
    if (process.platform !== 'win32')
        return p;
    return p
        .replace(/\\/g, '/')
        .replace(/^([A-Za-z]):\//, (_, drive) => `/${drive.toLowerCase()}/`);
}
function createGpgHome(prefix) {
    const gpgHome = fs__WEBPACK_IMPORTED_MODULE_0__.mkdtempSync(path__WEBPACK_IMPORTED_MODULE_1__.join(_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getTempDir */ .G4(), prefix));
    if (process.platform !== 'win32') {
        fs__WEBPACK_IMPORTED_MODULE_0__.chmodSync(gpgHome, 0o700);
    }
    return gpgHome;
}
async function importKey(privateKey) {
    const gpgHome = createGpgHome(GPG_HOME_PREFIX);
    const privateKeyFile = path__WEBPACK_IMPORTED_MODULE_1__.join(gpgHome, `private-key-${(0,crypto__WEBPACK_IMPORTED_MODULE_2__.randomUUID)()}.asc`);
    try {
        fs__WEBPACK_IMPORTED_MODULE_0__.writeFileSync(privateKeyFile, privateKey, {
            encoding: 'utf-8',
            flag: 'wx',
            mode: 0o600
        });
        try {
            await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpg', [
                '--homedir',
                toGpgPath(gpgHome),
                '--batch',
                '--import',
                toGpgPath(privateKeyFile)
            ], { silent: true });
        }
        finally {
            fs__WEBPACK_IMPORTED_MODULE_0__.rmSync(privateKeyFile, { force: true });
        }
        return gpgHome;
    }
    catch (error) {
        await removeGpgHome(gpgHome);
        throw error;
    }
}
async function removeGpgHome(gpgHome) {
    if (!gpgHome) {
        return;
    }
    const resolvedGpgHome = path__WEBPACK_IMPORTED_MODULE_1__.resolve(gpgHome);
    const resolvedTempDir = path__WEBPACK_IMPORTED_MODULE_1__.resolve(_util_js__WEBPACK_IMPORTED_MODULE_6__/* .getTempDir */ .G4());
    if (path__WEBPACK_IMPORTED_MODULE_1__.dirname(resolvedGpgHome) !== resolvedTempDir ||
        !path__WEBPACK_IMPORTED_MODULE_1__.basename(resolvedGpgHome).startsWith(GPG_HOME_PREFIX)) {
        throw new Error(`Refusing to remove unexpected GPG home: ${gpgHome}`);
    }
    if (!fs__WEBPACK_IMPORTED_MODULE_0__.existsSync(resolvedGpgHome)) {
        return;
    }
    try {
        await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpgconf', ['--homedir', toGpgPath(resolvedGpgHome), '--kill', 'gpg-agent'], { silent: true, ignoreReturnCode: true });
    }
    catch {
        // gpgconf may be unavailable, but directory removal must still be attempted.
    }
    await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(resolvedGpgHome);
}
async function verifyPackageSignature(archivePath, signatureUrl, publicKeyContent) {
    const signaturePath = await _actions_tool_cache__WEBPACK_IMPORTED_MODULE_5__/* .downloadTool */ .bq(signatureUrl);
    let gpgHome;
    try {
        gpgHome = createGpgHome(VERIFY_GPG_HOME_PREFIX);
    }
    catch (error) {
        try {
            await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(signaturePath);
        }
        catch {
            // ignore cleanup failures
        }
        throw new Error(`Failed to create temporary GPG home directory for signature verification: ${error.message}`, { cause: error });
    }
    try {
        const publicKeyFile = path__WEBPACK_IMPORTED_MODULE_1__.join(gpgHome, 'public-key.asc');
        fs__WEBPACK_IMPORTED_MODULE_0__.writeFileSync(publicKeyFile, publicKeyContent, { encoding: 'utf-8' });
        const options = { silent: true };
        await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpg', [
            '--homedir',
            toGpgPath(gpgHome),
            '--batch',
            '--import',
            toGpgPath(publicKeyFile)
        ], options);
        await _actions_exec__WEBPACK_IMPORTED_MODULE_4__/* .exec */ .m('gpg', [
            '--homedir',
            toGpgPath(gpgHome),
            '--batch',
            '--verify',
            toGpgPath(signaturePath),
            toGpgPath(archivePath)
        ], options);
    }
    finally {
        await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(signaturePath);
        await _actions_io__WEBPACK_IMPORTED_MODULE_3__/* .rmRF */ .Yz(gpgHome);
    }
}


/***/ }),

/***/ 22:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   I: () => (/* binding */ escapeXmlText),
/* harmony export */   R: () => (/* binding */ escapeXmlAttribute)
/* harmony export */ });
function escapeXmlText(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
// Use for user-controlled values written into XML attributes. Text nodes should
// use escapeXmlText so quotes remain byte-compatible with previous output.
function escapeXmlAttribute(value) {
    return escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}


/***/ })

};

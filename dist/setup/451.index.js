export const id = 451;
export const ids = [451];
export const modules = {

/***/ 9451:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   configureToolchains: () => (/* binding */ configureToolchains),
/* harmony export */   createToolchainsSettings: () => (/* binding */ createToolchainsSettings),
/* harmony export */   generateNewToolchainDefinition: () => (/* binding */ generateNewToolchainDefinition),
/* harmony export */   generateToolchainDefinition: () => (/* binding */ generateToolchainDefinition),
/* harmony export */   validateToolchainIds: () => (/* reexport safe */ _toolchain_ids_js__WEBPACK_IMPORTED_MODULE_5__.O)
/* harmony export */ });
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(9896);
/* harmony import */ var fs__WEBPACK_IMPORTED_MODULE_0___default = /*#__PURE__*/__webpack_require__.n(fs__WEBPACK_IMPORTED_MODULE_0__);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(857);
/* harmony import */ var os__WEBPACK_IMPORTED_MODULE_1___default = /*#__PURE__*/__webpack_require__.n(os__WEBPACK_IMPORTED_MODULE_1__);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(6928);
/* harmony import */ var path__WEBPACK_IMPORTED_MODULE_2___default = /*#__PURE__*/__webpack_require__.n(path__WEBPACK_IMPORTED_MODULE_2__);
/* harmony import */ var _actions_core__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(3838);
/* harmony import */ var _actions_io__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(8701);
/* harmony import */ var _constants_js__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(7242);
/* harmony import */ var _toolchain_ids_js__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(7083);
/* harmony import */ var _xml_js__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(22);








async function configureToolchains(version, distributionName, jdkHome, toolchainId) {
    const vendor = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getInput */ .V4(_constants_js__WEBPACK_IMPORTED_MODULE_6__/* .INPUT_MVN_TOOLCHAIN_VENDOR */ .m7) || distributionName;
    const id = toolchainId || `${vendor}_${version}`;
    const settingsDirectory = _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .getInput */ .V4(_constants_js__WEBPACK_IMPORTED_MODULE_6__/* .INPUT_SETTINGS_PATH */ .Xh) ||
        path__WEBPACK_IMPORTED_MODULE_2__.join(os__WEBPACK_IMPORTED_MODULE_1__.homedir(), _constants_js__WEBPACK_IMPORTED_MODULE_6__/* .M2_DIR */ .iT);
    await createToolchainsSettings({
        jdkInfo: {
            version,
            vendor,
            id,
            jdkHome
        },
        settingsDirectory
    });
}
async function createToolchainsSettings({ jdkInfo, settingsDirectory }) {
    _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Creating ${_constants_js__WEBPACK_IMPORTED_MODULE_6__/* .MVN_TOOLCHAINS_FILE */ .qs} for JDK version ${jdkInfo.version} from ${jdkInfo.vendor}`);
    // when an alternate m2 location is specified use only that location (no .m2 directory)
    // otherwise use the home/.m2/ path
    await _actions_io__WEBPACK_IMPORTED_MODULE_4__/* .mkdirP */ .U$(settingsDirectory);
    const originalToolchains = await readExistingToolchainsFile(settingsDirectory);
    const updatedToolchains = await generateToolchainDefinition(originalToolchains, jdkInfo.version, jdkInfo.vendor, jdkInfo.id, jdkInfo.jdkHome);
    await writeToolchainsFileToDisk(settingsDirectory, updatedToolchains);
}
// only exported for testing purposes
async function generateToolchainDefinition(original, version, vendor, id, jdkHome) {
    if (!original?.length) {
        return generateNewToolchainDefinition(version, vendor, id, jdkHome);
    }
    return generateMergedToolchainDefinition(original, version, vendor, id, jdkHome);
}
async function generateMergedToolchainDefinition(original, version, vendor, id, jdkHome) {
    let jsToolchains = [
        {
            type: 'jdk',
            provides: {
                version: `${version}`,
                vendor: `${vendor}`,
                id: `${id}`
            },
            configuration: {
                jdkHome: `${jdkHome}`
            }
        }
    ];
    // default root attributes, used when the existing file does not declare its own
    let rootAttributes = {
        '@xmlns': 'http://maven.apache.org/TOOLCHAINS/1.1.0',
        '@xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        '@xsi:schemaLocation': 'http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd'
    };
    const { create: xmlCreate } = await __webpack_require__.e(/* import() */ 697).then(__webpack_require__.bind(__webpack_require__, 4697));
    // convert existing toolchains into TS native objects for better handling
    // xmlbuilder2 will convert the document into a `{toolchains: { toolchain: [] | {} }}` structure
    // instead of the desired `toolchains: [{}]` one or simply `[{}]`
    const jsObj = xmlCreate(original)
        .root()
        .toObject();
    if (jsObj.toolchains) {
        // preserve the existing root attributes (xmlns, schemaLocation, …) so we don't
        // silently rewrite user-managed metadata or change the effective XML namespace;
        // xmlbuilder2 exposes attributes as `@`-prefixed keys on the element object
        const existingAttributes = Object.fromEntries(Object.entries(jsObj.toolchains).filter(([key]) => key.startsWith('@')));
        // fall back to the defaults only for attributes the existing file is missing
        rootAttributes = { ...rootAttributes, ...existingAttributes };
        if (jsObj.toolchains.toolchain) {
            // in case only a single child exists xmlbuilder2 will not create an array and using verbose = true equally doesn't work here
            // See https://oozcitak.github.io/xmlbuilder2/serialization.html#js-object-and-map-serializers for details
            if (Array.isArray(jsObj.toolchains.toolchain)) {
                jsToolchains.push(...jsObj.toolchains.toolchain);
            }
            else {
                jsToolchains.push(jsObj.toolchains.toolchain);
            }
        }
    }
    // remove potential duplicates based on type & id (which should be a unique combination);
    // self.findIndex will only return the first occurrence, ensuring duplicates are skipped
    jsToolchains = jsToolchains.filter((value, index, self) => 
    // ensure non-jdk toolchains are kept in the results, we must not touch them because they belong to the user
    value.type !== 'jdk' ||
        // keep toolchains that lack a usable string id (e.g. partially-formed user files);
        // we cannot safely deduplicate them and must not crash while reading them
        typeof value.provides?.id !== 'string' ||
        index ===
            self.findIndex(t => t.type === value.type && t.provides?.id === value.provides?.id));
    return xmlCreate({
        toolchains: {
            ...rootAttributes,
            toolchain: jsToolchains
        }
    }).end({
        format: 'xml',
        wellFormed: false,
        headless: false,
        prettyPrint: true,
        width: 80
    });
}
function generateNewToolchainDefinition(version, vendor, id, jdkHome) {
    return [
        '<?xml version="1.0"?>',
        '<toolchains xmlns="http://maven.apache.org/TOOLCHAINS/1.1.0"',
        '  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
        '  xsi:schemaLocation="http://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd">',
        '  <toolchain>',
        '    <type>jdk</type>',
        '    <provides>',
        `      <version>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(version)}</version>`,
        `      <vendor>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(vendor)}</vendor>`,
        `      <id>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(id)}</id>`,
        '    </provides>',
        '    <configuration>',
        `      <jdkHome>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(jdkHome)}</jdkHome>`,
        '    </configuration>',
        '  </toolchain>',
        '</toolchains>'
    ].join('\n');
}
async function readExistingToolchainsFile(directory) {
    const location = path__WEBPACK_IMPORTED_MODULE_2__.join(directory, _constants_js__WEBPACK_IMPORTED_MODULE_6__/* .MVN_TOOLCHAINS_FILE */ .qs);
    if (fs__WEBPACK_IMPORTED_MODULE_0__.existsSync(location)) {
        return fs__WEBPACK_IMPORTED_MODULE_0__.readFileSync(location, {
            encoding: 'utf-8',
            flag: 'r'
        });
    }
    return '';
}
async function writeToolchainsFileToDisk(directory, settings) {
    const location = path__WEBPACK_IMPORTED_MODULE_2__.join(directory, _constants_js__WEBPACK_IMPORTED_MODULE_6__/* .MVN_TOOLCHAINS_FILE */ .qs);
    const settingsExists = fs__WEBPACK_IMPORTED_MODULE_0__.existsSync(location);
    // The toolchains file is produced by a non-destructive merge (existing JDK,
    // custom, and non-jdk toolchains are preserved – see generateToolchainDefinition),
    // so it is always safe to write it. Unlike settings.xml, it is therefore not
    // gated behind the `overwrite-settings` input; that would prevent subsequent
    // setup-java runs from registering additional JDKs and silently drop the
    // toolchain entries created by earlier runs.
    if (settingsExists) {
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Updating existing file ${location}`);
    }
    else {
        _actions_core__WEBPACK_IMPORTED_MODULE_3__/* .info */ .pq(`Writing to ${location}`);
    }
    return fs__WEBPACK_IMPORTED_MODULE_0__.writeFileSync(location, settings, {
        encoding: 'utf-8',
        flag: 'w'
    });
}


/***/ }),

/***/ 22:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   I: () => (/* binding */ escapeXmlText)
/* harmony export */ });
/* unused harmony export escapeXmlAttribute */
function escapeXmlText(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function escapeXmlAttribute(value) {
    return escapeXmlText(value).replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}


/***/ })

};

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
    const { XMLParser } = await __webpack_require__.e(/* import() */ 824).then(__webpack_require__.bind(__webpack_require__, 5824));
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@',
        parseAttributeValue: false,
        parseTagValue: false,
        trimValues: true,
        isArray: tagName => tagName === 'toolchain'
    });
    const jsObj = parser.parse(original);
    if (isToolchainsRoot(jsObj.toolchains)) {
        // preserve the existing root attributes (xmlns, schemaLocation, …) so we don't
        // silently rewrite user-managed metadata or change the effective XML namespace;
        // fast-xml-parser exposes attributes as `@`-prefixed keys on the element object
        const existingAttributes = Object.fromEntries(Object.entries(jsObj.toolchains).filter(([key, value]) => key.startsWith('@') && typeof value === 'string'));
        // fall back to the defaults only for attributes the existing file is missing
        rootAttributes = { ...rootAttributes, ...existingAttributes };
        if (jsObj.toolchains.toolchain) {
            jsToolchains.push(...jsObj.toolchains.toolchain);
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
    return serializeToolchains(rootAttributes, jsToolchains);
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
function serializeToolchains(rootAttributes, toolchains) {
    return [
        '<?xml version="1.0"?>',
        serializeOpeningTag('toolchains', rootAttributes, 0),
        ...toolchains.flatMap(toolchain => serializeXmlElement('toolchain', toolchain, 1)),
        '</toolchains>'
    ].join('\n');
}
function serializeOpeningTag(name, attributes, depth) {
    const indent = '  '.repeat(depth);
    const attributeEntries = Object.entries(attributes);
    if (!attributeEntries.length) {
        return `${indent}<${name}>`;
    }
    const [firstAttribute, ...restAttributes] = attributeEntries;
    const lines = [
        `${indent}<${name} ${formatXmlAttribute(firstAttribute)}`,
        ...restAttributes.map(([attributeName, value]) => {
            return `${indent}  ${formatXmlAttribute([attributeName, value])}`;
        })
    ];
    lines[lines.length - 1] += '>';
    return lines.join('\n');
}
function serializeXmlElement(name, value, depth) {
    const indent = '  '.repeat(depth);
    if (Array.isArray(value)) {
        return value.flatMap(item => serializeXmlElement(name, item, depth));
    }
    if (!isXmlElementObject(value)) {
        return [
            `${indent}<${name}>${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(String(value ?? ''))}</${name}>`
        ];
    }
    const attributes = Object.fromEntries(Object.entries(value)
        .filter(([key, attributeValue]) => {
        return key.startsWith('@') && typeof attributeValue === 'string';
    })
        .map(([key, attributeValue]) => [key, attributeValue]));
    const childEntries = Object.entries(value).filter(([key]) => !key.startsWith('@') && key !== '#text');
    const textValue = value['#text'];
    if (!childEntries.length) {
        if (textValue !== undefined) {
            return [
                `${serializeOpeningTag(name, attributes, depth)}${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(String(textValue ?? ''))}</${name}>`
            ];
        }
        return [`${serializeOpeningTag(name, attributes, depth)}</${name}>`];
    }
    return [
        serializeOpeningTag(name, attributes, depth),
        ...(textValue === undefined
            ? []
            : [`${'  '.repeat(depth + 1)}${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlText */ .I)(String(textValue ?? ''))}`]),
        ...childEntries.flatMap(([childName, childValue]) => serializeXmlElement(childName, childValue, depth + 1)),
        `${indent}</${name}>`
    ];
}
function formatXmlAttribute([name, value]) {
    return `${name.slice(1)}="${(0,_xml_js__WEBPACK_IMPORTED_MODULE_7__/* .escapeXmlAttribute */ .R)(value)}"`;
}
function isToolchainsRoot(value) {
    return isXmlElementObject(value);
}
function isXmlElementObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
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

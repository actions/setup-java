export const id = 824;
export const ids = [824];
export const modules = {

/***/ 5824:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   XMLParser: () => (/* reexport safe */ _xmlparser_XMLParser_js__WEBPACK_IMPORTED_MODULE_1__.A),
/* harmony export */   i: () => (/* binding */ XMLValidator)
/* harmony export */ });
/* harmony import */ var _validator_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(1176);
/* harmony import */ var _xmlparser_XMLParser_js__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(6009);






const XMLValidator = {
  validate: _validator_js__WEBPACK_IMPORTED_MODULE_0__/* .validate */ .t
}


/***/ }),

/***/ 984:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   Eo: () => (/* binding */ isName),
/* harmony export */   Xe: () => (/* binding */ getAllMatches),
/* harmony export */   q9: () => (/* binding */ DANGEROUS_PROPERTY_NAMES),
/* harmony export */   vl: () => (/* binding */ criticalProperties),
/* harmony export */   yQ: () => (/* binding */ isExist)
/* harmony export */ });
/* unused harmony exports nameRegexp, isEmptyObject, getValue */


const nameStartChar = ':A-Za-z_\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD';
const nameChar = nameStartChar + '\\-.\\d\\u00B7\\u0300-\\u036F\\u203F-\\u2040';
const nameRegexp = '[' + nameStartChar + '][' + nameChar + ']*';
const regexName = new RegExp('^' + nameRegexp + '$');

function getAllMatches(string, regex) {
  const matches = [];
  let match = regex.exec(string);
  while (match) {
    const allmatches = [];
    allmatches.startIndex = regex.lastIndex - match[0].length;
    const len = match.length;
    for (let index = 0; index < len; index++) {
      allmatches.push(match[index]);
    }
    matches.push(allmatches);
    match = regex.exec(string);
  }
  return matches;
}

const isName = function (string) {
  const match = regexName.exec(string);
  return !(match === null || typeof match === 'undefined');
}

function isExist(v) {
  return typeof v !== 'undefined';
}

function isEmptyObject(obj) {
  return Object.keys(obj).length === 0;
}

function getValue(v) {
  if (exports.isExist(v)) {
    return v;
  } else {
    return '';
  }
}

/**
 * Dangerous property names that could lead to prototype pollution or security issues
 */
const DANGEROUS_PROPERTY_NAMES = [
  // '__proto__',
  // 'constructor',
  // 'prototype',
  'hasOwnProperty',
  'toString',
  'valueOf',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__'
];

const criticalProperties = ["__proto__", "constructor", "prototype"];

/***/ }),

/***/ 1176:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   t: () => (/* binding */ validate)
/* harmony export */ });
/* harmony import */ var _util_js__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(984);




const defaultOptions = {
  allowBooleanAttributes: false, //A tag can have attributes without any value
  unpairedTags: []
};

//const tagsPattern = new RegExp("<\\/?([\\w:\\-_\.]+)\\s*\/?>","g");
function validate(xmlData, options) {
  options = Object.assign({}, defaultOptions, options);

  //xmlData = xmlData.replace(/(\r\n|\n|\r)/gm,"");//make it single line
  //xmlData = xmlData.replace(/(^\s*<\?xml.*?\?>)/g,"");//Remove XML starting tag
  //xmlData = xmlData.replace(/(<!DOCTYPE[\s\w\"\.\/\-\:]+(\[.*\])*\s*>)/g,"");//Remove DOCTYPE
  const tags = [];
  let tagFound = false;

  //indicates that the root tag has been closed (aka. depth 0 has been reached)
  let reachedRoot = false;

  if (xmlData[0] === '\ufeff') {
    // check for byte order mark (BOM)
    xmlData = xmlData.substr(1);
  }

  for (let i = 0; i < xmlData.length; i++) {

    if (xmlData[i] === '<' && xmlData[i + 1] === '?') {
      i += 2;
      i = readPI(xmlData, i);
      if (i.err) return i;
    } else if (xmlData[i] === '<') {
      //starting of tag
      //read until you reach to '>' avoiding any '>' in attribute value
      let tagStartPos = i;
      i++;

      if (xmlData[i] === '!') {
        i = readCommentAndCDATA(xmlData, i);
        continue;
      } else {
        let closingTag = false;
        if (xmlData[i] === '/') {
          //closing tag
          closingTag = true;
          i++;
        }
        //read tagname
        let tagName = '';
        for (; i < xmlData.length &&
          xmlData[i] !== '>' &&
          xmlData[i] !== ' ' &&
          xmlData[i] !== '\t' &&
          xmlData[i] !== '\n' &&
          xmlData[i] !== '\r'; i++
        ) {
          tagName += xmlData[i];
        }
        tagName = tagName.trim();
        //console.log(tagName);

        if (tagName[tagName.length - 1] === '/') {
          //self closing tag without attributes
          tagName = tagName.substring(0, tagName.length - 1);
          //continue;
          i--;
        }
        if (!validateTagName(tagName)) {
          let msg;
          if (tagName.trim().length === 0) {
            msg = "Invalid space after '<'.";
          } else {
            msg = "Tag '" + tagName + "' is an invalid name.";
          }
          return getErrorObject('InvalidTag', msg, getLineNumberForPosition(xmlData, i));
        }

        const result = readAttributeStr(xmlData, i);
        if (result === false) {
          return getErrorObject('InvalidAttr', "Attributes for '" + tagName + "' have open quote.", getLineNumberForPosition(xmlData, i));
        }
        let attrStr = result.value;
        i = result.index;

        if (attrStr[attrStr.length - 1] === '/') {
          //self closing tag
          const attrStrStart = i - attrStr.length;
          attrStr = attrStr.substring(0, attrStr.length - 1);
          const isValid = validateAttributeString(attrStr, options);
          if (isValid === true) {
            tagFound = true;
            //continue; //text may presents after self closing tag
          } else {
            //the result from the nested function returns the position of the error within the attribute
            //in order to get the 'true' error line, we need to calculate the position where the attribute begins (i - attrStr.length) and then add the position within the attribute
            //this gives us the absolute index in the entire xml, which we can use to find the line at last
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, attrStrStart + isValid.err.line));
          }
        } else if (closingTag) {
          if (!result.tagClosed) {
            return getErrorObject('InvalidTag', "Closing tag '" + tagName + "' doesn't have proper closing.", getLineNumberForPosition(xmlData, i));
          } else if (attrStr.trim().length > 0) {
            return getErrorObject('InvalidTag', "Closing tag '" + tagName + "' can't have attributes or invalid starting.", getLineNumberForPosition(xmlData, tagStartPos));
          } else if (tags.length === 0) {
            return getErrorObject('InvalidTag', "Closing tag '" + tagName + "' has not been opened.", getLineNumberForPosition(xmlData, tagStartPos));
          } else {
            const otg = tags.pop();
            if (tagName !== otg.tagName) {
              let openPos = getLineNumberForPosition(xmlData, otg.tagStartPos);
              return getErrorObject('InvalidTag',
                "Expected closing tag '" + otg.tagName + "' (opened in line " + openPos.line + ", col " + openPos.col + ") instead of closing tag '" + tagName + "'.",
                getLineNumberForPosition(xmlData, tagStartPos));
            }

            //when there are no more tags, we reached the root level.
            if (tags.length == 0) {
              reachedRoot = true;
            }
          }
        } else {
          const isValid = validateAttributeString(attrStr, options);
          if (isValid !== true) {
            //the result from the nested function returns the position of the error within the attribute
            //in order to get the 'true' error line, we need to calculate the position where the attribute begins (i - attrStr.length) and then add the position within the attribute
            //this gives us the absolute index in the entire xml, which we can use to find the line at last
            return getErrorObject(isValid.err.code, isValid.err.msg, getLineNumberForPosition(xmlData, i - attrStr.length + isValid.err.line));
          }

          //if the root level has been reached before ...
          if (reachedRoot === true) {
            return getErrorObject('InvalidXml', 'Multiple possible root nodes found.', getLineNumberForPosition(xmlData, i));
          } else if (options.unpairedTags.indexOf(tagName) !== -1) {
            //don't push into stack
          } else {
            tags.push({ tagName, tagStartPos });
          }
          tagFound = true;
        }

        //skip tag text value
        //It may include comments and CDATA value
        for (i++; i < xmlData.length; i++) {
          if (xmlData[i] === '<') {
            if (xmlData[i + 1] === '!') {
              //comment or CADATA
              i++;
              i = readCommentAndCDATA(xmlData, i);
              continue;
            } else if (xmlData[i + 1] === '?') {
              i = readPI(xmlData, ++i);
              if (i.err) return i;
            } else {
              break;
            }
          } else if (xmlData[i] === '&') {
            const afterAmp = validateAmpersand(xmlData, i);
            if (afterAmp == -1)
              return getErrorObject('InvalidChar', "char '&' is not expected.", getLineNumberForPosition(xmlData, i));
            i = afterAmp;
          } else {
            if (reachedRoot === true && !isWhiteSpace(xmlData[i])) {
              return getErrorObject('InvalidXml', "Extra text at the end", getLineNumberForPosition(xmlData, i));
            }
          }
        } //end of reading tag text value
        if (xmlData[i] === '<') {
          i--;
        }
      }
    } else {
      if (isWhiteSpace(xmlData[i])) {
        continue;
      }
      return getErrorObject('InvalidChar', "char '" + xmlData[i] + "' is not expected.", getLineNumberForPosition(xmlData, i));
    }
  }

  if (!tagFound) {
    return getErrorObject('InvalidXml', 'Start tag expected.', 1);
  } else if (tags.length == 1) {
    return getErrorObject('InvalidTag', "Unclosed tag '" + tags[0].tagName + "'.", getLineNumberForPosition(xmlData, tags[0].tagStartPos));
  } else if (tags.length > 0) {
    return getErrorObject('InvalidXml', "Invalid '" +
      JSON.stringify(tags.map(t => t.tagName), null, 4).replace(/\r?\n/g, '') +
      "' found.", { line: 1, col: 1 });
  }

  return true;
};

function isWhiteSpace(char) {
  return char === ' ' || char === '\t' || char === '\n' || char === '\r';
}
/**
 * Read Processing insstructions and skip
 * @param {*} xmlData
 * @param {*} i
 */
function readPI(xmlData, i) {
  const start = i;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] == '?' || xmlData[i] == ' ') {
      //tagname
      const tagname = xmlData.substr(start, i - start);
      if (i > 5 && tagname === 'xml') {
        return getErrorObject('InvalidXml', 'XML declaration allowed only at the start of the document.', getLineNumberForPosition(xmlData, i));
      } else if (xmlData[i] == '?' && xmlData[i + 1] == '>') {
        //check if valid attribut string
        i++;
        break;
      } else {
        continue;
      }
    }
  }
  return i;
}

function readCommentAndCDATA(xmlData, i) {
  if (xmlData.length > i + 5 && xmlData[i + 1] === '-' && xmlData[i + 2] === '-') {
    //comment
    for (i += 3; i < xmlData.length; i++) {
      if (xmlData[i] === '-' && xmlData[i + 1] === '-' && xmlData[i + 2] === '>') {
        i += 2;
        break;
      }
    }
  } else if (
    xmlData.length > i + 8 &&
    xmlData[i + 1] === 'D' &&
    xmlData[i + 2] === 'O' &&
    xmlData[i + 3] === 'C' &&
    xmlData[i + 4] === 'T' &&
    xmlData[i + 5] === 'Y' &&
    xmlData[i + 6] === 'P' &&
    xmlData[i + 7] === 'E'
  ) {
    let angleBracketsCount = 1;
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === '<') {
        angleBracketsCount++;
      } else if (xmlData[i] === '>') {
        angleBracketsCount--;
        if (angleBracketsCount === 0) {
          break;
        }
      }
    }
  } else if (
    xmlData.length > i + 9 &&
    xmlData[i + 1] === '[' &&
    xmlData[i + 2] === 'C' &&
    xmlData[i + 3] === 'D' &&
    xmlData[i + 4] === 'A' &&
    xmlData[i + 5] === 'T' &&
    xmlData[i + 6] === 'A' &&
    xmlData[i + 7] === '['
  ) {
    for (i += 8; i < xmlData.length; i++) {
      if (xmlData[i] === ']' && xmlData[i + 1] === ']' && xmlData[i + 2] === '>') {
        i += 2;
        break;
      }
    }
  }

  return i;
}

const doubleQuote = '"';
const singleQuote = "'";

/**
 * Keep reading xmlData until '<' is found outside the attribute value.
 * @param {string} xmlData
 * @param {number} i
 */
function readAttributeStr(xmlData, i) {
  let attrStr = '';
  let startChar = '';
  let tagClosed = false;
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === doubleQuote || xmlData[i] === singleQuote) {
      if (startChar === '') {
        startChar = xmlData[i];
      } else if (startChar !== xmlData[i]) {
        //if vaue is enclosed with double quote then single quotes are allowed inside the value and vice versa
      } else {
        startChar = '';
      }
    } else if (xmlData[i] === '>') {
      if (startChar === '') {
        tagClosed = true;
        break;
      }
    }
    attrStr += xmlData[i];
  }
  if (startChar !== '') {
    return false;
  }

  return {
    value: attrStr,
    index: i,
    tagClosed: tagClosed
  };
}

/**
 * Select all the attributes whether valid or invalid.
 */
const validAttrStrRegxp = new RegExp('(\\s*)([^\\s=]+)(\\s*=)?(\\s*([\'"])(([\\s\\S])*?)\\5)?', 'g');

//attr, ="sd", a="amit's", a="sd"b="saf", ab  cd=""

function validateAttributeString(attrStr, options) {
  //console.log("start:"+attrStr+":end");

  //if(attrStr.trim().length === 0) return true; //empty string

  const matches = (0,_util_js__WEBPACK_IMPORTED_MODULE_0__/* .getAllMatches */ .Xe)(attrStr, validAttrStrRegxp);
  const attrNames = {};

  for (let i = 0; i < matches.length; i++) {
    if (matches[i][1].length === 0) {
      //nospace before attribute name: a="sd"b="saf"
      return getErrorObject('InvalidAttr', "Attribute '" + matches[i][2] + "' has no space in starting.", getPositionFromMatch(matches[i]))
    } else if (matches[i][3] !== undefined && matches[i][4] === undefined) {
      return getErrorObject('InvalidAttr', "Attribute '" + matches[i][2] + "' is without value.", getPositionFromMatch(matches[i]));
    } else if (matches[i][3] === undefined && !options.allowBooleanAttributes) {
      //independent attribute: ab
      return getErrorObject('InvalidAttr', "boolean attribute '" + matches[i][2] + "' is not allowed.", getPositionFromMatch(matches[i]));
    }
    /* else if(matches[i][6] === undefined){//attribute without value: ab=
                    return { err: { code:"InvalidAttr",msg:"attribute " + matches[i][2] + " has no value assigned."}};
                } */
    const attrName = matches[i][2];
    if (!validateAttrName(attrName)) {
      return getErrorObject('InvalidAttr', "Attribute '" + attrName + "' is an invalid name.", getPositionFromMatch(matches[i]));
    }
    if (!Object.prototype.hasOwnProperty.call(attrNames, attrName)) {
      //check for duplicate attribute.
      attrNames[attrName] = 1;
    } else {
      return getErrorObject('InvalidAttr', "Attribute '" + attrName + "' is repeated.", getPositionFromMatch(matches[i]));
    }
  }

  return true;
}

function validateNumberAmpersand(xmlData, i) {
  let re = /\d/;
  if (xmlData[i] === 'x') {
    i++;
    re = /[\da-fA-F]/;
  }
  for (; i < xmlData.length; i++) {
    if (xmlData[i] === ';')
      return i;
    if (!xmlData[i].match(re))
      break;
  }
  return -1;
}

function validateAmpersand(xmlData, i) {
  // https://www.w3.org/TR/xml/#dt-charref
  i++;
  if (xmlData[i] === ';')
    return -1;
  if (xmlData[i] === '#') {
    i++;
    return validateNumberAmpersand(xmlData, i);
  }
  let count = 0;
  for (; i < xmlData.length; i++, count++) {
    if (xmlData[i].match(/\w/) && count < 20)
      continue;
    if (xmlData[i] === ';')
      break;
    return -1;
  }
  return i;
}

function getErrorObject(code, message, lineNumber) {
  return {
    err: {
      code: code,
      msg: message,
      line: lineNumber.line || lineNumber,
      col: lineNumber.col,
    },
  };
}

function validateAttrName(attrName) {
  return (0,_util_js__WEBPACK_IMPORTED_MODULE_0__/* .isName */ .Eo)(attrName);
}

// const startsWithXML = /^xml/i;

function validateTagName(tagname) {
  return (0,_util_js__WEBPACK_IMPORTED_MODULE_0__/* .isName */ .Eo)(tagname) /* && !tagname.match(startsWithXML) */;
}

//this function returns the line number for the character at the given index
function getLineNumberForPosition(xmlData, index) {
  const lines = xmlData.substring(0, index).split(/\r?\n/);
  return {
    line: lines.length,

    // column number is last line's length + 1, because column numbering starts at 1:
    col: lines[lines.length - 1].length + 1
  };
}

//this function returns the position of the first character of match within attrStr
function getPositionFromMatch(match) {
  return match.startIndex + match[1].length;
}


/***/ }),

/***/ 6009:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {


// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  A: () => (/* binding */ XMLParser)
});

// EXTERNAL MODULE: ./node_modules/fast-xml-parser/src/util.js
var util = __webpack_require__(984);
;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/xmlparser/OptionsBuilder.js



const defaultOnDangerousProperty = (name) => {
  if (util/* DANGEROUS_PROPERTY_NAMES */.q9.includes(name)) {
    return "__" + name;
  }
  return name;
};


const defaultOptions = {
  preserveOrder: false,
  attributeNamePrefix: '@_',
  attributesGroupName: false,
  textNodeName: '#text',
  ignoreAttributes: true,
  removeNSPrefix: false, // remove NS from tag name or attribute name if true
  allowBooleanAttributes: false, //a tag can have attributes without any value
  //ignoreRootElement : false,
  parseTagValue: true,
  parseAttributeValue: false,
  trimValues: true, //Trim string values of tag and attributes
  cdataPropName: false,
  numberParseOptions: {
    hex: true,
    leadingZeros: true,
    eNotation: true,
    unicode: false
  },
  tagValueProcessor: function (tagName, val) {
    return val;
  },
  attributeValueProcessor: function (attrName, val) {
    return val;
  },
  stopNodes: [], //nested tags will not be parsed even for errors
  alwaysCreateTextNode: false,
  isArray: () => false,
  commentPropName: false,
  unpairedTags: [],
  processEntities: true,
  htmlEntities: false,
  entityDecoder: null,
  ignoreDeclaration: false,
  ignorePiTags: false,
  transformTagName: false,
  transformAttributeName: false,
  updateTag: function (tagName, jPath, attrs) {
    return tagName
  },
  // skipEmptyListItem: false
  captureMetaData: false,
  maxNestedTags: 100,
  strictReservedNames: true,
  jPath: true, // if true, pass jPath string to callbacks; if false, pass matcher instance
  onDangerousProperty: defaultOnDangerousProperty
};


/**
 * Validates that a property name is safe to use
 * @param {string} propertyName - The property name to validate
 * @param {string} optionName - The option field name (for error message)
 * @throws {Error} If property name is dangerous
 */
function validatePropertyName(propertyName, optionName) {
  if (typeof propertyName !== 'string') {
    return; // Only validate string property names
  }

  const normalized = propertyName.toLowerCase();
  if (util/* DANGEROUS_PROPERTY_NAMES */.q9.some(dangerous => normalized === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }

  if (util/* criticalProperties */.vl.some(dangerous => normalized === dangerous.toLowerCase())) {
    throw new Error(
      `[SECURITY] Invalid ${optionName}: "${propertyName}" is a reserved JavaScript keyword that could cause prototype pollution`
    );
  }
}

/**
 * Normalizes processEntities option for backward compatibility
 * @param {boolean|object} value 
 * @returns {object} Always returns normalized object
 */
function normalizeProcessEntities(value, htmlEntities) {
  // Boolean backward compatibility
  if (typeof value === 'boolean') {
    return {
      enabled: value, // true or false
      maxEntitySize: 10000,
      maxExpansionDepth: 10000,
      maxTotalExpansions: Infinity,
      maxExpandedLength: 100000,
      maxEntityCount: 1000,
      allowedTags: null,
      tagFilter: null,
      appliesTo: "all",
    };
  }

  // Object config - merge with defaults
  if (typeof value === 'object' && value !== null) {
    return {
      enabled: value.enabled !== false,
      maxEntitySize: Math.max(1, value.maxEntitySize ?? 10000),
      maxExpansionDepth: Math.max(1, value.maxExpansionDepth ?? 10000),
      maxTotalExpansions: Math.max(1, value.maxTotalExpansions ?? Infinity),
      maxExpandedLength: Math.max(1, value.maxExpandedLength ?? 100000),
      maxEntityCount: Math.max(1, value.maxEntityCount ?? 1000),
      allowedTags: value.allowedTags ?? null,
      tagFilter: value.tagFilter ?? null,
      appliesTo: value.appliesTo ?? "all",
    };
  }

  // Default to enabled with limits
  return normalizeProcessEntities(true);
}

const buildOptions = function (options) {
  const built = Object.assign({}, defaultOptions, options);

  // Validate property names to prevent prototype pollution
  const propertyNameOptions = [
    { value: built.attributeNamePrefix, name: 'attributeNamePrefix' },
    { value: built.attributesGroupName, name: 'attributesGroupName' },
    { value: built.textNodeName, name: 'textNodeName' },
    { value: built.cdataPropName, name: 'cdataPropName' },
    { value: built.commentPropName, name: 'commentPropName' }
  ];

  for (const { value, name } of propertyNameOptions) {
    if (value) {
      validatePropertyName(value, name);
    }
  }

  if (built.onDangerousProperty === null) {
    built.onDangerousProperty = defaultOnDangerousProperty;
  }

  // Always normalize processEntities for backward compatibility and validation
  built.processEntities = normalizeProcessEntities(built.processEntities, built.htmlEntities);
  built.unpairedTagsSet = new Set(built.unpairedTags);
  // Convert old-style stopNodes for backward compatibility
  if (built.stopNodes && Array.isArray(built.stopNodes)) {
    built.stopNodes = built.stopNodes.map(node => {
      if (typeof node === 'string' && node.startsWith('*.')) {
        // Old syntax: *.tagname meant "tagname anywhere"
        // Convert to new syntax: ..tagname
        return '..' + node.substring(2);
      }
      return node;
    });
  }
  //console.debug(built.processEntities)
  return built;
};
;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/xmlparser/xmlNode.js


let METADATA_SYMBOL;

if (typeof Symbol !== "function") {
  METADATA_SYMBOL = "@@xmlMetadata";
} else {
  METADATA_SYMBOL = Symbol("XML Node Metadata");
}

class XmlNode {
  constructor(tagname) {
    this.tagname = tagname;
    this.child = []; //nested tags, text, cdata, comments in order
    this[":@"] = Object.create(null); //attributes map
  }
  add(key, val) {
    // this.child.push( {name : key, val: val, isCdata: isCdata });
    if (key === "__proto__") key = "#__proto__";
    this.child.push({ [key]: val });
  }
  addChild(node, startIndex) {
    if (node.tagname === "__proto__") node.tagname = "#__proto__";
    if (node[":@"] && Object.keys(node[":@"]).length > 0) {
      this.child.push({ [node.tagname]: node.child, [":@"]: node[":@"] });
    } else {
      this.child.push({ [node.tagname]: node.child });
    }
    // if requested, add the startIndex
    if (startIndex !== undefined) {
      // Note: for now we just overwrite the metadata. If we had more complex metadata,
      // we might need to do an object append here:  metadata = { ...metadata, startIndex }
      this.child[this.child.length - 1][METADATA_SYMBOL] = { startIndex };
    }
  }
  /** symbol used for metadata */
  static getMetaDataSymbol() {
    return METADATA_SYMBOL;
  }
}

// EXTERNAL MODULE: ./node_modules/xml-naming/src/index.js
var src = __webpack_require__(4658);
;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/xmlparser/DocTypeReader.js


class DocTypeReader {
    constructor(options, xmlVersion) {
        this.suppressValidationErr = !options;
        this.options = options;
        this.xmlVersion = xmlVersion || 1.0;
    }

    setXmlVersion(xmlVersion = 1.0) {
        this.xmlVersion = xmlVersion;
    }
    readDocType(xmlData, i) {
        const entities = Object.create(null);
        let entityCount = 0;

        if (xmlData[i + 3] === 'O' &&
            xmlData[i + 4] === 'C' &&
            xmlData[i + 5] === 'T' &&
            xmlData[i + 6] === 'Y' &&
            xmlData[i + 7] === 'P' &&
            xmlData[i + 8] === 'E') {
            i = i + 9;
            let angleBracketsCount = 1;
            let hasBody = false, comment = false;
            let exp = "";
            for (; i < xmlData.length; i++) {
                if (xmlData[i] === '<' && !comment) { //Determine the tag type
                    if (hasBody && hasSeq(xmlData, "!ENTITY", i)) {
                        i += 7;
                        let entityName, val;
                        [entityName, val, i] = this.readEntityExp(xmlData, i + 1, this.suppressValidationErr);
                        if (val.indexOf("&") === -1) { //Parameter entities are not supported
                            if (this.options.enabled !== false &&
                                this.options.maxEntityCount != null &&
                                entityCount >= this.options.maxEntityCount) {
                                throw new Error(
                                    `Entity count (${entityCount + 1}) exceeds maximum allowed (${this.options.maxEntityCount})`
                                );
                            }
                            //const escaped = entityName.replace(/[.\-+*:]/g, '\\.');
                            //const escaped = entityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                            entities[entityName] = val;
                            entityCount++;
                        }
                    }
                    else if (hasBody && hasSeq(xmlData, "!ELEMENT", i)) {
                        i += 8;//Not supported
                        const { index } = this.readElementExp(xmlData, i + 1);
                        i = index;
                    } else if (hasBody && hasSeq(xmlData, "!ATTLIST", i)) {
                        i += 8;//Not supported
                        // const {index} = this.readAttlistExp(xmlData,i+1);
                        // i = index;
                    } else if (hasBody && hasSeq(xmlData, "!NOTATION", i)) {
                        i += 9;//Not supported
                        const { index } = this.readNotationExp(xmlData, i + 1, this.suppressValidationErr);
                        i = index;
                    } else if (hasSeq(xmlData, "!--", i)) comment = true;
                    else throw new Error(`Invalid DOCTYPE`);

                    angleBracketsCount++;
                    exp = "";
                } else if (xmlData[i] === '>') { //Read tag content
                    if (comment) {
                        if (xmlData[i - 1] === "-" && xmlData[i - 2] === "-") {
                            comment = false;
                            angleBracketsCount--;
                        }
                    } else {
                        angleBracketsCount--;
                    }
                    if (angleBracketsCount === 0) {
                        break;
                    }
                } else if (xmlData[i] === '[') {
                    hasBody = true;
                } else {
                    exp += xmlData[i];
                }
            }
            if (angleBracketsCount !== 0) {
                throw new Error(`Unclosed DOCTYPE`);
            }
        } else {
            throw new Error(`Invalid Tag instead of DOCTYPE`);
        }
        return { entities, i };
    }
    readEntityExp(xmlData, i) {
        //External entities are not supported
        //    <!ENTITY ext SYSTEM "http://normal-website.com" >

        //Parameter entities are not supported
        //    <!ENTITY entityname "&anotherElement;">

        //Internal entities are supported
        //    <!ENTITY entityname "replacement text">

        // Skip leading whitespace after <!ENTITY
        i = skipWhitespace(xmlData, i);

        // Read entity name
        const startIndex = i;
        while (i < xmlData.length && !/\s/.test(xmlData[i]) && xmlData[i] !== '"' && xmlData[i] !== "'") {
            i++;
        }
        let entityName = xmlData.substring(startIndex, i);

        validateEntityName(entityName, { xmlVersion: this.xmlVersion });

        // Skip whitespace after entity name
        i = skipWhitespace(xmlData, i);

        // Check for unsupported constructs (external entities or parameter entities)
        if (!this.suppressValidationErr) {
            if (xmlData.substring(i, i + 6).toUpperCase() === "SYSTEM") {
                throw new Error("External entities are not supported");
            } else if (xmlData[i] === "%") {
                throw new Error("Parameter entities are not supported");
            }
        }

        // Read entity value (internal entity)
        let entityValue = "";
        [i, entityValue] = this.readIdentifierVal(xmlData, i, "entity");

        // Validate entity size
        if (this.options.enabled !== false &&
            this.options.maxEntitySize != null &&
            entityValue.length > this.options.maxEntitySize) {
            throw new Error(
                `Entity "${entityName}" size (${entityValue.length}) exceeds maximum allowed size (${this.options.maxEntitySize})`
            );
        }

        i--;
        return [entityName, entityValue, i];
    }

    readNotationExp(xmlData, i) {
        // Skip leading whitespace after <!NOTATION
        i = skipWhitespace(xmlData, i);

        // Read notation name

        const startIndex = i;
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            i++;
        }
        let notationName = xmlData.substring(startIndex, i);

        !this.suppressValidationErr && validateEntityName(notationName, { xmlVersion: this.xmlVersion });

        // Skip whitespace after notation name
        i = skipWhitespace(xmlData, i);

        // Check identifier type (SYSTEM or PUBLIC)
        const identifierType = xmlData.substring(i, i + 6).toUpperCase();
        if (!this.suppressValidationErr && identifierType !== "SYSTEM" && identifierType !== "PUBLIC") {
            throw new Error(`Expected SYSTEM or PUBLIC, found "${identifierType}"`);
        }
        i += identifierType.length;

        // Skip whitespace after identifier type
        i = skipWhitespace(xmlData, i);

        // Read public identifier (if PUBLIC)
        let publicIdentifier = null;
        let systemIdentifier = null;

        if (identifierType === "PUBLIC") {
            [i, publicIdentifier] = this.readIdentifierVal(xmlData, i, "publicIdentifier");

            // Skip whitespace after public identifier
            i = skipWhitespace(xmlData, i);

            // Optionally read system identifier
            if (xmlData[i] === '"' || xmlData[i] === "'") {
                [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");
            }
        } else if (identifierType === "SYSTEM") {
            // Read system identifier (mandatory for SYSTEM)
            [i, systemIdentifier] = this.readIdentifierVal(xmlData, i, "systemIdentifier");

            if (!this.suppressValidationErr && !systemIdentifier) {
                throw new Error("Missing mandatory system identifier for SYSTEM notation");
            }
        }

        return { notationName, publicIdentifier, systemIdentifier, index: --i };
    }

    readIdentifierVal(xmlData, i, type) {
        let identifierVal = "";
        const startChar = xmlData[i];
        if (startChar !== '"' && startChar !== "'") {
            throw new Error(`Expected quoted string, found "${startChar}"`);
        }
        i++;

        const startIndex = i;
        while (i < xmlData.length && xmlData[i] !== startChar) {
            i++;
        }
        identifierVal = xmlData.substring(startIndex, i);

        if (xmlData[i] !== startChar) {
            throw new Error(`Unterminated ${type} value`);
        }
        i++;
        return [i, identifierVal];
    }

    readElementExp(xmlData, i) {
        // <!ELEMENT br EMPTY>
        // <!ELEMENT div ANY>
        // <!ELEMENT title (#PCDATA)>
        // <!ELEMENT book (title, author+)>
        // <!ELEMENT name (content-model)>

        // Skip leading whitespace after <!ELEMENT
        i = skipWhitespace(xmlData, i);

        // Read element name
        const startIndex = i;
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            i++;
        }
        let elementName = xmlData.substring(startIndex, i);

        // Validate element name
        if (!this.suppressValidationErr && !(0,src/* qName */.fG)(elementName, { xmlVersion: this.xmlVersion })) {
            throw new Error(`Invalid element name: "${elementName}"`);
        }

        // Skip whitespace after element name
        i = skipWhitespace(xmlData, i);
        let contentModel = "";
        // Expect '(' to start content model
        if (xmlData[i] === "E" && hasSeq(xmlData, "MPTY", i)) i += 4;
        else if (xmlData[i] === "A" && hasSeq(xmlData, "NY", i)) i += 2;
        else if (xmlData[i] === "(") {
            i++; // Move past '('

            // Read content model
            const startIndex = i;
            while (i < xmlData.length && xmlData[i] !== ")") {
                i++;
            }
            contentModel = xmlData.substring(startIndex, i);

            if (xmlData[i] !== ")") {
                throw new Error("Unterminated content model");
            }

        } else if (!this.suppressValidationErr) {
            throw new Error(`Invalid Element Expression, found "${xmlData[i]}"`);
        }

        return {
            elementName,
            contentModel: contentModel.trim(),
            index: i
        };
    }

    readAttlistExp(xmlData, i) {
        // Skip leading whitespace after <!ATTLIST
        i = skipWhitespace(xmlData, i);

        // Read element name
        let startIndex = i;
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            i++;
        }
        let elementName = xmlData.substring(startIndex, i);

        // Validate element name
        validateEntityName(elementName, { xmlVersion: this.xmlVersion })

        // Skip whitespace after element name
        i = skipWhitespace(xmlData, i);

        // Read attribute name
        startIndex = i;
        while (i < xmlData.length && !/\s/.test(xmlData[i])) {
            i++;
        }
        let attributeName = xmlData.substring(startIndex, i);

        // Validate attribute name
        if (!validateEntityName(attributeName, { xmlVersion: this.xmlVersion })) {
            throw new Error(`Invalid attribute name: "${attributeName}"`);
        }

        // Skip whitespace after attribute name
        i = skipWhitespace(xmlData, i);

        // Read attribute type
        let attributeType = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "NOTATION") {
            attributeType = "NOTATION";
            i += 8; // Move past "NOTATION"

            // Skip whitespace after "NOTATION"
            i = skipWhitespace(xmlData, i);

            // Expect '(' to start the list of notations
            if (xmlData[i] !== "(") {
                throw new Error(`Expected '(', found "${xmlData[i]}"`);
            }
            i++; // Move past '('

            // Read the list of allowed notations
            let allowedNotations = [];
            while (i < xmlData.length && xmlData[i] !== ")") {


                const startIndex = i;
                while (i < xmlData.length && xmlData[i] !== "|" && xmlData[i] !== ")") {
                    i++;
                }
                let notation = xmlData.substring(startIndex, i);

                // Validate notation name
                notation = notation.trim();
                if (!validateEntityName(notation, { xmlVersion: this.xmlVersion })) {
                    throw new Error(`Invalid notation name: "${notation}"`);
                }

                allowedNotations.push(notation);

                // Skip '|' separator or exit loop
                if (xmlData[i] === "|") {
                    i++; // Move past '|'
                    i = skipWhitespace(xmlData, i); // Skip optional whitespace after '|'
                }
            }

            if (xmlData[i] !== ")") {
                throw new Error("Unterminated list of notations");
            }
            i++; // Move past ')'

            // Store the allowed notations as part of the attribute type
            attributeType += " (" + allowedNotations.join("|") + ")";
        } else {
            // Handle simple types (e.g., CDATA, ID, IDREF, etc.)
            const startIndex = i;
            while (i < xmlData.length && !/\s/.test(xmlData[i])) {
                i++;
            }
            attributeType += xmlData.substring(startIndex, i);

            // Validate simple attribute type
            const validTypes = ["CDATA", "ID", "IDREF", "IDREFS", "ENTITY", "ENTITIES", "NMTOKEN", "NMTOKENS"];
            if (!this.suppressValidationErr && !validTypes.includes(attributeType.toUpperCase())) {
                throw new Error(`Invalid attribute type: "${attributeType}"`);
            }
        }

        // Skip whitespace after attribute type
        i = skipWhitespace(xmlData, i);

        // Read default value
        let defaultValue = "";
        if (xmlData.substring(i, i + 8).toUpperCase() === "#REQUIRED") {
            defaultValue = "#REQUIRED";
            i += 8;
        } else if (xmlData.substring(i, i + 7).toUpperCase() === "#IMPLIED") {
            defaultValue = "#IMPLIED";
            i += 7;
        } else {
            [i, defaultValue] = this.readIdentifierVal(xmlData, i, "ATTLIST");
        }

        return {
            elementName,
            attributeName,
            attributeType,
            defaultValue,
            index: i
        }
    }
}



const skipWhitespace = (data, index) => {
    while (index < data.length && /\s/.test(data[index])) {
        index++;
    }
    return index;
};



function hasSeq(data, seq, i) {
    for (let j = 0; j < seq.length; j++) {
        if (seq[j] !== data[i + j + 1]) return false;
    }
    return true;
}

function validateEntityName(name, xmlVersion) {
    if ((0,src/* qName */.fG)(name, { xmlVersion: xmlVersion }))
        return name;
    else
        throw new Error(`Invalid entity name ${name}`);
}
;// CONCATENATED MODULE: ./node_modules/anynum/digitTable.js
/**
 * Flat lookup table: maps Unicode code point → ASCII digit (0-9).
 * Only decimal digit characters (Unicode category Nd) are included.
 *
 * Strategy: Int32Array of size (maxCodePoint - minCodePoint + 1).
 * Value 0xFF means "not a digit". Value 0-9 is the ASCII digit value.
 * This gives O(1) lookup with no branching, no bisect, no loop.
 *
 * Memory: range is 0x0660 to 0x1FBF0 → ~129,936 entries × 1 byte = ~127 KB.
 * Acceptable for a one-time init; lookup is a single array index.
 */

// All known Unicode Nd (decimal digit) script zero code points.
// Each script has exactly 10 consecutive digits: zero+0 .. zero+9.
const SCRIPT_ZEROS = [
  // Basic Latin (ASCII) — included for completeness / pass-through
  0x0030, // 0-9

  // Arabic scripts
  0x0660, // Arabic-Indic ٠١٢٣٤٥٦٧٨٩
  0x06F0, // Extended Arabic-Indic (Urdu/Persian/Sindhi) ۰۱۲۳

  // Indic scripts
  0x0966, // Devanagari ०१२३४५६७८९
  0x09E6, // Bengali ০১২৩৪৫৬৭৮৯
  0x0A66, // Gurmukhi ੦੧੨੩੪੫੬੭੮੯
  0x0AE6, // Gujarati ૦૧૨૩૪૫૬૭૮૯
  0x0B66, // Odia ୦୧୨୩୪୫୬୭୮୯
  0x0BE6, // Tamil ௦௧௨௩௪௫௬௭௮௯
  0x0C66, // Telugu ౦౧౨౩౪౫౬౭౮౯
  0x0CE6, // Kannada ೦೧೨೩೪೫೬೭೮೯
  0x0D66, // Malayalam ൦൧൨൩൪൫൬൭൮൯
  0x0DE6, // Sinhala Archaic ෦෧෨෩෪෫෬෭෮෯

  // Southeast Asian scripts
  0x0E50, // Thai ๐๑๒๓๔๕๖๗๘๙
  0x0ED0, // Lao ໐໑໒໓໔໕໖໗໘໙
  0x0F20, // Tibetan ༠༡༢༣༤༥༦༧༨༩
  0x1040, // Myanmar ၀၁၂၃၄၅၆၇၈၉
  0x1090, // Myanmar Shan ႐႑႒႓႔႕႖႗႘႙
  0x17E0, // Khmer ០១២៣៤៥៦៧៨៩
  0x1810, // Mongolian ᠐᠑᠒᠓᠔᠕᠖᠗᠘᠙
  0x1946, // Limbu ᥆᥇᥈᥉᥊᥋᥌᥍᥎᥏
  0x19D0, // New Tai Lue ᧐᧑᧒᧓᧔᧕᧖᧗᧘᧙
  0x1A80, // Tai Tham Hora ᪀᪁᪂᪃᪄᪅᪆᪇᪈᪉
  0x1A90, // Tai Tham Tham ᪐᪑᪒᪓᪔᪕᪖᪗᪘᪙
  0x1B50, // Balinese ᭐᭑᭒᭓᭔᭕᭖᭗᭘᭙
  0x1BB0, // Sundanese ᮰᮱᮲᮳᮴᮵᮶᮷᮸᮹
  0x1C40, // Lepcha ᱀᱁᱂᱃᱄᱅᱆᱇᱈᱉
  0x1C50, // Ol Chiki ᱐᱑᱒᱓᱔᱕᱖᱗᱘᱙

  // Fullwidth (CJK context)
  0xFF10, // Fullwidth ０１２３４５６７８９

  // Mathematical digit variants (Unicode math block)
  0x1D7CE, // Mathematical Bold
  0x1D7D8, // Mathematical Double-Struck
  0x1D7E2, // Mathematical Sans-Serif
  0x1D7EC, // Mathematical Sans-Serif Bold
  0x1D7F6, // Mathematical Monospace

  // Other scripts
  0x104A0, // Osmanya 𐒠𐒡𐒢𐒣𐒤𐒥𐒦𐒧𐒨𐒩
  0x10D30, // Hanifi Rohingya 𐴰𐴱𐴲𐴳𐴴𐴵𐴶𐴷𐴸𐴹
  0x11066, // Brahmi 𑁦𑁧𑁨𑁩𑁪𑁫𑁬𑁭𑁮𑁯
  0x110F0, // Sora Sompeng 𑃰𑃱𑃲𑃳𑃴𑃵𑃶𑃷𑃸𑃹
  0x11136, // Chakma 𑄶𑄷𑄸𑄹𑄺𑄻𑄼𑄽𑄾𑄿
  0x111D0, // Sharada 𑇐𑇑𑇒𑇓𑇔𑇕𑇖𑇗𑇘𑇙
  0x112F0, // Khudawadi 𑋰𑋱𑋲𑋳𑋴𑋵𑋶𑋷𑋸𑋹
  0x11450, // Newa 𑑐𑑑𑑒𑑓𑑔𑑕𑑖𑑗𑑘𑑙
  0x114D0, // Tirhuta 𑓐𑓑𑓒𑓓𑓔𑓕𑓖𑓗𑓘𑓙
  0x11650, // Modi 𑙐𑙑𑙒𑙓𑙔𑙕𑙖𑙗𑙘𑙙
  0x116C0, // Takri 𑛀𑛁𑛂𑛃𑛄𑛅𑛆𑛇𑛈𑛉
  0x11730, // Ahom 𑜰𑜱𑜲𑜳𑜴𑜵𑜶𑜷𑜸𑜹
  0x118E0, // Warang Citi 𑣠𑣡𑣢𑣣𑣤𑣥𑣦𑣧𑣨𑣩
  0x11950, // Dives Akuru 𑥐𑥑𑥒𑥓𑥔𑥕𑥖𑥗𑥘𑥙
  0x11BF0, // Khitan Small Script 𑯰𑯱𑯲𑯳𑯴𑯵𑯶𑯷𑯸𑯹
  0x11C50, // Bhaiksuki 𑱐𑱑𑱒𑱓𑱔𑱕𑱖𑱗𑱘𑱙
  0x11D50, // Masaram Gondi 𑵐𑵑𑵒𑵓𑵔𑵕𑵖𑵗𑵘𑵙
  0x11DA0, // Gunjala Gondi 𑶠𑶡𑶢𑶣𑶤𑶥𑶦𑶧𑶨𑶩
  0x11F50, // Kawi 𑽐𑽑𑽒𑽓𑽔𑽕𑽖𑽗𑽘𑽙
  0x16A60, // Mro 𖩠𖩡𖩢𖩣𖩤𖩥𖩦𖩧𖩨𖩩
  0x16AC0, // Tangsa 𖫀𖫁𖫂𖫃𖫄𖫅𖫆𖫇𖫈𖫉
  0x16B50, // Pahawh Hmong 𖭐𖭑𖭒𖭓𖭔𖭕𖭖𖭗𖭘𖭙
  0x1E140, // Nyiakeng Puachue Hmong 𞅀𞅁𞅂𞅃𞅄𞅅𞅆𞅇𞅈𞅉
  0x1E2F0, // Wancho 𞋰𞋱𞋲𞋳𞋴𞋵𞋶𞋷𞋸𞋹
  0x1E4F0, // Nag Mundari 𞓰𞓱𞓲𞓳𞓴𞓵𞓶𞓷𞓸𞓹
  0x1E950, // Adlam 𞥐𞥑𞥒𞥓𞥔𞥕𞥖𞥗𞥘𞥙
  0x1FBF0, // Segmented digit symbols 🯰🯱🯲🯳🯴🯵🯶🯷🯸🯹
];

// Build a sparse Map for scripts above 0xFFFF (surrogate-pair range).
// These can't go into a flat Uint8Array indexed by code point efficiently.
const NOT_DIGIT = 0xFF;
const HIGH_MAP = new Map(); // codePoint → digit value (0-9)

const LOW_MAX = 0xFFFF;
const LOW_MIN = 0x0660; // first non-ASCII digit script

// Flat Uint8Array covering 0x0660 .. 0xFFFF
const TABLE_OFFSET = LOW_MIN;
const TABLE_SIZE = LOW_MAX - LOW_MIN + 1;
const TABLE = new Uint8Array(TABLE_SIZE).fill(NOT_DIGIT);

for (const zero of SCRIPT_ZEROS) {
  for (let d = 0; d < 10; d++) {
    const cp = zero + d;
    if (cp <= LOW_MAX) {
      TABLE[cp - TABLE_OFFSET] = d;
    } else {
      HIGH_MAP.set(cp, d);
    }
  }
}



;// CONCATENATED MODULE: ./node_modules/anynum/anynum.js




const CHAR_0 = 48; // '0'.charCodeAt(0)
const CHAR_9 = 57; // '9'.charCodeAt(0)
const CHAR_MINUS = 45; // '-'.charCodeAt(0)

// Unicode minus/hyphen variants worth normalizing to ASCII '-' in numeric context:
//   U+2212  MINUS SIGN       − (mathematically correct minus)
//   U+FF0D  FULLWIDTH HYPHEN-MINUS  － (Japanese fullwidth context)
//   U+FE63  SMALL HYPHEN-MINUS     ﹣ (small form variant)
//
// NOT normalized (deliberate):
//   U+2013  EN DASH  –  (punctuation, not a numeric sign)
//   U+2014  EM DASH  —  (punctuation)
//   U+2010  HYPHEN   ‐  (typographic hyphen)
//
// Rationale: only characters a human or locale formatter would plausibly use
// as a numeric minus sign are normalized. Dashes used for punctuation are left
// alone to avoid mangling non-numeric strings.
const MINUS_SET = new Set([0x2212, 0xFF0D, 0xFE63]);

/**
 * Normalize all Unicode decimal digit characters in a string to ASCII (0-9),
 * and normalize Unicode minus variants to ASCII '-' (U+002D).
 *
 * Non-digit, non-minus characters are passed through unchanged.
 *
 * Performance design:
 * - Fast path: if the string has no convertible characters, return it unchanged
 *   (zero allocation).
 * - BMP digits (0x0660..0xFFFF excl. surrogates): flat Uint8Array lookup (O(1)).
 * - Supplementary plane digits (> 0xFFFF, encoded as surrogate pairs): Map lookup.
 * - Minus variants: checked inline with a small fixed Set.
 *
 * @param {string} str
 * @returns {string}
 */
function anynum(str) {
  if (typeof str !== 'string') return str;

  const len = str.length;
  if (len === 0) return str;

  // Scan for first character needing conversion.
  // If none found, return original string (zero allocation).
  let firstHit = -1;

  for (let i = 0; i < len; i++) {
    const cc = str.charCodeAt(i);

    // ASCII digit or ASCII minus — already normalized, skip fast
    if ((cc >= CHAR_0 && cc <= CHAR_9) || cc === CHAR_MINUS) continue;

    // Below first unicode digit script — check minus variants only
    if (cc < TABLE_OFFSET) {
      if (MINUS_SET.has(cc)) { firstHit = i; break; }
      continue;
    }

    // Surrogate pairs live in BMP range 0xD800-0xDFFF — check before TABLE
    if (cc >= 0xD800 && cc <= 0xDBFF) {
      if (i + 1 < len) {
        const low = str.charCodeAt(i + 1);
        if (low >= 0xDC00 && low <= 0xDFFF) {
          const cp = 0x10000 + ((cc - 0xD800) << 10) + (low - 0xDC00);
          if (HIGH_MAP.has(cp)) { firstHit = i; break; }
        }
      }
      continue;
    }

    // BMP non-surrogate: flat table lookup; also check minus variants in this range
    if (TABLE[cc - TABLE_OFFSET] !== NOT_DIGIT || MINUS_SET.has(cc)) {
      firstHit = i;
      break;
    }
  }

  // Nothing to replace — return original, zero allocation
  if (firstHit === -1) return str;

  // Build result: copy unchanged prefix, then convert from firstHit onward
  const chars = [];

  if (firstHit > 0) chars.push(str.slice(0, firstHit));

  for (let i = firstHit; i < len; i++) {
    const cc = str.charCodeAt(i);

    // ASCII digit or ASCII minus — pass through
    if ((cc >= CHAR_0 && cc <= CHAR_9) || cc === CHAR_MINUS) {
      chars.push(str[i]);
      continue;
    }

    // Below TABLE_OFFSET — check minus variants, else pass through
    if (cc < TABLE_OFFSET) {
      chars.push(MINUS_SET.has(cc) ? '-' : str[i]);
      continue;
    }

    // Surrogate pairs
    if (cc >= 0xD800 && cc <= 0xDBFF) {
      if (i + 1 < len) {
        const low = str.charCodeAt(i + 1);
        if (low >= 0xDC00 && low <= 0xDFFF) {
          const cp = 0x10000 + ((cc - 0xD800) << 10) + (low - 0xDC00);
          const d = HIGH_MAP.get(cp);
          if (d !== undefined) {
            chars.push(String.fromCharCode(d + 48));
            i++; // consume low surrogate
            continue;
          }
        }
      }
      chars.push(str[i]);
      continue;
    }

    // BMP non-surrogate: flat table lookup + minus variants
    if (MINUS_SET.has(cc)) {
      chars.push('-');
      continue;
    }
    const d = TABLE[cc - TABLE_OFFSET];
    chars.push(d !== NOT_DIGIT ? String.fromCharCode(d + 48) : str[i]);
  }

  return chars.join('');
}


/* harmony default export */ const anynum_anynum = (anynum);
;// CONCATENATED MODULE: ./node_modules/strnum/strnum.js
const hexRegex = /^[-+]?0x[a-fA-F0-9]+$/;
const binRegex = /^0b[01]+$/;
const octRegex = /^0o[0-7]+$/;
const numRegex = /^([\-\+])?(0*)([0-9]*(\.[0-9]*)?)$/;



const consider = {
    hex: true,
    binary: false,
    octal: false,
    leadingZeros: true,
    decimalPoint: "\.",
    eNotation: true,
    //skipLike: /regex/,
    infinity: "original", // "null", "infinity" (Infinity type), "string" ("Infinity" (the string literal))
    unicode: false,
};

function toNumber(str, options = {}) {
    options = Object.assign({}, consider, options);
    if (!str || typeof str !== "string") return str;

    let trimmedStr = str.trim();

    if (trimmedStr.length === 0) return str;
    else if (options.skipLike !== undefined && options.skipLike.test(trimmedStr)) return str;
    else if (trimmedStr === "0") return 0;

    if (options.unicode) {
        trimmedStr = anynum_anynum(trimmedStr);
        if (trimmedStr === "0") return 0; // re-check after normalization
    }
    if (options.hex && hexRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 16);
    } else if (options.binary && binRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 2);
    } else if (options.octal && octRegex.test(trimmedStr)) {
        return parse_int(trimmedStr, 8);
    } else if (!isFinite(trimmedStr)) { //Infinity
        return handleInfinity(str, Number(trimmedStr), options);
    } else if (trimmedStr.includes('e') || trimmedStr.includes('E')) { //eNotation
        return resolveEnotation(str, trimmedStr, options);
    } else {
        //separate negative sign, leading zeros, and rest number
        const match = numRegex.exec(trimmedStr);
        // +00.123 => [ , '+', '00', '.123', ..
        if (match) {
            const sign = match[1] || "";
            const leadingZeros = match[2];
            let numTrimmedByZeros = trimZeros(match[3]); //complete num without leading zeros
            const decimalAdjacentToLeadingZeros = sign ? // 0., -00., 000.
                str[leadingZeros.length + 1] === "."
                : str[leadingZeros.length] === ".";

            //trim ending zeros for floating number
            if (!options.leadingZeros //leading zeros are not allowed
                && (leadingZeros.length > 1
                    || (leadingZeros.length === 1 && !decimalAdjacentToLeadingZeros))) {
                // 00, 00.3, +03.24, 03, 03.24
                return str;
            }
            else {//no leading zeros or leading zeros are allowed
                const num = Number(trimmedStr);
                const parsedStr = String(num);

                if (num === 0) return num;
                if (parsedStr.search(/[eE]/) !== -1) { //given number is long and parsed to eNotation
                    if (options.eNotation) return num;
                    else return str;
                } else if (trimmedStr.indexOf(".") !== -1) { //floating number
                    if (parsedStr === "0") return num; //0.0
                    else if (parsedStr === numTrimmedByZeros) return num; //0.456. 0.79000
                    else if (parsedStr === `${sign}${numTrimmedByZeros}`) return num;
                    else return str;
                }

                let n = leadingZeros ? numTrimmedByZeros : trimmedStr;
                if (leadingZeros) {
                    // -009 => -9
                    return (n === parsedStr) || (sign + n === parsedStr) ? num : str
                } else {
                    // +9
                    return (n === parsedStr) || (n === sign + parsedStr) ? num : str
                }
            }
        } else { //non-numeric string
            return str;
        }
    }
}

const eNotationRegx = /^([-+])?(0*)(\d*(\.\d*)?[eE][-\+]?\d+)$/;
function resolveEnotation(str, trimmedStr, options) {
    if (!options.eNotation) return str;
    const notation = trimmedStr.match(eNotationRegx);
    if (notation) {
        let sign = notation[1] || "";
        const eChar = notation[3].indexOf("e") === -1 ? "E" : "e";
        const leadingZeros = notation[2];
        const eAdjacentToLeadingZeros = sign ? // 0E.
            str[leadingZeros.length + 1] === eChar
            : str[leadingZeros.length] === eChar;

        if (leadingZeros.length > 1 && eAdjacentToLeadingZeros) return str;
        else if (leadingZeros.length === 1
            && (notation[3].startsWith(`.${eChar}`) || notation[3][0] === eChar)) {
            return Number(trimmedStr);
        } else if (leadingZeros.length > 0) {
            // Has leading zeros — only accept if leadingZeros option allows it
            if (options.leadingZeros && !eAdjacentToLeadingZeros) {
                trimmedStr = (notation[1] || "") + notation[3];
                return Number(trimmedStr);
            } else return str;
        } else {
            // No leading zeros — always valid e-notation, parse it
            return Number(trimmedStr);
        }
    } else {
        return str;
    }
}

/**
 * 
 * @param {string} numStr without leading zeros
 * @returns 
 */
function trimZeros(numStr) {
    if (numStr && numStr.indexOf(".") !== -1) {//float
        numStr = numStr.replace(/0+$/, ""); //remove ending zeros
        if (numStr === ".") numStr = "0";
        else if (numStr[0] === ".") numStr = "0" + numStr;
        else if (numStr[numStr.length - 1] === ".") numStr = numStr.substring(0, numStr.length - 1);
        return numStr;
    }
    return numStr;
}

function parse_int(numStr, base) {
    const str = numStr.trim();
    if (base === 2 || base === 8) numStr = str.substring(2);

    if (parseInt) return parseInt(numStr, base);
    else if (Number.parseInt) return Number.parseInt(numStr, base);
    else if (window && window.parseInt) return window.parseInt(numStr, base);
    else throw new Error("parseInt, Number.parseInt, window.parseInt are not supported");
}

/**
 * Handle infinite values based on user option
 * @param {string} str - original input string
 * @param {number} num - parsed number (Infinity or -Infinity)
 * @param {object} options - user options
 * @returns {string|number|null} based on infinity option
 */
function handleInfinity(str, num, options) {
    const isPositive = num === Infinity;

    switch (options.infinity.toLowerCase()) {
        case "null":
            return null;
        case "infinity":
            return num; // Return Infinity or -Infinity
        case "string":
            return isPositive ? "Infinity" : "-Infinity";
        case "original":
        default:
            return str; // Return original string like "1e1000"
    }
}
;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/ignoreAttributes.js
function getIgnoreAttributesFn(ignoreAttributes) {
    if (typeof ignoreAttributes === 'function') {
        return ignoreAttributes
    }
    if (Array.isArray(ignoreAttributes)) {
        return (attrName) => {
            for (const pattern of ignoreAttributes) {
                if (typeof pattern === 'string' && attrName === pattern) {
                    return true
                }
                if (pattern instanceof RegExp && pattern.test(attrName)) {
                    return true
                }
            }
        }
    }
    return () => false
}
// EXTERNAL MODULE: ./node_modules/path-expression-matcher/src/Matcher.js
var Matcher = __webpack_require__(8257);
// EXTERNAL MODULE: ./node_modules/path-expression-matcher/src/Expression.js
var Expression = __webpack_require__(3945);
;// CONCATENATED MODULE: ./node_modules/path-expression-matcher/src/ExpressionSet.js
/**
 * ExpressionSet - An indexed collection of Expressions for efficient bulk matching
 *
 * Instead of iterating all expressions on every tag, ExpressionSet pre-indexes
 * them at insertion time by depth and terminal tag name. At match time, only
 * the relevant bucket is evaluated — typically reducing checks from O(E) to O(1)
 * lookup plus O(small bucket) matches.
 *
 * Three buckets are maintained:
 *  - `_byDepthAndTag`  — exact depth + exact tag name  (tightest, used first)
 *  - `_wildcardByDepth` — exact depth + wildcard tag `*` (depth-matched only)
 *  - `_deepWildcards`  — expressions containing `..`  (cannot be depth-indexed)
 *
 * @example
 * import { Expression, ExpressionSet } from 'fast-xml-tagger';
 *
 * // Build once at config time
 * const stopNodes = new ExpressionSet();
 * stopNodes.add(new Expression('root.users.user'));
 * stopNodes.add(new Expression('root.config.setting'));
 * stopNodes.add(new Expression('..script'));
 *
 * // Query on every tag — hot path
 * if (stopNodes.matchesAny(matcher)) { ... }
 */
class ExpressionSet {
  constructor() {
    /** @type {Map<string, import('./Expression.js').default[]>} depth:tag → expressions */
    this._byDepthAndTag = new Map();

    /** @type {Map<number, import('./Expression.js').default[]>} depth → wildcard-tag expressions */
    this._wildcardByDepth = new Map();

    /** @type {import('./Expression.js').default[]} expressions containing deep wildcard (..) */
    this._deepWildcards = [];

    /** @type {Map<string, import('./Expression.js').default[]>} terminalTag → deep wildcard expressions */
    this._deepByTerminalTag = new Map();

    /** @type {Set<string>} pattern strings already added — used for deduplication */
    this._patterns = new Set();

    /** @type {boolean} whether the set is sealed against further additions */
    this._sealed = false;
  }

  /**
   * Add an Expression to the set.
   * Duplicate patterns (same pattern string) are silently ignored.
   *
   * @param {import('./Expression.js').default} expression - A pre-constructed Expression instance
   * @returns {this} for chaining
   * @throws {TypeError} if called after seal()
   *
   * @example
   * set.add(new Expression('root.users.user'));
   * set.add(new Expression('..script'));
   */
  add(expression) {
    if (this._sealed) {
      throw new TypeError(
        'ExpressionSet is sealed. Create a new ExpressionSet to add more expressions.'
      );
    }

    // Deduplicate by pattern string
    if (this._patterns.has(expression.pattern)) return this;
    this._patterns.add(expression.pattern);

    if (expression.hasDeepWildcard()) {
      const lastSeg = expression.segments[expression.segments.length - 1];
      if (lastSeg && lastSeg.type !== 'deep-wildcard' && lastSeg.tag !== '*') {
        const tag = lastSeg.tag;
        if (!this._deepByTerminalTag.has(tag)) this._deepByTerminalTag.set(tag, []);
        this._deepByTerminalTag.get(tag).push(expression);
      } else {
        this._deepWildcards.push(expression);
      }
      return this;
    }

    const depth = expression.length;
    const lastSeg = expression.segments[expression.segments.length - 1];
    const tag = lastSeg?.tag;

    if (!tag || tag === '*') {
      // Can index by depth but not by tag
      if (!this._wildcardByDepth.has(depth)) this._wildcardByDepth.set(depth, []);
      this._wildcardByDepth.get(depth).push(expression);
    } else {
      // Tightest bucket: depth + tag
      const key = `${depth}:${tag}`;
      if (!this._byDepthAndTag.has(key)) this._byDepthAndTag.set(key, []);
      this._byDepthAndTag.get(key).push(expression);
    }

    return this;
  }

  /**
   * Add multiple expressions at once.
   *
   * @param {import('./Expression.js').default[]} expressions - Array of Expression instances
   * @returns {this} for chaining
   *
   * @example
   * set.addAll([
   *   new Expression('root.users.user'),
   *   new Expression('root.config.setting'),
   * ]);
   */
  addAll(expressions) {
    for (const expr of expressions) this.add(expr);
    return this;
  }

  /**
   * Check whether a pattern string is already present in the set.
   *
   * @param {import('./Expression.js').default} expression
   * @returns {boolean}
   */
  has(expression) {
    return this._patterns.has(expression.pattern);
  }

  /**
   * Number of expressions in the set.
   * @type {number}
   */
  get size() {
    return this._patterns.size;
  }

  /**
   * Seal the set against further modifications.
   * Useful to prevent accidental mutations after config is built.
   * Calling add() or addAll() on a sealed set throws a TypeError.
   *
   * @returns {this}
   */
  seal() {
    this._sealed = true;
    return this;
  }

  /**
   * Whether the set has been sealed.
   * @type {boolean}
   */
  get isSealed() {
    return this._sealed;
  }

  /**
   * Test whether the matcher's current path matches any expression in the set.
   *
   * Evaluation order (cheapest → most expensive):
   *  1. Exact depth + tag bucket  — O(1) lookup, typically 0–2 expressions
   *  2. Depth-only wildcard bucket — O(1) lookup, rare
   *  3. Deep-wildcard list         — always checked, but usually small
   *
   * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
   * @returns {boolean} true if any expression matches the current path
   *
   * @example
   * if (stopNodes.matchesAny(matcher)) {
   *   // handle stop node
   * }
   */
  matchesAny(matcher) {
    return this.findMatch(matcher) !== null;
  }
  /**
 * Find and return the first Expression that matches the matcher's current path.
 *
 * Uses the same evaluation order as matchesAny (cheapest → most expensive):
 *  1. Exact depth + tag bucket
 *  2. Depth-only wildcard bucket
 *  3. Deep-wildcard list
 *
 * @param {import('./Matcher.js').default} matcher - Matcher instance (or readOnly view)
 * @returns {import('./Expression.js').default | null} the first matching Expression, or null
 *
 * @example
 * const expr = stopNodes.findMatch(matcher);
 * if (expr) {
 *   // access expr.config, expr.pattern, etc.
 * }
 */
  findMatch(matcher) {
    const depth = matcher.getDepth();
    const tag = matcher.getCurrentTag();

    // 1. Tightest bucket — most expressions live here
    const exactKey = `${depth}:${tag}`;
    const exactBucket = this._byDepthAndTag.get(exactKey);
    if (exactBucket) {
      for (let i = 0; i < exactBucket.length; i++) {
        if (matcher.matches(exactBucket[i])) return exactBucket[i];
      }
    }

    // 2. Depth-matched wildcard-tag expressions
    const wildcardBucket = this._wildcardByDepth.get(depth);
    if (wildcardBucket) {
      for (let i = 0; i < wildcardBucket.length; i++) {
        if (matcher.matches(wildcardBucket[i])) return wildcardBucket[i];
      }
    }

    // 3. Deep wildcards — indexed by terminal tag, then unindexed fallback
    const deepBucket = this._deepByTerminalTag.get(tag);
    if (deepBucket) {
      for (let i = 0; i < deepBucket.length; i++) {
        if (matcher.matches(deepBucket[i])) return deepBucket[i];
      }
    }
    for (let i = 0; i < this._deepWildcards.length; i++) {
      if (matcher.matches(this._deepWildcards[i])) return this._deepWildcards[i];
    }

    return null;
  }
}

;// CONCATENATED MODULE: ./node_modules/@nodable/entities/src/entities.js
// ---------------------------------------------------------------------------
// Complete HTML5 named entity reference
// Organized by logical categories for easy maintenance and selective importing
// ---------------------------------------------------------------------------

/**
 * Basic Latin & Special Characters
 * @type {Record<string, string>}
 */
const BASIC_LATIN = {
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
  apos: "'",
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  lsquor: '‚',
  rsquor: '’',
  ldquor: '„',
  bdquo: '„',
  comma: ',',
  period: '.',
  colon: ':',
  semi: ';',
  excl: '!',
  quest: '?',
  num: '#',
  dollar: '$',
  percent: '%',
  ast: '*',
  commat: '@',
  lowbar: '_',
  verbar: '|',
  vert: '|',
  sol: '/',
  bsol: '\\',
  lbrace: '{',
  rbrace: '}',
  lbrack: '[',
  rbrack: ']',
  lpar: '(',
  rpar: ')',
  nbsp: '\u00a0',
  iexcl: '¡',
  cent: '¢',
  pound: '£',
  curren: '¤',
  yen: '¥',
  brvbar: '¦',
  sect: '§',
  uml: '¨',
  copy: '©',
  COPY: '©',
  ordf: 'ª',
  laquo: '«',
  not: '¬',
  shy: '\u00ad',
  reg: '®',
  REG: '®',
  macr: '¯',
  deg: '°',
  plusmn: '±',
  sup2: '²',
  sup3: '³',
  acute: '´',
  micro: 'µ',
  para: '¶',
  middot: '·',
  cedil: '¸',
  sup1: '¹',
  ordm: 'º',
  raquo: '»',
  frac14: '¼',
  frac12: '½',
  half: '½',
  frac34: '¾',
  iquest: '¿',
  times: '×',
  div: '÷',
  divide: '÷',
};

/**
 * Latin Extended & Accented Letters (A-Z)
 * @type {Record<string, string>}
 */
const LATIN_ACCENTS = {
  Agrave: 'À',
  agrave: 'à',
  Aacute: 'Á',
  aacute: 'á',
  Acirc: 'Â',
  acirc: 'â',
  Atilde: 'Ã',
  atilde: 'ã',
  Auml: 'Ä',
  auml: 'ä',
  Aring: 'Å',
  aring: 'å',
  AElig: 'Æ',
  aelig: 'æ',
  Ccedil: 'Ç',
  ccedil: 'ç',
  Egrave: 'È',
  egrave: 'è',
  Eacute: 'É',
  eacute: 'é',
  Ecirc: 'Ê',
  ecirc: 'ê',
  Euml: 'Ë',
  euml: 'ë',
  Igrave: 'Ì',
  igrave: 'ì',
  Iacute: 'Í',
  iacute: 'í',
  Icirc: 'Î',
  icirc: 'î',
  Iuml: 'Ï',
  iuml: 'ï',
  ETH: 'Ð',
  eth: 'ð',
  Ntilde: 'Ñ',
  ntilde: 'ñ',
  Ograve: 'Ò',
  ograve: 'ò',
  Oacute: 'Ó',
  oacute: 'ó',
  Ocirc: 'Ô',
  ocirc: 'ô',
  Otilde: 'Õ',
  otilde: 'õ',
  Ouml: 'Ö',
  ouml: 'ö',
  Oslash: 'Ø',
  oslash: 'ø',
  Ugrave: 'Ù',
  ugrave: 'ù',
  Uacute: 'Ú',
  uacute: 'ú',
  Ucirc: 'Û',
  ucirc: 'û',
  Uuml: 'Ü',
  uuml: 'ü',
  Yacute: 'Ý',
  yacute: 'ý',
  THORN: 'Þ',
  thorn: 'þ',
  szlig: 'ß',
  yuml: 'ÿ',
  Yuml: 'Ÿ',
};

/**
 * Latin Extended (Letters with diacritics)
 * @type {Record<string, string>}
 */
const LATIN_EXTENDED = {
  Amacr: 'Ā',
  amacr: 'ā',
  Abreve: 'Ă',
  abreve: 'ă',
  Aogon: 'Ą',
  aogon: 'ą',
  Cacute: 'Ć',
  cacute: 'ć',
  Ccirc: 'Ĉ',
  ccirc: 'ĉ',
  Cdot: 'Ċ',
  cdot: 'ċ',
  Ccaron: 'Č',
  ccaron: 'č',
  Dcaron: 'Ď',
  dcaron: 'ď',
  Dstrok: 'Đ',
  dstrok: 'đ',
  Emacr: 'Ē',
  emacr: 'ē',
  Ecaron: 'Ě',
  ecaron: 'ě',
  Edot: 'Ė',
  edot: 'ė',
  Eogon: 'Ę',
  eogon: 'ę',
  Gcirc: 'Ĝ',
  gcirc: 'ĝ',
  Gbreve: 'Ğ',
  gbreve: 'ğ',
  Gdot: 'Ġ',
  gdot: 'ġ',
  Gcedil: 'Ģ',
  Hcirc: 'Ĥ',
  hcirc: 'ĥ',
  Hstrok: 'Ħ',
  hstrok: 'ħ',
  Itilde: 'Ĩ',
  itilde: 'ĩ',
  Imacr: 'Ī',
  imacr: 'ī',
  Iogon: 'Į',
  iogon: 'į',
  Idot: 'İ',
  IJlig: 'Ĳ',
  ijlig: 'ĳ',
  Jcirc: 'Ĵ',
  jcirc: 'ĵ',
  Kcedil: 'Ķ',
  kcedil: 'ķ',
  kgreen: 'ĸ',
  Lacute: 'Ĺ',
  lacute: 'ĺ',
  Lcedil: 'Ļ',
  lcedil: 'ļ',
  Lcaron: 'Ľ',
  lcaron: 'ľ',
  Lmidot: 'Ŀ',
  lmidot: 'ŀ',
  Lstrok: 'Ł',
  lstrok: 'ł',
  Nacute: 'Ń',
  nacute: 'ń',
  Ncaron: 'Ň',
  ncaron: 'ň',
  Ncedil: 'Ņ',
  ncedil: 'ņ',
  ENG: 'Ŋ',
  eng: 'ŋ',
  Omacr: 'Ō',
  omacr: 'ō',
  Odblac: 'Ő',
  odblac: 'ő',
  OElig: 'Œ',
  oelig: 'œ',
  Racute: 'Ŕ',
  racute: 'ŕ',
  Rcaron: 'Ř',
  rcaron: 'ř',
  Rcedil: 'Ŗ',
  rcedil: 'ŗ',
  Sacute: 'Ś',
  sacute: 'ś',
  Scirc: 'Ŝ',
  scirc: 'ŝ',
  Scedil: 'Ş',
  scedil: 'ş',
  Scaron: 'Š',
  scaron: 'š',
  Tcedil: 'Ţ',
  tcedil: 'ţ',
  Tcaron: 'Ť',
  tcaron: 'ť',
  Tstrok: 'Ŧ',
  tstrok: 'ŧ',
  Utilde: 'Ũ',
  utilde: 'ũ',
  Umacr: 'Ū',
  umacr: 'ū',
  Ubreve: 'Ŭ',
  ubreve: 'ŭ',
  Uring: 'Ů',
  uring: 'ů',
  Udblac: 'Ű',
  udblac: 'ű',
  Uogon: 'Ų',
  uogon: 'ų',
  Wcirc: 'Ŵ',
  wcirc: 'ŵ',
  Ycirc: 'Ŷ',
  ycirc: 'ŷ',
  Zacute: 'Ź',
  zacute: 'ź',
  Zdot: 'Ż',
  zdot: 'ż',
  Zcaron: 'Ž',
  zcaron: 'ž',
};

/**
 * Greek Letters
 * @type {Record<string, string>}
 */
const GREEK = {
  Alpha: 'Α',
  alpha: 'α',
  Beta: 'Β',
  beta: 'β',
  Gamma: 'Γ',
  gamma: 'γ',
  Delta: 'Δ',
  delta: 'δ',
  Epsilon: 'Ε',
  epsilon: 'ε',
  epsiv: 'ϵ',
  varepsilon: 'ϵ',
  Zeta: 'Ζ',
  zeta: 'ζ',
  Eta: 'Η',
  eta: 'η',
  Theta: 'Θ',
  theta: 'θ',
  thetasym: 'ϑ',
  vartheta: 'ϑ',
  Iota: 'Ι',
  iota: 'ι',
  Kappa: 'Κ',
  kappa: 'κ',
  kappav: 'ϰ',
  varkappa: 'ϰ',
  Lambda: 'Λ',
  lambda: 'λ',
  Mu: 'Μ',
  mu: 'μ',
  Nu: 'Ν',
  nu: 'ν',
  Xi: 'Ξ',
  xi: 'ξ',
  Omicron: 'Ο',
  omicron: 'ο',
  Pi: 'Π',
  pi: 'π',
  piv: 'ϖ',
  varpi: 'ϖ',
  Rho: 'Ρ',
  rho: 'ρ',
  rhov: 'ϱ',
  varrho: 'ϱ',
  Sigma: 'Σ',
  sigma: 'σ',
  sigmaf: 'ς',
  sigmav: 'ς',
  varsigma: 'ς',
  Tau: 'Τ',
  tau: 'τ',
  Upsilon: 'Υ',
  upsilon: 'υ',
  upsi: 'υ',
  Upsi: 'ϒ',
  upsih: 'ϒ',
  Phi: 'Φ',
  phi: 'φ',
  phiv: 'ϕ',
  varphi: 'ϕ',
  Chi: 'Χ',
  chi: 'χ',
  Psi: 'Ψ',
  psi: 'ψ',
  Omega: 'Ω',
  omega: 'ω',
  ohm: 'Ω',
  Gammad: 'Ϝ',
  gammad: 'ϝ',
  digamma: 'ϝ',
};

/**
 * Cyrillic Letters
 * @type {Record<string, string>}
 */
const CYRILLIC = {
  Afr: '𝔄',
  afr: '𝔞',
  Acy: 'А',
  acy: 'а',
  Bcy: 'Б',
  bcy: 'б',
  Vcy: 'В',
  vcy: 'в',
  Gcy: 'Г',
  gcy: 'г',
  Dcy: 'Д',
  dcy: 'д',
  IEcy: 'Е',
  iecy: 'е',
  IOcy: 'Ё',
  iocy: 'ё',
  ZHcy: 'Ж',
  zhcy: 'ж',
  Zcy: 'З',
  zcy: 'з',
  Icy: 'И',
  icy: 'и',
  Jcy: 'Й',
  jcy: 'й',
  Kcy: 'К',
  kcy: 'к',
  Lcy: 'Л',
  lcy: 'л',
  Mcy: 'М',
  mcy: 'м',
  Ncy: 'Н',
  ncy: 'н',
  Ocy: 'О',
  ocy: 'о',
  Pcy: 'П',
  pcy: 'п',
  Rcy: 'Р',
  rcy: 'р',
  Scy: 'С',
  scy: 'с',
  Tcy: 'Т',
  tcy: 'т',
  Ucy: 'У',
  ucy: 'у',
  Fcy: 'Ф',
  fcy: 'ф',
  KHcy: 'Х',
  khcy: 'х',
  TScy: 'Ц',
  tscy: 'ц',
  CHcy: 'Ч',
  chcy: 'ч',
  SHcy: 'Ш',
  shcy: 'ш',
  SHCHcy: 'Щ',
  shchcy: 'щ',
  HARDcy: 'Ъ',
  hardcy: 'ъ',
  Ycy: 'Ы',
  ycy: 'ы',
  SOFTcy: 'Ь',
  softcy: 'ь',
  Ecy: 'Э',
  ecy: 'э',
  YUcy: 'Ю',
  yucy: 'ю',
  YAcy: 'Я',
  yacy: 'я',
  DJcy: 'Ђ',
  djcy: 'ђ',
  GJcy: 'Ѓ',
  gjcy: 'ѓ',
  Jukcy: 'Є',
  jukcy: 'є',
  DScy: 'Ѕ',
  dscy: 'ѕ',
  Iukcy: 'І',
  iukcy: 'і',
  YIcy: 'Ї',
  yicy: 'ї',
  Jsercy: 'Ј',
  jsercy: 'ј',
  LJcy: 'Љ',
  ljcy: 'љ',
  NJcy: 'Њ',
  njcy: 'њ',
  TSHcy: 'Ћ',
  tshcy: 'ћ',
  KJcy: 'Ќ',
  kjcy: 'ќ',
  Ubrcy: 'Ў',
  ubrcy: 'ў',
  DZcy: 'Џ',
  dzcy: 'џ',
};

/**
 * Mathematical Operators & Relations
 * @type {Record<string, string>}
 */
const MATH = {
  plus: '+',
  pm: '±',
  times: '×',
  div: '÷',
  divide: '÷',
  sdot: '⋅',
  star: '☆',
  starf: '★',
  bigstar: '★',
  lowast: '∗',
  ast: '*',
  midast: '*',
  compfn: '∘',
  smallcircle: '∘',
  bullet: '•',
  bull: '•',
  nbsp: '\u00a0',
  hellip: '…',
  mldr: '…',
  prime: '′',
  Prime: '″',
  tprime: '‴',
  bprime: '‵',
  backprime: '‵',
  minus: '−',
  minusd: '∸',
  dotminus: '∸',
  plusdo: '∔',
  dotplus: '∔',
  plusmn: '±',
  minusplus: '∓',
  mnplus: '∓',
  mp: '∓',
  setminus: '∖',
  smallsetminus: '∖',
  Backslash: '∖',
  setmn: '∖',
  ssetmn: '∖',
  lowbar: '_',
  verbar: '|',
  vert: '|',
  VerticalLine: '|',
  colon: ':',
  Colon: '∷',
  Proportion: '∷',
  ratio: '∶',
  equals: '=',
  ne: '≠',
  nequiv: '≢',
  equiv: '≡',
  Congruent: '≡',
  sim: '∼',
  thicksim: '∼',
  thksim: '∼',
  sime: '≃',
  simeq: '≃',
  TildeEqual: '≃',
  asymp: '≈',
  approx: '≈',
  thickapprox: '≈',
  thkap: '≈',
  TildeTilde: '≈',
  ncong: '≇',
  cong: '≅',
  TildeFullEqual: '≅',
  asympeq: '≍',
  CupCap: '≍',
  bump: '≎',
  Bumpeq: '≎',
  HumpDownHump: '≎',
  bumpe: '≏',
  bumpeq: '≏',
  HumpEqual: '≏',
  le: '≤',
  LessEqual: '≤',
  ge: '≥',
  GreaterEqual: '≥',
  lesseqgtr: '⋚',
  lesseqqgtr: '⪋',
  greater: '>',
  less: '<',
};

/**
 * Mathematical Operators (Advanced)
 * @type {Record<string, string>}
 */
const MATH_ADVANCED = {
  alefsym: 'ℵ',
  aleph: 'ℵ',
  beth: 'ℶ',
  gimel: 'ℷ',
  daleth: 'ℸ',
  forall: '∀',
  ForAll: '∀',
  part: '∂',
  PartialD: '∂',
  exist: '∃',
  Exists: '∃',
  nexist: '∄',
  nexists: '∄',
  empty: '∅',
  emptyset: '∅',
  emptyv: '∅',
  varnothing: '∅',
  nabla: '∇',
  Del: '∇',
  isin: '∈',
  isinv: '∈',
  in: '∈',
  Element: '∈',
  notin: '∉',
  notinva: '∉',
  ni: '∋',
  niv: '∋',
  SuchThat: '∋',
  ReverseElement: '∋',
  notni: '∌',
  notniva: '∌',
  prod: '∏',
  Product: '∏',
  coprod: '∐',
  Coproduct: '∐',
  sum: '∑',
  Sum: '∑',
  minus: '−',
  mp: '∓',
  plusdo: '∔',
  dotplus: '∔',
  setminus: '∖',
  lowast: '∗',
  radic: '√',
  Sqrt: '√',
  prop: '∝',
  propto: '∝',
  Proportional: '∝',
  varpropto: '∝',
  infin: '∞',
  infintie: '⧝',
  ang: '∠',
  angle: '∠',
  angmsd: '∡',
  measuredangle: '∡',
  angsph: '∢',
  mid: '∣',
  VerticalBar: '∣',
  nmid: '∤',
  nsmid: '∤',
  npar: '∦',
  parallel: '∥',
  spar: '∥',
  nparallel: '∦',
  nspar: '∦',
  and: '∧',
  wedge: '∧',
  or: '∨',
  vee: '∨',
  cap: '∩',
  cup: '∪',
  int: '∫',
  Integral: '∫',
  conint: '∮',
  ContourIntegral: '∮',
  Conint: '∯',
  DoubleContourIntegral: '∯',
  Cconint: '∰',
  there4: '∴',
  therefore: '∴',
  Therefore: '∴',
  becaus: '∵',
  because: '∵',
  Because: '∵',
  ratio: '∶',
  Proportion: '∷',
  minusd: '∸',
  dotminus: '∸',
  mDDot: '∺',
  homtht: '∻',
  sim: '∼',
  bsimg: '∽',
  backsim: '∽',
  ac: '∾',
  mstpos: '∾',
  acd: '∿',
  VerticalTilde: '≀',
  wr: '≀',
  wreath: '≀',
  nsime: '≄',
  nsimeq: '≄',
  ncong: '≇',
  simne: '≆',
  ncongdot: '⩭̸',
  ngsim: '≵',
  nsim: '≁',
  napprox: '≉',
  nap: '≉',
  ngeq: '≱',
  nge: '≱',
  nleq: '≰',
  nle: '≰',
  ngtr: '≯',
  ngt: '≯',
  nless: '≮',
  nlt: '≮',
  nprec: '⊀',
  npr: '⊀',
  nsucc: '⊁',
  nsc: '⊁',
};

/**
 * Arrows
 * @type {Record<string, string>}
 */
const ARROWS = {
  larr: '←',
  leftarrow: '←',
  LeftArrow: '←',
  uarr: '↑',
  uparrow: '↑',
  UpArrow: '↑',
  rarr: '→',
  rightarrow: '→',
  RightArrow: '→',
  darr: '↓',
  downarrow: '↓',
  DownArrow: '↓',
  harr: '↔',
  leftrightarrow: '↔',
  LeftRightArrow: '↔',
  varr: '↕',
  updownarrow: '↕',
  UpDownArrow: '↕',
  nwarr: '↖',
  nwarrow: '↖',
  UpperLeftArrow: '↖',
  nearr: '↗',
  nearrow: '↗',
  UpperRightArrow: '↗',
  searr: '↘',
  searrow: '↘',
  LowerRightArrow: '↘',
  swarr: '↙',
  swarrow: '↙',
  LowerLeftArrow: '↙',
  lArr: '⇐',
  Leftarrow: '⇐',
  uArr: '⇑',
  Uparrow: '⇑',
  rArr: '⇒',
  Rightarrow: '⇒',
  dArr: '⇓',
  Downarrow: '⇓',
  hArr: '⇔',
  Leftrightarrow: '⇔',
  iff: '⇔',
  vArr: '⇕',
  Updownarrow: '⇕',
  lAarr: '⇚',
  Lleftarrow: '⇚',
  rAarr: '⇛',
  Rrightarrow: '⇛',
  lrarr: '⇆',
  leftrightarrows: '⇆',
  rlarr: '⇄',
  rightleftarrows: '⇄',
  lrhar: '⇋',
  leftrightharpoons: '⇋',
  ReverseEquilibrium: '⇋',
  rlhar: '⇌',
  rightleftharpoons: '⇌',
  Equilibrium: '⇌',
  udarr: '⇅',
  UpArrowDownArrow: '⇅',
  duarr: '⇵',
  DownArrowUpArrow: '⇵',
  llarr: '⇇',
  leftleftarrows: '⇇',
  rrarr: '⇉',
  rightrightarrows: '⇉',
  ddarr: '⇊',
  downdownarrows: '⇊',
  har: '↽',
  lhard: '↽',
  leftharpoondown: '↽',
  lharu: '↼',
  leftharpoonup: '↼',
  rhard: '⇁',
  rightharpoondown: '⇁',
  rharu: '⇀',
  rightharpoonup: '⇀',
  lsh: '↰',
  Lsh: '↰',
  rsh: '↱',
  Rsh: '↱',
  ldsh: '↲',
  rdsh: '↳',
  hookleftarrow: '↩',
  hookrightarrow: '↪',
  mapstoleft: '↤',
  mapstoup: '↥',
  map: '↦',
  mapsto: '↦',
  mapstodown: '↧',
  crarr: '↵',
  nleftarrow: '↚',
  nleftrightarrow: '↮',
  nrightarrow: '↛',
  nrarr: '↛',
  larrtl: '↢',
  rarrtl: '↣',
  leftarrowtail: '↢',
  rightarrowtail: '↣',
  twoheadleftarrow: '↞',
  twoheadrightarrow: '↠',
  Larr: '↞',
  Rarr: '↠',
  larrhk: '↩',
  rarrhk: '↪',
  larrlp: '↫',
  looparrowleft: '↫',
  rarrlp: '↬',
  looparrowright: '↬',
  harrw: '↭',
  leftrightsquigarrow: '↭',
  nrarrw: '↝̸',
  rarrw: '↝',
  rightsquigarrow: '↝',
  larrbfs: '⤟',
  rarrbfs: '⤠',
  nvHarr: '⤄',
  nvlArr: '⤂',
  nvrArr: '⤃',
  larrfs: '⤝',
  rarrfs: '⤞',
  Map: '⤅',
  larrsim: '⥳',
  rarrsim: '⥴',
  harrcir: '⥈',
  Uarrocir: '⥉',
  lurdshar: '⥊',
  ldrdhar: '⥧',
  ldrushar: '⥋',
  rdldhar: '⥩',
  lrhard: '⥭',
  uharr: '↾',
  uharl: '↿',
  dharr: '⇂',
  dharl: '⇃',
  Uarr: '↟',
  Darr: '↡',
  zigrarr: '⇝',
  nwArr: '⇖',
  neArr: '⇗',
  seArr: '⇘',
  swArr: '⇙',
  nharr: '↮',
  nhArr: '⇎',
  nlarr: '↚',
  nlArr: '⇍',
  nrArr: '⇏',
  larrb: '⇤',
  LeftArrowBar: '⇤',
  rarrb: '⇥',
  RightArrowBar: '⇥',
};

/**
 * Geometric Shapes
 * @type {Record<string, string>}
 */
const SHAPES = {
  square: '□',
  Square: '□',
  squ: '□',
  squf: '▪',
  squarf: '▪',
  blacksquar: '▪',
  blacksquare: '▪',
  FilledVerySmallSquare: '▪',
  blk34: '▓',
  blk12: '▒',
  blk14: '░',
  block: '█',
  srect: '▭',
  rect: '▭',
  sdot: '⋅',
  sdotb: '⊡',
  dotsquare: '⊡',
  triangle: '▵',
  tri: '▵',
  trine: '▵',
  utri: '▵',
  triangledown: '▿',
  dtri: '▿',
  tridown: '▿',
  triangleleft: '◃',
  ltri: '◃',
  triangleright: '▹',
  rtri: '▹',
  blacktriangle: '▴',
  utrif: '▴',
  blacktriangledown: '▾',
  dtrif: '▾',
  blacktriangleleft: '◂',
  ltrif: '◂',
  blacktriangleright: '▸',
  rtrif: '▸',
  loz: '◊',
  lozenge: '◊',
  blacklozenge: '⧫',
  lozf: '⧫',
  bigcirc: '◯',
  xcirc: '◯',
  circ: 'ˆ',
  Circle: '○',
  cir: '○',
  o: '○',
  bullet: '•',
  bull: '•',
  hellip: '…',
  mldr: '…',
  nldr: '‥',
  boxh: '─',
  HorizontalLine: '─',
  boxv: '│',
  boxdr: '┌',
  boxdl: '┐',
  boxur: '└',
  boxul: '┘',
  boxvr: '├',
  boxvl: '┤',
  boxhd: '┬',
  boxhu: '┴',
  boxvh: '┼',
  boxH: '═',
  boxV: '║',
  boxdR: '╒',
  boxDr: '╓',
  boxDR: '╔',
  boxDl: '╕',
  boxdL: '╖',
  boxDL: '╗',
  boxuR: '╘',
  boxUr: '╙',
  boxUR: '╚',
  boxUl: '╜',
  boxuL: '╛',
  boxUL: '╝',
  boxvR: '╞',
  boxVr: '╟',
  boxVR: '╠',
  boxVl: '╢',
  boxvL: '╡',
  boxVL: '╣',
  boxHd: '╤',
  boxhD: '╥',
  boxHD: '╦',
  boxHu: '╧',
  boxhU: '╨',
  boxHU: '╩',
  boxvH: '╪',
  boxVh: '╫',
  boxVH: '╬',
};

/**
 * Punctuation & Diacritics
 * @type {Record<string, string>}
 */
const PUNCTUATION = {
  excl: '!',
  iexcl: '¡',
  brvbar: '¦',
  sect: '§',
  uml: '¨',
  copy: '©',
  ordf: 'ª',
  laquo: '«',
  not: '¬',
  shy: '\u00ad',
  reg: '®',
  macr: '¯',
  deg: '°',
  plusmn: '±',
  sup2: '²',
  sup3: '³',
  acute: '´',
  micro: 'µ',
  para: '¶',
  middot: '·',
  cedil: '¸',
  sup1: '¹',
  ordm: 'º',
  raquo: '»',
  frac14: '¼',
  frac12: '½',
  frac34: '¾',
  iquest: '¿',
  nbsp: '\u00a0',
  comma: ',',
  period: '.',
  colon: ':',
  semi: ';',
  vert: '|',
  Verbar: '‖',
  verbar: '|',
  dblac: '˝',
  circ: 'ˆ',
  caron: 'ˇ',
  breve: '˘',
  dot: '˙',
  ring: '˚',
  ogon: '˛',
  tilde: '˜',
  DiacriticalGrave: '`',
  DiacriticalAcute: '´',
  DiacriticalTilde: '˜',
  DiacriticalDot: '˙',
  DiacriticalDoubleAcute: '˝',
  grave: '`',
};

/**
 * Currency Symbols
 * @type {Record<string, string>}
 */
const CURRENCY = {
  cent: '¢',
  pound: '£',
  curren: '¤',
  yen: '¥',
  euro: '€',
  dollar: '$',
  fnof: 'ƒ',
  inr: '₹',
  af: '؋',
  birr: 'ብር',
  peso: '₱',
  rub: '₽',
  won: '₩',
  yuan: '¥',
  cedil: '¸',
};

/**
 * Fractions
 * @type {Record<string, string>}
 */
const FRACTIONS = {
  frac12: '½',
  half: '½',
  frac13: '⅓',
  frac14: '¼',
  frac15: '⅕',
  frac16: '⅙',
  frac18: '⅛',
  frac23: '⅔',
  frac25: '⅖',
  frac34: '¾',
  frac35: '⅗',
  frac38: '⅜',
  frac45: '⅘',
  frac56: '⅚',
  frac58: '⅝',
  frac78: '⅞',
  frasl: '⁄',
};

/**
 * Miscellaneous Symbols
 * @type {Record<string, string>}
 */
const MISC_SYMBOLS = {
  trade: '™',
  TRADE: '™',
  telrec: '⌕',
  target: '⌖',
  ulcorn: '⌜',
  ulcorner: '⌜',
  urcorn: '⌝',
  urcorner: '⌝',
  dlcorn: '⌞',
  llcorner: '⌞',
  drcorn: '⌟',
  lrcorner: '⌟',
  intercal: '⊺',
  intcal: '⊺',
  oplus: '⊕',
  CirclePlus: '⊕',
  ominus: '⊖',
  CircleMinus: '⊖',
  otimes: '⊗',
  CircleTimes: '⊗',
  osol: '⊘',
  odot: '⊙',
  CircleDot: '⊙',
  oast: '⊛',
  circledast: '⊛',
  odash: '⊝',
  circleddash: '⊝',
  ocirc: '⊚',
  circledcirc: '⊚',
  boxplus: '⊞',
  plusb: '⊞',
  boxminus: '⊟',
  minusb: '⊟',
  boxtimes: '⊠',
  timesb: '⊠',
  boxdot: '⊡',
  sdotb: '⊡',
  veebar: '⊻',
  vee: '∨',
  barvee: '⊽',
  and: '∧',
  wedge: '∧',
  Cap: '⋒',
  Cup: '⋓',
  Fork: '⋔',
  pitchfork: '⋔',
  epar: '⋕',
  ltlarr: '⥶',
  nvap: '≍⃒',
  nvsim: '∼⃒',
  nvge: '≥⃒',
  nvle: '≤⃒',
  nvlt: '<⃒',
  nvgt: '>⃒',
  nvltrie: '⊴⃒',
  nvrtrie: '⊵⃒',
  Vdash: '⊩',
  dashv: '⊣',
  vDash: '⊨',
  Vvdash: '⊪',
  nvdash: '⊬',
  nvDash: '⊭',
  nVdash: '⊮',
  nVDash: '⊯',
};

const XML = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: "\""
}
const COMMON_HTML = {
  nbsp: '\u00a0',
  copy: '\u00a9',
  reg: '\u00ae',
  trade: '\u2122',
  mdash: '\u2014',
  ndash: '\u2013',
  hellip: '\u2026',
  laquo: '\u00ab',
  raquo: '\u00bb',
  lsquo: '\u2018',
  rsquo: '\u2019',
  ldquo: '\u201c',
  rdquo: '\u201d',
  bull: '\u2022',
  para: '\u00b6',
  sect: '\u00a7',
  deg: '\u00b0',
  frac12: '\u00bd',
  frac14: '\u00bc',
  frac34: '\u00be',
}
// ---------------------------------------------------------------------------
// Note: NUMERIC_ENTITIES (&#NNN; / &#xHH;) are handled by the scanner directly
// via String.fromCodePoint() without any map lookup.
// ---------------------------------------------------------------------------
;// CONCATENATED MODULE: ./node_modules/@nodable/entities/src/EntityDecoder.js
// ---------------------------------------------------------------------------
// Built-in named entity map  (name → replacement string)
// No regex, no {regex,val} objects — just flat key/value pairs.
// ---------------------------------------------------------------------------



// ---------------------------------------------------------------------------
// Entity hook action constants
// ---------------------------------------------------------------------------

/**
 * Action constants for `onExternalEntity` and `onInputEntity` hooks.
 *
 * Use these instead of raw strings to avoid typos:
 *
 * @example
 * import EntityDecoder, { ENTITY_ACTION } from './EntityDecoder.js';
 * const dec = new EntityDecoder({
 *   onInputEntity: (name, value) => ENTITY_ACTION.BLOCK,
 * });
 */
const ENTITY_ACTION = Object.freeze({
  /** Resolve and expand the entity normally. */
  ALLOW: 'allow',
  /** Silently skip this entity — it will not be registered. */
  BLOCK: 'block',
  /** Throw an error, aborting entity registration entirely. */
  THROW: 'throw',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SPECIAL_CHARS = new Set('!?\\\\/[]$%{}^&*()<>|+');

/**
 * Validate that an entity name contains no dangerous characters.
 * @param {string} name
 * @returns {string} the name, unchanged
 * @throws {Error} on invalid characters
 */
function EntityDecoder_validateEntityName(name) {
  if (name[0] === '#') {
    throw new Error(`[EntityReplacer] Invalid character '#' in entity name: "${name}"`);
  }
  for (const ch of name) {
    if (SPECIAL_CHARS.has(ch)) {
      throw new Error(`[EntityReplacer] Invalid character '${ch}' in entity name: "${name}"`);
    }
  }
  return name;
}

/**
 * Merge one or more entity maps into a flat name→string map.
 * Accepts either:
 *   - plain string values:             { amp: '&' }
 *   - legacy {regex,val} / {regx,val}: { lt: { regex: /.../, val: '<' } }
 *
 * Values containing '&' are skipped (recursive expansion risk).
 *
 * @param {...object} maps
 * @returns {Record<string, string>}
 */
function mergeEntityMaps(...maps) {
  const out = Object.create(null);
  for (const map of maps) {
    if (!map) continue;
    for (const key of Object.keys(map)) {
      const raw = map[key];
      if (typeof raw === 'string') {
        out[key] = raw;
      } else if (raw && typeof raw === 'object' && raw.val !== undefined) {
        // Legacy {regex,val} or {regx,val} — extract the string val only
        const val = raw.val;
        if (typeof val === 'string') {
          out[key] = val;
        }
        // function vals are not supported in the scanner — skip
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// applyLimitsTo helpers
// ---------------------------------------------------------------------------

const LIMIT_TIER_EXTERNAL = 'external'; // input/runtime + persistent external maps
const LIMIT_TIER_BASE = 'base';     // DEFAULT_XML_ENTITIES + namedEntities (system) maps
const LIMIT_TIER_ALL = 'all';      // every entity regardless of tier

/**
 * Resolve `applyLimitsTo` option into a normalised Set of tier strings.
 * Accepted values: 'external' | 'base' | 'all' | string[]
 * Default: 'external' (only untrusted injected entities are counted).
 * @param {string|string[]|undefined} raw
 * @returns {Set<string>}
 */
function parseLimitTiers(raw) {
  if (!raw || raw === LIMIT_TIER_EXTERNAL) return new Set([LIMIT_TIER_EXTERNAL]);
  if (raw === LIMIT_TIER_ALL) return new Set([LIMIT_TIER_ALL]);
  if (raw === LIMIT_TIER_BASE) return new Set([LIMIT_TIER_BASE]);
  if (Array.isArray(raw)) return new Set(raw);
  return new Set([LIMIT_TIER_EXTERNAL]); // safe default for unrecognised values
}

// ---------------------------------------------------------------------------
// NCR (Numeric Character Reference) classification
// ---------------------------------------------------------------------------

// Severity order — higher number = stricter action.
// Used to enforce minimum action levels for specific codepoint ranges.
const NCR_LEVEL = Object.freeze({ allow: 0, leave: 1, remove: 2, throw: 3 });

// XML 1.0 §2.2: allowed chars are #x9 | #xA | #xD | [#x20-#xD7FF] | [#xE000-#xFFFD] | [#x10000-#x10FFFF]
// Restricted C0: U+0001–U+001F excluding U+0009, U+000A, U+000D
const XML10_ALLOWED_C0 = new Set([0x09, 0x0A, 0x0D]);

/**
 * Parse the `ncr` constructor option into flat, hot-path-friendly fields.
 * @param {object|undefined} ncr
 * @returns {{ xmlVersion: number, onLevel: number, nullLevel: number }}
 */
function parseNCRConfig(ncr) {
  if (!ncr) {
    return { xmlVersion: 1.0, onLevel: NCR_LEVEL.allow, nullLevel: NCR_LEVEL.remove };
  }
  const xmlVersion = ncr.xmlVersion === 1.1 ? 1.1 : 1.0;
  const onLevel = NCR_LEVEL[ncr.onNCR] ?? NCR_LEVEL.allow;
  const nullLevel = NCR_LEVEL[ncr.nullNCR] ?? NCR_LEVEL.remove;
  // 'allow' is not meaningful for null — clamp to at least 'remove'
  const clampedNull = Math.max(nullLevel, NCR_LEVEL.remove);
  return { xmlVersion, onLevel, nullLevel: clampedNull };
}

// ---------------------------------------------------------------------------
// EntityReplacer
// ---------------------------------------------------------------------------

/**
 * Single-pass, zero-regex entity replacer for XML/HTML content.
 *
 * Algorithm: scan the string once for '&', read to ';', resolve via map
 * or direct codepoint conversion, build output chunks, join once at the end.
 *
 * Entity lookup priority (highest → lowest):
 *   1. input / runtime  (DOCTYPE entities for current document)
 *   2. persistent external (survive across documents)
 *   3. base named map   (DEFAULT_XML_ENTITIES + user-supplied namedEntities)
 *
 * Both input and external resolve as the 'external' tier for limit purposes.
 * Base map entities resolve as the 'base' tier.
 *
 * Numeric / hex references (&#NNN; / &#xHH;) are resolved directly via
 * String.fromCodePoint() — no map needed. They count as 'base' tier.
 *
 * @example
 * const replacer = new EntityReplacer({ namedEntities: COMMON_HTML });
 * replacer.setExternalEntities({ brand: 'Acme' });
 *
 * const instance = replacer.reset();
 * instance.addInputEntities({ version: '1.0' });
 * instance.encode('&brand; v&version; &lt;'); // 'Acme v1.0 <'
 */
class EntityDecoder {
  /**
   * @param {object} [options]
   * @param {object|null}  [options.namedEntities]        — extra named entities merged into base map
   * @param {object}  [options.limit]                 — security limits
   * @param {number}       [options.limit.maxTotalExpansions=0]  — 0 = unlimited
   * @param {number}       [options.limit.maxExpandedLength=0]   — 0 = unlimited
   * @param {'external'|'base'|'all'|string[]} [options.limit.applyLimitsTo='external']
   *   Which entity tiers count against the security limits:
   *   - 'external' (default) — only input/runtime + persistent external entities
   *   - 'base'               — only DEFAULT_XML_ENTITIES + namedEntities
   *   - 'all'                — every entity regardless of tier
   *   - string[]             — explicit combination, e.g. ['external', 'base']
   * @param {((resolved: string, original: string) => string)|null} [options.postCheck=null]
   * @param {string[]} [options.remove=[]] — entity names (e.g. ['nbsp', '#13']) to delete (replace with empty string)
   * @param {string[]} [options.leave=[]]  — entity names to keep as literal (unchanged in output)
   * @param {object}   [options.ncr]       — Numeric Character Reference controls
   * @param {1.0|1.1}  [options.ncr.xmlVersion=1.0]
   *   XML version governing which codepoint ranges are restricted:
   *   - 1.0 — C0 controls U+0001–U+001F (except U+0009/000A/000D) are prohibited
   *   - 1.1 — C0 controls are allowed when written as NCRs; C1 (U+007F–U+009F) decoded as-is
   * @param {'allow'|'leave'|'remove'|'throw'} [options.ncr.onNCR='allow']
   *   Base action for numeric references. Severity order: allow < leave < remove < throw.
   *   For codepoint ranges that carry a minimum level (surrogates → remove, XML 1.0 C0 → remove),
   *   the effective action is max(onNCR, rangeMinimum).
   * @param {'remove'|'throw'} [options.ncr.nullNCR='remove']
   *   Action for U+0000 (null). 'allow' and 'leave' are clamped to 'remove' since null is never safe.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onExternalEntity=null]
   *   Hook called when an external entity is registered via `setExternalEntities()` or
   *   `addExternalEntity()`. Return `ENTITY_ACTION.ALLOW` to accept the entity,
   *   `ENTITY_ACTION.BLOCK` to silently skip it, or `ENTITY_ACTION.THROW` to abort with an error.
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} [options.onInputEntity=null]
   *   Hook called when an input entity is registered via `addInputEntities()`. Return
   *   `ENTITY_ACTION.ALLOW` to accept, `ENTITY_ACTION.BLOCK` to silently skip, or
   *   `ENTITY_ACTION.THROW` to abort with an error.
   */
  constructor(options = {}) {
    this._limit = options.limit || {};
    this._maxTotalExpansions = this._limit.maxTotalExpansions || 0;
    this._maxExpandedLength = this._limit.maxExpandedLength || 0;
    this._postCheck = typeof options.postCheck === 'function' ? options.postCheck : r => r;
    this._limitTiers = parseLimitTiers(this._limit.applyLimitsTo ?? LIMIT_TIER_EXTERNAL);
    this._numericAllowed = options.numericAllowed ?? true;
    // Base map: DEFAULT_XML_ENTITIES + user-supplied extras. Immutable after construction.
    this._baseMap = mergeEntityMaps(XML, options.namedEntities || null);

    // Persistent external entities — survive across documents.
    // Stored as a separate map so reset() never touches them.
    /** @type {Record<string, string>} */
    this._externalMap = Object.create(null);

    // Input / runtime entities — current document only, wiped on reset().
    /** @type {Record<string, string>} */
    this._inputMap = Object.create(null);

    // Per-document counters
    this._totalExpansions = 0;
    this._expandedLength = 0;

    // --- New: remove / leave sets ---
    /** @type {Set<string>} */
    this._removeSet = new Set(options.remove && Array.isArray(options.remove) ? options.remove : []);
    /** @type {Set<string>} */
    this._leaveSet = new Set(options.leave && Array.isArray(options.leave) ? options.leave : []);

    // --- NCR config (parsed into flat fields for hot-path speed) ---
    const ncrCfg = parseNCRConfig(options.ncr);
    this._ncrXmlVersion = ncrCfg.xmlVersion;
    this._ncrOnLevel = ncrCfg.onLevel;
    this._ncrNullLevel = ncrCfg.nullLevel;

    // --- Registration hooks ---
    /** @type {((name: string, value: string) => 'allow'|'block'|'throw')|null} */
    this._onExternalEntity = typeof options.onExternalEntity === 'function'
      ? options.onExternalEntity
      : null;
    /** @type {((name: string, value: string) => 'allow'|'block'|'throw')|null} */
    this._onInputEntity = typeof options.onInputEntity === 'function'
      ? options.onInputEntity
      : null;
  }

  // -------------------------------------------------------------------------
  // Private: registration hook dispatch
  // -------------------------------------------------------------------------

  /**
   * Invoke a registration hook for a single entity name/value pair.
   * Returns true when the entity should be accepted, false when it should be
   * silently skipped (BLOCK), and throws when the hook returns THROW.
   *
   * @param {((name: string, value: string) => 'allow'|'block'|'throw')|null} hook
   * @param {string} name
   * @param {string} value
   * @param {string} context  — used in error messages ('external' | 'input')
   * @returns {boolean}  true = accept, false = skip
   */
  _applyRegistrationHook(hook, name, value, context) {
    if (!hook) return true; // no hook → always accept
    const action = hook(name, value);
    if (action === ENTITY_ACTION.BLOCK) return false;
    if (action === ENTITY_ACTION.THROW) {
      throw new Error(
        `[EntityDecoder] Registration of ${context} entity "&${name};" was rejected by hook`
      );
    }
    return true; // ALLOW or any unknown return value → accept
  }

  // -------------------------------------------------------------------------
  // Persistent external entity registration
  // -------------------------------------------------------------------------

  /**
   * Replace the full set of persistent external entities.
   * All keys are validated — throws on invalid characters.
   * If `onExternalEntity` is set, it is called once per entry; entries that
   * return `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW`
   * aborts the whole call.
   * @param {Record<string, string | { regex?: RegExp, val: string }>} map
   */
  setExternalEntities(map) {
    if (map) {
      for (const key of Object.keys(map)) {
        EntityDecoder_validateEntityName(key);
      }
    }
    if (!this._onExternalEntity) {
      this._externalMap = mergeEntityMaps(map);
      return;
    }
    // Hook present — resolve values first, then filter
    const flat = mergeEntityMaps(map);
    const filtered = Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onExternalEntity, name, value, 'external')) {
        filtered[name] = value;
      }
    }
    this._externalMap = filtered;
  }

  /**
   * Add a single persistent external entity.
   * If `onExternalEntity` is set it is called before the entity is stored;
   * `ENTITY_ACTION.BLOCK` silently skips storage, `ENTITY_ACTION.THROW` raises.
   * @param {string} key
   * @param {string} value
   */
  addExternalEntity(key, value) {
    EntityDecoder_validateEntityName(key);
    if (typeof value === 'string' && value.indexOf('&') === -1) {
      if (this._applyRegistrationHook(this._onExternalEntity, key, value, 'external')) {
        this._externalMap[key] = value;
      }
    }
  }

  // -------------------------------------------------------------------------
  // Input / runtime entity registration (per document)
  // -------------------------------------------------------------------------

  /**
   * Inject DOCTYPE entities for the current document.
   * Also resets per-document expansion counters.
   * If `onInputEntity` is set it is called once per entry; entries returning
   * `ENTITY_ACTION.BLOCK` are silently omitted, `ENTITY_ACTION.THROW` aborts.
   * @param {Record<string, string | { regx?: RegExp, regex?: RegExp, val: string }>} map
   */
  addInputEntities(map) {
    this._totalExpansions = 0;
    this._expandedLength = 0;
    if (!this._onInputEntity) {
      this._inputMap = mergeEntityMaps(map);
      return;
    }
    const flat = mergeEntityMaps(map);
    const filtered = Object.create(null);
    for (const [name, value] of Object.entries(flat)) {
      if (this._applyRegistrationHook(this._onInputEntity, name, value, 'input')) {
        filtered[name] = value;
      }
    }
    this._inputMap = filtered;
  }

  // -------------------------------------------------------------------------
  // Per-document reset
  // -------------------------------------------------------------------------

  /**
   * Wipe input/runtime entities and reset counters.
   * Call this before processing each new document.
   * @returns {this}
   */
  reset() {
    this._inputMap = Object.create(null);
    this._totalExpansions = 0;
    this._expandedLength = 0;
    return this;
  }

  // -------------------------------------------------------------------------
  // XML version (can be set after construction, e.g. once parser reads <?xml?>)
  // -------------------------------------------------------------------------

  /**
   * Update the XML version used for NCR classification.
   * Call this as soon as the document's `<?xml version="...">` declaration is parsed.
   * @param {1.0|1.1|number} version
   */
  setXmlVersion(version) {
    this._ncrXmlVersion = version === 1.1 ? 1.1 : 1.0;
  }

  // -------------------------------------------------------------------------
  // Primary API
  // -------------------------------------------------------------------------

  /**
   * Replace all entity references in `str` in a single pass.
   *
   * @param {string} str
   * @returns {string}
   */
  decode(str) {
    if (typeof str !== 'string' || str.length === 0) return str;
    //TODO: check if needed
    if (str.indexOf('&') === -1) return str; // fast path — no entities at all

    const original = str;
    const chunks = [];
    const len = str.length;
    let last = 0; // start of next unprocessed literal chunk
    let i = 0;

    const limitExpansions = this._maxTotalExpansions > 0;
    const limitLength = this._maxExpandedLength > 0;
    const checkLimits = limitExpansions || limitLength;

    while (i < len) {
      // Scan forward to next '&'
      if (str.charCodeAt(i) !== 38 /* '&' */) { i++; continue; }

      // --- Found '&' at position i ---

      // Scan forward to ';'
      let j = i + 1;
      while (j < len && str.charCodeAt(j) !== 59 /* ';' */ && (j - i) <= 32) j++;

      if (j >= len || str.charCodeAt(j) !== 59) {
        // No closing ';' within window — treat '&' as literal
        i++;
        continue;
      }

      // Raw token between '&' and ';' (exclusive)
      const token = str.slice(i + 1, j);
      if (token.length === 0) { i++; continue; }

      let replacement;
      let tier; // which limit tier this entity belongs to

      if (this._removeSet.has(token)) {
        // Remove entity: replace with empty string
        replacement = '';
        // If entity was unknown (replacement undefined), we still need a tier for limits.
        // Treat as external tier because it's user-directed removal of an unknown reference.
        if (tier === undefined) {
          tier = LIMIT_TIER_EXTERNAL;
        }
      } else if (this._leaveSet.has(token)) {
        // Do not replace — keep original &token; as literal
        i++;
        continue;
      } else if (token.charCodeAt(0) === 35 /* '#' */) {
        // ---- Numeric / NCR reference ----
        // NCR classification always runs first — prohibited codepoints must be
        // caught regardless of numericAllowed.
        const ncrResult = this._resolveNCR(token);
        if (ncrResult === undefined) {
          // 'leave' action — keep original &token; as-is
          i++;
          continue;
        }
        replacement = ncrResult; // '' for remove, char string for allow
        tier = LIMIT_TIER_BASE;
      } else {
        // ---- Named reference ----
        const resolved = this._resolveName(token);
        replacement = resolved?.value;
        tier = resolved?.tier;
      }

      if (replacement === undefined) {
        // Unknown entity — leave as-is, advance past '&' only
        i++;
        continue;
      }

      // Flush literal chunk before this entity
      if (i > last) chunks.push(str.slice(last, i));
      chunks.push(replacement);
      last = j + 1; // skip past ';'
      i = last;

      // Apply expansion limits only if this tier is being tracked
      if (checkLimits && this._tierCounts(tier)) {
        if (limitExpansions) {
          this._totalExpansions++;
          if (this._totalExpansions > this._maxTotalExpansions) {
            throw new Error(
              `[EntityReplacer] Entity expansion count limit exceeded: ` +
              `${this._totalExpansions} > ${this._maxTotalExpansions}`
            );
          }
        }
        if (limitLength) {
          // delta: replacement.length minus the raw &token; length (token.length + 2 for '&' and ';')
          const delta = replacement.length - (token.length + 2);
          if (delta > 0) {
            this._expandedLength += delta;
            if (this._expandedLength > this._maxExpandedLength) {
              throw new Error(
                `[EntityReplacer] Expanded content length limit exceeded: ` +
                `${this._expandedLength} > ${this._maxExpandedLength}`
              );
            }
          }
        }
      }
    }

    // Flush trailing literal
    if (last < len) chunks.push(str.slice(last));

    // If nothing was replaced, chunks is empty — return original
    const result = chunks.length === 0 ? str : chunks.join('');

    return this._postCheck(result, original);
  }

  // -------------------------------------------------------------------------
  // Private: limit tier check
  // -------------------------------------------------------------------------

  /**
   * Returns true if a resolved entity of the given tier should count
   * against the expansion/length limits.
   * @param {string} tier  — LIMIT_TIER_EXTERNAL | LIMIT_TIER_BASE
   * @returns {boolean}
   */
  _tierCounts(tier) {
    if (this._limitTiers.has(LIMIT_TIER_ALL)) return true;
    return this._limitTiers.has(tier);
  }

  // -------------------------------------------------------------------------
  // Private: entity resolution
  // -------------------------------------------------------------------------

  /**
   * Resolve a named entity token (without & and ;).
   * Priority: inputMap > externalMap > baseMap
   * Returns the resolved value tagged with its limit tier.
   *
   * @param {string} name
   * @returns {{ value: string, tier: string }|undefined}
   */
  _resolveName(name) {
    // input and external both count as 'external' tier for limit purposes —
    // they are injected at runtime and are the untrusted surface.
    if (name in this._inputMap) return { value: this._inputMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._externalMap) return { value: this._externalMap[name], tier: LIMIT_TIER_EXTERNAL };
    if (name in this._baseMap) return { value: this._baseMap[name], tier: LIMIT_TIER_BASE };
    return undefined;
  }

  /**
   * Classify a codepoint and return the minimum action level that must be applied.
   * Returns -1 when no minimum is imposed (normal allow path).
   *
   * Ranges checked (in priority order):
   *   1. U+0000            — null, governed by nullNCR (always ≥ remove)
   *   2. U+D800–U+DFFF     — surrogates, always prohibited (min: remove)
   *   3. U+0001–U+001F \ {0x09,0x0A,0x0D}  — XML 1.0 restricted C0 (min: remove)
   *      (skipped in XML 1.1 — C0 controls are allowed when written as NCRs)
   *
   * @param {number} cp  — codepoint
   * @returns {number}   — minimum NCR_LEVEL value, or -1 for no restriction
   */
  _classifyNCR(cp) {
    // 1. Null
    if (cp === 0) return this._ncrNullLevel;

    // 2. Surrogates — always prohibited, minimum 'remove'
    if (cp >= 0xD800 && cp <= 0xDFFF) return NCR_LEVEL.remove;

    // 3. XML 1.0 restricted C0 controls
    if (this._ncrXmlVersion === 1.0) {
      if (cp >= 0x01 && cp <= 0x1F && !XML10_ALLOWED_C0.has(cp)) return NCR_LEVEL.remove;
    }

    return -1; // no restriction
  }

  /**
   * Execute a resolved NCR action.
   *
   * @param {number} action   — NCR_LEVEL value
   * @param {string} token    — raw token (e.g. '#38') for error messages
   * @param {number} cp       — codepoint, used only for error messages
   * @returns {string|undefined}
   *   - decoded character string  → 'allow'
   *   - ''                        → 'remove'
   *   - undefined                 → 'leave' (caller must skip past '&' only)
   *   - throws Error              → 'throw'
   */
  _applyNCRAction(action, token, cp) {
    switch (action) {
      case NCR_LEVEL.allow: return String.fromCodePoint(cp);
      case NCR_LEVEL.remove: return '';
      case NCR_LEVEL.leave: return undefined; // signal: keep literal
      case NCR_LEVEL.throw:
        throw new Error(
          `[EntityDecoder] Prohibited numeric character reference ` +
          `&${token}; (U+${cp.toString(16).toUpperCase().padStart(4, '0')})`
        );
      default: return String.fromCodePoint(cp);
    }
  }

  /**
   * Full NCR resolution pipeline for a numeric token.
   *
   * Steps:
   *   1. Parse the codepoint (decimal or hex).
   *   2. Validate the raw codepoint range (NaN, <0, >0x10FFFF).
   *   3. If numericAllowed is false and no minimum restriction applies → leave as-is.
   *   4. Classify the codepoint to find the minimum required action level.
   *   5. Resolve effective action = max(onNCR, minimum).
   *   6. Apply and return.
   *
   * @param {string} token  — e.g. '#38', '#x26', '#X26'
   * @returns {string|undefined}
   *   - string (incl. '')  — replacement ('' = remove)
   *   - undefined          — leave original &token; as-is
   */
  _resolveNCR(token) {
    // Step 1: parse codepoint
    const second = token.charCodeAt(1);
    let cp;
    if (second === 120 /* x */ || second === 88 /* X */) {
      cp = parseInt(token.slice(2), 16);
    } else {
      cp = parseInt(token.slice(1), 10);
    }

    // Step 2: out-of-range → leave as-is unconditionally
    if (Number.isNaN(cp) || cp < 0 || cp > 0x10FFFF) return undefined;

    // Step 3: classify to get minimum action level
    const minimum = this._classifyNCR(cp);

    // Step 4: if numericAllowed is false and no hard minimum → leave
    if (!this._numericAllowed && minimum < NCR_LEVEL.remove) return undefined;

    // Step 5: effective action = max(configured onNCR, range minimum)
    const effective = minimum === -1
      ? this._ncrOnLevel
      : Math.max(this._ncrOnLevel, minimum);

    // Step 6: apply
    return this._applyNCRAction(effective, token, cp);
  }
}
;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/sql.js
/**
 * SQL context patterns — high-precision rules only.
 *
 * These rules have very low false-positive risk and are safe to apply to
 * general user text (names, descriptions, search queries, etc.).
 * All patterns are ReDoS-safe — unlike the `sql-injection` npm package
 * which has an active CVE on its own detection regexes.
 *
 * For exhaustive coverage including noisier heuristics (comment sequences,
 * hex literals, stacked queries with semicolons), use 'SQL-STRICT' instead.
 * Apply 'SQL-STRICT' only to strings that are specifically SQL fragments,
 * not to general free-text fields.
 */

const SQL_PATTERNS = [
  {
    id: 'sql-block-comment-open',
    description: 'SQL block comment open: /* ... */ — unusual in legitimate user text',
    pattern: /\/\*/,
  },
  {
    id: 'sql-union-select',
    description: 'UNION SELECT — most common SQL injection aggregation attack',
    pattern: /\bUNION\s{1,20}(?:ALL\s{1,20})?SELECT\b/i,
  },
  {
    id: 'sql-drop-table',
    description: 'DROP TABLE — destructive DDL injection',
    pattern: /\bDROP\s{1,20}TABLE\b/i,
  },
  {
    id: 'sql-drop-database',
    description: 'DROP DATABASE — destructive DDL injection',
    pattern: /\bDROP\s{1,20}DATABASE\b/i,
  },
  {
    id: 'sql-insert-into',
    description: 'INSERT INTO — data injection',
    pattern: /\bINSERT\s{1,20}INTO\b/i,
  },
  {
    id: 'sql-delete-from',
    description: 'DELETE FROM — data deletion injection',
    pattern: /\bDELETE\s{1,20}FROM\b/i,
  },
  {
    id: 'sql-update-set',
    description: 'UPDATE ... SET — data modification injection',
    // Allows arbitrary content between UPDATE and SET (table name, alias, etc.)
    pattern: /\bUPDATE\b[\s\S]{1,60}\bSET\b/i,
  },
  {
    id: 'sql-exec-xp',
    description: 'EXEC xp_ — MSSQL extended stored procedure execution',
    pattern: /\bEXEC(?:UTE)?\s{1,20}xp_/i,
  },
  {
    id: 'sql-tautology-string',
    description: "Classic string tautology: ' OR '1'='1 or \" OR \"1\"=\"1\"",
    // Last quote is optional — injection may truncate it: ' OR '1'='1--
    pattern: /'\s{0,10}OR\s{0,10}'[^']{0,20}'\s*=\s*'[^']{0,20}/i,
  },
  {
    id: 'sql-tautology-numeric',
    description: 'Numeric tautology: OR 1=1',
    pattern: /\bOR\s{1,10}1\s*=\s*1\b/i,
  },
  {
    id: 'sql-always-true-zero',
    description: 'Numeric tautology: OR 0=0',
    pattern: /\bOR\s{1,10}0\s*=\s*0\b/i,
  },
  {
    id: 'sql-sleep-benchmark',
    description: 'Time-based blind injection: SLEEP() or BENCHMARK()',
    pattern: /\b(?:SLEEP|BENCHMARK)\s*\(/i,
  },
  {
    id: 'sql-waitfor-delay',
    description: 'MSSQL time-based blind injection: WAITFOR DELAY',
    pattern: /\bWAITFOR\s{1,20}DELAY\b/i,
  },
  {
    id: 'sql-char-function',
    description: 'CHAR() function — used to obfuscate injected strings',
    pattern: /\bCHAR\s*\(\s*\d{1,3}/i,
  },
  {
    id: 'sql-information-schema',
    description: 'INFORMATION_SCHEMA — reconnaissance query for table/column enumeration',
    pattern: /\bINFORMATION_SCHEMA\b/i,
  },
];

/* harmony default export */ const sql = (SQL_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/sql-strict.js
/**
 * SQL-STRICT context patterns.
 *
 * Extends the base 'SQL' context with three additional rules that are
 * effective at detecting real injections but carry a higher false-positive
 * risk on general free-text input.
 *
 * Use 'SQL-STRICT' when:
 *   - The string is specifically a SQL fragment or database identifier
 *   - You control the input domain (e.g. a dedicated SQL search field)
 *   - You can tolerate occasional false positives in exchange for broader coverage
 *
 * Use 'SQL' (not STRICT) when:
 *   - The field is general user text (names, descriptions, comments)
 *   - False positives would block legitimate content (e.g. "see note -- above")
 *
 * Rules moved here from 'SQL' due to false-positive risk:
 *
 *   sql-line-comment   — "--" fires on "see note -- above", "value--", CSS var(--primary)
 *   sql-stacked-query  — "; SELECT" fires on legitimate prose with semicolons + SQL words
 *   sql-hex-encoding   — "0xDEAD" fires on hex values in technical docs and log output
 */



const SQL_STRICT_EXTRA = [
  {
    id: 'sql-line-comment',
    description: 'SQL line comment: -- followed by whitespace or end of string',
    pattern: /--(?:\s|$)/,
  },
  {
    id: 'sql-stacked-query',
    description: 'Stacked queries: semicolon immediately followed by a SQL keyword',
    pattern: /;\s{0,10}(?:SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b/i,
  },
  {
    id: 'sql-hex-encoding',
    description: 'Hex-encoded string injection: 0x41414141 style (MySQL)',
    pattern: /\b0x[0-9a-f]{4,}/i,
  },
];

// SQL-STRICT = all base SQL rules + the three noisy extras
const SQL_STRICT_PATTERNS = [...sql, ...SQL_STRICT_EXTRA];

/* harmony default export */ const sql_strict = (SQL_STRICT_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/html.js
/**
 * HTML context patterns.
 *
 * Detects XSS vectors that are dangerous when a string ends up rendered as HTML.
 * All patterns use bounded quantifiers to ensure linear-time matching (ReDoS-safe).
 *
 * Each entry is { pattern: RegExp, id: string, description: string }
 * so callers can inspect which rule fired if they need to.
 */

const HTML_PATTERNS = [
  {
    id: 'html-script-open',
    description: '<script opening tag',
    pattern: /<script[\s>/]/i,
  },
  {
    id: 'html-script-close',
    description: '</script closing tag',
    pattern: /<\/script[\s>]/i,
  },
  {
    id: 'html-javascript-protocol',
    description: 'javascript: URI scheme (with optional whitespace/encoding)',
    // Handles j&#x61;vascript:, j\u0061vascript:, and whitespace variants
    pattern: /j[\t\n\r ]*a[\t\n\r ]*v[\t\n\r ]*a[\t\n\r ]*s[\t\n\r ]*c[\t\n\r ]*r[\t\n\r ]*i[\t\n\r ]*p[\t\n\r ]*t[\t\n\r ]*:/i,
  },
  {
    id: 'html-vbscript-protocol',
    description: 'vbscript: URI scheme',
    pattern: /vbscript[\t\n\r ]*:/i,
  },
  {
    id: 'html-data-html',
    description: 'data:text/html URI — can execute scripts in browsers',
    pattern: /data[\t\n\r ]*:[\t\n\r ]*text\/html/i,
  },
  {
    id: 'html-data-xhtml',
    description: 'data:application/xhtml+xml URI',
    pattern: /data[\t\n\r ]*:[\t\n\r ]*application\/xhtml/i,
  },
  {
    id: 'html-data-svg',
    description: 'data:image/svg+xml URI — can execute scripts',
    pattern: /data[\t\n\r ]*:[\t\n\r ]*image\/svg\+xml/i,
  },
  {
    id: 'html-inline-event-handler',
    description: 'Inline event handler attributes: onclick=, onerror=, onload=, etc.',
    // \bon ensures we match a word boundary so "phonetic=" is not caught
    pattern: /\bon\w{1,30}\s*=/i,
  },
  {
    id: 'html-entity-obfuscated-script',
    description: 'HTML-entity-encoded <script (e.g. &#x3C;script or &lt;script)',
    // Entities include optional trailing semicolon: &#x3C; or &#x3C (both valid in HTML5)
    pattern: /(?:&#x0*3[Cc];?|&#0*60;?|&lt;)\s*script/i,
  },
  {
    id: 'html-entity-obfuscated-javascript',
    description: 'HTML-entity-encoded javascript: (partial — catches common &#106; or &#x6a; for "j")',
    pattern: /(?:&#x0*6[Aa];?|&#0*106;?)\s*(?:&#x0*61;?|a)[\s\S]{0,80}script\s*:/i,
  },
  {
    id: 'html-style-expression',
    description: 'CSS expression() — IE-era code execution in style attributes',
    pattern: /style[\s\S]{0,20}expression\s*\(/i,
  },
  {
    id: 'html-object-embed',
    description: '<object or <embed tags that can load active content',
    pattern: /<(?:object|embed)[\s>/]/i,
  },
  {
    id: 'html-base-tag',
    description: '<base href= — can hijack all relative URLs on a page',
    pattern: /<base[\s>]/i,
  },
  {
    id: 'html-meta-refresh',
    description: '<meta http-equiv="refresh" — can redirect users',
    pattern: /<meta[\s\S]{0,40}http-equiv[\s\S]{0,20}refresh/i,
  },
  {
    id: 'html-srcdoc',
    description: 'srcdoc= attribute on iframes — embeds HTML that can run scripts',
    pattern: /srcdoc\s*=/i,
  },
  {
    id: 'html-iframe',
    description: '<iframe tag',
    pattern: /<iframe[\s>/]/i,
  },
  {
    id: 'html-form',
    description: '<form tag — can be used for phishing / credential harvesting injection',
    pattern: /<form[\s>/]/i,
  },
];

/* harmony default export */ const html = (HTML_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/xml.js
/**
 * XML context patterns.
 *
 * Detects injection vectors that are specifically dangerous when a string
 * is inserted into an XML document (not HTML rendering context).
 *
 * Key distinction from HTML: these patterns target parser-level attacks —
 * things that can confuse or subvert an XML parser, trigger external entity
 * resolution, or inject DTD content. HTML rendering concerns (XSS) belong
 * in the HTML context.
 */

const XML_PATTERNS = [
  {
    id: 'xml-cdata-injection',
    description: 'CDATA section injection: <![CDATA[ breaks out of text node context',
    pattern: /<!\[CDATA\[/i,
  },
  {
    id: 'xml-cdata-close',
    description: 'CDATA close sequence: ]]> can terminate an enclosing CDATA section',
    pattern: /\]\]>/,
  },
  {
    id: 'xml-processing-instruction',
    description: 'XML processing instruction: <?xml-stylesheet or <?php etc.',
    pattern: /<\?(?:xml[\- ]|php|asp)/i,
  },
  {
    id: 'xml-doctype-injection',
    description: 'DOCTYPE declaration embedded in content — can define entities',
    // Match <!DOCTYPE followed by end-of-string, whitespace, or [ (internal subset)
    pattern: /<!DOCTYPE(?:[\s[]|$)/i,
  },
  {
    id: 'xml-entity-system',
    description: 'SYSTEM keyword — used in external entity declarations (XXE)',
    pattern: /\bSYSTEM\s+["']/i,
  },
  {
    id: 'xml-entity-public',
    description: 'PUBLIC keyword — used in external entity declarations (XXE)',
    pattern: /\bPUBLIC\s+["']/i,
  },
  {
    id: 'xml-entity-declaration',
    description: '<!ENTITY declaration — defines entities, potential XXE or entity expansion',
    pattern: /<!ENTITY[\s%]/i,
  },
  {
    id: 'xml-billion-laughs',
    description: 'Entity reference chaining / billion laughs: repeated &eX; style references',
    // Heuristic: 3+ consecutive entity refs suggests expansion attack
    pattern: /(?:&\w{1,20};){3,}/,
  },
  {
    id: 'xml-namespace-confusion',
    description: 'xmlns: attribute injection — can redefine namespaces to confuse parsers',
    pattern: /\bxmlns\s*(?::\w{1,40})?\s*=/i,
  },
  {
    id: 'xml-comment-injection',
    description: '<!-- comment injection — can hide content from some parsers',
    pattern: /<!--/,
  },
  {
    id: 'xml-comment-close',
    description: '--> closes an enclosing XML comment',
    pattern: /--!?>/,
  },
  {
    id: 'xml-pi-close',
    description: '?> closes an enclosing processing instruction',
    pattern: /\?>/,
  },
];

/* harmony default export */ const xml = (XML_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/svg.js
/**
 * SVG context patterns.
 *
 * SVG is XML-based but renders in browsers, giving it a unique attack surface
 * that combines XML parser behaviour with browser rendering and JavaScript execution.
 *
 * Many of these vectors bypass HTML sanitizers that don't understand SVG semantics
 * (DOMPurify has documented bypass vulnerabilities specifically in SVG/XML context).
 */

const SVG_PATTERNS = [
  {
    id: 'svg-script-element',
    description: '<script element inside SVG executes JavaScript',
    pattern: /<script[\s>/]/i,
  },
  {
    id: 'svg-xlink-href-javascript',
    description: 'xlink:href with javascript: — classic SVG XSS via <a> or <use>',
    pattern: /xlink\s*:\s*href\s*=\s*["']?\s*javascript\s*:/i,
  },
  {
    id: 'svg-href-javascript',
    description: 'href= with javascript: in SVG context (<a>, <animate>, etc.)',
    pattern: /href\s*=\s*["']?\s*javascript\s*:/i,
  },
  {
    id: 'svg-foreignobject',
    description: '<foreignObject embeds HTML inside SVG — can execute scripts',
    pattern: /<foreignObject[\s>/]/i,
  },
  {
    id: 'svg-use-external',
    description: '<use xlink:href or href pointing to external resource (non-fragment URL)',
    // Match <use with href= where the value starts with a non-# character (external URL)
    // [\"'][^#] catches quoted values not starting with #; [^\"'#\s>] catches unquoted
    pattern: /<use[\s\S]{0,60}(?:xlink\s*:\s*)?href\s*=\s*(?:["'][^#]|[^"'#\s>])/i,
  },
  {
    id: 'svg-animate-href',
    description: '<animate attributeName="href" — can dynamically change href to javascript:',
    pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*href["']/i,
  },
  {
    id: 'svg-animate-xlinkhref',
    description: '<animate attributeName="xlink:href"',
    pattern: /<animate[\s\S]{0,80}attributeName\s*=\s*["'][\s]*xlink\s*:\s*href["']/i,
  },
  {
    id: 'svg-set-javascript',
    description: '<set to="javascript:..." — sets an attribute to a javascript: URI',
    pattern: /<set[\s\S]{0,80}to\s*=\s*["']?\s*javascript\s*:/i,
  },
  {
    id: 'svg-event-handler',
    description: 'SVG-specific event handler attributes: onload=, onerror=, onactivate=, etc.',
    pattern: /\bon(?:load|error|activate|begin|end|repeat|focus|blur|click|mouse\w{1,20}|key\w{1,20})\s*=/i,
  },
  {
    id: 'svg-handler-generic',
    description: 'Generic on* handler catch-all for SVG attributes',
    pattern: /\bon\w{1,30}\s*=/i,
  },
  {
    id: 'svg-filter-feimage',
    description: '<feImage href= — filter primitive that can load external resources',
    pattern: /<feImage[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=/i,
  },
  {
    id: 'svg-image-external',
    description: '<image xlink:href with http/https or javascript protocol',
    pattern: /<image[\s\S]{0,80}(?:xlink\s*:\s*)?href\s*=\s*["']?\s*(?:https?|javascript)\s*:/i,
  },
  {
    id: 'svg-style-javascript',
    description: 'style= attribute containing javascript: (e.g. background:url(javascript:...))',
    pattern: /style\s*=[\s\S]{0,60}javascript\s*:/i,
  },
];

/* harmony default export */ const svg = (SVG_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/shell.js
/**
 * SHELL context patterns.
 *
 * Detects shell injection vectors and path traversal patterns.
 * Designed for use when a string will be passed to a shell command,
 * used as a file path, or interpolated into OS-level operations.
 */

const SHELL_PATTERNS = [
  {
    id: 'shell-path-traversal-unix',
    description: 'Unix path traversal: ../  — climbing the directory tree',
    pattern: /\.\.\//,
  },
  {
    id: 'shell-path-traversal-windows',
    description: 'Windows path traversal: ..\\ — climbing the directory tree',
    pattern: /\.\.\\/,
  },
  {
    id: 'shell-path-traversal-encoded',
    description: 'URL-encoded path traversal: %2e%2e or %2f variants',
    pattern: /%2e%2e|%2f\.\.|\.\.%2f/i,
  },
  {
    id: 'shell-null-byte',
    description: 'Null byte injection: \\x00 or %00 — truncates strings in C-backed functions',
    pattern: /\x00|%00/,
  },
  {
    id: 'shell-semicolon',
    description: 'Semicolon command separator: cmd1; cmd2',
    pattern: /;/,
  },
  {
    id: 'shell-pipe',
    description: 'Pipe operator: cmd1 | cmd2',
    pattern: /\|/,
  },
  {
    id: 'shell-and-operator',
    description: 'AND operator: cmd1 && cmd2',
    pattern: /&&/,
  },
  {
    id: 'shell-or-operator',
    description: 'OR operator: cmd1 || cmd2',
    pattern: /\|\|/,
  },
  {
    id: 'shell-backtick',
    description: 'Backtick command substitution: `cmd`',
    pattern: /`/,
  },
  {
    id: 'shell-dollar-paren',
    description: 'Dollar-paren command substitution: $(cmd)',
    pattern: /\$\(/,
  },
  {
    id: 'shell-dollar-brace',
    description: 'Dollar-brace variable expansion: ${var} — can be abused for injection',
    pattern: /\$\{/,
  },
  {
    id: 'shell-redirect-out',
    description: 'Output redirection: cmd > file or cmd >> file',
    pattern: />{1,2}/,
  },
  {
    id: 'shell-redirect-in',
    description: 'Input redirection: cmd < file',
    pattern: /</,
  },
  {
    id: 'shell-newline-injection',
    description: 'Newline injection: \\n or \\r — can inject new shell commands',
    pattern: /[\n\r]/,
  },
  {
    id: 'shell-glob-star',
    description: 'Glob expansion: * or ? — can expand to unintended files',
    // Only flag when combined with path separators to reduce false positives
    pattern: /[/\\][*?]/,
  },
  {
    id: 'shell-absolute-root',
    description: 'Absolute root path injection: string starting with / or \\ (Windows UNC)',
    pattern: /^(?:\/|\\\\)/,
  },
  {
    id: 'shell-windows-drive',
    description: 'Windows drive letter path injection: C:\\ or D:/',
    pattern: /^[a-zA-Z]:[/\\]/,
  },
  {
    id: 'shell-curl-wget',
    description: 'curl/wget with URL or flags — can exfiltrate data or download payloads',
    // Require a URL scheme (http/https/ftp) or a flag (-) to reduce false positives
    // "curl is a tool" won't match; "curl http://..." or "curl -s ..." will
    pattern: /\b(?:curl|wget)\s+(?:https?:\/\/|ftp:\/\/|-)/i,
  },
];

/* harmony default export */ const shell = (SHELL_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/redos.js
/**
 * REDOS context patterns.
 *
 * Detects strings that, if used as regular expressions, could cause
 * catastrophic backtracking (ReDoS — Regular Expression Denial of Service).
 *
 * These patterns detect the structural forms that lead to exponential or
 * polynomial backtracking in NFA-based regex engines (V8, PCRE, Java, etc.).
 *
 * Use this context when user-supplied strings will be compiled into RegExp objects.
 */

const REDOS_PATTERNS = [
  {
    id: 'redos-nested-quantifier-plus',
    description: 'Nested + quantifier inside a group with outer quantifier: (a+)+, (.+b)*, etc.',
    // Matches any group containing a + quantifier, with an outer * or + — catches (a+)+, (.+b)*, etc.
    pattern: /\([^)]*\+[^)]*\)[+*]/,
  },
  {
    id: 'redos-nested-quantifier-star',
    description: 'Nested * quantifier: (a*)* or (a*)+ — catastrophic backtracking',
    pattern: /\([^)]*\*[^)]*\)[*+]/,
  },
  {
    id: 'redos-nested-groups',
    description: 'Doubly nested quantified groups: ((a+)+) — guaranteed catastrophic',
    pattern: /\(\([^)]{0,40}\)[+*]\)[+*]/,
  },
  {
    id: 'redos-alternation-overlap',
    description: 'Overlapping alternation under quantifier: (a|a)+ — ambiguous NFA paths',
    // Detect repeated identical alternatives under a quantifier
    pattern: /\(([^|()]{1,20})\|(?:\1)(?:\|[^|()]{1,20}){0,5}\)[+*?]{1,2}/,
  },
  {
    id: 'redos-star-plus-concat',
    description: '(x*x)+ pattern — triggers super-linear backtracking',
    pattern: /\([^)]{0,10}\*[^)]{0,10}\)[+*]/,
  },
  {
    id: 'redos-dot-star-greedy',
    description: '(.*){n,} or (.+){n,} — repeated greedy dot quantifiers',
    pattern: /\(\.[*+]\)\{?\d/,
  },
  {
    id: 'redos-large-repetition',
    description: 'Very large fixed or range repetition count {1000,} or {1000,n} — denial of service via backtracking',
    // Matches { followed by 4+ digits (≥1000), then optional ,digits }
    pattern: /\{\d{4,}(?:,\d*)?\}/,
  },
  {
    id: 'redos-catastrophic-alternation',
    description: 'Long alternation with many similar branches — polynomial backtracking risk',
    // Heuristic: 10+ pipe-separated alternatives in a single group
    pattern: /\([^)]{0,200}(?:\|[^|)]{0,50}){9,}\)/,
  },
];

/* harmony default export */ const redos = (REDOS_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/nosql.js
/**
 * NOSQL context patterns.
 *
 * Detects injection vectors specific to NoSQL databases (primarily MongoDB)
 * and JavaScript-evaluated queries.
 *
 * Attack categories:
 *   1. MongoDB query operator injection: $where, $ne, $gt, $regex, $or, $and, etc.
 *      These operators, when injected into a JSON query object, can bypass
 *      authentication or exfiltrate data without knowing passwords.
 *
 *   2. JavaScript execution: $where clauses execute arbitrary JS server-side.
 *
 *   3. Prototype pollution: __proto__, constructor.prototype — can corrupt
 *      the prototype chain of all objects in the Node.js process.
 *
 * Pattern note: MongoDB operators appear as JSON keys. In JSON, keys are
 * quoted: {"$where": ...} so the pattern must allow an optional closing
 * quote between the operator name and the colon: /\$where["'\s]*:/
 */

// Shared suffix: optional closing quote/whitespace before the colon
// Handles: $op: (bare), "$op": (JSON), '$op': (single-quoted)
const SEP = /["'\s]*:/;
const sep = '["\'\\s]*:';

const NOSQL_PATTERNS = [
  // ─── MongoDB $ operator injection ────────────────────────────────────────
  {
    id: 'nosql-where-operator',
    description: '$where — executes arbitrary JavaScript server-side in MongoDB',
    pattern: new RegExp(`\\$where${sep}`, 'i'),
  },
  {
    id: 'nosql-ne-operator',
    description: '$ne — "not equal" operator used to bypass equality checks',
    pattern: new RegExp(`\\$ne${sep}`, 'i'),
  },
  {
    id: 'nosql-gt-operator',
    description: '$gt — "greater than" used to bypass password/value checks',
    pattern: new RegExp(`\\$gte?${sep}`, 'i'),
  },
  {
    id: 'nosql-lt-operator',
    description: '$lt / $lte — "less than" bypass variants',
    pattern: new RegExp(`\\$lte?${sep}`, 'i'),
  },
  {
    id: 'nosql-regex-operator',
    description: '$regex — can be used to extract data character by character (blind injection)',
    pattern: new RegExp(`\\$regex${sep}`, 'i'),
  },
  {
    id: 'nosql-or-operator',
    description: '$or — logical OR; used to create always-true conditions',
    pattern: new RegExp(`\\$or${sep}\\s*\\[`, 'i'),
  },
  {
    id: 'nosql-and-operator',
    description: '$and — logical AND operator injection',
    pattern: new RegExp(`\\$and${sep}\\s*\\[`, 'i'),
  },
  {
    id: 'nosql-nor-operator',
    description: '$nor — logical NOR operator injection',
    pattern: new RegExp(`\\$nor${sep}\\s*\\[`, 'i'),
  },
  {
    id: 'nosql-exists-operator',
    description: '$exists — can enumerate fields to determine schema',
    pattern: new RegExp(`\\$exists${sep}`, 'i'),
  },
  {
    id: 'nosql-in-operator',
    description: '$in — matches any value in a list; can enumerate values',
    pattern: new RegExp(`\\$in${sep}\\s*\\[`, 'i'),
  },
  {
    id: 'nosql-expr-operator',
    description: '$expr — allows aggregation expressions in queries (MongoDB 3.6+)',
    pattern: new RegExp(`\\$expr${sep}`, 'i'),
  },
  {
    id: 'nosql-function-operator',
    description: '$function — executes arbitrary JavaScript in MongoDB 4.4+',
    pattern: new RegExp(`\\$function${sep}`, 'i'),
  },
  {
    id: 'nosql-accumulator-operator',
    description: '$accumulator — custom aggregation with arbitrary JS execution',
    pattern: new RegExp(`\\$accumulator${sep}`, 'i'),
  },
  // ─── Prototype pollution ─────────────────────────────────────────────────
  {
    id: 'nosql-proto-pollution',
    description: '__proto__ — prototype pollution via object key injection',
    pattern: /__proto__/,
  },
  {
    id: 'nosql-constructor-prototype',
    description: 'constructor.prototype — alternative prototype pollution vector (dot notation or JSON key)',
    // Matches dot-notation (obj.constructor.prototype) and JSON key adjacency
    // ("constructor": {"prototype": ...})
    pattern: /constructor[\s"':.,{\[]*prototype/i,
  },
  {
    id: 'nosql-proto-bracket',
    description: '["__proto__"] — bracket-notation prototype pollution',
    pattern: /\[["']__proto__["']\]/,
  },
];

/* harmony default export */ const nosql = (NOSQL_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/contexts/log.js
/**
 * LOG context patterns.
 *
 * Detects injection vectors that are dangerous when a string is written
 * to a log file, passed to a logging framework, or interpolated into
 * a log message that will be parsed or displayed.
 *
 * Attack categories:
 *   1. CRLF injection — injects fake log lines by embedding newlines
 *   2. Log4Shell (CVE-2021-44228) — ${jndi:...} triggers JNDI lookup in Log4j
 *   3. SSTI in log templates — {{...}}, #{...} trigger template evaluation
 *      if the log message is passed through a template engine
 *   4. Null byte injection — truncates log entries in some implementations
 *   5. ANSI escape injection — manipulates terminal output when logs are
 *      tailed in a terminal (colour codes, cursor movement, etc.)
 *
 * Note: Newline characters (\n, \r) will produce false positives for
 * multi-line legitimate values. Use this context only for single-line
 * log field values (usernames, IDs, request parameters, etc.).
 */

const LOG_PATTERNS = [
  // ─── CRLF / newline injection ─────────────────────────────────────────────
  {
    id: 'log-crlf-injection',
    description: 'CRLF injection: literal \\r or \\n embeds fake log lines',
    pattern: /[\r\n]/,
  },
  {
    id: 'log-url-encoded-crlf',
    description: 'URL-encoded CRLF: %0d, %0a, %0D, %0A — decoded by some log parsers',
    pattern: /%0[dDaA]/,
  },
  {
    id: 'log-unicode-newline',
    description: 'Unicode newline variants: U+2028 (line separator), U+2029 (paragraph separator)',
    pattern: /[\u2028\u2029]/,
  },

  // ─── Log4Shell / JNDI injection (CVE-2021-44228) ─────────────────────────
  {
    id: 'log-log4shell-jndi',
    description: 'Log4Shell: ${jndi:...} triggers remote code execution in Apache Log4j',
    pattern: /\$\{jndi\s*:/i,
  },
  {
    id: 'log-log4shell-obfuscated',
    description: 'Obfuscated Log4Shell: ${::-j}... lookup-bypass prefix used to evade WAF detection',
    // ${::- is the Log4j lookup-bypass escape sequence; presence alone is suspicious
    pattern: /\$\{::-/,
  },
  {
    id: 'log-log4j-lookup',
    description: 'Log4j lookup syntax: ${env:...}, ${sys:...}, ${ctx:...} — data exfiltration',
    pattern: /\$\{(?:env|sys|ctx|main|map|sd|web|docker|k8s|spring)\s*:/i,
  },

  // ─── Server-Side Template Injection (SSTI) in log messages ───────────────
  {
    id: 'log-ssti-double-brace',
    description: 'SSTI double-brace: {{expression}} — Jinja2, Twig, Handlebars, etc.',
    pattern: /\{\{[\s\S]{0,80}\}\}/,
  },
  {
    id: 'log-ssti-hash-brace',
    description: 'SSTI hash-brace: #{expression} — Thymeleaf, Velocity, Ruby ERB',
    pattern: /#\{[\s\S]{0,80}\}/,
  },
  {
    id: 'log-ssti-dollar-brace',
    description: 'SSTI/EL injection: ${expression with operators or method calls} — JSP EL, Freemarker, SpEL',
    // Require that the ${...} content looks like an expression, not a plain variable name.
    // Flags if the content contains: . ( * + operators, or known SSTI keywords.
    // This avoids flagging ${PATH}, ${HOME} etc. (plain shell variables).
    pattern: /\$\{[^}]*(?:\.|\(|\*|\+|\bclass\b|\bruntime\b|\bprocess\b|\bexec\b)[^}]{0,80}\}/i,
  },
  {
    id: 'log-ssti-percent-tag',
    description: 'SSTI ERB/ASP tag: <%= expression %> — Ruby ERB, ASP',
    pattern: /<%=[\s\S]{0,80}%>/,
  },

  // ─── Null byte ────────────────────────────────────────────────────────────
  {
    id: 'log-null-byte',
    description: 'Null byte: \\x00 or %00 — can truncate log entries in C-backed loggers',
    pattern: /\x00|%00/,
  },

  // ─── ANSI escape injection ────────────────────────────────────────────────
  {
    id: 'log-ansi-escape',
    description: 'ANSI escape sequence: ESC[ — can manipulate terminal output when logs are tailed',
    pattern: /\x1b\[/,
  },
];

/* harmony default export */ const log = (LOG_PATTERNS);

;// CONCATENATED MODULE: ./node_modules/is-unsafe/src/index.js
/**
 * is-unsafe v2
 *
 * Zero-dependency, DOM-free, pure predicate for detecting unsafe strings
 * across HTML, XML, SVG, SQL, SQL-STRICT, SHELL, REDOS, NOSQL, and LOG contexts.
 *
 * v2 change: contexts are imported as named pattern arrays rather than resolved
 * via a string-keyed registry. This makes each context independently
 * tree-shakeable — bundlers can drop any context you never import.
 *
 * @module is-unsafe
 */

// ─── Context pattern arrays (named exports) ────────────────────────────────
// Import only the ones you need. Each is independently tree-shakeable.










// SQL-STRICT needs a quoted identifier because of the hyphen



// ─── VALID_CONTEXTS convenience re-export ─────────────────────────────────
// Importing this pulls in ALL contexts. Use it only when you need all of them
// (e.g. for validation UI, tooling, or exhaustive audits).
// If you only need a subset, import the named contexts directly instead.










// ─── Attach labels to named contexts ──────────────────────────────────────
// Each built-in PatternList carries its canonical name so matchList can read
// list.label directly — no registry lookup needed at match time.
// Custom PatternLists default to 'CUSTOM' unless the caller sets list.label.

html.label       = 'HTML';
xml.label        = 'XML';
svg.label        = 'SVG';
sql.label        = 'SQL';
sql_strict.label = 'SQL-STRICT';
shell.label      = 'SHELL';
redos.label      = 'REDOS';
nosql.label      = 'NOSQL';
log.label        = 'LOG';

const VALID_CONTEXTS = Object.freeze({
  HTML: html,
  XML: xml,
  SVG: svg,
  SQL: sql,
  'SQL-STRICT': sql_strict,
  SHELL: shell,
  REDOS: redos,
  NOSQL: nosql,
  LOG: log,
});

// ─── Types ────────────────────────────────────────────────────────────────

/**
 * @typedef {{ id: string, description: string, pattern: RegExp }} Rule
 */

/**
 * @typedef {Rule[]} PatternList
 */

/**
 * @typedef {Object} MatchResult
 * @property {string} context     - Label identifying which context matched ('HTML', 'CUSTOM', etc.)
 * @property {string} id          - Rule identifier
 * @property {string} description - Human-readable description of what was matched
 * @property {RegExp} pattern     - The pattern that matched
 */

// ─── Internal helpers ──────────────────────────────────────────────────────

/**
 * @param {unknown} value
 */
function assertString(value) {
  if (typeof value !== 'string') {
    throw new TypeError(
      `is-unsafe: first argument must be a string, got ${typeof value}`
    );
  }
}

/**
 * @param {unknown} context
 */
function assertContext(context) {
  if (context instanceof RegExp) return;

  if (Array.isArray(context)) {
    if (context.length === 0) {
      throw new TypeError('is-unsafe: context must not be an empty array');
    }
    // Detect array-of-arrays vs flat pattern list
    if (Array.isArray(context[0])) {
      // Array of PatternLists
      for (const list of context) {
        if (!Array.isArray(list) || list.length === 0) {
          throw new TypeError(
            'is-unsafe: each context in the array must be a non-empty pattern array (PatternList)'
          );
        }
      }
    }
    // else: flat PatternList — trust it, no deep validation needed
    return;
  }

  throw new TypeError(
    `is-unsafe: second argument must be a PatternList (e.g. HTML), ` +
    `an array of PatternLists (e.g. [HTML, XML]), or a RegExp. Got: ${typeof context}`
  );
}

/**
 * Normalise any valid context arg into an array of PatternLists.
 *
 * @param {Rule[]|Rule[][]|RegExp} context
 * @returns {{ lists: Rule[][]|null, regex: RegExp|null }}
 */
function normalise(context) {
  if (context instanceof RegExp) return { lists: null, regex: context };
  // Distinguish PatternList (array of rule objects) from array of PatternLists
  if (Array.isArray(context[0])) return { lists: context, regex: null };
  return { lists: [context], regex: null };
}

/**
 * Test value against a single PatternList. Returns the first MatchResult or null.
 *
 * @param {string} value
 * @param {Rule[]} list
 * @returns {MatchResult|null}
 */
function matchList(value, list) {
  const label = list.label ?? 'CUSTOM';
  for (const rule of list) {
    if (rule.pattern.test(value)) {
      return { context: label, id: rule.id, description: rule.description, pattern: rule.pattern };
    }
  }
  return null;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Returns `true` if `value` is unsafe in the given context(s), `false` otherwise.
 *
 * @param {string} value - The string to test
 * @param {PatternList | PatternList[] | RegExp} context
 *   - A PatternList imported from is-unsafe (e.g. `HTML`, `XML`)
 *   - An array of PatternLists — returns true if unsafe in **any** of them
 *   - A custom RegExp — returns true if the pattern matches
 * @returns {boolean}
 *
 * @example
 * import { isUnsafe, HTML, SQL } from 'is-unsafe';
 *
 * isUnsafe('<script>alert(1)</script>', HTML)       // true
 * isUnsafe('hello world', HTML)                     // false
 * isUnsafe('value', [HTML, SQL])                    // false
 * isUnsafe('value', /my-pattern/i)                  // false
 */
function isUnsafe(value, context) {
  assertString(value);
  assertContext(context);

  const { lists, regex } = normalise(context);

  if (regex) return regex.test(value);

  for (const list of lists) {
    if (matchList(value, list) !== null) return true;
  }
  return false;
}

/**
 * Like `isUnsafe`, but returns the first `MatchResult` describing **why**
 * the value was flagged, or `null` if it is safe.
 *
 * @param {string} value
 * @param {PatternList | PatternList[] | RegExp} context
 * @returns {MatchResult|null}
 *
 * @example
 * import { whyUnsafe, HTML } from 'is-unsafe';
 *
 * whyUnsafe('<script>alert(1)</script>', HTML)
 * // { context: 'HTML', id: 'html-script-open', description: '...', pattern: /.../ }
 */
function whyUnsafe(value, context) {
  assertString(value);
  assertContext(context);

  const { lists, regex } = normalise(context);

  if (regex) {
    return regex.test(value)
      ? { context: 'CUSTOM', id: 'custom-regex', description: 'Matched caller-supplied pattern', pattern: regex }
      : null;
  }

  for (const list of lists) {
    const result = matchList(value, list);
    if (result !== null) return result;
  }
  return null;
}

/**
 * Returns **all** matching rules across the given context(s), or an empty
 * array if the value is safe. Useful for comprehensive auditing.
 *
 * @param {string} value
 * @param {PatternList | PatternList[] | RegExp} context
 * @returns {MatchResult[]}
 */
function allUnsafe(value, context) {
  assertString(value);
  assertContext(context);

  const { lists, regex } = normalise(context);
  const results = [];

  if (regex) {
    if (regex.test(value)) {
      results.push({ context: 'CUSTOM', id: 'custom-regex', description: 'Matched caller-supplied pattern', pattern: regex });
    }
    return results;
  }

  for (const list of lists) {
    const label = list.label ?? 'CUSTOM';
    for (const rule of list) {
      if (rule.pattern.test(value)) {
        results.push({ context: label, id: rule.id, description: rule.description, pattern: rule.pattern });
      }
    }
  }

  return results;
}


/* harmony default export */ const is_unsafe_src = ((/* unused pure expression or super */ null && (isUnsafe)));

;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/xmlparser/OrderedObjParser.js

///@ts-check












// const regx =
//   '<((!\\[CDATA\\[([\\s\\S]*?)(]]>))|((NAME:)?(NAME))([^>]*)>|((\\/)(NAME)\\s*>))([^<]*)'
//   .replace(/NAME/g, util.nameRegexp);

//const tagsRegx = new RegExp("<(\\/?[\\w:\\-\._]+)([^>]*)>(\\s*"+cdataRegx+")*([^<]+)?","g");
//const tagsRegx = new RegExp("<(\\/?)((\\w*:)?([\\w:\\-\._]+))([^>]*)>([^<]*)("+cdataRegx+"([^<]*))*([^<]+)?","g");

// Helper functions for attribute and namespace handling

/**
 * Extract raw attributes (without prefix) from prefixed attribute map
 * @param {object} prefixedAttrs - Attributes with prefix from buildAttributesMap
 * @param {object} options - Parser options containing attributeNamePrefix
 * @returns {object} Raw attributes for matcher
 */
function extractRawAttributes(prefixedAttrs, options) {
  if (!prefixedAttrs) return {};

  // Handle attributesGroupName option
  const attrs = options.attributesGroupName
    ? prefixedAttrs[options.attributesGroupName]
    : prefixedAttrs;

  if (!attrs) return {};

  const rawAttrs = {};
  for (const key in attrs) {
    // Remove the attribute prefix to get raw name
    if (key.startsWith(options.attributeNamePrefix)) {
      const rawName = key.substring(options.attributeNamePrefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      // Attribute without prefix (shouldn't normally happen, but be safe)
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}

/**
 * Extract namespace from raw tag name
 * @param {string} rawTagName - Tag name possibly with namespace (e.g., "soap:Envelope")
 * @returns {string|undefined} Namespace or undefined
 */
function extractNamespace(rawTagName) {
  if (!rawTagName || typeof rawTagName !== 'string') return undefined;

  const colonIndex = rawTagName.indexOf(':');
  if (colonIndex !== -1 && colonIndex > 0) {
    const ns = rawTagName.substring(0, colonIndex);
    // Don't treat xmlns as a namespace
    if (ns !== 'xmlns') {
      return ns;
    }
  }
  return undefined;
}

class OrderedObjParser {
  constructor(options, externalEntities) {
    this.options = options;
    this.currentNode = null;
    this.tagsNodeStack = [];
    this.parseXml = parseXml;
    this.parseTextData = parseTextData;
    this.resolveNameSpace = resolveNameSpace;
    this.buildAttributesMap = buildAttributesMap;
    this.isItStopNode = isItStopNode;
    this.replaceEntitiesValue = replaceEntitiesValue;
    this.readStopNodeData = readStopNodeData;
    this.saveTextToParentTag = saveTextToParentTag;
    this.addChild = addChild;
    this.ignoreAttributesFn = getIgnoreAttributesFn(this.options.ignoreAttributes)
    this.entityExpansionCount = 0;
    this.currentExpandedLength = 0;
    this.doctypefound = false;
    let namedEntities = { ...XML };
    if (this.options.entityDecoder) {
      this.entityDecoder = this.options.entityDecoder
    } else {
      if (typeof this.options.htmlEntities === "object") namedEntities = this.options.htmlEntities;
      else if (this.options.htmlEntities === true) namedEntities = { ...COMMON_HTML, ...CURRENCY };
      this.entityDecoder = new EntityDecoder({
        namedEntities: { ...namedEntities, ...externalEntities },
        numericAllowed: this.options.htmlEntities,
        limit: {
          maxTotalExpansions: this.options.processEntities.maxTotalExpansions,
          maxExpandedLength: this.options.processEntities.maxExpandedLength,
          applyLimitsTo: this.options.processEntities.appliesTo,
        },
        // onExternalEntity: (name, value) => isUnsafe(value) ? 'block' : 'allow',
        onInputEntity: (name, value) =>
          //TODO: VALID_CONTEXTS.HTML should be set only if this.options.htmlEntities
          isUnsafe(value, [html, xml]) ? ENTITY_ACTION.BLOCK : ENTITY_ACTION.ALLOW,

        //postCheck: resolved => resolved
      });
    }

    // Initialize path matcher for path-expression-matcher
    this.matcher = new Matcher/* default */.A();
    this.readonlyMatcher = this.matcher.readOnly();

    // Flag to track if current node is a stop node (optimization)
    this.isCurrentNodeStopNode = false;

    // Pre-compile stopNodes expressions
    this.stopNodeExpressionsSet = new ExpressionSet();
    const stopNodesOpts = this.options.stopNodes;
    if (stopNodesOpts && stopNodesOpts.length > 0) {
      for (let i = 0; i < stopNodesOpts.length; i++) {
        const stopNodeExp = stopNodesOpts[i];
        if (typeof stopNodeExp === 'string') {
          // Convert string to Expression object
          this.stopNodeExpressionsSet.add(new Expression/* default */.A(stopNodeExp));
        } else if (stopNodeExp instanceof Expression/* default */.A) {
          // Already an Expression object
          this.stopNodeExpressionsSet.add(stopNodeExp);
        }
      }
      this.stopNodeExpressionsSet.seal();
    }
  }

}


/**
 * @param {string} val
 * @param {string} tagName
 * @param {string|Matcher} jPath - jPath string or Matcher instance based on options.jPath
 * @param {boolean} dontTrim
 * @param {boolean} hasAttributes
 * @param {boolean} isLeafNode
 * @param {boolean} escapeEntities
 */
function parseTextData(val, tagName, jPath, dontTrim, hasAttributes, isLeafNode, escapeEntities) {
  const options = this.options;
  if (val !== undefined) {
    if (options.trimValues && !dontTrim) {
      val = val.trim();
    }
    if (val.length > 0) {
      if (!escapeEntities) val = this.replaceEntitiesValue(val, tagName, jPath);

      // Pass jPath string or matcher based on options.jPath setting
      const jPathOrMatcher = options.jPath ? jPath.toString() : jPath;
      const newval = options.tagValueProcessor(tagName, val, jPathOrMatcher, hasAttributes, isLeafNode);
      if (newval === null || newval === undefined) {
        //don't parse
        return val;
      } else if (typeof newval !== typeof val || newval !== val) {
        //overwrite
        return newval;
      } else if (options.trimValues) {
        return parseValue(val, options.parseTagValue, options.numberParseOptions);
      } else {
        const trimmedVal = val.trim();
        if (trimmedVal === val) {
          return parseValue(val, options.parseTagValue, options.numberParseOptions);
        } else {
          return val;
        }
      }
    }
  }
}

function resolveNameSpace(tagname) {
  if (this.options.removeNSPrefix) {
    const tags = tagname.split(':');
    const prefix = tagname.charAt(0) === '/' ? '/' : '';
    if (tags[0] === 'xmlns') {
      return '';
    }
    if (tags.length === 2) {
      tagname = prefix + tags[1];
    }
  }
  return tagname;
}

//TODO: change regex to capture NS
//const attrsRegx = new RegExp("([\\w\\-\\.\\:]+)\\s*=\\s*(['\"])((.|\n)*?)\\2","gm");
const attrsRegx = new RegExp('([^\\s=]+)\\s*(=\\s*([\'"])([\\s\\S]*?)\\3)?', 'gm');

function buildAttributesMap(attrStr, jPath, tagName, force = false) {
  const options = this.options;
  if (force === true || (options.ignoreAttributes !== true && typeof attrStr === 'string')) {
    // attrStr = attrStr.replace(/\r?\n/g, ' ');
    //attrStr = attrStr || attrStr.trim();

    const matches = (0,util/* getAllMatches */.Xe)(attrStr, attrsRegx);
    const len = matches.length; //don't make it inline
    const attrs = {};

    // Pre-process values once: trim + entity replacement
    // Reused in both matcher update and second pass
    const processedVals = new Array(len);
    let hasRawAttrs = false;
    const rawAttrsForMatcher = {};

    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);
      const oldVal = matches[i][4];

      if (attrName.length && oldVal !== undefined) {
        let val = oldVal;
        if (options.trimValues) val = val.trim();
        val = this.replaceEntitiesValue(val, tagName, this.readonlyMatcher);
        processedVals[i] = val;

        rawAttrsForMatcher[attrName] = val;
        hasRawAttrs = true;
      }
    }

    // Update matcher ONCE before second pass, if applicable
    if (hasRawAttrs && typeof jPath === 'object' && jPath.updateCurrent) {
      jPath.updateCurrent(rawAttrsForMatcher);
    }

    // Hoist toString() once — path doesn't change during attribute processing
    const jPathStr = options.jPath ? jPath.toString() : this.readonlyMatcher;

    // Second pass: apply processors, build final attrs
    let hasAttrs = false;
    for (let i = 0; i < len; i++) {
      const attrName = this.resolveNameSpace(matches[i][1]);

      if (this.ignoreAttributesFn(attrName, jPathStr)) continue;

      let aName = options.attributeNamePrefix + attrName;

      if (attrName.length) {
        if (options.transformAttributeName) {
          aName = options.transformAttributeName(aName);
        }
        aName = sanitizeName(aName, options);

        if (matches[i][4] !== undefined) {
          // Reuse already-processed value — no double entity replacement
          const oldVal = processedVals[i];

          const newVal = options.attributeValueProcessor(attrName, oldVal, jPathStr);
          if (newVal === null || newVal === undefined) {
            attrs[aName] = oldVal;
          } else if (typeof newVal !== typeof oldVal || newVal !== oldVal) {
            attrs[aName] = newVal;
          } else {
            attrs[aName] = parseValue(oldVal, options.parseAttributeValue, options.numberParseOptions);
          }
          hasAttrs = true;
        } else if (options.allowBooleanAttributes) {
          attrs[aName] = true;
          hasAttrs = true;
        }
      }
    }

    if (!hasAttrs) return;

    if (options.attributesGroupName && !options.preserveOrder) {
      const attrCollection = {};
      attrCollection[options.attributesGroupName] = attrs;
      return attrCollection;
    }
    return attrs;
  }
}
const parseXml = function (xmlData) {
  xmlData = xmlData.replace(/\r\n?/g, "\n"); //TODO: remove this line
  const xmlObj = new XmlNode('!xml');
  let currentNode = xmlObj;
  let textData = "";

  // Reset matcher for new document
  this.matcher.reset();
  this.entityDecoder.reset();

  // Reset entity expansion counters for this document
  this.entityExpansionCount = 0;
  this.currentExpandedLength = 0;
  this.doctypefound = false;
  const options = this.options;
  const docTypeReader = new DocTypeReader(options.processEntities);
  const xmlLen = xmlData.length;
  for (let i = 0; i < xmlLen; i++) {//for each char in XML data
    const ch = xmlData[i];
    if (ch === '<') {
      // const nextIndex = i+1;
      // const _2ndChar = xmlData[nextIndex];
      const c1 = xmlData.charCodeAt(i + 1);
      if (c1 === 47) {//Closing Tag '/'
        const closeIndex = findClosingIndex(xmlData, ">", i, "Closing Tag is not closed.")
        let tagName = xmlData.substring(i + 2, closeIndex).trim();

        if (options.removeNSPrefix) {
          const colonIndex = tagName.indexOf(":");
          if (colonIndex !== -1) {
            tagName = tagName.substr(colonIndex + 1);
          }
        }

        tagName = transformTagName(options.transformTagName, tagName, "", options).tagName;

        if (currentNode) {
          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        }

        //check if last tag of nested tag was unpaired tag
        const lastTagName = this.matcher.getCurrentTag();
        if (tagName && options.unpairedTagsSet.has(tagName)) {
          throw new Error(`Unpaired tag can not be used as closing tag: </${tagName}>`);
        }
        if (lastTagName && options.unpairedTagsSet.has(lastTagName)) {
          // Pop the unpaired tag
          this.matcher.pop();
          this.tagsNodeStack.pop();
        }
        // Pop the closing tag
        this.matcher.pop();
        this.isCurrentNodeStopNode = false; // Reset flag when closing tag

        currentNode = this.tagsNodeStack.pop();//avoid recursion, set the parent tag scope
        textData = "";
        i = closeIndex;
      } else if (c1 === 63) { //'?'

        let tagData = readTagExp(xmlData, i, false, "?>");
        if (!tagData) throw new Error("Pi Tag is not closed.");

        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);
        const attsMap = this.buildAttributesMap(tagData.tagExp, this.matcher, tagData.tagName, true);
        if (attsMap) {
          const ver = attsMap[this.options.attributeNamePrefix + "version"];
          this.entityDecoder.setXmlVersion(Number(ver) || 1.0);
          docTypeReader.setXmlVersion(Number(ver) || 1.0);
        }
        if ((options.ignoreDeclaration && tagData.tagName === "?xml") || options.ignorePiTags) {
          //do nothing
        } else {

          const childNode = new XmlNode(tagData.tagName);
          childNode.add(options.textNodeName, "");

          if (tagData.tagName !== tagData.tagExp && tagData.attrExpPresent && options.ignoreAttributes !== true) {
            childNode[":@"] = attsMap
          }
          this.addChild(currentNode, childNode, this.readonlyMatcher, i);
        }


        i = tagData.closeIndex + 1;
      } else if (c1 === 33
        && xmlData.charCodeAt(i + 2) === 45
        && xmlData.charCodeAt(i + 3) === 45) { //'!--'
        const endIndex = findClosingIndex(xmlData, "-->", i + 4, "Comment is not closed.")
        if (options.commentPropName) {
          const comment = xmlData.substring(i + 4, endIndex - 2);

          textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);

          currentNode.add(options.commentPropName, [{ [options.textNodeName]: comment }]);
        }
        i = endIndex;
      } else if (c1 === 33
        && xmlData.charCodeAt(i + 2) === 68) { //'!D'
        if (this.doctypefound) throw new Error("Multiple DOCTYPE declarations found.");
        this.doctypefound = true;
        const result = docTypeReader.readDocType(xmlData, i);
        this.entityDecoder.addInputEntities(result.entities);
        i = result.i;
      } else if (c1 === 33
        && xmlData.charCodeAt(i + 2) === 91) { // '!['
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "CDATA is not closed.") - 2;
        const tagExp = xmlData.substring(i + 9, closeIndex);

        textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher);

        let val = this.parseTextData(tagExp, currentNode.tagname, this.readonlyMatcher, true, false, true, true);
        if (val == undefined) val = "";

        //cdata should be set even if it is 0 length string
        if (options.cdataPropName) {
          currentNode.add(options.cdataPropName, [{ [options.textNodeName]: tagExp }]);
        } else {
          currentNode.add(options.textNodeName, val);
        }

        i = closeIndex + 2;
      } else {//Opening tag
        let result = readTagExp(xmlData, i, options.removeNSPrefix);

        // Safety check: readTagExp can return undefined
        if (!result) {
          // Log context for debugging
          const context = xmlData.substring(Math.max(0, i - 50), Math.min(xmlLen, i + 50));
          throw new Error(`readTagExp returned undefined at position ${i}. Context: "${context}"`);
        }

        let tagName = result.tagName;
        const rawTagName = result.rawTagName;
        let tagExp = result.tagExp;
        let attrExpPresent = result.attrExpPresent;
        let closeIndex = result.closeIndex;

        ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));

        if (options.strictReservedNames &&
          (tagName === options.commentPropName
            || tagName === options.cdataPropName
            || tagName === options.textNodeName
            || tagName === options.attributesGroupName
          )) {
          throw new Error(`Invalid tag name: ${tagName}`);
        }

        //save text as child node
        if (currentNode && textData) {
          if (currentNode.tagname !== '!xml') {
            //when nested tag is found
            textData = this.saveTextToParentTag(textData, currentNode, this.readonlyMatcher, false);
          }
        }

        //check if last tag was unpaired tag
        const lastTag = currentNode;
        if (lastTag && options.unpairedTagsSet.has(lastTag.tagname)) {
          currentNode = this.tagsNodeStack.pop();
          this.matcher.pop();
        }

        // Clean up self-closing syntax BEFORE processing attributes
        // This is where tagExp gets the trailing / removed
        let isSelfClosing = false;
        if (tagExp.length > 0 && tagExp.lastIndexOf("/") === tagExp.length - 1) {
          isSelfClosing = true;
          if (tagName[tagName.length - 1] === "/") {
            tagName = tagName.substr(0, tagName.length - 1);
            tagExp = tagName;
          } else {
            tagExp = tagExp.substr(0, tagExp.length - 1);
          }

          // Re-check attrExpPresent after cleaning
          attrExpPresent = (tagName !== tagExp);
        }

        // Now process attributes with CLEAN tagExp (no trailing /)
        let prefixedAttrs = null;
        let rawAttrs = {};
        let namespace = undefined;

        // Extract namespace from rawTagName
        namespace = extractNamespace(rawTagName);

        // Push tag to matcher FIRST (with empty attrs for now) so callbacks see correct path
        if (tagName !== xmlObj.tagname) {
          this.matcher.push(tagName, {}, namespace);
        }

        // Now build attributes - callbacks will see correct matcher state
        if (tagName !== tagExp && attrExpPresent) {
          // Build attributes (returns prefixed attributes for the tree)
          // Note: buildAttributesMap now internally updates the matcher with raw attributes
          prefixedAttrs = this.buildAttributesMap(tagExp, this.matcher, tagName);

          if (prefixedAttrs) {
            // Extract raw attributes (without prefix) for our use
            //TODO: seems a performance overhead
            rawAttrs = extractRawAttributes(prefixedAttrs, options);
          }
        }

        // Now check if this is a stop node (after attributes are set)
        if (tagName !== xmlObj.tagname) {
          this.isCurrentNodeStopNode = this.isItStopNode();
        }

        const startIndex = i;
        if (this.isCurrentNodeStopNode) {
          let tagContent = "";

          // For self-closing tags, content is empty
          if (isSelfClosing) {
            i = result.closeIndex;
          }
          //unpaired tag
          else if (options.unpairedTagsSet.has(tagName)) {
            i = result.closeIndex;
          }
          //normal tag
          else {
            //read until closing tag is found
            const result = this.readStopNodeData(xmlData, rawTagName, closeIndex + 1);
            if (!result) throw new Error(`Unexpected end of ${rawTagName}`);
            i = result.i;
            tagContent = result.tagContent;
          }

          const childNode = new XmlNode(tagName);

          if (prefixedAttrs) {
            childNode[":@"] = prefixedAttrs;
          }

          // For stop nodes, store raw content as-is without any processing
          childNode.add(options.textNodeName, tagContent);

          this.matcher.pop(); // Pop the stop node tag
          this.isCurrentNodeStopNode = false; // Reset flag

          this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
        } else {
          //selfClosing tag
          if (isSelfClosing) {
            ({ tagName, tagExp } = transformTagName(options.transformTagName, tagName, tagExp, options));

            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            this.matcher.pop(); // Pop self-closing tag
            this.isCurrentNodeStopNode = false; // Reset flag
          }
          else if (options.unpairedTagsSet.has(tagName)) {//unpaired tag
            const childNode = new XmlNode(tagName);
            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            this.matcher.pop(); // Pop unpaired tag
            this.isCurrentNodeStopNode = false; // Reset flag
            i = result.closeIndex;
            // Continue to next iteration without changing currentNode
            continue;
          }
          //opening tag
          else {
            const childNode = new XmlNode(tagName);
            if (this.tagsNodeStack.length > options.maxNestedTags) {
              throw new Error("Maximum nested tags exceeded");
            }
            this.tagsNodeStack.push(currentNode);

            if (prefixedAttrs) {
              childNode[":@"] = prefixedAttrs;
            }
            this.addChild(currentNode, childNode, this.readonlyMatcher, startIndex);
            currentNode = childNode;
          }
          textData = "";
          i = closeIndex;
        }
      }
    } else {
      textData += xmlData[i];
    }
  }
  return xmlObj.child;
}

function addChild(currentNode, childNode, matcher, startIndex) {
  // unset startIndex if not requested
  if (!this.options.captureMetaData) startIndex = undefined;

  // Pass jPath string or matcher based on options.jPath setting
  const jPathOrMatcher = this.options.jPath ? matcher.toString() : matcher;
  const result = this.options.updateTag(childNode.tagname, jPathOrMatcher, childNode[":@"])
  if (result === false) {
    //do nothing
  } else if (typeof result === "string") {
    childNode.tagname = result
    currentNode.addChild(childNode, startIndex);
  } else {
    currentNode.addChild(childNode, startIndex);
  }
}

/**
 * @param {object} val - Entity object with regex and val properties
 * @param {string} tagName - Tag name
 * @param {string|Matcher} jPath - jPath string or Matcher instance based on options.jPath
 */
function replaceEntitiesValue(val, tagName, jPath) {
  const entityConfig = this.options.processEntities;

  if (!entityConfig || !entityConfig.enabled) {
    return val;
  }

  // Check if tag is allowed to contain entities
  if (entityConfig.allowedTags) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    const allowed = Array.isArray(entityConfig.allowedTags)
      ? entityConfig.allowedTags.includes(tagName)
      : entityConfig.allowedTags(tagName, jPathOrMatcher);

    if (!allowed) {
      return val;
    }
  }

  // Apply custom tag filter if provided
  if (entityConfig.tagFilter) {
    const jPathOrMatcher = this.options.jPath ? jPath.toString() : jPath;
    if (!entityConfig.tagFilter(tagName, jPathOrMatcher)) {
      return val; // Skip based on custom filter
    }
  }

  return this.entityDecoder.decode(val);
}


function saveTextToParentTag(textData, parentNode, matcher, isLeafNode) {
  if (textData) { //store previously collected data as textNode
    if (isLeafNode === undefined) isLeafNode = parentNode.child.length === 0

    textData = this.parseTextData(textData,
      parentNode.tagname,
      matcher,
      false,
      parentNode[":@"] ? Object.keys(parentNode[":@"]).length !== 0 : false,
      isLeafNode);

    if (textData !== undefined && textData !== "")
      parentNode.add(this.options.textNodeName, textData);
    textData = "";
  }
  return textData;
}

/**
 * @param {Array<Expression>} stopNodeExpressions - Array of compiled Expression objects
 * @param {Matcher} matcher - Current path matcher
 */
function isItStopNode() {
  if (this.stopNodeExpressionsSet.size === 0) return false;

  return this.matcher.matchesAny(this.stopNodeExpressionsSet);
}

/**
 * Returns the tag Expression and where it is ending handling single-double quotes situation
 * @param {string} xmlData 
 * @param {number} i starting index
 * @returns 
 */
function tagExpWithClosingIndex(xmlData, i, closingChar = ">") {
  //TODO: ignore boolean attributes in tag expression
  //TODO: if ignore attributes, dont read full attribute expression but the end. But read for xml declaration
  let attrBoundary = 0;
  const len = xmlData.length;
  const closeCode0 = closingChar.charCodeAt(0);
  const closeCode1 = closingChar.length > 1 ? closingChar.charCodeAt(1) : -1;

  let result = '';
  let segmentStart = i;

  for (let index = i; index < len; index++) {
    const code = xmlData.charCodeAt(index);

    if (attrBoundary) {
      if (code === attrBoundary) attrBoundary = 0;
    } else if (code === 34 || code === 39) { // " or '
      attrBoundary = code;
    } else if (code === closeCode0) {
      if (closeCode1 !== -1) {
        if (xmlData.charCodeAt(index + 1) === closeCode1) {
          result += xmlData.substring(segmentStart, index);
          return { data: result, index };
        }
      } else {
        result += xmlData.substring(segmentStart, index);
        return { data: result, index };
      }
    } else if (code === 9 && !attrBoundary) { // \t - only replace with space outside attribute values
      // Flush accumulated segment, add space, start new segment
      result += xmlData.substring(segmentStart, index) + ' ';
      segmentStart = index + 1;
    }
  }
}

function findClosingIndex(xmlData, str, i, errMsg) {
  const closingIndex = xmlData.indexOf(str, i);
  if (closingIndex === -1) {
    throw new Error(errMsg)
  } else {
    return closingIndex + str.length - 1;
  }
}

function findClosingChar(xmlData, char, i, errMsg) {
  const closingIndex = xmlData.indexOf(char, i);
  if (closingIndex === -1) throw new Error(errMsg);
  return closingIndex; // no offset needed
}

function readTagExp(xmlData, i, removeNSPrefix, closingChar = ">") {
  const result = tagExpWithClosingIndex(xmlData, i + 1, closingChar);
  if (!result) return;
  let tagExp = result.data;
  const closeIndex = result.index;
  const separatorIndex = tagExp.search(/\s/);
  let tagName = tagExp;
  let attrExpPresent = true;
  if (separatorIndex !== -1) {//separate tag name and attributes expression
    tagName = tagExp.substring(0, separatorIndex);
    tagExp = tagExp.substring(separatorIndex + 1).trimStart();
  }

  const rawTagName = tagName;
  if (removeNSPrefix) {
    const colonIndex = tagName.indexOf(":");
    if (colonIndex !== -1) {
      tagName = tagName.substr(colonIndex + 1);
      attrExpPresent = tagName !== result.data.substr(colonIndex + 1);
    }
  }

  return {
    tagName: tagName,
    tagExp: tagExp,
    closeIndex: closeIndex,
    attrExpPresent: attrExpPresent,
    rawTagName: rawTagName,
  }
}
/**
 * find paired tag for a stop node
 * @param {string} xmlData 
 * @param {string} tagName 
 * @param {number} i 
 */
function readStopNodeData(xmlData, tagName, i) {
  const startIndex = i;
  // Starting at 1 since we already have an open tag
  let openTagCount = 1;

  const xmllen = xmlData.length;
  for (; i < xmllen; i++) {
    if (xmlData[i] === "<") {
      const c1 = xmlData.charCodeAt(i + 1);
      if (c1 === 47) {//close tag '/'
        const closeIndex = findClosingChar(xmlData, ">", i, `${tagName} is not closed`);
        let closeTagName = xmlData.substring(i + 2, closeIndex).trim();
        if (closeTagName === tagName) {
          openTagCount--;
          if (openTagCount === 0) {
            return {
              tagContent: xmlData.substring(startIndex, i),
              i: closeIndex
            }
          }
        }
        i = closeIndex;
      } else if (c1 === 63) { //?
        const closeIndex = findClosingIndex(xmlData, "?>", i + 1, "StopNode is not closed.")
        i = closeIndex;
      } else if (c1 === 33
        && xmlData.charCodeAt(i + 2) === 45
        && xmlData.charCodeAt(i + 3) === 45) { // '!--'
        const closeIndex = findClosingIndex(xmlData, "-->", i + 3, "StopNode is not closed.")
        i = closeIndex;
      } else if (c1 === 33
        && xmlData.charCodeAt(i + 2) === 91) { // '!['
        const closeIndex = findClosingIndex(xmlData, "]]>", i, "StopNode is not closed.") - 2;
        i = closeIndex;
      } else {
        const tagData = readTagExp(xmlData, i, false)

        if (tagData) {
          const openTagName = tagData && tagData.tagName;
          if (openTagName === tagName && tagData.tagExp[tagData.tagExp.length - 1] !== "/") {
            openTagCount++;
          }
          i = tagData.closeIndex;
        }
      }
    }
  }//end for loop
}

function parseValue(val, shouldParse, options) {
  if (shouldParse && typeof val === 'string') {
    //console.log(options)
    const newval = val.trim();
    if (newval === 'true') return true;
    else if (newval === 'false') return false;
    else return toNumber(val, options);
  } else {
    if ((0,util/* isExist */.yQ)(val)) {
      return val;
    } else {
      return '';
    }
  }
}

function fromCodePoint(str, base, prefix) {
  const codePoint = Number.parseInt(str, base);

  if (codePoint >= 0 && codePoint <= 0x10FFFF) {
    return String.fromCodePoint(codePoint);
  } else {
    return prefix + str + ";";
  }
}

function transformTagName(fn, tagName, tagExp, options) {
  if (fn) {
    const newTagName = fn(tagName);
    if (tagExp === tagName) {
      tagExp = newTagName
    }
    tagName = newTagName;
  }
  tagName = sanitizeName(tagName, options);
  return { tagName, tagExp };
}



function sanitizeName(name, options) {
  if (util/* criticalProperties */.vl.includes(name)) {
    throw new Error(`[SECURITY] Invalid name: "${name}" is a reserved JavaScript keyword that could cause prototype pollution`);
  } else if (util/* DANGEROUS_PROPERTY_NAMES */.q9.includes(name)) {
    return options.onDangerousProperty(name);
  }
  return name;
}
;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/xmlparser/node2json.js





const node2json_METADATA_SYMBOL = XmlNode.getMetaDataSymbol();

/**
 * Helper function to strip attribute prefix from attribute map
 * @param {object} attrs - Attributes with prefix (e.g., {"@_class": "code"})
 * @param {string} prefix - Attribute prefix to remove (e.g., "@_")
 * @returns {object} Attributes without prefix (e.g., {"class": "code"})
 */
function stripAttributePrefix(attrs, prefix) {
  if (!attrs || typeof attrs !== 'object') return {};
  if (!prefix) return attrs;

  const rawAttrs = {};
  for (const key in attrs) {
    if (key.startsWith(prefix)) {
      const rawName = key.substring(prefix.length);
      rawAttrs[rawName] = attrs[key];
    } else {
      // Attribute without prefix (shouldn't normally happen, but be safe)
      rawAttrs[key] = attrs[key];
    }
  }
  return rawAttrs;
}

/**
 * 
 * @param {array} node 
 * @param {any} options 
 * @param {Matcher} matcher - Path matcher instance
 * @returns 
 */
function prettify(node, options, matcher, readonlyMatcher) {
  return compress(node, options, matcher, readonlyMatcher);
}

/**
 * @param {array} arr 
 * @param {object} options 
 * @param {Matcher} matcher - Path matcher instance
 * @returns object
 */
function compress(arr, options, matcher, readonlyMatcher) {
  let text;
  const compressedObj = {}; //This is intended to be a plain object
  for (let i = 0; i < arr.length; i++) {
    const tagObj = arr[i];
    const property = propName(tagObj);

    // Push current property to matcher WITH RAW ATTRIBUTES (no prefix)
    if (property !== undefined && property !== options.textNodeName) {
      const rawAttrs = stripAttributePrefix(
        tagObj[":@"] || {},
        options.attributeNamePrefix
      );
      matcher.push(property, rawAttrs);
    }

    if (property === options.textNodeName) {
      if (text === undefined) text = tagObj[property];
      else text += "" + tagObj[property];
    } else if (property === undefined) {
      continue;
    } else if (tagObj[property]) {

      let val = compress(tagObj[property], options, matcher, readonlyMatcher);
      const isLeaf = isLeafTag(val, options);

      if (Object.keys(val).length === 0 && options.alwaysCreateTextNode) {
        val[options.textNodeName] = "";
      }

      if (tagObj[":@"]) {
        assignAttributes(val, tagObj[":@"], readonlyMatcher, options);
      } else if (Object.keys(val).length === 1 && val[options.textNodeName] !== undefined && !options.alwaysCreateTextNode) {
        val = val[options.textNodeName];
      } else if (Object.keys(val).length === 0) {
        if (options.alwaysCreateTextNode) val[options.textNodeName] = "";
        else val = "";
      }

      if (tagObj[node2json_METADATA_SYMBOL] !== undefined && typeof val === "object" && val !== null) {
        val[node2json_METADATA_SYMBOL] = tagObj[node2json_METADATA_SYMBOL]; // copy over metadata
      }


      if (compressedObj[property] !== undefined && Object.prototype.hasOwnProperty.call(compressedObj, property)) {
        if (!Array.isArray(compressedObj[property])) {
          compressedObj[property] = [compressedObj[property]];
        }
        compressedObj[property].push(val);
      } else {
        //TODO: if a node is not an array, then check if it should be an array
        //also determine if it is a leaf node

        // Pass jPath string or readonlyMatcher based on options.jPath setting
        const jPathOrMatcher = options.jPath ? readonlyMatcher.toString() : readonlyMatcher;
        if (options.isArray(property, jPathOrMatcher, isLeaf)) {
          compressedObj[property] = [val];
        } else {
          compressedObj[property] = val;
        }
      }

      // Pop property from matcher after processing
      if (property !== undefined && property !== options.textNodeName) {
        matcher.pop();
      }
    }

  }
  // if(text && text.length > 0) compressedObj[options.textNodeName] = text;
  if (typeof text === "string") {
    if (text.length > 0) compressedObj[options.textNodeName] = text;
  } else if (text !== undefined) compressedObj[options.textNodeName] = text;


  return compressedObj;
}

function propName(obj) {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (key !== ":@") return key;
  }
}

function assignAttributes(obj, attrMap, readonlyMatcher, options) {
  if (attrMap) {
    const keys = Object.keys(attrMap);
    const len = keys.length; //don't make it inline
    for (let i = 0; i < len; i++) {
      const atrrName = keys[i];  // This is the PREFIXED name (e.g., "@_class")

      // Strip prefix for matcher path (for isArray callback)
      const rawAttrName = atrrName.startsWith(options.attributeNamePrefix)
        ? atrrName.substring(options.attributeNamePrefix.length)
        : atrrName;

      // For attributes, we need to create a temporary path
      // Pass jPath string or matcher based on options.jPath setting
      const jPathOrMatcher = options.jPath
        ? readonlyMatcher.toString() + "." + rawAttrName
        : readonlyMatcher;

      if (options.isArray(atrrName, jPathOrMatcher, true, true)) {
        obj[atrrName] = [attrMap[atrrName]];
      } else {
        obj[atrrName] = attrMap[atrrName];
      }
    }
  }
}

function isLeafTag(obj, options) {
  const { textNodeName } = options;
  const propCount = Object.keys(obj).length;

  if (propCount === 0) {
    return true;
  }

  if (
    propCount === 1 &&
    (obj[textNodeName] || typeof obj[textNodeName] === "boolean" || obj[textNodeName] === 0)
  ) {
    return true;
  }

  return false;
}
// EXTERNAL MODULE: ./node_modules/fast-xml-parser/src/validator.js
var validator = __webpack_require__(1176);
;// CONCATENATED MODULE: ./node_modules/fast-xml-parser/src/xmlparser/XMLParser.js






class XMLParser {

    constructor(options) {
        this.externalEntities = {};
        this.options = buildOptions(options);

    }
    /**
     * Parse XML dats to JS object 
     * @param {string|Uint8Array} xmlData 
     * @param {boolean|Object} validationOption 
     */
    parse(xmlData, validationOption) {
        if (typeof xmlData !== "string" && xmlData.toString) {
            xmlData = xmlData.toString();
        } else if (typeof xmlData !== "string") {
            throw new Error("XML data is accepted in String or Bytes[] form.")
        }

        if (validationOption) {
            if (validationOption === true) validationOption = {}; //validate with default options

            const result = (0,validator/* validate */.t)(xmlData, validationOption);
            if (result !== true) {
                throw Error(`${result.err.msg}:${result.err.line}:${result.err.col}`)
            }
        }
        const orderedObjParser = new OrderedObjParser(this.options, this.externalEntities);
        // orderedObjParser.entityDecoder.setExternalEntities(this.externalEntities);
        const orderedResult = orderedObjParser.parseXml(xmlData);
        if (this.options.preserveOrder || orderedResult === undefined) return orderedResult;
        else return prettify(orderedResult, this.options, orderedObjParser.matcher, orderedObjParser.readonlyMatcher);
    }

    /**
     * Add Entity which is not by default supported by this library
     * @param {string} key 
     * @param {string} value 
     */
    addEntity(key, value) {
        if (value.indexOf("&") !== -1) {
            throw new Error("Entity value can't have '&'")
        } else if (key.indexOf("&") !== -1 || key.indexOf(";") !== -1) {
            throw new Error("An entity must be set without '&' and ';'. Eg. use '#xD' for '&#xD;'")
        } else if (value === "&") {
            throw new Error("An entity with value '&' is not permitted");
        } else {
            this.externalEntities[key] = value;
        }
    }

    /**
     * Returns a Symbol that can be used to access the metadata
     * property on a node.
     * 
     * If Symbol is not available in the environment, an ordinary property is used
     * and the name of the property is here returned.
     * 
     * The XMLMetaData property is only present when `captureMetaData`
     * is true in the options.
     */
    static getMetaDataSymbol() {
        return XmlNode.getMetaDataSymbol();
    }
}

/***/ }),

/***/ 3945:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (/* binding */ Expression)
/* harmony export */ });
/**
 * Expression - Parses and stores a tag pattern expression
 * 
 * Patterns are parsed once and stored in an optimized structure for fast matching.
 * 
 * @example
 * const expr = new Expression("root.users.user");
 * const expr2 = new Expression("..user[id]:first");
 * const expr3 = new Expression("root/users/user", { separator: '/' });
 */
class Expression {
  /**
   * Create a new Expression
   * @param {string} pattern - Pattern string (e.g., "root.users.user", "..user[id]")
   * @param {Object} options - Configuration options
   * @param {string} options.separator - Path separator (default: '.')
   */
  constructor(pattern, options = {}, data) {
    this.pattern = pattern;
    this.separator = options.separator || '.';
    this.segments = this._parse(pattern);
    this.data = data;
    // Cache expensive checks for performance (O(1) instead of O(n))
    this._hasDeepWildcard = this.segments.some(seg => seg.type === 'deep-wildcard');
    this._hasAttributeCondition = this.segments.some(seg => seg.attrName !== undefined);
    this._hasPositionSelector = this.segments.some(seg => seg.position !== undefined);
  }

  /**
   * Parse pattern string into segments
   * @private
   * @param {string} pattern - Pattern to parse
   * @returns {Array} Array of segment objects
   */
  _parse(pattern) {
    const segments = [];

    // Split by separator but handle ".." specially
    let i = 0;
    let currentPart = '';

    while (i < pattern.length) {
      if (pattern[i] === this.separator) {
        // Check if next char is also separator (deep wildcard)
        if (i + 1 < pattern.length && pattern[i + 1] === this.separator) {
          // Flush current part if any
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
            currentPart = '';
          }
          // Add deep wildcard
          segments.push({ type: 'deep-wildcard' });
          i += 2; // Skip both separators
        } else {
          // Regular separator
          if (currentPart.trim()) {
            segments.push(this._parseSegment(currentPart.trim()));
          }
          currentPart = '';
          i++;
        }
      } else {
        currentPart += pattern[i];
        i++;
      }
    }

    // Flush remaining part
    if (currentPart.trim()) {
      segments.push(this._parseSegment(currentPart.trim()));
    }

    return segments;
  }

  /**
   * Parse a single segment
   * @private
   * @param {string} part - Segment string (e.g., "user", "ns::user", "user[id]", "ns::user:first")
   * @returns {Object} Segment object
   */
  _parseSegment(part) {
    const segment = { type: 'tag' };

    // NEW NAMESPACE SYNTAX (v2.0):
    // ============================
    // Namespace uses DOUBLE colon (::)
    // Position uses SINGLE colon (:)
    // 
    // Examples:
    //   "user"              → tag
    //   "user:first"        → tag + position
    //   "user[id]"          → tag + attribute
    //   "user[id]:first"    → tag + attribute + position
    //   "ns::user"          → namespace + tag
    //   "ns::user:first"    → namespace + tag + position
    //   "ns::user[id]"      → namespace + tag + attribute
    //   "ns::user[id]:first" → namespace + tag + attribute + position
    //   "ns::first"         → namespace + tag named "first" (NO ambiguity!)
    //
    // This eliminates all ambiguity:
    //   :: = namespace separator
    //   :  = position selector
    //   [] = attributes

    // Step 1: Extract brackets [attr] or [attr=value]
    let bracketContent = null;
    let withoutBrackets = part;

    const bracketMatch = part.match(/^([^\[]+)(\[[^\]]*\])(.*)$/);
    if (bracketMatch) {
      withoutBrackets = bracketMatch[1] + bracketMatch[3];
      if (bracketMatch[2]) {
        const content = bracketMatch[2].slice(1, -1);
        if (content) {
          bracketContent = content;
        }
      }
    }

    // Step 2: Check for namespace (double colon ::)
    let namespace = undefined;
    let tagAndPosition = withoutBrackets;

    if (withoutBrackets.includes('::')) {
      const nsIndex = withoutBrackets.indexOf('::');
      namespace = withoutBrackets.substring(0, nsIndex).trim();
      tagAndPosition = withoutBrackets.substring(nsIndex + 2).trim(); // Skip ::

      if (!namespace) {
        throw new Error(`Invalid namespace in pattern: ${part}`);
      }
    }

    // Step 3: Parse tag and position (single colon :)
    let tag = undefined;
    let positionMatch = null;

    if (tagAndPosition.includes(':')) {
      const colonIndex = tagAndPosition.lastIndexOf(':'); // Use last colon for position
      const tagPart = tagAndPosition.substring(0, colonIndex).trim();
      const posPart = tagAndPosition.substring(colonIndex + 1).trim();

      // Verify position is a valid keyword
      const isPositionKeyword = ['first', 'last', 'odd', 'even'].includes(posPart) ||
        /^nth\(\d+\)$/.test(posPart);

      if (isPositionKeyword) {
        tag = tagPart;
        positionMatch = posPart;
      } else {
        // Not a valid position keyword, treat whole thing as tag
        tag = tagAndPosition;
      }
    } else {
      tag = tagAndPosition;
    }

    if (!tag) {
      throw new Error(`Invalid segment pattern: ${part}`);
    }

    segment.tag = tag;
    if (namespace) {
      segment.namespace = namespace;
    }

    // Step 4: Parse attributes
    if (bracketContent) {
      if (bracketContent.includes('=')) {
        const eqIndex = bracketContent.indexOf('=');
        segment.attrName = bracketContent.substring(0, eqIndex).trim();
        segment.attrValue = bracketContent.substring(eqIndex + 1).trim();
      } else {
        segment.attrName = bracketContent.trim();
      }
    }

    // Step 5: Parse position selector
    if (positionMatch) {
      const nthMatch = positionMatch.match(/^nth\((\d+)\)$/);
      if (nthMatch) {
        segment.position = 'nth';
        segment.positionValue = parseInt(nthMatch[1], 10);
      } else {
        segment.position = positionMatch;
      }
    }

    return segment;
  }

  /**
   * Get the number of segments
   * @returns {number}
   */
  get length() {
    return this.segments.length;
  }

  /**
   * Check if expression contains deep wildcard
   * @returns {boolean}
   */
  hasDeepWildcard() {
    return this._hasDeepWildcard;
  }

  /**
   * Check if expression has attribute conditions
   * @returns {boolean}
   */
  hasAttributeCondition() {
    return this._hasAttributeCondition;
  }

  /**
   * Check if expression has position selectors
   * @returns {boolean}
   */
  hasPositionSelector() {
    return this._hasPositionSelector;
  }

  /**
   * Get string representation
   * @returns {string}
   */
  toString() {
    return this.pattern;
  }
}

/***/ }),

/***/ 8257:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   A: () => (/* binding */ Matcher)
/* harmony export */ });
/* unused harmony export MatcherView */


/**
 * MatcherView - A lightweight read-only view over a Matcher's internal state.
 *
 * Created once by Matcher and reused across all callbacks. Holds a direct
 * reference to the parent Matcher so it always reflects current parser state
 * with zero copying or freezing overhead.
 *
 * Users receive this via {@link Matcher#readOnly} or directly from parser
 * callbacks. It exposes all query and matching methods but has no mutation
 * methods — misuse is caught at the TypeScript level rather than at runtime.
 *
 * @example
 * const matcher = new Matcher();
 * const view = matcher.readOnly();
 *
 * matcher.push("root", {});
 * view.getCurrentTag(); // "root"
 * view.getDepth();      // 1
 */
class MatcherView {
  /**
   * @param {Matcher} matcher - The parent Matcher instance to read from.
   */
  constructor(matcher) {
    this._matcher = matcher;
  }

  /**
   * Get the path separator used by the parent matcher.
   * @returns {string}
   */
  get separator() {
    return this._matcher.separator;
  }

  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    const path = this._matcher.path;
    return path.length > 0 ? path[path.length - 1].tag : undefined;
  }

  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    const path = this._matcher.path;
    return path.length > 0 ? path[path.length - 1].namespace : undefined;
  }

  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    const path = this._matcher.path;
    if (path.length === 0) return undefined;
    return path[path.length - 1].values?.[attrName];
  }

  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    const path = this._matcher.path;
    if (path.length === 0) return false;
    const current = path[path.length - 1];
    return current.values !== undefined && attrName in current.values;
  }

  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {*}
   */
  getAnyParentAttr(attrName) {
    return this._matcher.getAnyParentAttr(attrName);
  }

  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    return this._matcher.hasAnyParentAttr(attrName);
  }

  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    const path = this._matcher.path;
    if (path.length === 0) return -1;
    return path[path.length - 1].position ?? 0;
  }

  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    const path = this._matcher.path;
    if (path.length === 0) return -1;
    return path[path.length - 1].counter ?? 0;
  }

  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }

  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this._matcher.path.length;
  }

  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    return this._matcher.toString(separator, includeNamespace);
  }

  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this._matcher.path.map(n => n.tag);
  }

  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    return this._matcher.matches(expression);
  }

  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this._matcher);
  }
}

/**
 * Matcher - Tracks current path in XML/JSON tree and matches against Expressions.
 *
 * The matcher maintains a stack of nodes representing the current path from root to
 * current tag. It only stores attribute values for the current (top) node to minimize
 * memory usage. Sibling tracking is used to auto-calculate position and counter.
 *
 * Use {@link Matcher#readOnly} to obtain a {@link MatcherView} safe to pass to
 * user callbacks — it always reflects current state with no Proxy overhead.
 *
 * @example
 * const matcher = new Matcher();
 * matcher.push("root", {});
 * matcher.push("users", {});
 * matcher.push("user", { id: "123", type: "admin" });
 *
 * const expr = new Expression("root.users.user");
 * matcher.matches(expr); // true
 */
class Matcher {
  /**
   * Create a new Matcher.
   * @param {Object} [options={}]
   * @param {string} [options.separator='.'] - Default path separator
   */
  constructor(options = {}) {
    this.separator = options.separator || '.';
    this.path = [];
    this.siblingStacks = [];
    // Each path node: { tag, values, position, counter, namespace? }
    // values only present for current (last) node
    // Each siblingStacks entry: Map<tagName, count> tracking occurrences at each level
    this._pathStringCache = null;
    this._view = new MatcherView(this);

    // Kept-attribute stack: only populated when push() is called with options.keep.
    this._keptAttrs = [];
  }

  /**
   * Push a new tag onto the path.
   * @param {string} tagName
   * @param {Object|null} [attrValues=null]
   * @param {string|null} [namespace=null]
   * @param {Object|null} [options=null]
   * @param {string[]} [options.keep] - Names of attributes (from attrValues)
   */
  push(tagName, attrValues = null, namespace = null, options = null) {
    this._pathStringCache = null;

    // Remove values from previous current node (now becoming ancestor)
    if (this.path.length > 0) {
      this.path[this.path.length - 1].values = undefined;
    }

    // Get or create sibling tracking for current level
    const currentLevel = this.path.length;
    let level = this.siblingStacks[currentLevel];
    if (!level) {
      // `counts` tells same-name siblings apart (the "counter" — nth <item>
      // among other <item>s). `total` is every child seen at this level so
      // far, kept as a running number instead of re-added from `counts` on
      // every push — a parent with many differently-named children would
      // otherwise cost more per child the more distinct names it has.
      level = { counts: new Map(), total: 0 };
      this.siblingStacks[currentLevel] = level;
    }

    // Create a unique key for sibling tracking that includes namespace
    const siblingKey = namespace ? `${namespace}:${tagName}` : tagName;

    // Calculate counter (how many times this tag appeared at this level)
    const counter = level.counts.get(siblingKey) || 0;

    // Position = total children at this level seen before this one.
    const position = level.total;

    // Update sibling count for this tag, and the level's running total.
    level.counts.set(siblingKey, counter + 1);
    level.total++;

    // Create new node
    const node = {
      tag: tagName,
      position: position,
      counter: counter
    };

    if (namespace !== null && namespace !== undefined) {
      node.namespace = namespace;
    }

    if (attrValues !== null && attrValues !== undefined) {
      node.values = attrValues;
    }

    this.path.push(node);

    // Depth of the node we just pushed (1-based, matches this.path.length)
    const depth = this.path.length;

    // Copy only the requested attributes into the kept-attrs stack. This is
    // the one part of push() whose cost scales with input (O(keep.length))
    // rather than being O(1) — by design, since the caller is explicitly
    // opting in for specific attribute names. No options/keep => zero added
    // cost beyond the two property reads below.
    const keep = options !== null ? options.keep : null;
    if (keep !== null && keep !== undefined && keep.length > 0 && attrValues) {
      for (let i = 0; i < keep.length; i++) {
        const name = keep[i];
        if (attrValues[name] !== undefined) {
          this._keptAttrs.push({ depth, name, value: attrValues[name] });
        }
      }
    }
  }

  /**
   * Pop the last tag from the path.
   * @returns {Object|undefined} The popped node
   */
  pop() {
    if (this.path.length === 0) return undefined;
    this._pathStringCache = null;

    const node = this.path.pop();

    if (this.siblingStacks.length > this.path.length + 1) {
      this.siblingStacks.length = this.path.length + 1;
    }

    // Drop any kept attributes that belonged to the popped node (or deeper).
    // _keptAttrs is depth-ordered (push only ever appends increasing depths),
    // so this is a backward scan that stops at the first surviving entry —
    // typically O(1) since kept attrs are rare by design.
    const poppedDepth = this.path.length + 1;
    while (
      this._keptAttrs.length > 0 &&
      this._keptAttrs[this._keptAttrs.length - 1].depth >= poppedDepth
    ) {
      this._keptAttrs.pop();
    }

    return node;
  }

  /**
   * Update current node's attribute values.
   * Useful when attributes are parsed after push.
   * @param {Object} attrValues
   */
  updateCurrent(attrValues) {
    if (this.path.length > 0) {
      const current = this.path[this.path.length - 1];
      if (attrValues !== null && attrValues !== undefined) {
        current.values = attrValues;
      }
    }
  }

  /**
   * Get current tag name.
   * @returns {string|undefined}
   */
  getCurrentTag() {
    return this.path.length > 0 ? this.path[this.path.length - 1].tag : undefined;
  }

  /**
   * Get current namespace.
   * @returns {string|undefined}
   */
  getCurrentNamespace() {
    return this.path.length > 0 ? this.path[this.path.length - 1].namespace : undefined;
  }

  /**
   * Get current node's attribute value.
   * @param {string} attrName
   * @returns {*}
   */
  getAttrValue(attrName) {
    if (this.path.length === 0) return undefined;
    return this.path[this.path.length - 1].values?.[attrName];
  }

  /**
   * Check if current node has an attribute.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAttr(attrName) {
    if (this.path.length === 0) return false;
    const current = this.path[this.path.length - 1];
    return current.values !== undefined && attrName in current.values;
  }

  /**
   * Get the value of a "kept" attribute from the nearest ancestor (or
   * current node) that declared it via `push(tag, attrs, ns, { keep: [...] })`.
   * Unlike getAttrValue(), this works regardless of how deep the path has
   * gone since the attribute was pushed — but only for attribute names that
   * were explicitly marked with `keep` at push time. Cost is proportional to
   * the number of currently-kept attributes (typically 0-3), not path depth.
   * @param {string} attrName
   * @returns {*} the value, or undefined if no ancestor kept this attribute
   */
  getAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].name === attrName) return kept[i].value;
    }
    return undefined;
  }

  /**
   * Check whether any ancestor (or the current node) kept the given
   * attribute via `push(tag, attrs, ns, { keep: [...] })`.
   * @param {string} attrName
   * @returns {boolean}
   */
  hasAnyParentAttr(attrName) {
    const kept = this._keptAttrs;
    for (let i = kept.length - 1; i >= 0; i--) {
      if (kept[i].name === attrName) return true;
    }
    return false;
  }

  /**
   * Get current node's sibling position (child index in parent).
   * @returns {number}
   */
  getPosition() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].position ?? 0;
  }

  /**
   * Get current node's repeat counter (occurrence count of this tag name).
   * @returns {number}
   */
  getCounter() {
    if (this.path.length === 0) return -1;
    return this.path[this.path.length - 1].counter ?? 0;
  }

  /**
   * Get current node's sibling index (alias for getPosition).
   * @returns {number}
   * @deprecated Use getPosition() or getCounter() instead
   */
  getIndex() {
    return this.getPosition();
  }

  /**
   * Get current path depth.
   * @returns {number}
   */
  getDepth() {
    return this.path.length;
  }

  /**
   * Get path as string.
   * @param {string} [separator] - Optional separator (uses default if not provided)
   * @param {boolean} [includeNamespace=true]
   * @returns {string}
   */
  toString(separator, includeNamespace = true) {
    const sep = separator || this.separator;
    const isDefault = (sep === this.separator && includeNamespace === true);

    if (isDefault) {
      if (this._pathStringCache !== null) {
        return this._pathStringCache;
      }
      const result = this.path.map(n =>
        (n.namespace) ? `${n.namespace}:${n.tag}` : n.tag
      ).join(sep);
      this._pathStringCache = result;
      return result;
    }

    return this.path.map(n =>
      (includeNamespace && n.namespace) ? `${n.namespace}:${n.tag}` : n.tag
    ).join(sep);
  }

  /**
   * Get path as array of tag names.
   * @returns {string[]}
   */
  toArray() {
    return this.path.map(n => n.tag);
  }

  /**
   * Reset the path to empty.
   */
  reset() {
    this._pathStringCache = null;
    this.path = [];
    this.siblingStacks = [];
    this._keptAttrs = [];
  }

  /**
   * Match current path against an Expression.
   * @param {Expression} expression
   * @returns {boolean}
   */
  matches(expression) {
    const segments = expression.segments;

    if (segments.length === 0) {
      return false;
    }

    if (expression.hasDeepWildcard()) {
      return this._matchWithDeepWildcard(segments);
    }

    return this._matchSimple(segments);
  }

  /**
   * @private
   */
  _matchSimple(segments) {
    if (this.path.length !== segments.length) {
      return false;
    }

    for (let i = 0; i < segments.length; i++) {
      if (!this._matchSegment(segments[i], this.path[i], i === this.path.length - 1)) {
        return false;
      }
    }

    return true;
  }

  /**
   * @private
   */
  _matchWithDeepWildcard(segments) {
    let pathIdx = this.path.length - 1;
    let segIdx = segments.length - 1;

    while (segIdx >= 0 && pathIdx >= 0) {
      const segment = segments[segIdx];

      if (segment.type === 'deep-wildcard') {
        segIdx--;

        if (segIdx < 0) {
          return true;
        }

        const nextSeg = segments[segIdx];
        let found = false;

        for (let i = pathIdx; i >= 0; i--) {
          if (this._matchSegment(nextSeg, this.path[i], i === this.path.length - 1)) {
            pathIdx = i - 1;
            segIdx--;
            found = true;
            break;
          }
        }

        if (!found) {
          return false;
        }
      } else {
        if (!this._matchSegment(segment, this.path[pathIdx], pathIdx === this.path.length - 1)) {
          return false;
        }
        pathIdx--;
        segIdx--;
      }
    }

    return segIdx < 0;
  }

  /**
   * @private
   */
  _matchSegment(segment, node, isCurrentNode) {
    if (segment.tag !== '*' && segment.tag !== node.tag) {
      return false;
    }

    if (segment.namespace !== undefined) {
      if (segment.namespace !== '*' && segment.namespace !== node.namespace) {
        return false;
      }
    }

    if (segment.attrName !== undefined) {
      if (!isCurrentNode) {
        return false;
      }

      if (!node.values || !(segment.attrName in node.values)) {
        return false;
      }

      if (segment.attrValue !== undefined) {
        if (String(node.values[segment.attrName]) !== String(segment.attrValue)) {
          return false;
        }
      }
    }

    if (segment.position !== undefined) {
      if (!isCurrentNode) {
        return false;
      }

      const counter = node.counter ?? 0;

      if (segment.position === 'first' && counter !== 0) {
        return false;
      } else if (segment.position === 'odd' && counter % 2 !== 1) {
        return false;
      } else if (segment.position === 'even' && counter % 2 !== 0) {
        return false;
      } else if (segment.position === 'nth' && counter !== segment.positionValue) {
        return false;
      }
    }

    return true;
  }

  /**
   * Match any expression in the given set against the current path.
   * @param {ExpressionSet} exprSet
   * @returns {boolean}
   */
  matchesAny(exprSet) {
    return exprSet.matchesAny(this);
  }

  /**
   * Create a snapshot of current state.
   * @returns {Object}
   */
  snapshot() {
    return {
      path: this.path.map(node => ({ ...node })),
      siblingStacks: this.siblingStacks.map(level => level ? { counts: new Map(level.counts), total: level.total } : level),
      keptAttrs: this._keptAttrs.map(entry => ({ ...entry }))
    };
  }

  /**
   * Restore state from snapshot.
   * @param {Object} snapshot
   */
  restore(snapshot) {
    this._pathStringCache = null;
    this.path = snapshot.path.map(node => ({ ...node }));
    this.siblingStacks = snapshot.siblingStacks.map(level => level ? { counts: new Map(level.counts), total: level.total } : level);
    this._keptAttrs = (snapshot.keptAttrs || []).map(entry => ({ ...entry }));
  }

  /**
   * Return the read-only {@link MatcherView} for this matcher.
   *
   * The same instance is returned on every call — no allocation occurs.
   * It always reflects the current parser state and is safe to pass to
   * user callbacks without risk of accidental mutation.
   *
   * @returns {MatcherView}
   *
   * @example
   * const view = matcher.readOnly();
   * // pass view to callbacks — it stays in sync automatically
   * view.matches(expr);       // ✓
   * view.getCurrentTag();     // ✓
   * // view.push(...)         // ✗ method does not exist — caught by TypeScript
   */
  readOnly() {
    return this._view;
  }
}


/***/ }),

/***/ 4658:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   fG: () => (/* binding */ qName),
/* harmony export */   fH: () => (/* binding */ createValidator)
/* harmony export */ });
/* unused harmony exports name, ncName, nmToken, nmTokens, validate, validateAll, sanitize */
/**
 * xml-naming
 * Validates XML Name productions as defined in the XML 1.0 and 1.1 specifications.
 * Covers: Name, NCName, QName, NMToken, NMTokens
 *
 * XML 1.0 spec: https://www.w3.org/TR/xml/#NT-Name
 * XML 1.1 spec: https://www.w3.org/TR/xml11/#NT-NameStartChar
 * XML NS spec:  https://www.w3.org/TR/xml-names/#NT-NCName
 */

// ---------------------------------------------------------------------------
// Character class strings — XML 1.0
//
// NameStartChar ::= ":" | [A-Z] | "_" | [a-z]
//   | [#xC0-#xD6]   | [#xD8-#xF6]   | [#xF8-#x2FF]
//   | [#x370-#x37D] | [#x37F-#x1FFF]    <- split to exclude #x0487
//   | [#x200C-#x200D]
//   | [#x2070-#x218F] | [#x2C00-#x2FEF]
//   | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD]
//
// NameChar ::= NameStartChar | "-" | "." | [0-9]
//   | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
//
// Note: \u0487 (Combining Cyrillic Millions Sign) was added in Unicode 4.0,
// after XML 1.0 was defined against Unicode 2.0. It falls inside the range
// \u037F-\u1FFF but must be excluded. We split that range into
// \u037F-\u0486 and \u0488-\u1FFF to exclude it explicitly.
// ---------------------------------------------------------------------------

const nameStartChar10 =
  ':A-Za-z_' +
  '\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF' +
  '\u0370-\u037D' +
  '\u037F-\u0486\u0488-\u1FFF' +  // split to exclude \u0487
  '\u200C-\u200D' +
  '\u2070-\u218F' +
  '\u2C00-\u2FEF' +
  '\u3001-\uD7FF' +
  '\uF900-\uFDCF' +
  '\uFDF0-\uFFFD';

const nameChar10 =
  nameStartChar10 +
  '\\-\\.\\d' +
  '\u00B7' +
  '\u0300-\u036F' +
  '\u203F-\u2040';

// ---------------------------------------------------------------------------
// Character class strings — XML 1.1
//
// Differences from XML 1.0:
//
// NameStartChar:
//   1.0 has split ranges: \u00C0-\u00D6, \u00D8-\u00F6, \u00F8-\u02FF
//   1.1 merges them into: \u00C0-\u02FF
//   (\u00D7 x and \u00F7 / are division symbols, excluded in both versions)
//
//   1.0 tops out at \uFFFD (BMP only)
//   1.1 adds \u{10000}-\u{EFFFF} (supplementary planes)
//   These require the /u flag on the RegExp — see buildRegexes below.
//
// NameChar:
//   1.1 adds \u0487 (Combining Cyrillic Millions Sign, added in Unicode 4.0)
// ---------------------------------------------------------------------------

const nameStartChar11 =
  ':A-Za-z_' +
  '\u00C0-\u02FF' +                    // merged — 1.0 had three split ranges here
  '\u0370-\u037D' +
  '\u037F-\u0486\u0488-\u1FFF' +       // split to exclude \u0487 (combining mark, never a NameStartChar)
  '\u200C-\u200D' +
  '\u2070-\u218F' +
  '\u2C00-\u2FEF' +
  '\u3001-\uD7FF' +
  '\uF900-\uFDCF' +
  '\uFDF0-\uFFFD' +
  '\u{10000}-\u{EFFFF}';     // supplementary planes — REQUIRES /u flag on RegExp

const nameChar11 =
  nameStartChar11 +
  '\\-\\.\\d' +
  '\u00B7' +
  '\u0300-\u036F' +
  '\u0487' +                 // Combining Cyrillic Millions Sign — valid in 1.1, not 1.0
  '\u203F-\u2040';

// ---------------------------------------------------------------------------
// Regex builders
//
// XML 1.0 regexes: no flags — BMP only, standard JS regex behaviour.
// XML 1.1 regexes: /u flag — required for \u{10000}-\u{EFFFF} to match actual
//   supplementary code points rather than lone surrogates (which are illegal XML).
// ---------------------------------------------------------------------------

const buildRegexes = (startChar, char, flags = '') => {
  const ncStart = startChar.replace(':', '');
  const ncChar = char.replace(':', '');
  const ncNamePat = `[${ncStart}][${ncChar}]*`;

  return {
    name: new RegExp(`^[${startChar}][${char}]*$`, flags),
    ncName: new RegExp(`^${ncNamePat}$`, flags),
    qName: new RegExp(`^${ncNamePat}(?::${ncNamePat})?$`, flags),
    nmToken: new RegExp(`^[${char}]+$`, flags),
    nmTokens: new RegExp(`^[${char}]+(?:\\s+[${char}]+)*$`, flags),
  };
};

const regexes10 = buildRegexes(nameStartChar10, nameChar10);       // no /u — BMP only
const regexes11 = buildRegexes(nameStartChar11, nameChar11, 'u');  // /u — enables \u{10000}-\u{EFFFF}

// ---------------------------------------------------------------------------
// ASCII-only fast path (opt-in, off by default)
//
// The XML 1.0 vs 1.1 NameStartChar/NameChar productions differ *only* in
// their non-ASCII ranges (merged vs split Latin-1 ranges, \u0487, and
// supplementary planes). Restricted to ASCII, both versions collapse to the
// same character classes, so a single regex pair covers both xmlVersion
// values — no /u flag needed.
//
// Rationale: unicode-aware regexes (the /u flag, required for XML 1.1's
// supplementary-plane range) are measurably slower in V8 than plain
// non-unicode regexes on the same input, even when the input is pure ASCII.
// For the common case — HTML/SVG ids, XML tags — names are ASCII, so callers
// who know this can opt in to skip the unicode-aware matching path entirely.
// This is a real but *conditional* win: mainly for XML 1.1 input (avoids /u),
// or at scale where the larger unicode character classes add engine
// overhead. It also changes behaviour (rejects legitimate non-ASCII XML
// 1.0/1.1 names), so it must never be silently enabled — hence off by
// default.
// ---------------------------------------------------------------------------

const nameStartCharAscii = ':A-Za-z_';
const nameCharAscii = nameStartCharAscii + '\\-\\.\\d';

const regexesAscii = buildRegexes(nameStartCharAscii, nameCharAscii); // no /u — ASCII only

const getRegexes = (xmlVersion = '1.0', asciiOnly = false) => {
  if (asciiOnly) return regexesAscii;
  return xmlVersion === '1.1' ? regexes11 : regexes10;
};

// ---------------------------------------------------------------------------
// Boolean validators
// ---------------------------------------------------------------------------

/**
 * Returns true if the string is a valid XML Name.
 * Colons are allowed anywhere (Name production).
 * Used for: DOCTYPE entity names, notation names, DTD element declarations.
 *
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 *   asciiOnly: skip unicode-aware matching, ASCII names only (default false).
 */
const name = (str, { xmlVersion = '1.0', asciiOnly = false } = {}) =>
  getRegexes(xmlVersion, asciiOnly).name.test(str);

/**
 * Returns true if the string is a valid NCName (Non-Colonized Name).
 * Colons are not permitted.
 * Used for: namespace prefixes, local names, SVG id attributes.
 *
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 *   asciiOnly: skip unicode-aware matching, ASCII names only (default false).
 */
const ncName = (str, { xmlVersion = '1.0', asciiOnly = false } = {}) =>
  getRegexes(xmlVersion, asciiOnly).ncName.test(str);

/**
 * Returns true if the string is a valid QName (Qualified Name).
 * Allows exactly one colon as a prefix separator: prefix:localName.
 * Used for: element and attribute names in namespace-aware XML/SVG.
 *
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 *   asciiOnly: skip unicode-aware matching, ASCII names only (default false).
 */
const qName = (str, { xmlVersion = '1.0', asciiOnly = false } = {}) =>
  getRegexes(xmlVersion, asciiOnly).qName.test(str);

/**
 * Returns true if the string is a valid NMToken.
 * Like Name but no restriction on the first character.
 * Used for: DTD NMTOKEN attribute values.
 *
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 *   asciiOnly: skip unicode-aware matching, ASCII names only (default false).
 */
const nmToken = (str, { xmlVersion = '1.0', asciiOnly = false } = {}) =>
  getRegexes(xmlVersion, asciiOnly).nmToken.test(str);

/**
 * Returns true if the string is a valid NMTokens value.
 * A whitespace-separated list of NMToken values.
 * Used for: DTD NMTOKENS attribute values.
 *
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 *   asciiOnly: skip unicode-aware matching, ASCII names only (default false).
 */
const nmTokens = (str, { xmlVersion = '1.0', asciiOnly = false } = {}) =>
  getRegexes(xmlVersion, asciiOnly).nmTokens.test(str);

// ---------------------------------------------------------------------------
// Memoized validator factory
//
// Real documents reuse a small vocabulary of tag/attribute names across many
// siblings (e.g. `id`, `class`, `href` repeated across hundreds of elements).
// The plain boolean validators above re-run the regex on every call
// regardless of repeats. `createValidator` returns a closure with a private
// string -> boolean cache, so repeated names after the first become O(1)
// lookups instead of regex tests.
//
// - opts (xmlVersion, asciiOnly) are fixed at creation time, so the regex is
//   resolved once, not on every call.
// - The cache is private to the returned closure — no shared/global state,
//   no cross-caller pollution.
// - `maxCacheSize` bounds memory: once the cache reaches this many entries,
//   it stops accepting new ones (existing entries keep serving hits; new
//   misses just fall through to the regex, uncached). This avoids unbounded
//   growth against adversarial/high-cardinality input (e.g. validating
//   attacker-supplied names with no repeats) without the cost/complexity of
//   a full LRU, and without the perf cliff of reset-and-refill thrashing.
// - Call `.reset()` on the returned function to clear the cache manually
//   (e.g. between unrelated parse calls).
// ---------------------------------------------------------------------------

const PRODUCTIONS = ['name', 'ncName', 'qName', 'nmToken', 'nmTokens'];

/**
 * Returns a memoized boolean validator function for a single production,
 * with opts fixed at creation time.
 *
 * @param {'name'|'ncName'|'qName'|'nmToken'|'nmTokens'} production
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean, maxCacheSize?: number }} [opts]
 *   maxCacheSize: max number of distinct strings to cache (default 2048).
 *   Once reached, new strings are validated but not cached; existing cached
 *   entries keep being served.
 * @returns {((str: string) => boolean) & { reset: () => void }}
 */
const createValidator = (production, { xmlVersion = '1.0', asciiOnly = false, maxCacheSize = 2048 } = {}) => {
  if (!PRODUCTIONS.includes(production)) {
    throw new TypeError(
      `Unknown production "${production}". Must be one of: ${PRODUCTIONS.join(', ')}`
    );
  }

  const regex = getRegexes(xmlVersion, asciiOnly)[production];
  let cache = new Map();

  const validator = (str) => {
    const cached = cache.get(str);
    if (cached !== undefined) return cached;

    const result = regex.test(str);
    if (cache.size < maxCacheSize) cache.set(str, result);
    return result;
  };

  validator.reset = () => { cache = new Map(); };

  return validator;
};

// ---------------------------------------------------------------------------
// Diagnostic validator
// ---------------------------------------------------------------------------

/**
 * Validates a string against a named production and returns a detailed result.
 *
 * @param {string} str
 * @param {'name'|'ncName'|'qName'|'nmToken'|'nmTokens'} production
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 * @returns {{ valid: boolean, production: string, input: string, reason?: string, position?: number }}
 */
const validate = (str, production, { xmlVersion = '1.0', asciiOnly = false } = {}) => {
  if (!PRODUCTIONS.includes(production)) {
    throw new TypeError(
      `Unknown production "${production}". Must be one of: ${PRODUCTIONS.join(', ')}`
    );
  }

  const validators = { name, ncName, qName, nmToken, nmTokens };
  const isValid = validators[production](str, { xmlVersion, asciiOnly });

  if (isValid) return { valid: true, production, input: str };

  let reason = 'Does not match the production rules';
  let position;

  // Diagnostic fallback char checks must mirror the same character set the
  // boolean validator above used, or the reported reason/position could
  // contradict the `valid: false` result (e.g. flagging a char as illegal
  // that the unicode-aware check would have accepted).
  const startCharPattern = asciiOnly ? /^[:A-Za-z_]/ : /^[:A-Za-z_\u00C0-\uFFFD]/;
  const namePattern = asciiOnly ? /[\w\-\\.:]/ : /[\w\-\\.:\u00B7\u00C0-\uFFFD]/;

  if (str.length === 0) {
    reason = 'Input is empty';
  } else if (production === 'ncName' && str.includes(':')) {
    position = str.indexOf(':');
    reason = 'Colon is not allowed in NCName';
  } else if (production === 'qName' && str.startsWith(':')) {
    reason = 'QName cannot start with a colon';
    position = 0;
  } else if (production === 'qName' && str.endsWith(':')) {
    reason = 'QName cannot end with a colon';
    position = str.length - 1;
  } else if (production === 'qName' && (str.match(/:/g) || []).length > 1) {
    reason = 'QName can have at most one colon';
    position = str.lastIndexOf(':');
  } else if (
    ['name', 'ncName', 'qName'].includes(production) &&
    !startCharPattern.test(str[0])
  ) {
    reason = `First character "${str[0]}" is not a valid NameStartChar`;
    position = 0;
  } else {
    for (let i = 0; i < str.length; i++) {
      if (!namePattern.test(str[i])) {
        reason = `Character "${str[i]}" at position ${i} is not a valid NameChar`;
        position = i;
        break;
      }
    }
  }

  return { valid: false, production, input: str, reason, position };
};

// ---------------------------------------------------------------------------
// Batch validator
// ---------------------------------------------------------------------------

/**
 * Validates an array of strings against a named production.
 *
 * @param {string[]} strings
 * @param {'name'|'ncName'|'qName'|'nmToken'|'nmTokens'} production
 * @param {{ xmlVersion?: '1.0'|'1.1', asciiOnly?: boolean }} [opts]
 * @returns {Array<{ valid: boolean, production: string, input: string, reason?: string, position?: number }>}
 */
const validateAll = (strings, production, opts = {}) =>
  strings.map(str => validate(str, production, opts));

// ---------------------------------------------------------------------------
// Sanitizer
// ---------------------------------------------------------------------------

/**
 * Transforms an invalid string into the nearest valid XML name for the given production.
 *
 * @param {string} str
 * @param {'name'|'ncName'|'qName'|'nmToken'|'nmTokens'} production
 * @param {{ replacement?: string, asciiOnly?: boolean }} [opts]
 *   asciiOnly: also replace any non-ASCII character, not just XML-illegal
 *   ones (default false).
 * @returns {string}
 */
const sanitize = (str, production = 'name', { replacement = '_', asciiOnly = false } = {}) => {
  if (!str) return replacement;

  let result = str;

  // Strip colons for NCName
  if (production === 'ncName') {
    result = result.replace(/:/g, '');
  }

  // Replace illegal characters
  const allowedCharPattern = asciiOnly ? /[^\w\-\.:]/g : /[^\w\-\.:\u00B7\u00C0-\uFFFD]/g;
  result = result.replace(allowedCharPattern, replacement);

  // Fix invalid start character for Name / NCName / QName
  if (production !== 'nmToken' && production !== 'nmTokens') {
    if (/^[\-\.\d]/.test(result)) {
      result = replacement + result;
    }
  }

  return result || replacement;
};

/***/ })

};

"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
let tempDirectory = process.env['RUNNER_TEMPDIRECTORY'] || '';
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
const exec = __importStar(require("@actions/exec"));
const tc = __importStar(require("@actions/tool-cache"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const semver = __importStar(require("semver"));
const httpm = __importStar(require("typed-rest-client/HttpClient"));
const IS_WINDOWS = process.platform === 'win32';
if (!tempDirectory) {
    let baseLocation;
    if (IS_WINDOWS) {
        // On windows use the USERPROFILE env variable
        baseLocation = process.env['USERPROFILE'] || 'C:\\';
    }
    else {
        if (process.platform === 'darwin') {
            baseLocation = '/Users';
        }
        else {
            baseLocation = '/home';
        }
    }
    tempDirectory = path.join(baseLocation, 'actions', 'temp');
}
function getJava(version, arch, jdkFile) {
    return __awaiter(this, void 0, void 0, function* () {
        let toolPath = tc.find('Java', version);
        if (toolPath) {
            core.debug(`Tool found in cache ${toolPath}`);
        }
        else {
            let compressedFileExtension = '';
            if (!jdkFile) {
                core.debug('Downloading Jdk from Azul');
                let http = new httpm.HttpClient('setup-java');
                let contents = yield (yield http.get('https://static.azul.com/zulu/bin/')).readBody();
                let refs = contents.match(/<a href.*\">/gi) || [];
                const downloadInfo = getDownloadInfo(refs, version);
                jdkFile = yield tc.downloadTool(downloadInfo.url);
                version = downloadInfo.version;
                compressedFileExtension = IS_WINDOWS ? '.zip' : '.tar.gz';
            }
            else {
                core.debug('Retrieving Jdk from local path');
            }
            compressedFileExtension = compressedFileExtension || getFileEnding(jdkFile);
            let tempDir = path.join(tempDirectory, 'temp_' + Math.floor(Math.random() * 2000000000));
            const jdkDir = yield unzipJavaDownload(jdkFile, compressedFileExtension, tempDir);
            core.debug(`jdk extracted to ${jdkDir}`);
            toolPath = yield tc.cacheDir(jdkDir, 'Java', getCacheVersionString(version), arch);
        }
        let extendedJavaHome = 'JAVA_HOME_' + version + '_' + arch;
        core.exportVariable('JAVA_HOME', toolPath);
        core.exportVariable(extendedJavaHome, toolPath);
        core.addPath(path.join(toolPath, 'bin'));
    });
}
exports.getJava = getJava;
function getCacheVersionString(version) {
    const versionArray = version.split('.');
    const major = versionArray[0];
    const minor = versionArray.length > 1 ? versionArray[1] : '0';
    const patch = versionArray.length > 2 ? versionArray[2] : '0';
    return `${major}.${minor}.${patch}`;
}
function getFileEnding(file) {
    let fileEnding = '';
    if (file.endsWith('.tar')) {
        fileEnding = '.tar';
    }
    else if (file.endsWith('.tar.gz')) {
        fileEnding = '.tar.gz';
    }
    else if (file.endsWith('.zip')) {
        fileEnding = '.zip';
    }
    else if (file.endsWith('.7z')) {
        fileEnding = '.7z';
    }
    else {
        throw new Error(`${file} has an unsupported file extension`);
    }
    return fileEnding;
}
function extractFiles(file, fileEnding, destinationFolder) {
    return __awaiter(this, void 0, void 0, function* () {
        const stats = fs.statSync(file);
        if (!stats) {
            throw new Error(`Failed to extract ${file} - it doesn't exist`);
        }
        else if (stats.isDirectory()) {
            throw new Error(`Failed to extract ${file} - it is a directory`);
        }
        if ('.tar' === fileEnding || '.tar.gz' === fileEnding) {
            yield tc.extractTar(file, destinationFolder);
        }
        else if ('.zip' === fileEnding) {
            yield tc.extractZip(file, destinationFolder);
        }
        else {
            // fall through and use sevenZip
            yield tc.extract7z(file, destinationFolder);
        }
    });
}
// This method recursively finds all .pack files under fsPath and unpacks them with the unpack200 tool
function unpackJars(fsPath, javaBinPath) {
    return __awaiter(this, void 0, void 0, function* () {
        if (fs.existsSync(fsPath)) {
            if (fs.lstatSync(fsPath).isDirectory()) {
                for (const file in fs.readdirSync(fsPath)) {
                    const curPath = path.join(fsPath, file);
                    yield unpackJars(curPath, javaBinPath);
                }
            }
            else if (path.extname(fsPath).toLowerCase() === '.pack') {
                // Unpack the pack file synchonously
                const p = path.parse(fsPath);
                const toolName = IS_WINDOWS ? 'unpack200.exe' : 'unpack200';
                const args = IS_WINDOWS ? '-r -v -l ""' : '';
                const name = path.join(p.dir, p.name);
                yield exec.exec(`"${path.join(javaBinPath, toolName)}"`, [
                    `${args} "${name}.pack" "${name}.jar"`
                ]);
            }
        }
    });
}
function unzipJavaDownload(repoRoot, fileEnding, destinationFolder, extension) {
    return __awaiter(this, void 0, void 0, function* () {
        // Create the destination folder if it doesn't exist
        yield io.mkdirP(destinationFolder);
        const jdkFile = path.normalize(repoRoot);
        const stats = fs.statSync(jdkFile);
        if (stats.isFile()) {
            yield extractFiles(jdkFile, fileEnding, destinationFolder);
            const jdkDirectory = path.join(destinationFolder, fs.readdirSync(destinationFolder)[0]);
            yield unpackJars(jdkDirectory, path.join(jdkDirectory, 'bin'));
            return jdkDirectory;
        }
        else {
            throw new Error(`Jdk argument ${jdkFile} is not a file`);
        }
    });
}
function getDownloadInfo(refs, version) {
    version = normalizeVersion(version);
    let extension = '';
    if (IS_WINDOWS) {
        extension = `-win_x64.zip`;
    }
    else {
        if (process.platform === 'darwin') {
            extension = `-macosx_x64.tar.gz`;
        }
        else {
            extension = `-linux_x64.tar.gz`;
        }
    }
    // Maps version to url
    let versionMap = new Map();
    // Filter by platform
    refs.forEach(ref => {
        if (ref.indexOf(extension) < 0) {
            return;
        }
        // If we haven't returned, means we're looking at the correct platform
        let versions = ref.match(/jdk.*-/gi) || [];
        if (versions.length > 1) {
            throw new Error(`Invalid ref received from https://static.azul.com/zulu/bin/: ${ref}`);
        }
        if (versions.length == 0) {
            return;
        }
        const refVersion = versions[0].slice('jdk'.length, versions[0].length - 1);
        if (semver.satisfies(refVersion, version)) {
            versionMap.set(refVersion, 'https://static.azul.com/zulu/bin/' +
                ref.slice('<a href="'.length, ref.length - '">'.length));
        }
    });
    // Choose the most recent satisfying version
    let curVersion = '0.0.0';
    let curUrl = '';
    for (const entry of versionMap.entries()) {
        const entryVersion = entry[0];
        const entryUrl = entry[1];
        if (semver.gt(entryVersion, curVersion)) {
            curUrl = entryUrl;
            curVersion = entryVersion;
        }
    }
    if (curUrl == '') {
        throw new Error(`No valid download found for version ${version}. Check https://static.azul.com/zulu/bin/ for a list of valid versions or download your own jdk file and add the jdkFile argument`);
    }
    return { version: curVersion, url: curUrl };
}
function normalizeVersion(version) {
    if (version.slice(0, 2) === '1.') {
        // Trim leading 1. for versions like 1.8
        version = version.slice(2);
        if (!version) {
            throw new Error('1. is not a valid version');
        }
    }
    // Add trailing .x if it is missing
    if (version.split('.').length != 3) {
        if (version[version.length - 1] != 'x') {
            version = version + '.x';
        }
    }
    return version;
}

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
const core = __importStar(require("@actions/core"));
const installer = __importStar(require("./installer"));
const path = __importStar(require("path"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let version = core.getInput('version');
            if (!version) {
                version = core.getInput('java-version', { required: true });
            }
            const arch = core.getInput('architecture', { required: true });
            const javaPackage = core.getInput('java-package', { required: true });
            const jdkFile = core.getInput('jdkFile', { required: false }) || '';
            yield installer.getJava(version, arch, jdkFile, javaPackage);
            const matchersPath = path.join(__dirname, '..', '.github');
            console.log(`##[add-matcher]${path.join(matchersPath, 'java.json')}`);
        }
        catch (error) {
            core.setFailed(error.message);
        }
    });
}
run();

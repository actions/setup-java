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
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const core = __importStar(require("@actions/core"));
const io = __importStar(require("@actions/io"));
exports.M2_DIR = '.m2';
exports.SETTINGS_FILE = 'settings.xml';
function configAuthentication(id, username, password) {
    return __awaiter(this, void 0, void 0, function* () {
        if (id && username && password) {
            console.log(`creating ${exports.SETTINGS_FILE} with server-id: ${id}, username: ${username}, and a password`);
            const directory = path.join(os.homedir(), exports.M2_DIR);
            yield io.mkdirP(directory);
            core.debug(`created directory ${directory}`);
            yield write(directory, generate(id, username, password));
        }
        else {
            core.debug(`no ${exports.SETTINGS_FILE} without server-id: ${id}, username: ${username}, and a password`);
        }
    });
}
exports.configAuthentication = configAuthentication;
// only exported for testing purposes
function generate(id, username, password) {
    return `
  <settings>
      <servers>
        <server>
          <id>${id}</id>
          <username>${username}</username>
          <password>${password}</password>
        </server>
      </servers>
  </settings>
  `;
}
exports.generate = generate;
function write(directory, settings) {
    return __awaiter(this, void 0, void 0, function* () {
        const options = { encoding: 'utf-8' };
        const location = path.join(directory, exports.SETTINGS_FILE);
        console.log(`writing ${location}`);
        return fs.writeFileSync(location, settings, options);
    });
}

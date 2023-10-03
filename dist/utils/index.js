"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getReleaseSource = exports.extractToLib = exports.downloadFlywaySource = exports.copyToBin = exports.cleanupDirs = void 0;
var _os = _interopRequireDefault(require("os"));
var _fsExtra = _interopRequireDefault(require("fs-extra"));
var _path = _interopRequireDefault(require("path"));
var _request = _interopRequireDefault(require("request"));
var _requestPromise = _interopRequireDefault(require("request-promise"));
var _requestProgress = _interopRequireDefault(require("request-progress"));
var _progress = _interopRequireDefault(require("progress"));
var _extractZip = _interopRequireDefault(require("extract-zip"));
var _child_process = require("child_process");
var _filesize = _interopRequireDefault(require("filesize"));
var _rimraf = require("rimraf");
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }
function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(o); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }
function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) arr2[i] = arr[i]; return arr2; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }
var env = process.env;
var repoBaseUrl = "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline";
var readDotFlywayFile = function readDotFlywayFile() {
  var resolveDotFlywayPath = _fsExtra["default"].existsSync(_path["default"].resolve(__dirname, "../../../../../", ".flyway")) ? _path["default"].resolve(__dirname, "../../../../../", ".flyway") : "";
  // console.log("readDotFlywayFile dotFlywayPath -> ", resolveDotFlywayPath);
  var encoding = "utf8";
  var version = resolveDotFlywayPath !== "" ? _fsExtra["default"].readFileSync(resolveDotFlywayPath, {
    encoding: encoding
  }) : "";
  version !== "" ? console.log("Found version in .flyway -> ", version) : "";
  return version.trim();
};

/**
 * @returns sources[os.platform()]
 */
var getReleaseSource = exports.getReleaseSource = function getReleaseSource() {
  return (0, _requestPromise["default"])({
    uri: "".concat(repoBaseUrl, "/maven-metadata.xml")
  }).then(function (response) {
    var releaseRegularExp = new RegExp("<release>(.+)</release>");
    var releaseVersion = readDotFlywayFile() || response.match(releaseRegularExp)[1];

    // console.log("getReleaseSource releaseVersion -> ", releaseVersion);
    var sources = {
      win32: {
        url: "".concat(repoBaseUrl, "/").concat(releaseVersion, "/flyway-commandline-").concat(releaseVersion, "-windows-x64.zip"),
        filename: "flyway-commandline-".concat(releaseVersion, "-windows-x64.zip"),
        folder: "flyway-".concat(releaseVersion)
      },
      linux: {
        url: "".concat(repoBaseUrl, "/").concat(releaseVersion, "/flyway-commandline-").concat(releaseVersion, "-linux-x64.tar.gz"),
        filename: "flyway-commandline-".concat(releaseVersion, "-linux-x64.tar.gz"),
        folder: "flyway-".concat(releaseVersion)
      },
      arm64: {
        url: "".concat(repoBaseUrl, "/").concat(releaseVersion, "/flyway-commandline-").concat(releaseVersion, "-macosx-arm64.tar.gz"),
        filename: "flyway-commandline-".concat(releaseVersion, "-macosx-arm64.tar.gz"),
        folder: "flyway-".concat(releaseVersion)
      },
      darwin: {
        url: "".concat(repoBaseUrl, "/").concat(releaseVersion, "/flyway-commandline-").concat(releaseVersion, "-macosx-x64.tar.gz"),
        filename: "flyway-commandline-".concat(releaseVersion, "-macosx-x64.tar.gz"),
        folder: "flyway-".concat(releaseVersion)
      }
    };

    // Apple Silicon version was released with 9.6.0
    if (_os["default"].platform() === "darwin" && _os["default"].arch() === "arm64") {
      var _releaseVersion$split = releaseVersion.split("."),
        _releaseVersion$split2 = _slicedToArray(_releaseVersion$split, 2),
        majorVersion = _releaseVersion$split2[0],
        minorVersion = _releaseVersion$split2[1];
      if (Number(majorVersion) > 9 || Number(majorVersion) === 9 && Number(minorVersion) >= 6) {
        return sources.arm64;
      }
    }
    return sources[_os["default"].platform()];
  });
};

// copied from https://github.com/getsentry/sentry-cli/blob/c65df4fba17101e60e8c31f378f6001b514e5a42/scripts/install.js#L123-L131
var getNpmCache = function getNpmCache() {
  return env.npm_config_cache || env.npm_config_cache_folder || env.npm_config_yarn_offline_mirror || (env.APPDATA ? _path["default"].join(env.APPDATA, 'npm-cache') : _path["default"].join(_os["default"].homedir(), '.npm'));
};

/**
 * @param {any} source
 * @returns source.filename
 */
var downloadFlywaySource = exports.downloadFlywaySource = function downloadFlywaySource(source) {
  var downloadDir = _path["default"].join(getNpmCache(), 'flywaydb-cli');
  if (!source) {
    throw new Error("Your platform is not supported");
  }
  source.filename = _path["default"].join(downloadDir, source.filename);
  if (_fsExtra["default"].existsSync(source.filename)) {
    console.log("Cached file exists, skipping download", source.filename);
    return Promise.resolve(source.filename);
  } else if (!_fsExtra["default"].existsSync(downloadDir)) {
    _fsExtra["default"].mkdirSync(downloadDir);
  }
  console.log("Downloading", source.url);
  console.log("Saving to", source.filename);
  return new Promise(function (resolve, reject) {
    var proxyUrl = env.npm_config_https_proxy || env.npm_config_http_proxy || env.npm_config_proxy;
    var downloadOptions = {
      uri: source.url,
      encoding: null,
      // Get response as a buffer
      followRedirect: true,
      headers: {
        "User-Agent": env.npm_config_user_agent
      },
      strictSSL: true,
      proxy: proxyUrl
    };
    var consoleDownloadBar;
    (0, _requestProgress["default"])((0, _request["default"])(downloadOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        _fsExtra["default"].writeFileSync(source.filename, body);
        console.log("\nReceived ".concat((0, _filesize["default"])(body.length), " total."));
        resolve(source.filename);
      } else if (response) {
        console.error("\n        Error requesting source.\n        Status: ".concat(response.statusCode, "\n        Request options: ").concat(JSON.stringify(downloadOptions, null, 2), "\n        Response headers: ").concat(JSON.stringify(response.headers, null, 2), "\n        Make sure your network and proxy settings are correct.\n\n        If you continue to have issues, please report this full log at https://github.com/sgraham/flywaydb-cli"));
        process.exit(1);
      } else {
        console.error("Error downloading : ", error);
        process.exit(1);
      }
    })).on("progress", function (state) {
      try {
        if (!consoleDownloadBar) {
          consoleDownloadBar = new _progress["default"]("  [:bar] :percent", {
            total: state.size.total,
            width: 40
          });
        }
        consoleDownloadBar.curr = state.size.transferred;
        consoleDownloadBar.tick();
      } catch (e) {
        console.log("error", e);
      }
    });
  });
};

/**
 * @param {any} file
 * @returns extractDir
 */
var extractToLib = exports.extractToLib = function extractToLib(file) {
  var extractDir = _path["default"].join(__dirname, "../../", "lib");
  if (!_fsExtra["default"].existsSync(extractDir)) {
    _fsExtra["default"].mkdirSync(extractDir);
  } else {
    (0, _rimraf.rimrafSync)(extractDir);
    _fsExtra["default"].mkdirSync(extractDir);
  }
  if (_path["default"].extname(file) === ".zip") {
    return new Promise(function (resolve, reject) {
      (0, _extractZip["default"])(file, {
        dir: extractDir
      }, function (err) {
        if (err) {
          console.error("Error extracting zip", err);
          reject(new Error("Error extracting zip"));
        } else {
          resolve(extractDir);
        }
      });
    });
  } else {
    return new Promise(function (resolve, reject) {
      (0, _child_process.spawn)("tar", ["zxf", file], {
        cwd: extractDir,
        stdio: "inherit"
      }).on("close", function (code) {
        if (code === 0) {
          resolve(extractDir);
        } else {
          console.log("Untaring file failed", code);
          reject(new Error("Untaring file failed"));
        }
      });
    });
  }
};

/**
 * @param {any} libDir
 * @returns
 */
var copyToBin = exports.copyToBin = function copyToBin(libDir) {
  return new Promise(function (resolve, reject) {
    var versionDirs = flywayVersionDir(libDir);
    var flywayDir = _path["default"].join(libDir, versionDirs[0]);
    var binDir = _path["default"].join(__dirname, "../../", "bin");
    if (_fsExtra["default"].existsSync(flywayDir)) {
      (0, _rimraf.rimrafSync)(_path["default"].join(__dirname, "../../", "bin"));
      if (_fsExtra["default"].existsSync(_path["default"].join(flywayDir, "jre", "lib", "amd64"))) {
        _fsExtra["default"].removeSync(_path["default"].join(flywayDir, "jre", "lib", "amd64", "server", "libjsig.so")); // Broken link, we need to delete it to avoid the copy to fail
      }

      _fsExtra["default"].copySync(flywayDir, binDir);
      resolve();
    } else {
      reject(new Error("flywayDir was not found at ".concat(flywayDir)));
    }
  });
};

/**
 * @param {any} libDir
 */
var flywayVersionDir = function flywayVersionDir(libDir) {
  return _fsExtra["default"].readdirSync(libDir).filter(function (file) {
    return _fsExtra["default"].statSync(_path["default"].join(libDir, file)).isDirectory();
  });
};
var cleanupDirs = exports.cleanupDirs = function cleanupDirs() {
  (0, _rimraf.rimrafSync)(_path["default"].join(__dirname, "../../", "lib"));
};
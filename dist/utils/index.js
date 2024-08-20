"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.cleanupDirs = exports.copyToBin = exports.extractToLib = exports.downloadFlywaySource = exports.getReleaseSource = undefined;

var _nodeOs = require("node:os");

var _nodeOs2 = _interopRequireDefault(_nodeOs);

var _nodeFs = require("node:fs");

var _nodeFs2 = _interopRequireDefault(_nodeFs);

var _nodePath = require("node:path");

var _nodePath2 = _interopRequireDefault(_nodePath);

var _nodeChild_process = require("node:child_process");

var _undici = require("undici");

var _extractZip = require("extract-zip");

var _extractZip2 = _interopRequireDefault(_extractZip);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const env = process.env;

const repoBaseUrl = "https://repo1.maven.org/maven2/org/flywaydb/flyway-commandline";

const readDotFlywayFile = () => {
  const dotFlywayPath = _nodePath2.default.resolve(__dirname, "../../../../../", ".flyway");

  if (!_nodeFs2.default.existsSync(dotFlywayPath)) {
    return '';
  }

  const version = _nodeFs2.default.readFileSync(dotFlywayPath, { encoding: 'utf8' });
  console.log("Found version in .flyway -> ", version);
  return version.trim();
};

/**
 * @returns sources[os.platform()]
 */
const getReleaseSource = exports.getReleaseSource = () => (0, _undici.fetch)(`${repoBaseUrl}/maven-metadata.xml`).then(resp => resp.text()).then(response => {
  let releaseRegularExp = new RegExp("<release>(.+)</release>");
  let releaseVersion = readDotFlywayFile() || response.match(releaseRegularExp)[1];

  let sources = {
    win32: {
      url: `${repoBaseUrl}/${releaseVersion}/flyway-commandline-${releaseVersion}-windows-x64.zip`,
      filename: `flyway-commandline-${releaseVersion}-windows-x64.zip`,
      folder: `flyway-${releaseVersion}`
    },
    linux: {
      url: `${repoBaseUrl}/${releaseVersion}/flyway-commandline-${releaseVersion}-linux-x64.tar.gz`,
      filename: `flyway-commandline-${releaseVersion}-linux-x64.tar.gz`,
      folder: `flyway-${releaseVersion}`
    },
    arm64: {
      url: `${repoBaseUrl}/${releaseVersion}/flyway-commandline-${releaseVersion}-macosx-arm64.tar.gz`,
      filename: `flyway-commandline-${releaseVersion}-macosx-arm64.tar.gz`,
      folder: `flyway-${releaseVersion}`
    },
    darwin: {
      url: `${repoBaseUrl}/${releaseVersion}/flyway-commandline-${releaseVersion}-macosx-x64.tar.gz`,
      filename: `flyway-commandline-${releaseVersion}-macosx-x64.tar.gz`,
      folder: `flyway-${releaseVersion}`
    }
  };

  // Apple Silicon version was released with 9.6.0
  if (_nodeOs2.default.platform() === "darwin" && _nodeOs2.default.arch() === "arm64") {
    const [majorVersion, minorVersion] = releaseVersion.split(".");
    if (Number(majorVersion) > 9 || Number(majorVersion) === 9 && Number(minorVersion) >= 6) {
      return sources.arm64;
    }
  }

  return sources[_nodeOs2.default.platform()];
});

// copied from https://github.com/getsentry/sentry-cli/blob/c65df4fba17101e60e8c31f378f6001b514e5a42/scripts/install.js#L123-L131
const getNpmCache = () => {
  return env.npm_config_cache || env.npm_config_cache_folder || env.npm_config_yarn_offline_mirror || (env.APPDATA ? _nodePath2.default.join(env.APPDATA, 'npm-cache') : _nodePath2.default.join(_nodeOs2.default.homedir(), '.npm'));
};

/**
 * @param {any} source
 * @returns source.filename
 */
const downloadFlywaySource = exports.downloadFlywaySource = source => {
  let downloadDir = _nodePath2.default.join(getNpmCache(), 'flywaydb-cli');

  if (!source) {
    throw new Error("Your platform is not supported");
  }

  source.filename = _nodePath2.default.join(downloadDir, source.filename);
  if (_nodeFs2.default.existsSync(source.filename)) {
    console.log("Cached file exists, skipping download", source.filename);
    return Promise.resolve(source.filename);
  } else if (!_nodeFs2.default.existsSync(downloadDir)) {
    _nodeFs2.default.mkdirSync(downloadDir);
  }

  console.log("Downloading", source.url);

  const proxyUrl = env.npm_config_https_proxy || env.npm_config_http_proxy || env.npm_config_proxy;

  return (0, _undici.fetch)(source.url, {
    redirect: 'follow',
    headers: { 'User-Agent': env.npm_config_user_agent },
    dispatcher: proxyUrl ? new _undici.ProxyAgent(proxyUrl) : undefined
  }).then(resp => {
    if (!resp.ok) {
      throw new Error(`Error requesting source: ${source.url}.
        Status: ${response.statusCode}
        Proxy URL: ${proxyUrl}
        Response headers: ${JSON.stringify(response.headers, null, 2)}
        Make sure your network and proxy settings are correct.

        If you continue to have issues, please report this full log at https://github.com/sgraham/flywaydb-cli`);
    }

    return resp.arrayBuffer();
  }).then(body => {
    _nodeFs2.default.writeFileSync(source.filename, Buffer.from(new Uint8Array(body)));
    return source.filename;
  });
};

/**
 * @param {any} file
 * @returns extractDir
 */
const extractToLib = exports.extractToLib = file => {
  let extractDir = _nodePath2.default.join(__dirname, "../../", "lib");

  if (!_nodeFs2.default.existsSync(extractDir)) {
    _nodeFs2.default.mkdirSync(extractDir);
  } else {
    _nodeFs2.default.rmSync(extractDir, { recursive: true, force: true });
    _nodeFs2.default.mkdirSync(extractDir);
  }

  if (_nodePath2.default.extname(file) === ".zip") {
    return new Promise((resolve, reject) => {
      (0, _extractZip2.default)(file, { dir: extractDir }).then(() => resolve(extractDir)).catch(reject);
    });
  } else {
    return new Promise((resolve, reject) => {
      (0, _nodeChild_process.spawn)("tar", ["zxf", file], {
        cwd: extractDir,
        stdio: "inherit"
      }).on("close", code => {
        if (code === 0) {
          resolve(extractDir);
        } else {
          reject(new Error(`Untaring file failed: ${code}`));
        }
      });
    });
  }
};

/**
 * @param {any} libDir
 * @returns
 */
const copyToBin = exports.copyToBin = libDir => {
  return new Promise((resolve, reject) => {
    let versionDirs = flywayVersionDir(libDir);
    let flywayDir = _nodePath2.default.join(libDir, versionDirs[0]);
    let binDir = _nodePath2.default.join(__dirname, "../../", "bin");

    if (_nodeFs2.default.existsSync(flywayDir)) {
      _nodeFs2.default.rmSync(binDir, { recursive: true, force: true });
      _nodeFs2.default.cpSync(flywayDir, binDir, { recursive: true });

      resolve();
    } else {
      reject(new Error(`flywayDir was not found at ${flywayDir}`));
    }
  });
};

/**
 * @param {any} libDir
 */
const flywayVersionDir = libDir => {
  return _nodeFs2.default.readdirSync(libDir).filter(file => _nodeFs2.default.statSync(_nodePath2.default.join(libDir, file)).isDirectory());
};

const cleanupDirs = exports.cleanupDirs = () => {
  const libDir = _nodePath2.default.join(__dirname, "../../", "lib");
  _nodeFs2.default.rmSync(libDir, { recursive: true, force: true });
};
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { ProxyAgent, fetch } from 'undici'
import extractZip from "extract-zip";

const env = process.env;

const readDotFlywayFile = () => {
  const dotFlywayPath = path.resolve(__dirname, "../../../../../", ".flyway");

  if (!fs.existsSync(dotFlywayPath)) {
    return '';
  }

  const version = fs.readFileSync(dotFlywayPath, { encoding: 'utf8' });
  console.log("Found version in .flyway -> ", version);
  return version.trim();
};

export const getReleaseSource = async () => {
  let releaseVersion = readDotFlywayFile();
  if (!releaseVersion) {
    const latestRelease = await fetch(`https://api.github.com/repos/flyway/flyway/releases/latest`);
    if (!latestRelease.ok) {
      throw new Error(`Failed to fetch latest release: ${await latestRelease.text()}`);
    }
    releaseVersion = (await latestRelease.json()).tag_name.split('flyway-')[1];
  }

  const platforms = {
    win32: `windows-x64.zip`,
    linux: `linux-x64.tar.gz`,
    arm64: `macosx-arm64.tar.gz`,
    darwin: `macosx-x64.tar.gz`,
  }

  const buildSource = (platform) => ({
    url: `https://github.com/flyway/flyway/releases/download/flyway-${releaseVersion}/flyway-commandline-${releaseVersion}-${platform}`,
    filename: `flyway-commandline-${releaseVersion}-${platform}`,
    folder: `flyway-${releaseVersion}`
  });

  // Apple Silicon version was released with 9.6.0
  if (os.platform() === "darwin" && os.arch() === "arm64") {
    const [majorVersion, minorVersion] = releaseVersion.split(".");
    if (Number(majorVersion) > 9 || (Number(majorVersion) === 9 && Number(minorVersion) >= 6)) {
      return buildSource(platforms.arm64);
    }
  }

  return buildSource(platforms[os.platform()]);
};

// copied from https://github.com/getsentry/sentry-cli/blob/c65df4fba17101e60e8c31f378f6001b514e5a42/scripts/install.js#L123-L131
const getNpmCache = () => {
  return (
    env.npm_config_cache ||
    env.npm_config_cache_folder ||
    env.npm_config_yarn_offline_mirror ||
    (env.APPDATA ? path.join(env.APPDATA, 'npm-cache') : path.join(os.homedir(), '.npm'))
  );
}

/**
 * @param {any} source
 * @returns source.filename
 */
export const downloadFlywaySource = source => {
  let downloadDir = path.join(getNpmCache(), 'flywaydb-cli');

  if (!source) {
    throw new Error("Your platform is not supported");
  }

  source.filename = path.join(downloadDir, source.filename);
  if (fs.existsSync(source.filename)) {
    console.log("Cached file exists, skipping download", source.filename);
    return Promise.resolve(source.filename);
  } else if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir);
  }

  console.log("Downloading", source.url);

  const proxyUrl =
    env.npm_config_https_proxy ||
    env.npm_config_http_proxy ||
    env.npm_config_proxy;

  return fetch(source.url, {
    redirect: 'follow',
    headers: { 'User-Agent': env.npm_config_user_agent },
    dispatcher: proxyUrl ? new ProxyAgent(proxyUrl) : undefined,
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
  })
  .then(body => {
    fs.writeFileSync(source.filename, Buffer.from(new Uint8Array(body)));
    return source.filename;
  });
};

/**
 * @param {any} file
 * @returns extractDir
 */
export const extractToLib = file => {
  let extractDir = path.join(__dirname, "../../", "lib");

  if (!fs.existsSync(extractDir)) {
    fs.mkdirSync(extractDir);
  } else {
    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir);
  }

  if (path.extname(file) === ".zip") {
    return new Promise((resolve, reject) => {
      extractZip(file, { dir: extractDir })
        .then(() => resolve(extractDir))
        .catch(reject);
    });
  } else {
    return new Promise((resolve, reject) => {
      spawn("tar", ["zxf", file], {
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
export const copyToBin = libDir => {
  return new Promise((resolve, reject) => {
    let versionDirs = flywayVersionDir(libDir);
    let flywayDir = path.join(libDir, versionDirs[0]);
    let binDir = path.join(__dirname, "../../", "bin");

    if (fs.existsSync(flywayDir)) {
      fs.rmSync(binDir, { recursive: true, force: true });
      fs.cpSync(flywayDir, binDir, { recursive: true });

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
  return fs
    .readdirSync(libDir)
    .filter(file => fs.statSync(path.join(libDir, file)).isDirectory());
};

export const cleanupDirs = () => {
  const libDir = path.join(__dirname, "../../", "lib");
  fs.rmSync(libDir, { recursive: true, force: true });
};

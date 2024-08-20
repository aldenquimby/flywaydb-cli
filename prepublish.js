const path = require("path");
const fs = require("fs");

const touch = filename => fs.closeSync(fs.openSync(filename, "w"));
const binDir = path.join(__dirname, "bin");

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir);
} else {
  fs.rmdirSync(binDir);
  fs.mkdirSync(binDir);
}
// usage
touch("./bin/flyway");
touch("./bin/flyway.cmd");

console.log("done");

"use strict";

var _utils = require("./utils");

(0, _utils.getReleaseSource)().then(_utils.downloadFlywaySource).then(_utils.extractToLib).then(_utils.copyToBin).then(_utils.cleanupDirs).then(() => console.log("Flyway installation complete")).catch(function (reason) {
  // Handle failed request...
  console.error(`error --> ${reason}`);
  process.exit(1);
});
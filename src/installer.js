import {
  getReleaseSource,
  downloadFlywaySource,
  extractToLib,
  copyToBin,
  cleanupDirs
} from "./utils";

getReleaseSource()
  .then(downloadFlywaySource)
  .then(extractToLib)
  .then(copyToBin)
  .then(cleanupDirs)
  .then(() => console.log("Flyway installation complete"))
  .catch(function(reason) {
    // Handle failed request...
    console.error(`error --> ${reason}`);
    process.exit(1);
  });

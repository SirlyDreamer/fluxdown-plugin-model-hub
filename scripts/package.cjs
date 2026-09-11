"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { zipSync } = require("fflate");
const { root, archiveFiles, project } = require("./project.cjs");
const sha256 = data => createHash("sha256").update(data).digest("hex");

function archive() {
  const files = {};
  for (const name of archiveFiles) {
    // Fixed local DOS timestamp and Unix permissions make archives reproducible
    // across runner operating systems. .gitattributes fixes source line endings.
    files[name] = [fs.readFileSync(path.join(root, name)), {
      mtime: new Date(1980, 0, 1, 0, 0, 0), os: 3, attrs: 0o100644 << 16
    }];
  }
  return Buffer.from(zipSync(files, { level: 9 }));
}

function packagePlugin() {
  const info = project();
  const dist = path.join(root, "dist");
  fs.mkdirSync(dist, { recursive: true });
  const bytes = archive();
  const digest = sha256(bytes);
  const sums = [];
  for (const extension of ["zip", "fxplug"]) {
    const name = info.basename + "." + extension;
    const sum = digest + "  " + name + "\n";
    fs.writeFileSync(path.join(dist, name), bytes);
    fs.writeFileSync(path.join(dist, name + ".sha256"), sum);
    sums.push(sum);
  }
  fs.writeFileSync(path.join(dist, "SHA256SUMS"), sums.join(""));
  console.log("Packaged " + info.tag + " in dist/; SHA256 " + digest);
}
if (require.main === module) packagePlugin();
module.exports = { archive, sha256, packagePlugin };

"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { unzipSync } = require("fflate");
const { root, archiveFiles, project } = require("./project.cjs");
const { sha256 } = require("./package.cjs");

function verifyArchive(bytes) {
  const unpacked = unzipSync(bytes);
  assert.deepEqual(Object.keys(unpacked).sort(), [...archiveFiles].sort(), "Archive must contain only the four runtime/documentation files");
  for (const name of archiveFiles) assert.deepEqual(Buffer.from(unpacked[name]), fs.readFileSync(path.join(root, name)), name + " must match the source");
}
function verifyPackage() {
  const info = project();
  const dist = path.join(root, "dist");
  const zip = fs.readFileSync(path.join(dist, info.basename + ".zip"));
  const fxplug = fs.readFileSync(path.join(dist, info.basename + ".fxplug"));
  assert.deepEqual(zip, fxplug, "ZIP and FXPLUG must be identical");
  verifyArchive(zip);
  const sums = [];
  for (const extension of ["zip", "fxplug"]) {
    const name = info.basename + "." + extension;
    const sum = sha256(zip) + "  " + name + "\n";
    assert.equal(fs.readFileSync(path.join(dist, name + ".sha256"), "utf8"), sum);
    sums.push(sum);
  }
  assert.equal(fs.readFileSync(path.join(dist, "SHA256SUMS"), "utf8"), sums.join(""));
  console.log("Verified archive contents, identical formats and SHA256 checksums: " + info.tag);
}
if (require.main === module) verifyPackage();
module.exports = { verifyArchive, verifyPackage };

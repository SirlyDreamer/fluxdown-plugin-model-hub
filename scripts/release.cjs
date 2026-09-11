"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { root, project } = require("./project.cjs");
const tag = process.env.RELEASE_TAG || process.argv[2];
if (!tag) throw new Error("Pass a tag: npm run release:prepare -- v0.1.2");
const info = project(tag);
const dist = path.join(root, "dist");
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, "RELEASE_NOTES.md"), info.notes);
if (process.env.GITHUB_OUTPUT) {
  fs.appendFileSync(process.env.GITHUB_OUTPUT, "version=" + info.version + "\ntag=" + info.tag + "\nprerelease=" + info.prerelease + "\nbasename=" + info.basename + "\n");
}
console.log("Release ready: " + info.tag + "; prerelease=" + info.prerelease);

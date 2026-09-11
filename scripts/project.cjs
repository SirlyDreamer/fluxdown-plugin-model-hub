"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { Script } = require("node:vm");
const root = path.resolve(__dirname, "..");
const archiveFiles = ["LICENSE", "README.md", "manifest.json", "resolver.js"];
const numeric = "(?:0|[1-9][0-9]*)";
const identifier = "(?:" + numeric + "|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)";
const semver = new RegExp("^" + numeric + "\\." + numeric + "\\." + numeric + "(?:-" + identifier + "(?:\\." + identifier + ")*)?(?:\\+[0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*)?$");

function validateVersion(pkg, manifest, tag) {
  if (typeof pkg.version !== "string" || pkg.version !== pkg.version.trim() || !semver.test(pkg.version)) throw new Error("package.json version must be valid SemVer");
  if (manifest.version !== pkg.version) throw new Error("manifest.json and package.json versions must match");
  if (tag != null && tag !== "v" + pkg.version) throw new Error("Release tag must equal v" + pkg.version);
  return { version: pkg.version, tag: "v" + pkg.version, prerelease: pkg.version.split("+")[0].includes("-") };
}

function releaseNotes(changelog, version) {
  const lines = changelog.replace(/\r\n/g, "\n").split("\n");
  const start = lines.findIndex(line => line.startsWith("## [" + version + "] - "));
  if (start === -1) throw new Error("CHANGELOG.md needs a release entry for " + version);
  let end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  if (end === -1) end = lines.length;
  const body = lines.slice(start + 1, end).join("\n").trim();
  if (!body) throw new Error("Release notes must not be empty");
  return body + "\n";
}

function project(tag) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  const version = validateVersion(pkg, manifest, tag);
  if (lock.packages?.[""]?.version !== pkg.version || lock.name !== pkg.name) throw new Error("package-lock.json must match the package version and name");
  if (pkg.name !== "fluxdown-plugin-model-hub" || pkg.license !== "MIT" || pkg.private !== true) throw new Error("Unexpected package identity, license or npm publish setting");
  if (!/^[a-z0-9_-]+@[a-z0-9_-]+$/.test(manifest.identity)) throw new Error("Invalid FluxDown plugin identity");
  if (manifest.resolvers.length !== 1 || manifest.resolvers[0].entry !== "resolver.js" || manifest.resolvers[0].multi !== true) throw new Error("Invalid plugin entry or multi-file capability");
  const keys = manifest.settings.map(setting => setting.key);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate plugin setting key");
  for (const key of ["hfToken", "msToken", "hfMirror"]) {
    if (manifest.settings.find(setting => setting.key === key)?.default !== "") throw new Error(key + " must default to empty");
  }
  for (const file of archiveFiles) {
    if (!fs.statSync(path.join(root, file)).isFile()) throw new Error("Missing package file: " + file);
  }
  new Script(fs.readFileSync(path.join(root, "resolver.js"), "utf8"), { filename: "resolver.js" });
  const notes = releaseNotes(fs.readFileSync(path.join(root, "CHANGELOG.md"), "utf8"), version.version);
  return { ...version, pkg, manifest, notes, basename: pkg.name + "-" + version.version };
}
module.exports = { root, archiveFiles, validateVersion, releaseNotes, project };

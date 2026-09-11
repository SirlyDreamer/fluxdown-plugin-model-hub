"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { unzipSync, zipSync } = require("fflate");
const { archive, sha256 } = require("../scripts/package.cjs");
const { verifyArchive } = require("../scripts/verify-package.cjs");
const { validateVersion, releaseNotes, project } = require("../scripts/project.cjs");

test("release metadata matches the package, manifest and changelog", () => {
  const info = project();
  assert.equal(info.tag, "v" + info.manifest.version);
  assert.ok(info.notes.length > 20);
  assert.equal(info.pkg.license, "MIT");
});

test("release rejects mismatched tags, mismatched versions and malformed SemVer", () => {
  assert.throws(() => validateVersion({ version: "0.1.2" }, { version: "0.1.1" }, "v0.1.2"), /must match/);
  for (const tag of ["0.1.2", "v0.1.3", "v0.1.2\n", "v0.1.2;echo test"]) {
    assert.throws(() => validateVersion({ version: "0.1.2" }, { version: "0.1.2" }, tag), /Release tag/);
  }
  for (const version of ["01.2.3", "1.2", "v1.2.3", "1.2.3-01", "1.2.3;echo test", "1.2.3\n"]) {
    assert.throws(() => validateVersion({ version }, { version }), /SemVer/);
  }
});

test("stable and prerelease tags are distinguished including build metadata", () => {
  for (const [version, prerelease] of [["1.2.3", false], ["1.2.3+build-a", false], ["1.2.3-rc.1", true], ["1.2.3-beta.0+build.1", true]]) {
    assert.equal(validateVersion({ version }, { version }, "v" + version).prerelease, prerelease);
  }
});

test("release notes include exactly the requested version and fail on missing or empty notes", () => {
  const log = "# Changes\r\n\r\n## [1.2.3] - 2026-09-11\r\n\r\n### Added\r\n\r\n- Feature\r\n\r\n## [1.2.2] - 2026-09-10\r\n\r\n- Old\r\n";
  assert.equal(releaseNotes(log, "1.2.3"), "### Added\n\n- Feature\n");
  assert.throws(() => releaseNotes(log, "1.2.4"), /needs a release entry/);
  assert.throws(() => releaseNotes("## [1.2.3] - 2026-09-11\n\n", "1.2.3"), /empty/);
});

test("release archive has flat runtime files and is byte-for-byte reproducible", () => {
  const first = archive();
  const second = archive();
  verifyArchive(first);
  assert.deepEqual(first, second);
  assert.equal(sha256(first), sha256(second));
  assert.deepEqual(Object.keys(unzipSync(first)).sort(), ["LICENSE", "README.md", "manifest.json", "resolver.js"]);
});

test("package verification catches modified runtime code and unexpected files", () => {
  const unpacked = unzipSync(archive());
  unpacked[".env"] = Buffer.from("MUST_NOT_BE_RELEASED=test");
  assert.throws(() => verifyArchive(zipSync(unpacked)), /only the four/);
  delete unpacked[".env"];
  unpacked["resolver.js"] = Buffer.from("unexpected code");
  assert.throws(() => verifyArchive(zipSync(unpacked)), /must match/);
});

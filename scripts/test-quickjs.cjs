"use strict";
const { spawnSync } = require("node:child_process");
const { root } = require("./project.cjs");
const result = spawnSync(process.execPath, ["--test", "tests/resolver.test.cjs"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, MODEL_HUB_QUICKJS: require.resolve("quickjs-emscripten") }
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

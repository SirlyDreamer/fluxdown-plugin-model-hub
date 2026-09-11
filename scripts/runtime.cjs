"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "..", "resolver.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "manifest.json"), "utf8"));
const defaults = Object.fromEntries(manifest.settings.map(s => [s.key, s.default]));

// Deliberately expose only the FluxDown surface; no URL, fetch, Buffer or require.
async function run(ctx, fetch, settings = {}) {
  if (process.env.MODEL_HUB_QUICKJS) {
    return require("./quickjs.cjs").run(source, ctx, fetch, { ...defaults, ...settings });
  }
  const sandbox = { flux: { fetch, settings: { ...defaults, ...settings } }, __ctx: ctx };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { timeout: 1000 });
  const result = await vm.runInContext("resolve(__ctx)", sandbox, { timeout: 30000 });
  return JSON.parse(JSON.stringify(result));
}

async function networkFetch(opts) {
  const response = await fetch(opts.url, { headers: opts.headers, signal: AbortSignal.timeout(10000) });
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0, truncated = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 8 * 1024 * 1024) { truncated = true; break; }
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return { status: response.status, headers: Object.fromEntries(response.headers), body: Buffer.concat(chunks).toString("utf8"), truncated };
}
module.exports = { run, networkFetch, manifest };

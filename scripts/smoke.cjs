"use strict";
const assert = require("node:assert/strict");
const { run, networkFetch } = require("./runtime.cjs");
const fixtures = [
  { url: "https://huggingface.co/sshleifer/tiny-gpt2", file: "config.json", prefix: "{" },
  { url: "https://huggingface.co/datasets/lhoestq/demo1", file: "data/test.csv", prefix: "id," },
  { url: "https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct", file: "config.json", prefix: "{" },
  { url: "https://modelscope.cn/datasets/AI-ModelScope/alpaca-gpt4-data-en", file: "README.md" }
];
async function readSmallFile(direct) {
  const response = await fetch(direct.url, { headers: direct.extraHeaders, signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      assert.ok(size <= 65536, "small-file fixture unexpectedly exceeded 64 KiB");
      chunks.push(Buffer.from(value));
    }
  } finally { await reader.cancel(); }
  return Buffer.concat(chunks).toString("utf8");
}
async function rangeProbe(url) {
  const direct = await run({ url }, networkFetch);
  const r = await fetch(direct.url, { headers: { ...direct.extraHeaders, Range: "bytes=0-31" }, signal: AbortSignal.timeout(15000) });
  try {
    assert.equal(r.status, 206, "weight host must honor a bounded Range request");
    assert.match(r.headers.get("content-range"), /^bytes 0-31\/\d+$/);
    const data = await r.arrayBuffer();
    assert.equal(data.byteLength, 32);
    console.log(JSON.stringify({ check: "weight-range", source: url, status: r.status, bytes: data.byteLength, contentRange: r.headers.get("content-range") }));
  } finally { if (!r.bodyUsed) await r.body.cancel(); }
}
(async () => {
  for (const fixture of fixtures) {
    const listing = await run({ url: fixture.url }, networkFetch);
    const item = listing.manifest.items.find(i => (i.path ? i.path + "/" : "") + i.name === fixture.file);
    assert.ok(item, fixture.file + " must be in the manifest");
    const direct = await run({ url: fixture.url, resolverItem: item.id }, networkFetch);
    const body = await readSmallFile(direct);
    assert.equal(Buffer.byteLength(body), item.size, "API size must match downloaded bytes");
    assert.ok(!/^\s*<!doctype html/i.test(body), "must not download a login/HTML page");
    if (fixture.prefix) assert.ok(body.trimStart().startsWith(fixture.prefix));
    console.log(JSON.stringify({ check: "repository-and-file", source: fixture.url, files: listing.manifest.items.length, downloaded: fixture.file, bytes: Buffer.byteLength(body), status: "passed" }));
  }
  await rangeProbe("https://huggingface.co/sshleifer/tiny-gpt2/blob/main/pytorch_model.bin");
  await rangeProbe("https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct/resolve/master/model.safetensors");
})().catch(error => { console.error(error.message); process.exitCode = 1; });

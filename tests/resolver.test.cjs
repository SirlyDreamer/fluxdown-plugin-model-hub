"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { run, manifest } = require("../scripts/runtime.cjs");
const SHA = "0123456789abcdef0123456789abcdef01234567";
const HF = "https://huggingface.co/team/repo";
const HFD = "https://huggingface.co/datasets/team/repo";
const MS = "https://modelscope.cn/models/team/repo";
const MSD = "https://modelscope.cn/datasets/team/repo";
function response(body, headers = {}, status = 200) {
  return { status, headers, body: JSON.stringify(body), truncated: false };
}
function hfFile(path, size = 10) { return { type: "file", path, size }; }
function msFile(Path, Size = 10) { return { Type: "blob", Path, Size }; }
function harness(pages, settings = {}) {
  const requests = [];
  async function fetch(request) {
    requests.push(JSON.parse(JSON.stringify(request)));
    assert.ok(pages.length, "unexpected request: " + request.url);
    const page = pages.shift();
    return typeof page === "function" ? page(request) : page;
  }
  return { requests, go: ctx => run(ctx, fetch, settings), remaining: () => pages.length };
}
function hf(pages, settings) { return harness([response({ sha: SHA }), ...pages], settings); }
function ms(pages, settings) { return harness([response({ Code: 200, Data: { Commit: [{ Id: SHA }] } }), ...pages], settings); }

test("manifest matches the host schema and declares multi-file capability", () => {
  assert.match(manifest.identity, /^[a-z0-9_-]+@[a-z0-9_-]+$/);
  assert.equal(manifest.minAppVersion, "0.1.44");
  assert.equal(manifest.resolvers.length, 1);
  assert.equal(manifest.resolvers[0].multi, true);
  assert.equal(manifest.resolvers[0].timeoutMs, 30000);
  assert.equal(new Set(manifest.settings.map(s => s.key)).size, manifest.settings.length);
  for (const setting of manifest.settings) assert.equal(typeof setting.default, "string");
});

test("HF model manifest preserves paths, sizes including zero and LFS size", async () => {
  const h = hf([response([
    { type: "directory", path: "weights" }, hfFile("config.json", 0),
    { ...hfFile("weights/model.safetensors", 132), lfs: { size: 6000000000 } }
  ])]);
  const result = await h.go({ url: HF });
  assert.equal(result.manifest.name, "team--repo--01234567");
  assert.deepEqual(result.manifest.items.map(i => [i.path, i.name, i.size]), [["", "config.json", 0], ["weights", "model.safetensors", 6000000000]]);
  assert.ok(h.requests[1].url.includes("/tree/" + SHA));
});

test("HF pagination includes subsequent pages and omits directories", async () => {
  const next = "https://huggingface.co/api/datasets/team/repo/tree/" + SHA + "?cursor=next";
  const h = hf([response([hfFile("README.md")], { Link: `<${next}>; rel="next"` }), response([hfFile("data/test.csv")])]);
  const result = await h.go({ url: HFD });
  assert.equal(result.manifest.items.length, 2);
  assert.equal(h.requests[2].url, next);
});

test("HF mirror handles official model/dataset links, directories and selected downloads without tokens", async () => {
  for (const repo of [HF, HFD]) {
    const settings = { hfMirror: " https://HF-MIRROR.COM/ ", hfToken: "hf_secret", msToken: "ms_secret" };
    const h = hf([response([hfFile("data/你好 #.txt", 12)])], settings);
    const result = await h.go({ url: repo.replace("://hug", "://www.hug") + "/tree/dev/data" });
    const kind = repo === HF ? "models" : "datasets";
    assert.equal(h.requests[0].url, "https://hf-mirror.com/api/" + kind + "/team/repo/revision/dev");
    assert.equal(h.requests[1].url, "https://hf-mirror.com/api/" + kind + "/team/repo/tree/" + SHA + "/data?recursive=true&limit=1000");
    assert.ok(h.requests.every(request => Object.keys(request.headers).length === 0));
    assert.equal(result.manifest.items[0].path, "");
    const direct = await h.go({ url: repo, resolverItem: result.manifest.items[0].id });
    assert.equal(direct.url, repo.replace("https://huggingface.co", "https://hf-mirror.com") + "/resolve/" + SHA + "/data/%E4%BD%A0%E5%A5%BD%20%23.txt?download=true");
    assert.deepEqual(direct.extraHeaders, {});
  }
});

test("mirror single-file links pin versions and encode the downloadable path", async () => {
  for (const action of ["blob", "resolve"]) {
    const h = hf([], { hfMirror: "https://mirror.example:8443", excludePatterns: "**" });
    const direct = await h.go({ url: HFD + "/" + action + "/refs%2Fpr%2F4/data/test%20one.csv" });
    assert.equal(h.requests[0].url, "https://mirror.example:8443/api/datasets/team/repo/revision/refs%2Fpr%2F4");
    assert.equal(direct.url, "https://mirror.example:8443/datasets/team/repo/resolve/" + SHA + "/data/test%20one.csv?download=true");
  }
});

test("existing item IDs keep their commit while using current mirror settings without a listing request", async () => {
  const listed = await hf([response([hfFile("weights/model.safetensors")])]).go({ url: HF });
  const item = listed.manifest.items[0].id;
  for (const [hfMirror, base, headers] of [
    ["https://hf-mirror.com", "https://hf-mirror.com", {}],
    ["https://other.example/", "https://other.example", {}],
    ["", "https://huggingface.co", { Authorization: "Bearer hf_secret" }]
  ]) {
    const direct = await run({ url: HF, resolverItem: item }, () => assert.fail("must not fetch"), { hfMirror, hfToken: "hf_secret", revision: "changed" });
    assert.equal(direct.url, base + "/team/repo/resolve/" + SHA + "/weights/model.safetensors?download=true");
    assert.deepEqual(direct.extraHeaders, headers);
  }
});

test("mirror pagination rebases exact upstream and relative resources onto the configured mirror", async () => {
  const path = "/api/datasets/team/repo/tree/" + SHA + "/data";
  for (const next of [
    "https://huggingface.co" + path + "?cursor=2",
    "https://www.huggingface.co" + path + "?cursor=2",
    "https://hf-mirror.com" + path + "?cursor=2",
    path + "?cursor=2", "?cursor=2"
  ]) {
    const h = hf([response([hfFile("data/a.csv")], { Link: `<${next}>; rel="next"` }), response([hfFile("data/b.csv")])], { hfMirror: "https://hf-mirror.com", hfToken: "hf_secret" });
    assert.equal((await h.go({ url: HFD + "/tree/main/data" })).manifest.items.length, 2);
    assert.equal(h.requests[2].url, "https://hf-mirror.com" + path + "?cursor=2");
    assert.ok(h.requests.every(request => request.url.startsWith("https://hf-mirror.com/") && Object.keys(request.headers).length === 0));
  }
});

test("mirror pagination rejects foreign hosts, altered resources and loops before fetching them", async () => {
  const path = "/api/models/team/repo/tree/" + SHA;
  for (const next of [
    "https://evil.test" + path + "?cursor=2",
    "https://hf-mirror.com.evil.test" + path + "?cursor=2",
    "https://huggingface.co/api/models/other/repo/tree/" + SHA + "?cursor=2",
    "https://huggingface.co" + path + "/other?cursor=2",
    "https://huggingface.co" + path + "?cursor=2#fragment",
    "//huggingface.co" + path + "?cursor=2",
    "https://huggingface.co" + path + "?recursive=true&limit=1000"
  ]) {
    const h = hf([response([hfFile("a")], { Link: `<${next}>; rel="next"` })], { hfMirror: "https://hf-mirror.com", hfToken: "hf_secret" });
    await assert.rejects(h.go({ url: HF }), /分页/);
    assert.equal(h.requests.length, 2);
  }
});

test("invalid mirror endpoints fail before requests and never echo credential-like settings", async () => {
  for (const hfMirror of [
    "http://hf-mirror.com", "hf-mirror.com", "https://user:secret@mirror.example",
    "https://mirror.example/api", "https://mirror.example/?token=secret", "https://mirror.example/#secret",
    "https://mirror.example:0", "https://mirror.example:65536", "https://mirror..example",
    "https://-mirror.example", "https://mirror.example\\secret", "https://mirror.example\n.evil.test"
  ]) {
    await assert.rejects(run({ url: HF }, () => assert.fail("must not fetch"), { hfMirror }), error => /镜像地址无效/.test(error.message) && !error.message.includes("secret"));
  }
});

test("official endpoint aliases normalize and retain official token authentication", async () => {
  for (const hfMirror of ["", "  ", "https://HUGGINGFACE.CO/", "https://www.huggingface.co:443/"]) {
    const h = hf([], { hfMirror, hfToken: "hf_secret" });
    const direct = await h.go({ url: HF + "/blob/main/config.json" });
    assert.ok(h.requests[0].url.startsWith("https://huggingface.co/api/"));
    assert.deepEqual(h.requests[0].headers, { Authorization: "Bearer hf_secret" });
    assert.ok(direct.url.startsWith("https://huggingface.co/"));
    assert.deepEqual(direct.extraHeaders, { Authorization: "Bearer hf_secret" });
  }
});

test("Hugging Face mirror settings do not affect ModelScope URLs or authentication", async () => {
  const h = ms([], { hfMirror: "invalid setting ignored by ModelScope", msToken: "ms_secret" });
  const direct = await h.go({ url: MS + "/files?FilePath=config.json" });
  assert.ok(h.requests[0].url.startsWith("https://modelscope.cn/"));
  assert.ok(direct.url.startsWith("https://modelscope.cn/"));
  assert.deepEqual(direct.extraHeaders, { Cookie: "m_session_id=ms_secret" });
});

test("mirror access and incompatible API errors explain the mirror configuration without official fallback", async () => {
  for (const [page, message] of [
    [response({}, {}, 401), /镜像拒绝访问/],
    [response({}, {}, 403), /镜像拒绝访问/],
    [{ status: 200, body: "<html>Mirror homepage</html>" }, /兼容 Hugging Face Hub API/]
  ]) {
    const h = harness([page], { hfMirror: "https://hf-mirror.com", hfToken: "hf_secret" });
    await assert.rejects(h.go({ url: HF }), message);
    assert.equal(h.requests.length, 1);
    assert.deepEqual(h.requests[0].headers, {});
  }
});

test("selected items survive a fresh runtime without network or cache and use the pinned commit", async () => {
  const h = hf([response([hfFile("data/你好 #?.txt")])], { excludePatterns: "**/*?.txt" });
  await assert.rejects(h.go({ url: HF }), /没有匹配/);
  const good = hf([response([hfFile("data/你好 #.txt")])]);
  const result = await good.go({ url: HF });
  const selected = await run({ url: HF, resolverItem: result.manifest.items[0].id }, () => { throw new Error("no network expected"); }, { subdirectory: "../changed", revision: "invalid revision", hfToken: "hf_secret" });
  assert.equal(selected.url, HF + "/resolve/" + SHA + "/data/%E4%BD%A0%E5%A5%BD%20%23.txt?download=true");
  assert.equal(selected.fileName, "你好 #.txt");
  assert.deepEqual(selected.extraHeaders, { Authorization: "Bearer hf_secret" });
  assert.ok(!selected.ephemeral && !selected.rangeSupported);
});

test("HF directory links and slash-containing encoded revisions", async () => {
  const h = hf([response([hfFile("data/train/a.csv")])], { revision: "ignored", subdirectory: "ignored" });
  const result = await h.go({ url: HFD + "/tree/refs%2Fpr%2F4/data/train" });
  assert.ok(h.requests[0].url.endsWith("/revision/refs%2Fpr%2F4"));
  assert.ok(h.requests[1].url.includes("/" + SHA + "/data/train?"));
  assert.equal(result.manifest.items[0].path, "");
});

test("glob includes root and nested files, exclusion wins, and dotfiles remain by default", async () => {
  const files = [hfFile(".gitattributes"), hfFile("a.safetensors"), hfFile("fp16/b.safetensors"), hfFile("q4/c.safetensors"), hfFile("config.json")];
  const h = hf([response(files)], { includePatterns: "**/*.safetensors\nconfig.json", excludePatterns: "q4/**" });
  const result = await h.go({ url: HF });
  assert.deepEqual(result.manifest.items.map(i => i.name), ["a.safetensors", "config.json", "b.safetensors"]);
  const all = await hf([response(files)]).go({ url: HF });
  assert.equal(all.manifest.items.length, 5);
});

test("single file links bypass repository filters and encode download paths", async () => {
  const h = hf([], { excludePatterns: "**" });
  const result = await h.go({ url: HFD + "/blob/dev/data/test%20one.csv" });
  assert.equal(result.url, HFD + "/resolve/" + SHA + "/data/test%20one.csv?download=true");
  assert.equal(h.requests.length, 1);
});

test("40 character commits need no metadata lookup", async () => {
  const h = harness([]);
  const result = await h.go({ url: HF + "/resolve/" + SHA + "/config.json" });
  assert.ok(result.url.includes(SHA));
  assert.equal(h.requests.length, 0);
});

test("ModelScope model API uses SDK cookie authentication and canonical host", async () => {
  const h = ms([response({ Code: 200, Data: { Files: [msFile("dir/config.json", 100)] } })], { msToken: "ms_secret", hfToken: "hf_secret" });
  const result = await h.go({ url: MS.replace("://model", "://www.model") + "/files?Revision=v1" });
  assert.ok(h.requests[0].url.includes("Ref=v1"));
  assert.ok(h.requests[1].url.includes("/repo/files?Revision=" + SHA));
  assert.deepEqual(h.requests[1].headers, { Cookie: "m_session_id=ms_secret" });
  const direct = await h.go({ url: MS, resolverItem: result.manifest.items[0].id });
  const u = new URL(direct.url);
  assert.equal(u.searchParams.get("FilePath"), "dir/config.json");
  assert.equal(u.searchParams.get("Revision"), SHA);
  assert.equal(u.hostname, "modelscope.cn");
  assert.deepEqual(direct.extraHeaders, { Cookie: "m_session_id=ms_secret" });
});

test("ModelScope dataset discovers numeric ID and follows total count pagination", async () => {
  const h = ms([
    response({ Code: 200, Data: { Id: 42 } }),
    response({ Code: 200, Data: { Files: [msFile("data/a.csv")] }, TotalCount: 2 }),
    response({ Code: 200, Data: { Files: [msFile("data/b.csv")] }, TotalCount: 2 })
  ]);
  const result = await h.go({ url: MSD + "/files" });
  assert.equal(result.manifest.items.length, 2);
  assert.ok(h.requests[2].url.includes("/datasets/42/repo/tree?"));
  assert.ok(h.requests[3].url.includes("PageNumber=2"));
  const direct = await h.go({ url: MSD, resolverItem: result.manifest.items[0].id });
  assert.ok(direct.url.startsWith("https://modelscope.cn/api/v1/datasets/team/repo/repo?"));
});

test("ModelScope dataset without total count fetches full pages until final short page", async () => {
  const h = ms([
    response({ Code: 200, Data: { Id: 42 } }),
    response({ Code: 200, Data: { Files: Array.from({ length: 100 }, (_, i) => msFile(`data/${i}.csv`)) } }),
    response({ Code: 200, Data: { Files: [msFile("data/last.csv")] } })
  ]);
  assert.equal((await h.go({ url: MSD })).manifest.items.length, 101);
});

test("ModelScope FilePath query and file/view URLs are converted to files", async () => {
  for (const url of [MS + "/files?Revision=dev&FilePath=dir%2Fconfig.json", MS + "/file/view/dev/dir/config.json"]) {
    const h = ms([]);
    const result = await h.go({ url });
    assert.equal(new URL(result.url).searchParams.get("FilePath"), "dir/config.json");
    assert.ok(h.requests[0].url.includes("Ref=dev"));
  }
});

test("settings apply revision and subdirectory; selected folder becomes download root", async () => {
  const h = hf([response([hfFile("data/train.csv")])], { subdirectory: "data", revision: "v1" });
  const result = await h.go({ url: HF });
  assert.equal(result.manifest.items[0].path, "");
  assert.ok(h.requests[0].url.endsWith("revision/v1"));
  assert.ok(h.requests[1].url.includes("/data?"));
});

for (const status of [401, 403, 404, 429, 500]) {
  test(`HTTP ${status} fails visibly without returning a page download`, async () => {
    await assert.rejects(harness([response({}, {}, status)]).go({ url: HF }), /Model Hub:/);
  });
}
test("malformed JSON, truncated bodies, API failure envelopes and network errors fail closed", async () => {
  for (const page of [
    { status: 200, body: "<html>Login</html>" },
    { ...response({ sha: SHA }), truncated: true },
    () => { throw new Error("secret URL and token should not be echoed"); }
  ]) {
    await assert.rejects(harness([page]).go({ url: HF }), e => /Model Hub:/.test(e.message) && !e.message.includes("secret"));
  }
  await assert.rejects(harness([response({ Code: 401, Message: "secret" })]).go({ url: MS }), /API 拒绝/);
});

test("unsafe hosts, traversal, malformed URLs and unexpected page routes are rejected before fetching", async () => {
  const urls = [
    "http://huggingface.co/team/repo", "https://huggingface.co.evil.test/team/repo", "https://user@huggingface.co/team/repo",
    "https://huggingface.co:443/team/repo", HF + "/tree/main/%2e%2e", HF + "/blob/main/dir%2F..%2Fsecret",
    HF + "/blob/main/%ZZ", HF + "/discussions/1", HF + "/blob/main/a%5Cb", HF + "?revision=a&revision=b"
  ];
  for (const url of urls) await assert.rejects(run({ url }, () => assert.fail("must not fetch")), /Model Hub:/);
});

test("pagination cannot exfiltrate a token or repeat forever", async () => {
  for (const next of ["https://evil.test/list?cursor=2", "https://huggingface.co/api/other?cursor=2", "https://huggingface.co/api/models/team/repo/tree/" + SHA + "?recursive=true&limit=1000"]) {
    const h = hf([response([hfFile("a")], { link: `<${next}>; rel="next"` })], { hfToken: "secret" });
    await assert.rejects(h.go({ url: HF }), /分页/);
    assert.equal(h.requests.length, 2);
  }
});

test("bad token input is rejected before any request", async () => {
  for (const token of ["token\r\nX-Foo: secret", "Bearer hf_token", "bad;cookie"]) {
    await assert.rejects(hf([] , { hfToken: token }).go({ url: HF }), /Token 格式/);
  }
});

for (const [reason, code] of [
  ["dns lookup returned no addresses for https://private.example/?token=secret", "DNS_OR_ADDRESS_BLOCKED"],
  ["TLS certificate validation failed; Authorization: Bearer secret", "TLS_FAILED"],
  ["request timed out; m_session_id=secret", "REQUEST_TIMEOUT"],
  ["proxy connection refused with password secret", "PROXY_OR_CONNECT_FAILED"],
  ["error sending request for url https://private.example/?token=secret", "FETCH_FAILED"]
]) {
  test(`network errors expose actionable ${code} without raw credentials`, async () => {
    const h = harness([() => { throw new Error(reason); }]);
    await assert.rejects(h.go({ url: HF }), error => error.message.includes(code) && !error.message.includes("secret") && !error.message.includes("private.example"));
  });
}

test("1000 items succeed; 1001 items never silently truncate; filters can reduce the set", async () => {
  const files = Array.from({ length: 1001 }, (_, i) => hfFile(`${i}.json`));
  assert.equal((await hf([response(files.slice(0, 1000))]).go({ url: HF })).manifest.items.length, 1000);
  await assert.rejects(hf([response(files)]).go({ url: HF }), /1000/);
  assert.equal((await hf([response(files)], { includePatterns: "0.json" }).go({ url: HF })).manifest.items.length, 1);
});

test("unsafe names, collisions, excessive path depth and ID length are actionable errors", async () => {
  for (const files of [
    [hfFile("../secret")], [hfFile("dir/NUL.txt")], [hfFile("name..txt")], [hfFile("file:stream")],
    [hfFile("data/A.csv"), hfFile("data/a.csv")], [hfFile("a"), hfFile("a")],
    [hfFile("A"), hfFile("a/b")], [hfFile("a/b"), hfFile("A")],
    [hfFile("a/b/c/d/e/f/g/h/i/file.txt")], [hfFile("a".repeat(173))]
  ]) await assert.rejects(hf([response(files)]).go({ url: HF }), /Model Hub:/);
});

test("files outside requested directory, unrecognized types, empty and incomplete listings are rejected", async () => {
  await assert.rejects(hf([response([hfFile("outside.txt")])]).go({ url: HF + "/tree/main/data" }), /之外/);
  await assert.rejects(hf([response([{ type: "symlink", path: "link" }])]).go({ url: HF }), /条目类型/);
  await assert.rejects(hf([response([])]).go({ url: HF }), /没有匹配/);
  await assert.rejects(ms([response({ Code: 200, Data: { Files: [msFile("a")], TotalCount: 2 } })]).go({ url: MS }), /不完整/);
  const short = ms([response({ Code: 200, Data: { Id: 1 } }), response({ Code: 200, Data: { Files: [] }, TotalCount: 2 })]);
  await assert.rejects(short.go({ url: MSD }), /提前结束/);
});

test("invalid second-stage identifiers fail before network requests", async () => {
  for (const resolverItem of ["bad", "A".repeat(27) + ":../secret", "_".repeat(27) + ":a"]) {
    await assert.rejects(run({ url: HF, resolverItem }, () => assert.fail("must not fetch")), /Model Hub:/);
  }
});

test("commit packing roundtrips edge values and unknown sizes are omitted", async () => {
  for (const sha of ["0".repeat(40), "f".repeat(40), SHA]) {
    const h = harness([response([hfFile("config.json", -1)])]);
    const result = await h.go({ url: HF + "/tree/" + sha });
    assert.equal(result.manifest.items[0].size, undefined);
    const direct = await h.go({ url: HF, resolverItem: result.manifest.items[0].id });
    assert.ok(direct.url.includes("/resolve/" + sha + "/"));
  }
});

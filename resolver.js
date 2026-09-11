// Classic script for FluxDown QuickJS. No Node, DOM, URL, imports or dependencies.
(function () {
  "use strict";
  const MAX_FILES = 1000;
  const MAX_PAGES = 100;
  const HF_ORIGIN = "https://huggingface.co";
  const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

  function fail(message) { throw new Error("Model Hub: " + message); }
  function chars(value) { return Array.from(value).length; }
  function decode(value) {
    try { return decodeURIComponent(value); }
    catch (_) { fail("链接包含无效编码 / Invalid URL encoding."); }
  }
  function query(text) {
    const result = Object.create(null);
    for (const part of (text || "").split("&")) {
      if (!part) continue;
      const at = part.indexOf("=");
      const key = decode(at < 0 ? part : part.slice(0, at));
      const value = decode((at < 0 ? "" : part.slice(at + 1)).replace(/\+/g, " "));
      if (Object.prototype.hasOwnProperty.call(result, key)) fail("链接查询参数重复 / Duplicate query parameter.");
      result[key] = value;
    }
    return result;
  }
  function safePath(value, allowEmpty) {
    if (typeof value !== "string" || (!allowEmpty && !value)) fail("文件路径为空 / Empty file path.");
    if (!value && allowEmpty) return value;
    if (value.startsWith("/") || /[\\\x00-\x1f\x7f]/.test(value) ||
        value.split("/").some(p => !p || p === "." || p === "..")) {
      fail("仓库含不安全路径 / Unsafe repository path.");
    }
    return value;
  }
  function safeRevision(value) {
    if (typeof value !== "string" || !value || value.length > 200 || /[\x00-\x20\x7f\\?#]/.test(value) ||
        value.split("/").some(p => !p || p === "." || p === "..")) fail("版本格式无效 / Invalid revision.");
    return value;
  }
  function settingsString(key) {
    const value = flux.settings && flux.settings[key];
    return typeof value === "string" ? value.trim() : "";
  }
  function hfBase() {
    const value = settingsString("hfMirror");
    if (!value) return HF_ORIGIN;
    // Endpoint only: no credentials, query, fragment or repository/API path.
    // DNS and public-address enforcement remain the host's responsibility.
    const match = /^https:\/\/([a-z0-9.-]+)(?::([0-9]{1,5}))?\/*$/i.exec(value);
    if (!match || match[1].length > 253 || match[1].split(".").some(label =>
      !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) ||
      (match[2] && (Number(match[2]) < 1 || Number(match[2]) > 65535))) {
      fail("Hugging Face 镜像地址无效；请填写 HTTPS 站点根地址，例如 https://hf-mirror.com，不要包含账号、路径、查询参数或片段 / Invalid mirror endpoint.");
    }
    const host = match[1].toLowerCase();
    const port = match[2] && Number(match[2]) !== 443 ? ":" + Number(match[2]) : "";
    if ((host === "huggingface.co" || host === "www.huggingface.co") && !port) return HF_ORIGIN;
    return "https://" + host + port;
  }
  function parseTarget(url, secondStage) {
    const match = /^https:\/\/([^/?#]+)(\/[^?#]*)?(?:\?([^#]*))?(?:#.*)?$/i.exec(String(url));
    if (!match) fail("请使用 HTTPS 仓库链接 / Use an HTTPS repository URL.");
    const host = match[1].toLowerCase();
    const hf = host === "huggingface.co" || host === "www.huggingface.co";
    if (!hf && host !== "modelscope.cn" && host !== "www.modelscope.cn") fail("不支持此站点 / Unsupported host.");
    const parts = (match[2] || "").replace(/^\/|\/$/g, "").split("/").map(decode);
    const params = query(match[3]);
    let kind = "models";
    if (parts[0] === "datasets") { kind = "datasets"; parts.shift(); }
    else if (!hf && parts[0] === "models") parts.shift();
    else if (!hf) fail("请使用 ModelScope /models/ 或 /datasets/ 仓库链接。");
    if (parts.length < 2 || !parts[0] || !parts[1]) fail("请提供 owner/repository 仓库链接。");
    const owner = parts.shift();
    const name = parts.shift().replace(/\.git$/, "");
    if (![owner, name].every(p => /^[A-Za-z0-9_][A-Za-z0-9_.-]*$/.test(p) && !p.includes(".."))) {
      fail("仓库名称无效 / Invalid repository name.");
    }
    const action = parts.shift() || "";
    let revision = params.revision || params.Revision || "";
    let path = "";
    let file = false;
    if (["tree", "blob", "resolve"].includes(action)) {
      revision = parts.shift() || "";
      if (!revision) fail("链接缺少版本 / Missing revision in URL.");
      path = parts.join("/");
      file = action !== "tree";
      if (file && !path) fail("链接缺少文件路径 / Missing file path.");
    } else if (!hf && action === "file" && parts.shift() === "view") {
      revision = parts.shift() || revision;
      path = parts.join("/");
      file = true;
    } else if (!hf && (action === "files" || action === "summary" || !action)) {
      if (parts.length) fail("不支持此 ModelScope 页面路径 / Unsupported page path.");
      path = params.Root || params.root || "";
      if (params.FilePath) { path = params.FilePath; file = true; }
    } else if (action) {
      fail("请粘贴仓库、目录或文件链接 / Use a repository, tree or file URL.");
    }
    if (!file && !path && !secondStage) path = settingsString("subdirectory");
    if (path === "/" && !file) path = "";
    safePath(path, !file);
    const defaultRevision = secondStage ? "" : settingsString("revision");
    safeRevision(revision || defaultRevision || (hf ? "main" : "master"));
    return {
      provider: hf ? "hf" : "ms", kind, owner, name, path, file,
      revision: revision || defaultRevision || (hf ? "main" : "master"),
      base: hf ? hfBase() : "https://modelscope.cn"
    };
  }
  function repoPath(target) { return encodeURIComponent(target.owner) + "/" + encodeURIComponent(target.name); }
  function encodedPath(path) { return path.split("/").map(encodeURIComponent).join("/"); }
  function apiBase(target) { return target.base + (target.provider === "hf" ? "/api/" : "/api/v1/") + target.kind + "/" + repoPath(target); }
  function authHeaders(target) {
    // HF tokens belong to the official service; a mirror URL is not consent to
    // disclose them to a third party. Public mirrors therefore use no token.
    if (target.provider === "hf" && target.base !== HF_ORIGIN) return {};
    const token = settingsString(target.provider === "hf" ? "hfToken" : "msToken");
    if (!token) return {};
    if (/[\s\x00-\x1f\x7f;,]/.test(token)) fail("Token 格式无效；只填写令牌本身 / Enter the token only.");
    // ModelScope SDK authenticates with the m_session_id cookie, not HF Bearer auth.
    return target.provider === "hf" ? { Authorization: "Bearer " + token } : { Cookie: "m_session_id=" + token };
  }
  function budget(state) {
    if (Date.now() - state.started > 24000) fail("清单解析接近 30 秒上限，请指定更小的子目录后重试 / Narrow the subdirectory.");
  }
  function networkFailure(target, error) {
    const reason = String(error && error.message || error || "");
    const site = target.provider === "hf" ? (target.base === HF_ORIGIN ? "Hugging Face" : "Hugging Face 镜像") : "ModelScope";
    let code = "FETCH_FAILED";
    let advice = "请检查网络。使用 TUN/fake-IP 时，请在 FluxDown 设置中配置手动 HTTP/SOCKS 代理并重启应用；自动模式不会为插件自动切换代理。";
    if (/dns|lookup|resolv|no.*address|non-routable|blocked/i.test(reason)) {
      code = "DNS_OR_ADDRESS_BLOCKED";
      advice = "域名解析或地址检查失败。TUN/fake-IP 的 198.18.x.x 虚拟地址会被宿主拦截；请配置手动 HTTP/SOCKS 代理并重启 FluxDown。";
    } else if (/certificate|cert\b|tls|ssl/i.test(reason)) {
      code = "TLS_FAILED";
      advice = "TLS 证书校验失败，请检查代理证书链和系统时间。";
    } else if (/timed?\s*out|timeout|ETIMEDOUT/i.test(reason)) {
      code = "REQUEST_TIMEOUT";
      advice = "站点请求超时，请检查代理连通性后重试。";
    } else if (/proxy|ECONNREFUSED|connection refused/i.test(reason)) {
      code = "PROXY_OR_CONNECT_FAILED";
      advice = "连接失败，请检查代理是否运行、端口和协议是否正确；修改代理后需要重启 FluxDown。";
    }
    // Classify, but never echo raw bridge messages: they may contain URLs,
    // Authorization headers, cookie values or private repository metadata.
    fail(site + " 请求失败 [" + code + "]。" + advice);
  }
  async function jsonRequest(target, url, state) {
    budget(state);
    let response;
    const headers = authHeaders(target);
    try { response = await flux.fetch({ url, headers }); }
    catch (error) { networkFailure(target, error); }
    const status = response.status;
    if (status === 401 || status === 403) {
      if (target.provider === "hf" && target.base !== HF_ORIGIN) fail("镜像拒绝访问；镜像请求不会发送 Hugging Face Token。私有或受限仓库请清空镜像设置，使用官方站点及有权限的 Token / Mirror access denied.");
      fail("访问被拒绝；请检查对应站点 Token，并先在网站取得受限仓库访问权限 / Access denied.");
    }
    if (status === 404) fail("仓库、版本或目录不存在，或 Token 无权访问 / Not found or private.");
    if (status === 429) fail("站点限流，请稍后重试 / Rate limited; retry later.");
    if (status < 200 || status >= 300) fail("站点返回 HTTP " + status + " / HTTP request failed.");
    if (response.truncated) fail("清单响应超过宿主 8 MB 上限，请缩小子目录 / Response truncated.");
    let body;
    try { body = JSON.parse(response.body); }
    catch (_) {
      if (target.provider === "hf" && target.base !== HF_ORIGIN) fail("镜像未返回有效 JSON；镜像必须兼容 Hugging Face Hub API / Invalid mirror API response.");
      fail("站点未返回有效 JSON / Invalid API response.");
    }
    if (target.provider === "ms" && (!body || body.Success === false || (body.Code != null && Number(body.Code) !== 200))) {
      fail("ModelScope API 拒绝请求；请检查版本、Token 和仓库权限 / API rejected request.");
    }
    return { body, headers: response.headers || {} };
  }
  async function pinRevision(target, state) {
    if (/^[0-9a-f]{40}$/i.test(target.revision)) return target.revision.toLowerCase();
    const url = target.provider === "hf"
      ? apiBase(target) + "/revision/" + encodeURIComponent(target.revision)
      : apiBase(target) + "/commits?Ref=" + encodeURIComponent(target.revision) + "&PageNumber=1&PageSize=1";
    const { body } = await jsonRequest(target, url, state);
    const sha = target.provider === "hf" ? body && body.sha : body && body.Data && body.Data.Commit && body.Data.Commit[0] && body.Data.Commit[0].Id;
    if (typeof sha !== "string" || !/^[0-9a-f]{40}$/i.test(sha)) fail("无法固定仓库提交版本 / Cannot determine repository commit.");
    return sha.toLowerCase();
  }
  // Pack the 20-byte Git commit into 27 base64url characters. IDs remain stateless
  // across restarts, simultaneous repositories and later settings changes.
  function packCommit(hex) {
    let bits = 0, value = 0, out = "";
    for (let i = 0; i < hex.length; i += 2) {
      value = (value << 8) | parseInt(hex.slice(i, i + 2), 16); bits += 8;
      while (bits >= 6) { bits -= 6; out += B64[(value >>> bits) & 63]; }
    }
    if (bits) out += B64[(value << (6 - bits)) & 63];
    return out;
  }
  function unpackCommit(text) {
    if (!/^[A-Za-z0-9_-]{27}$/.test(text)) fail("任务文件标识无效，请重新添加仓库 / Invalid item ID.");
    let bits = 0, value = 0, out = "";
    for (const ch of text) {
      value = (value << 6) | B64.indexOf(ch); bits += 6;
      if (bits >= 8) { bits -= 8; out += ((value >>> bits) & 255).toString(16).padStart(2, "0"); }
    }
    if (packCommit(out) !== text) fail("任务文件标识无效 / Invalid item ID.");
    return out;
  }
  function glob(pattern) {
    let source = "^";
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === "*" && pattern[i + 1] === "*") {
        i++;
        if (pattern[i + 1] === "/") { i++; source += "(?:.*/)?"; }
        else source += ".*";
      } else if (ch === "*") source += "[^/]*";
      else if (ch === "?") source += "[^/]";
      else source += /[\\^$+?.()|{}\[\]]/.test(ch) ? "\\" + ch : ch;
    }
    return new RegExp(source + "$");
  }
  function rules(key) {
    const patterns = settingsString(key).split(/\r?\n/).map(p => p.trim()).filter(Boolean);
    if (patterns.length > 50 || patterns.some(p => p.length > 300)) fail("筛选规则过多或过长 / Too many filter patterns.");
    return patterns.map(glob);
  }
  function diskPath(path) {
    safePath(path, false);
    const parts = path.split("/");
    if (parts.some(p => /[<>:"|?*\x80-\x9f]/.test(p) || /[. ]$/.test(p) || p.includes("..") ||
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i.test(p))) {
      fail("文件名无法在 Windows/FluxDown 安全保存，请用排除规则过滤 / Unsupported filename: " + path);
    }
    if (parts.length > 9 || chars(path) > 180) fail("文件路径超过 FluxDown 的 8 层目录/180 字符限制，请缩小子目录 / Path too long: " + path);
    return parts;
  }
  function makeCollector(target, revision) {
    const include = rules("includePatterns"), exclude = rules("excludePatterns");
    const items = [], seen = new Set(), localPaths = new Set(), directories = new Set();
    const prefix = target.path ? target.path + "/" : "";
    function add(remotePath, size) {
      safePath(remotePath, false);
      if (prefix && !remotePath.startsWith(prefix)) fail("API 返回子目录之外的文件 / API returned a path outside the requested directory.");
      if (seen.has(remotePath)) fail("API 分页含重复文件，已停止以避免不完整清单 / Duplicate file in listing.");
      seen.add(remotePath);
      if (include.length && !include.some(r => r.test(remotePath))) return;
      if (exclude.some(r => r.test(remotePath))) return;
      const relative = remotePath.slice(prefix.length);
      const parts = diskPath(relative);
      const localKey = relative.normalize("NFC").toLowerCase();
      const parents = localKey.split("/").slice(0, -1).map((_, i, all) => all.slice(0, i + 1).join("/"));
      if (localPaths.has(localKey) || directories.has(localKey) || parents.some(p => localPaths.has(p))) {
        fail("仓库含 Windows 文件/目录大小写冲突 / Case-insensitive path collision: " + relative);
      }
      localPaths.add(localKey);
      parents.forEach(p => directories.add(p));
      const id = packCommit(revision) + ":" + remotePath;
      if (chars(id) > 200) fail("完整仓库路径超过清单标识上限（172 字符）；请使用单文件链接 / Repository path too long: " + remotePath);
      const item = { id, name: parts.pop(), path: parts.join("/"), kind: "file" };
      if (Number.isSafeInteger(size) && size >= 0) item.size = size;
      items.push(item);
      if (items.length > MAX_FILES) fail("筛选后超过 1000 个文件；请用子目录或包含/排除规则分批下载 / More than 1000 files.");
    }
    return { items, add };
  }
  function header(headers, name) {
    const key = Object.keys(headers).find(k => k.toLowerCase() === name);
    return key ? headers[key] : "";
  }
  function hfNextPage(next, target, resource) {
    const path = resource.slice(target.base.length);
    if (/^[?]/.test(next)) return resource + next;
    if (next.startsWith(path + "?")) return target.base + next;
    // Mirrors can preserve an upstream Link header. Rebase only this exact API
    // resource, including its pinned revision and subdirectory, to the endpoint.
    for (const base of [target.base, HF_ORIGIN, "https://www.huggingface.co"]) {
      const upstream = base + path;
      if (next.startsWith(upstream + "?")) return resource + next.slice(upstream.length);
    }
    fail("API 分页链接不可信 / Unsafe pagination URL.");
  }
  async function listHF(target, revision, collector, state) {
    const resource = apiBase(target) + "/tree/" + revision + (target.path ? "/" + encodedPath(target.path) : "");
    let url = resource + "?recursive=true&limit=1000";
    const pages = new Set();
    for (let page = 0; url; page++) {
      if (page >= MAX_PAGES || pages.has(url)) fail("分页异常或过多，请缩小子目录 / Invalid or excessive pagination.");
      // Never forward an API token to a host/path supplied by an untrusted Link header.
      if (!url.startsWith(resource + "?") || /[\s#]/.test(url)) fail("API 分页链接不可信 / Unsafe pagination URL.");
      pages.add(url);
      const { body, headers } = await jsonRequest(target, url, state);
      if (!Array.isArray(body)) fail("Hugging Face 文件清单格式变化 / Unexpected tree response.");
      for (const entry of body) {
        if (entry.type === "file") collector.add(entry.path, entry.lfs && entry.lfs.size != null ? entry.lfs.size : entry.size);
        else if (entry.type !== "directory") fail("不支持的仓库条目类型 / Unsupported tree entry.");
      }
      const link = header(headers, "link");
      const next = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(link);
      if (/rel="?next/i.test(link) && !next) fail("分页响应无法识别 / Invalid pagination header.");
      url = next ? hfNextPage(next[1], target, resource) : "";
    }
  }
  function modelScopeEntries(body, collector) {
    const files = body && body.Data && body.Data.Files;
    if (!Array.isArray(files)) fail("ModelScope 文件清单格式变化 / Unexpected tree response.");
    for (const entry of files) {
      if (entry.Type === "blob") collector.add(entry.Path, entry.Size);
      else if (entry.Type !== "tree") fail("不支持的仓库条目类型 / Unsupported tree entry.");
    }
    return files;
  }
  async function listMS(target, revision, collector, state) {
    if (target.kind === "models") {
      const url = apiBase(target) + "/repo/files?Revision=" + revision + "&Recursive=True" + (target.path ? "&Root=" + encodeURIComponent(target.path) : "");
      const { body } = await jsonRequest(target, url, state);
      const files = modelScopeEntries(body, collector);
      const count = body.Data.TotalCount;
      if (count != null && Number(count) > files.length) fail("ModelScope 返回了不完整的模型清单 / Incomplete model listing.");
      return;
    }
    const { body: info } = await jsonRequest(target, apiBase(target), state);
    const id = info && info.Data && info.Data.Id;
    if (!/^\d+$/.test(String(id))) fail("无法取得 ModelScope 数据集 ID / Missing dataset ID.");
    let received = 0;
    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = target.base + "/api/v1/datasets/" + id + "/repo/tree?Revision=" + revision +
        "&Root=" + encodeURIComponent(target.path || "/") + "&Recursive=True&PageNumber=" + page + "&PageSize=100";
      const { body } = await jsonRequest(target, url, state);
      const files = modelScopeEntries(body, collector);
      received += files.length;
      const count = body.TotalCount != null ? body.TotalCount : body.Data.TotalCount;
      if (count != null && Number.isFinite(Number(count))) {
        if (received >= Number(count)) return;
        if (!files.length) fail("数据集分页提前结束 / Incomplete dataset listing.");
      } else if (files.length < 100) return;
    }
    fail("数据集分页过多，请缩小子目录 / Too many dataset pages.");
  }
  function directResult(target, revision, path) {
    safePath(path, false);
    const name = path.split("/").pop();
    diskPath(name);
    const url = target.provider === "hf"
      ? target.base + (target.kind === "datasets" ? "/datasets/" : "/") + repoPath(target) + "/resolve/" + encodeURIComponent(revision) + "/" + encodedPath(path) + "?download=true"
      : apiBase(target) + "/repo?Revision=" + encodeURIComponent(revision) + "&Source=SDK&View=False&FilePath=" + encodeURIComponent(path);
    // Stable provider URL: let the engine probe ETag/Range and follow LFS/Xet/CDN
    // redirects afresh on every start/resume instead of persisting a signed URL.
    return { url, fileName: name, extraHeaders: authHeaders(target) };
  }
  globalThis.resolve = async function (ctx) {
    const target = parseTarget(ctx.url, Boolean(ctx.resolverItem));
    if (ctx.resolverItem) {
      const id = String(ctx.resolverItem);
      if (id.length < 29 || id[27] !== ":" || chars(id) > 200) fail("任务文件标识无效，请重新添加仓库 / Invalid item ID.");
      return directResult(target, unpackCommit(id.slice(0, 27)), id.slice(28));
    }
    const state = { started: Date.now() };
    const revision = await pinRevision(target, state);
    if (target.file) return directResult(target, revision, target.path);
    const collector = makeCollector(target, revision);
    if (target.provider === "hf") await listHF(target, revision, collector, state);
    else await listMS(target, revision, collector, state);
    if (!collector.items.length) fail("没有匹配文件；请检查目录和筛选规则 / No matching files.");
    collector.items.sort((a, b) => (a.path + "/" + a.name).localeCompare(b.path + "/" + b.name));
    const group = target.owner + "--" + target.name + "--" + revision.slice(0, 8);
    return { manifest: { name: group, items: collector.items } };
  };
})();

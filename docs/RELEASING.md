# GitHub 发布

仓库名：`fluxdown-plugin-model-hub`。插件运行代码位于仓库根目录，GitHub Release 是安装包发布渠道；`package.json` 的 `private: true` 防止误发到 npm，不影响 GitHub 开源和 Release。

## 首次创建远程仓库

将此目录作为仓库根目录上传到 GitHub，确保 `.github/`、`package-lock.json`、`LICENSE` 等文件都在根目录。不要将整个工作目录、上游 FluxDown 源码或 `node_modules/` 上传。

在 GitHub 创建名为 `fluxdown-plugin-model-hub` 的空仓库。以下命令在本项目目录执行，将 `<OWNER>` 换成你的 GitHub 用户名或组织名：

```sh
git init -b main
git add .
git commit -m "Prepare Model Hub plugin and release automation"
git remote add origin https://github.com/<OWNER>/fluxdown-plugin-model-hub.git
git push -u origin main
```

如果已初始化仓库或已有 `origin`，跳过对应命令。项目没有设置你的 Git 作者信息，请使用自己的 Git 配置提交。

## Actions 配置

仓库需要启用 GitHub Actions，并允许工作流使用官方 `actions/checkout`、`actions/setup-node`、`actions/upload-artifact`。

- **CI**：分支推送、PR、手动触发及 Release 调用；Windows/Linux × Node.js 22/24，运行离线测试、QuickJS 测试及打包验证。
- **Release**：仅 `v*` 标签推送触发；先校验标签，再运行完整 CI，成功后上传全部安装包并发布 Release。
- **Live smoke test**：手动触发，检查公开站点、小文件及权重 Range；不依赖任何模型站点 Token。

发布使用 GitHub 自动提供的 `GITHUB_TOKEN`，**无需新增 PAT 或 Secrets**。工作流默认只读，只有 `publish` 作业请求 `contents: write`。若组织策略禁止该权限，需要仓库/组织管理员允许发布作业写入 Release。

## 发布 v0.1.2

确认以下三处已经对应同一版本：

1. `package.json` 的 `version`：`0.1.2`。
2. `manifest.json` 的 `version`：`0.1.2`。
3. `CHANGELOG.md` 中有 `## [0.1.2] - 日期` 及非空更新内容。

本地预检：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:quickjs
npm run pack
npm run verify:package
npm run release:prepare -- v0.1.2
```

提交并推送当前修改后，再推送标签：

```sh
git tag -a v0.1.2 -m "Release v0.1.2"
git push origin v0.1.2
```

标签必须指向含工作流、锁文件、对应版本及更新记录的提交。普通分支推送只产生 CI 构建产物，不发布 Release。

Release 附件：

```text
fluxdown-plugin-model-hub-0.1.2.zip
fluxdown-plugin-model-hub-0.1.2.fxplug
fluxdown-plugin-model-hub-0.1.2.zip.sha256
fluxdown-plugin-model-hub-0.1.2.fxplug.sha256
SHA256SUMS
```

ZIP 和 FXPLUG 内容相同，包内只有 `manifest.json`、`resolver.js`、`README.md`、`LICENSE`。用户应安装这里的 ZIP 附件，GitHub 自动生成的 Source code 是开发源码。

## 后续版本与预发布

更新版本时先执行 `npm version 0.1.3 --no-git-tag-version`，同时修改 `manifest.json`、README 中的当前版本示例及 `CHANGELOG.md`，再提交、推送、打 `v0.1.3` 标签。

`0.2.0-rc.1` 等 SemVer 预发布版本使用标签 `v0.2.0-rc.1`，工作流自动将 Release 标记为 Pre-release。

## 失败重试

版本不匹配、测试失败或安装包校验失败时，工作流不会发布。标签内容有误时应修复后使用一个新版本标签。

上传阶段先创建 Draft，所有附件上传成功才公开。临时网络故障留下 Draft 时，可在 Actions 中 **Re-run failed jobs**；工作流会补齐并覆盖该 Draft 的附件，然后发布。已公开的同名 Release 会拒绝覆盖，需要发布新版本。

工作流只在 GitHub 上首次运行后才能确认组织权限及托管 runner 的实际行为。本地预检不会创建远程仓库、推送标签或发布 Release。

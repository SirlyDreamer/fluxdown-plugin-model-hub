# 参与开发

欢迎通过 Issue 描述问题或提交 PR。提交代码采用本仓库的 MIT 许可证。

## 本地环境

安装 Node.js 22 或 24，然后运行：

```sh
npm ci --ignore-scripts
npm run check
npm test
npm run test:quickjs
npm run pack
npm run verify:package
```

所有依赖都只用于开发。`resolver.js` 在 FluxDown 的 QuickJS 环境中运行，没有 Node.js、DOM、`URL`、`fetch` 全局对象或模块导入；网络与配置通过 `flux.fetch`、`flux.settings` 访问。

## 修改解析器

- 为新站点行为、分页、路径编码或认证改动补充能覆盖实际回归的测试，使用伪造请求响应。
- 保持仓库提交固定、目录结构和已有文件标识兼容。
- 不记录 Token/Cookie，不把访问令牌放入 URL，也不向镜像转发官方 Token。
- HTTP 错误、不完整分页或超限清单应明确失败。
- 不把 `node_modules/`、`dist/`、真实凭据或本机 FluxDown 配置提交到仓库。

API 接口联调可运行 `npm run test:live`，仅测试公开小文件及 32 字节权重片段。没有网络时，离线测试仍可运行。真实私有仓库问题请提供脱敏复现步骤，而非账户凭据。

## PR 和发布

PR 简要说明问题、修改后的行为和验证结果。一般功能 PR 不需要打版本标签，维护者在发布时同步版本号及 `CHANGELOG.md`。发布步骤见 [RELEASING.md](docs/RELEASING.md)。

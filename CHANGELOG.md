# 更新记录

版本号遵循 SemVer。每次发布前同时更新 `package.json`、`manifest.json` 和本文件。

## [0.1.2] - 2026-09-11

### 新增

- Hugging Face 镜像地址设置：粘贴官方模型、数据集、目录或单文件链接，通过镜像列出文件并生成下载地址。
- 校验镜像分页中的官方/相对链接，并转换为对应镜像路径。
- MIT 许可证、贡献指南及独立开源仓库结构。
- Windows/Linux、Node.js 22/24 CI，Node VM 与 QuickJS 测试。
- 推送版本标签后自动发布 GitHub Release，提供 ZIP、FXPLUG 及 SHA256 校验文件。

### 行为说明

- 镜像地址默认留空；配置镜像时不转发 Hugging Face Token。
- 插件身份继续使用 `model-hub@local`，兼容已安装版本及设置。

## [0.1.1] - 2026-09-11

- 区分 DNS/地址拦截、TLS、超时及代理连接错误，隐藏底层错误中的潜在凭据。
- 记录 FluxDown 0.4.7 与 TUN/fake-IP 的代理配置方式。
- 提供内容相同的 ZIP 与 FXPLUG 安装包。

## [0.1.0] - 2026-09-10

- 支持 Hugging Face、ModelScope 的模型与数据集仓库、目录和单文件下载。
- 支持文件勾选、全选、保留子目录、访问令牌及包含/排除规则。
- 固定仓库提交版本，文件任务可在无清单缓存时独立解析。

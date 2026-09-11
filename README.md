# fluxdown-plugin-model-hub

为 [FluxDown](https://github.com/zerx-lab/FluxDown) 添加 Hugging Face、ModelScope 模型与数据集下载支持。

- 粘贴仓库、目录或单文件链接，勾选文件或全选下载。
- 保留目录结构，支持版本选择、文件筛选和 Token 认证。
- 支持自定义 Hugging Face 镜像。

## 安装与使用

需要 FluxDown 0.1.44+，并支持多文件插件。

1. 从 [Releases](https://github.com/SirlyDreamer/fluxdown-plugin-model-hub/releases/latest) 下载插件 `.zip` 安装包。
2. 在 FluxDown **设置 → 扩展 → 插件** 中安装并启用。
3. 新建下载，粘贴官方链接，勾选文件后开始下载。

```text
https://huggingface.co/sshleifer/tiny-gpt2
https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct
```

## 插件设置

- **Hugging Face 镜像地址**：例如 `https://hf-mirror.com`，留空使用源站。仍粘贴官方链接，文件清单和下载地址会自动使用镜像。
- **Token**：公开仓库可留空；私有或受限仓库填写对应平台的 Token。Hugging Face 镜像不接收 Token，此类仓库请使用源站。
- **版本与筛选**：可指定版本、子目录及包含/排除规则，例如 `**/*.safetensors`。单次最多列出 1000 个文件，大仓库可按目录分批下载。

## 开发

需要 Node.js 22+。

```sh
npm ci --ignore-scripts
npm test
npm run test:quickjs
npm run pack
```

安装包输出至 `dist/`。提交版本标签后，GitHub Actions 自动测试并发布 Release。

[贡献指南](CONTRIBUTING.md) · [发布指南](docs/RELEASING.md) · [更新记录](CHANGELOG.md) · [MIT License](LICENSE)

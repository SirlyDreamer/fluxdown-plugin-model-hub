# fluxdown-plugin-model-hub

用于 [FluxDown](https://github.com/zerx-lab/FluxDown) 的模型与数据集下载插件。支持 Hugging Face、ModelScope、Hugging Face 镜像、按文件选择下载及完整仓库下载。

A standalone FluxDown plugin for Hugging Face and ModelScope models/datasets, with file selection, pinned revisions and configurable Hugging Face mirrors.

[下载安装包](https://github.com/SirlyDreamer/fluxdown-plugin-model-hub/releases/latest) · [更新记录](CHANGELOG.md) · [贡献指南](CONTRIBUTING.md) · [发布指南](docs/RELEASING.md) · [MIT License](LICENSE)

当前版本 **0.1.2**，支持 Hugging Face、ModelScope，以及自定义 Hugging Face 镜像。粘贴仓库链接后，使用 FluxDown 的文件清单选择框勾选文件或全选，保留子目录，下载由 FluxDown 引擎执行。

需要 **FluxDown 0.1.44 或更新版本，且该构建已启用 plugins 并包含多文件清单接口**。安装插件不需要 Node.js、Python、Git 或模型 SDK。移动端等未启用插件的构建不能使用。

## 安装与使用

1. 从本仓库 **Releases** 下载 `fluxdown-plugin-model-hub-0.1.2.zip`。在 FluxDown 的 **设置 → 扩展 → 插件** 中选择本地文件安装。请使用 Release 附件中的插件 ZIP；GitHub 自动提供的 `Source code (zip)` 是开发源码。另提供内容相同的 `.fxplug` 格式，0.4.7 的文件选择器筛选 ZIP。
2. 在插件设置中按需填写 **Hugging Face Token**、**ModelScope Token**。公开仓库通常留空即可。
3. 新建下载任务，粘贴下方任一仓库链接，等待文件清单。
4. 勾选需要的文件，或全选下载；选择保存位置后创建任务。

也可以选择 **从目录安装（开发模式）**，指向源码中同时包含 `manifest.json` 和 `resolver.js` 的目录。开发模式会在每次调用时重新读取脚本；修改 manifest 后需要重新加载插件。

目录名形如 `Qwen--Qwen2.5-0.5B-Instruct--186d8559`，末尾为提交号前 8 位，便于区分版本。目录内保留仓库相对路径。选择子目录时，所选目录作为下载根目录。最终保存位置由 FluxDown 的选择框和任务组设置决定。

## 支持的链接

| 类型 | 示例 |
|---|---|
| Hugging Face 模型 | `https://huggingface.co/sshleifer/tiny-gpt2` |
| Hugging Face 数据集 | `https://huggingface.co/datasets/lhoestq/demo1` |
| Hugging Face 子目录 | `https://huggingface.co/datasets/lhoestq/demo1/tree/main/data` |
| Hugging Face 单文件 | `https://huggingface.co/sshleifer/tiny-gpt2/blob/main/config.json` |
| ModelScope 模型 | `https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct` |
| ModelScope 数据集 | `https://modelscope.cn/datasets/AI-ModelScope/alpaca-gpt4-data-en` |
| ModelScope 指定版本 | `https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct/files?Revision=master` |
| ModelScope 单文件 | `https://modelscope.cn/models/Qwen/Qwen2.5-0.5B-Instruct/files?Revision=master&FilePath=config.json` |

支持上述站点的 `www` 域名。Hugging Face 可通过下方设置切换请求站点，ModelScope 使用官方 HTTPS 域名。插件接管的输入仍是官方站点链接。也支持 `/resolve/版本/文件`，ModelScope 的 `/file/view/版本/文件`，以及 `/tree/版本/目录` 形式。版本名包含 `/` 时，在 URL 的版本部分编码为 `%2F`，或在插件设置中填写原始版本名。

## Hugging Face 镜像

在 **设置 → 扩展 → 插件 → Model Hub → 设置** 的 **Hugging Face 镜像地址** 中填写镜像站点根地址，例如 `https://hf-mirror.com`。默认留空，使用官方站点。地址必须使用 HTTPS，可以包含端口、末尾斜杠；不能包含账号密码、仓库/API 路径、查询参数或片段。镜像须兼容 Hugging Face Hub 的版本与文件树 API，以及文件的 `/resolve/` 地址。

保存后继续粘贴 **Hugging Face 官方链接**：

```text
输入：https://huggingface.co/sshleifer/tiny-gpt2/blob/main/config.json
下载：https://hf-mirror.com/sshleifer/tiny-gpt2/resolve/<提交号>/config.json?download=true

输入：https://huggingface.co/datasets/lhoestq/demo1
清单：https://hf-mirror.com/api/datasets/lhoestq/demo1/tree/<提交号>?recursive=true&limit=1000
下载：https://hf-mirror.com/datasets/lhoestq/demo1/resolve/<提交号>/data/test.csv?download=true
```

仓库、子目录、单文件均适用，目录结构及版本固定方式保持一致。版本查询、文件清单和生成的下载地址都会使用镜像，不需要先连接源站。镜像分页中返回的源站地址会在校验为同一仓库、版本和目录后改为镜像地址；其他站点或目录的分页链接会报错。

**镜像请求不携带插件配置中的 Hugging Face Token**。私有或受限仓库请清空镜像设置，使用官方站点和有权限的 Token。镜像不支持所需接口或返回错误时会显示错误，不会自动回退到官方站点。ModelScope 不受此设置影响。

设置在下一次插件解析时生效，无须重启应用；已经开始下载的连接不会即时切换。已有文件标识仍固定原提交，重新解析时使用当前镜像设置。实际文件重定向和传输由 FluxDown 引擎处理；镜像是否将大文件继续转向其他存储站点，取决于镜像服务。

## 版本、目录与筛选

- **默认版本**：留空时 Hugging Face 使用 `main`，ModelScope 使用 `master`。URL 中的版本优先于设置。可填分支、标签或完整 40 位提交号。
- **子目录**：例如 `data/train`，相对仓库根目录填写，不带开头或结尾的 `/`。URL 中明确指定的目录优先。
- **包含规则**：每行一个，任一规则匹配即保留；留空包含全部。
- **排除规则**：每行一个，排除优先于包含。

规则匹配**仓库完整相对路径**，区分大小写。`*` 匹配当前层任意字符，`?` 匹配当前层一个字符，`**` 可跨目录，`**/` 也匹配根目录。规则是通配符，不是正则表达式；不支持字符集合或否定规则。

例如保留所有层级的 safetensors 权重、JSON 配置及文本文件：

```text
**/*.safetensors
**/*.json
**/*.txt
```

例如排除 PyTorch `.bin` 权重和一个量化目录：

```text
**/*.bin
quantized/**
```

完整仓库下载建议保持筛选规则为空；模型加载通常也需要配置和 tokenizer 等文件。插件不会默认排除 README、配置或 Git 元文件。单文件链接直接解析对应文件，不应用仓库筛选规则。

## Token 与权限

- Hugging Face：从 [Access Tokens](https://huggingface.co/settings/tokens) 获取对目标仓库有读取权限的 Token。插件使用 `Authorization: Bearer …`。
- ModelScope：从网站个人中心获取 SDK 访问令牌。按照 ModelScope SDK 的方式，使用 `m_session_id` Cookie 认证。
- 受限仓库需要先在网站接受条款或取得访问批准；Token 不会绕过站点权限。

两个 Token 分别发送到对应官方站点，不互相混用。分页链接会校验到原 API 资源，拒绝向外站发送凭据。插件不把 Token 写入 URL、清单文件标识或日志。密码控件只遮蔽显示；设置及下载请求头的实际存储由 FluxDown 管理，不能视为独立加密凭据库。

## 使用代理时出现网络错误

如果浏览器能够打开仓库，但插件出现网络错误，检查是否使用 Mihomo/Clash 的 TUN 与 `fake-ip` 模式。这类网络可能把站点域名解析成 `198.18.x.x`。FluxDown 插件的公网地址防护会拒绝这些虚拟地址，而普通浏览器或其他下载器可能正常。

在 **FluxDown → 设置 → 代理** 中选择 **手动配置**，填写现有代理程序的本机地址及实际 HTTP/混合端口，然后**完全退出并重新启动 FluxDown**。代理类型选择 HTTP（HTTPS 目标也通过 HTTP CONNECT 连接）；不要将混合端口误设为 HTTPS 代理。以自己的代理配置为准，不要猜测端口。

在核对过的 FluxDown 0.4.7 中，“自动”模式对插件解析阶段仍为直连；插件网络客户端在启动时固定代理配置，所以只修改设置或开关插件不足以更新网络出口。此问题需要修正宿主的连接方式，单独升级插件不能让网络自动恢复。

0.1.1 将网络错误区分为 DNS/地址拦截、TLS、超时、代理连接失败和未知请求失败，并提供下一步操作；不回显可能含凭据的底层原始错误。原有任务的文件标识继续兼容。

## 下载行为与边界

仓库清单在生成时固定到 Git 提交号，选中的文件标识携带提交号和原始路径。排队、重启、改变目录筛选设置后，已选任务仍解析原版本，不依赖会过期的清单缓存。单文件 URL 在每次初段解析时解析其指定版本；如需始终固定同一版本，可直接使用完整提交号。

下载返回官方或所配置镜像的稳定 resolve/repo 地址，由引擎处理 LFS、Xet 和 CDN 重定向。插件不缓存短期签名 URL，也不禁用引擎的元数据探测。队列、分段、暂停和续传复用 FluxDown 的能力；本插件不实现另一套下载器，也不执行下载的脚本。

首版范围及限制：

- 下载仓库文件树中的模型和数据集文件；不执行数据集加载脚本，不自动追踪说明文件中的外部下载地址、对象存储资源或流式数据接口，也不自动转换数据格式。
- 一次清单最多 **1000 个筛选后的文件**。超过上限会报错，请按子目录或筛选规则分批添加。不会只返回前 1000 个而假装完整。
- FluxDown 单次解析最多 **30 秒**，单个 API 请求最多 10 秒、响应最多 8 MB。大仓库、慢网络可能需要缩小子目录；单纯筛选文件名不能减少所有平台的 API 列举开销。
- 保存的相对路径最多 **8 层目录、180 个 Unicode 字符**；为符合 200 字符的文件标识上限，本版清单中的仓库完整路径最多 **172 个 Unicode 字符**。更长路径可尝试单文件链接。
- 不安全路径、Windows 不支持的名称、大小写冲突和不完整分页会报错，避免改名破坏模型的文件引用。
- 接收 HTTPS 官方仓库、目录和文件链接；可配置 Hugging Face 镜像，不提供站内搜索或浏览器登录。

## 验证记录

验证日期：**2026-09-10 至 2026-09-11**。接口核对基于 FluxDown `main` 提交 `ec394d578d52d4b567dc7edb4a93fdad63c2d031`（版本 `0.1.44+1`）及本地 FluxDown **0.4.7** 的插件网络实现。

- 41 项自动化测试通过；覆盖两平台模型/数据集、分页、中文与编码路径、版本固定、Token 隔离、1000 文件边界、筛选、非法响应、路径冲突、无缓存二段解析、网络错误分类和脱敏，以及新增镜像 URL 转换、分页重定向校验、设置变更和镜像认证隔离。
- 首版在 Node.js 的精简 VM 沙箱及独立 QuickJS/WASM 中运行；0.1.2 在 QuickJS 下通过全部 41 项。QuickJS 校验器仅用于开发，不包含在插件安装包内。
- 以下公开仓库的清单和实际小文件下载通过，下载字节数与清单一致：

| 站点/类型 | 仓库 | 清单文件数 | 下载文件 | 字节数 |
|---|---|---:|---|---:|
| Hugging Face 模型 | `sshleifer/tiny-gpt2` | 9 | `config.json` | 662 |
| Hugging Face 数据集 | `lhoestq/demo1` | 4 | `data/test.csv` | 894 |
| ModelScope 模型 | `Qwen/Qwen2.5-0.5B-Instruct` | 11 | `config.json` | 659 |
| ModelScope 数据集 | `AI-ModelScope/alpaca-gpt4-data-en` | 4 | `README.md` | 1228 |

- Hugging Face 的 `pytorch_model.bin` 和 ModelScope 的 `model.safetensors` 均完成 `bytes=0-31` 分段下载，返回 **206** 和正确的 Content-Range；每个仅读取 32 字节。
- 已在本地 FluxDown 0.4.7 的安装界面安装并启用插件，0.1.1 经本机代理成功解析 `deepseek-ai/DeepSeek-V4.1-Flash`，列出 89 个文件，约 475 GB。**尚未验证**：实际镜像服务下载、真实引擎暂停续传、真实私有或受限仓库。没有提供账号 Token；独立 QuickJS/WASM 校验不能代替这些端到端验收。

## 开发与打包

生产入口只有 `manifest.json`、`resolver.js`。脚本使用 FluxDown 注入的 `flux.fetch` 和 `flux.settings`；没有第三方运行时依赖。

开发环境需要 Node.js **22 或更新版本**；CI 覆盖 Windows/Linux 和 Node.js 22/24。安装插件的用户不需要这些开发依赖。

```powershell
npm ci --ignore-scripts
npm run check
npm test
npm run test:quickjs
npm run pack
npm run verify:package
```

`dist/` 内生成 `.fxplug`、同内容的 `.zip`、单文件 `.sha256` 及 `SHA256SUMS`。安装包根目录只包含 `manifest.json`、`resolver.js`、`README.md` 和 `LICENSE`，不包含开发依赖、测试或本地配置。文件顺序、权限和时间戳固定，同一份源码可重复生成相同校验值。

`npm run test:quickjs` 使用锁定的 QuickJS/WASM 运行 41 项解析器测试；`npm test` 还测试发布版本校验、预发布识别、更新记录提取及安装包内容。所有开发依赖通过 `package-lock.json` 锁定。

`npm run test:live` 可选，只请求上述公开仓库、小文件和 32 字节权重片段，不读取你的 Token。GitHub Actions 中对应 **Live smoke test → Run workflow**；它不会阻塞离线 CI 或 Release。

推送 `v0.1.2` 这样的标签会触发自动 Release，要求标签、`package.json`、`manifest.json` 版本一致，并有对应更新记录。详见[发布指南](docs/RELEASING.md)。

本项目发布包沿用 `model-hub@local` 身份，以便更新已经安装的插件及保留设置。GitHub 仓库名与 FluxDown identity 是不同概念。如果之后接入要求作者身份的插件市场，可单独迁移；更改 identity 会成为另一个插件，其设置不与旧身份共用。

## 许可证

本仓库代码以 [MIT](LICENSE) 许可发布。FluxDown、Hugging Face、ModelScope 及其托管模型/数据集分别遵循各自的许可证和条款；本插件不重新授权这些项目或下载内容。

接口参考：

- [FluxDown 多文件声明](https://github.com/zerx-lab/FluxDown/blob/ec394d578d52d4b567dc7edb4a93fdad63c2d031/native/engine/src/plugin/manifest.rs)
- [FluxDown resolver 与清单类型](https://github.com/zerx-lab/FluxDown/blob/ec394d578d52d4b567dc7edb4a93fdad63c2d031/native/engine/src/plugin/runtime.rs)
- [FluxDown 输出校验](https://github.com/zerx-lab/FluxDown/blob/ec394d578d52d4b567dc7edb4a93fdad63c2d031/native/engine/src/plugin/manager.rs)
- [Hugging Face Hub API](https://huggingface.co/docs/hub/api)
- [ModelScope SDK API 与认证](https://github.com/modelscope/modelscope/blob/v1.34.0/modelscope/hub/api.py)
- [ModelScope SDK 文件下载](https://github.com/modelscope/modelscope/blob/v1.34.0/modelscope/hub/file_download.py)

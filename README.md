# 文档与工具

通用文档与工具平台，提供 JSON、Markdown 预览（支持 Mermaid）、JWT、摘要、字符串处理和加解密六类浏览器工具，以及私有 GitHub 仓库的文档阅读入口。JSON 与字符串处理在同一页面顶部切换，输入、结果和选项各自独立保存；字符串处理的 Base64、转义和引号转换也分别保存输入与结果。使用TypeScript + Vite，无需后端。

默认 GitHub Pages 访问地址：[https://liuzhenghua.github.io/tech-hub/](https://liuzhenghua.github.io/tech-hub/)。这是部署地址，实际可用性取决于发布状态。自行部署时，默认地址为 `https://<GitHub 用户名>.github.io/<网站仓库名>/`，与文档源仓库配置无关。

## 本地使用

需要 Node.js 22.12 或更新版本。无需凭证即可预览工具页：

```sh
npm ci
npm run dev
# 打开 http://127.0.0.1:4173
```

### 配置文档源

根目录 `.env` 保存可公开、随代码提交的默认配置：

```dotenv
VITE_GITHUB_REPOSITORY=liuzhenghua/tech
VITE_DOCS_DIR=docs
VITE_SITE_TITLE=文档与工具
```

仓库使用 `owner/repo` 格式，文档目录是仓库相对路径，支持 `knowledge/docs` 等多层目录；设为 `/` 时递归收录整个仓库的 Markdown 文件。文档库只收录指定目录下的 Markdown 文件，分类对应其中的主题目录。

本机覆盖配置可写入忽略提交的 `.env.local`。修改配置后重启开发服务；线上修改需要重新构建发布。

### 配置访问口令

1. 打开 [Fine-grained PAT 创建页面](https://github.com/settings/personal-access-tokens/new)，选择文档源仓库，授予 **Contents: Read-only** 并设置有效期。详细步骤见 [GitHub 官方说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-fine-grained-personal-access-token)。
2. 复制 `.env.example` 为 `.env.token.local`，填写 Token 和容易记住的长口令。两个文件中的示例值需要替换，真实凭证不要提交。
3. 首次配置或更换 Token 时执行：

```sh
node --env-file=.env.token.local tools/encrypt-token.mjs
```

脚本将 Token 密文写入 `.env.local` 的 `VITE_GITHUB_TOKEN_BOX`。Vite 启动和构建时自动读取，页面输入口令即可解锁。若开发服务正在运行，生成密文后重启服务。

## 发布到 GitHub Pages

在网站仓库配置以下项目：

1. **Settings → Secrets and variables → Actions → Secrets**：添加 `VITE_GITHUB_TOKEN_BOX`，值为 `.env.local` 中该变量等号后的密文。
2. **Settings → Pages → Source**：选择 **GitHub Actions**。
3. 推送到 `main`，或在 **Actions → Deploy Tech Hub → Run workflow** 手动发布。

默认地址为 [liuzhenghua.github.io/tech-hub](https://liuzhenghua.github.io/tech-hub/)。工作流安装依赖、检查格式、运行测试并构建发布；私有文档不进入构建产物。

### 在 GitHub 覆盖文档源

可以修改并提交 `.env`，也可在 **Settings → Secrets and variables → Actions → Variables** 添加 Repository variables：

| 配置                     | 是否必填           | 默认值             | GitHub 配置位置 | 用途                                             |
| ------------------------ | ------------------ | ------------------ | --------------- | ------------------------------------------------ |
| `VITE_SITE_TITLE`        | 否                 | `文档与工具`       | Variables       | 页面品牌、浏览器标题和页脚名称                   |
| `VITE_GITHUB_REPOSITORY` | 否                 | `liuzhenghua/tech` | Variables       | 文档源仓库，格式为 `owner/repo`                  |
| `VITE_DOCS_DIR`          | 否                 | `docs`             | Variables       | 仓库内文档目录，支持多层路径；`/` 表示仓库根目录 |
| `VITE_GITHUB_TOKEN_BOX`  | 访问私有文档时必填 | 无                 | Secrets         | 加密后的 Token；未配置时只能使用公开工具         |

使用默认文档源时，无需添加 Variables，只需配置密文 Secret。可选变量未设置或为空时使用程序默认值。保存配置后重新运行发布工作流。更换仓库时，还需确认 Token 有对应仓库的读取权限；Token 过期或更换后，重新生成密文并更新 Secret。

## 阅读与本地缓存

文档页提供分类卡片、搜索和正文预览，点击进入详情。主入口通过 `#/tools` 和 `#/docs` 渲染对应组件，顶部菜单共用，页面按需加载；每篇文档有独立 URL，可刷新恢复；未解锁时先输入口令。支持 Markdown、Mermaid、相对文档链接及仓库内 PNG、JPEG、GIF、WebP 图片。代码块可复制，图表可放大、复制和下载。

默认记住口令，口令、列表和最近阅读的正文以明文保存在当前浏览器 localStorage。再次进入先显示缓存，再后台解锁并检查更新；Token 仅留在内存。全文检索索引与摘要一起缓存并记录文件 SHA；构建文档库时读取全部尚未建立索引或已变更的文档（最多并发 3 个请求），生成主子关系，未变更的索引直接复用。可供离线阅读的原始正文最多缓存 10 篇，每篇上限 150,000 字符，图片不缓存。索引写入 localStorage 失败不影响当前会话，刷新后可能需要联网重建。文件 SHA 变化时正文缓存失效，切换仓库、目录或 Token 密文后不复用旧缓存。

不勾选记住口令时不保留文档缓存。点击“锁定”会清除口令、缓存和当前内容。网络失败时可阅读缓存正文，未缓存内容需要联网；浏览器存储不可用时仍可在线阅读。

### 文档 Front Matter

Markdown 可选用文件头声明标题和是否作为独立文档展示；没有文件头的现有文档无需修改：

```markdown
---
title: 浏览器自动化
standalone: false
---

# 浏览器自动化

[返回主文档](./index.md)

这里是子文档正文。
```

| 字段         | 解析规则                                                                         | 默认行为                               |
| ------------ | -------------------------------------------------------------------------------- | -------------------------------------- |
| `title`      | 非空字符串，去除首尾空白；优先作为列表标题                                       | 使用正文第一个一级标题，再回退到文件名 |
| `standalone` | 只有 YAML 布尔值 `false` 表示子文档；字符串 `"false"`、`null` 和其他类型均不排除 | 独立展示                               |

文件头要求与处理规则：

- 必须从文件第一行开始（允许 UTF-8 BOM），用单独一行的 `---` 开始和结束；支持 LF、CRLF 换行，分隔符允许尾随空格或制表符。
- 内容按 YAML 解析，顶层必须是映射；支持引号和注释，字段名区分大小写，未知字段忽略。有效文件头不显示在正文和摘要中；`title` 不会自动生成正文标题。
- YAML 语法错误、重复键、顶层不是映射或缺少结束分隔符时，整个文件按普通 Markdown 处理，不应用元数据。

**未标记或 `standalone: true` 的是主文档，只有 `standalone: false` 才是子文档。** 主文档没有固定命名规则。子文档归属于同目录唯一的主文档；子目录中没有主文档时向上寻找最近的唯一主文档。列表、分类和计数只展示主文档，子文档命中检索时归并到主文档，并标注命中的子文档。子文档仍可通过文档 URL 和 Markdown 相对链接直接访问。原始 Markdown 复制和导出保留文件头。

元数据和全文检索索引在构建文档库时统一读取，不再按卡片可见性加载。刷新时保留缓存列表并在后台更新；真实索引失败显示简短提示和重试按钮，详细清单默认折叠。升级前没有全文索引的缓存会重新生成。

### 文档导出

阅读页可复制当前 Markdown 全文，或通过“导出”菜单选择当前 `.md`、包含子文档的 `.zip`、当前文档 PDF。ZIP 使用列表和检索共用的主子关系，保留仓库相对目录及本地图片；读取失败时列出缺失项，支持重试或导出已有内容。PDF 当前仅导出打开的文档。完整的归属、检索和导出边界见 [文档库业务规则](docs/document-business-rules.md)。

### 访问边界

- 目录按默认分支的同一个提交加载；检索匹配主文档和所属子文档的路径、标题、摘要及完整正文，子文档命中归并到主文档。
- 外部图片不自动加载；非 Markdown 的仓库文件需在 GitHub 查看。GitHub 截断大型仓库目录时会提示错误。
- Markdown 经 DOMPurify 清洗，Mermaid 使用 strict 模式。独立工具页不接收凭证。

### 凭证保护

`VITE_` 前缀表示允许进入前端构建，只有密文和公开配置使用此前缀。原始 `DATA_GITHUB_TOKEN`、`DATA_TOKEN_PASSPHRASE` 仅供本机加密脚本使用。

Token 使用 PBKDF2-HMAC-SHA256（600,000 次迭代、16 字节随机 salt）派生的 AES-256-GCM 密钥加密，每次生成随机 12 字节 IV。公开密文可被离线猜解，应使用长口令及独立的只读 Token。

同一 `github.io` 域名下的项目共享 origin，localStorage 不按路径隔离。同源脚本属于信任范围；需要隔离时使用独立域名，不引入不可信脚本。

## 开发与维护

```sh
npm run typecheck        # TypeScript 严格类型检查
npm test                 # 行为测试
npm run format:check     # 格式检查；npm run format 自动整理
npm run build            # 生产产物输出到 dist/
npm run preview          # 本地检查生产构建
```

开发服务支持热更新，生产资源使用相对路径以兼容 Pages 仓库子路径。依赖由 `package-lock.json` 锁定；Mermaid 按需加载。

- `src/`：页面、阅读器、API、缓存和凭证解锁；CSS 按布局与组件分区。
- `src/tools/<工具>/index.html` 和 `main.ts`：六类工具各自的页面与脚本入口，通过 `tools/json/`、`tools/markdown/` 等路径访问。
- `src/tools/<工具>/tool.ts`：工具定义；`transform.ts`：可独立测试的业务计算。加解密按算法族继续分模块。
- `src/tools/shared/`：工具接口类型、编辑器、状态持久化、JSON 树及字节编解码；`src/tool.css`：编辑器布局。
- `src/markdown.ts`：文档阅读器与 Markdown 工具共用的清洗、语法高亮、代码复制和 Mermaid 渲染；图表交互复用 `src/diagrams.ts`。
- `public/tools/text-toolbox/`：保留旧版离线工具入口及算法依赖许可证，仅供旧版离线页面使用；新工具通过 npm 模块加载算法依赖。
- `tools/`：Token 加密程序。
- `tests/`：解锁、API、缓存和路由测试。
- `vite.config.js`：开发服务与构建配置。

文档协作遵循 [AGENTS.md](./AGENTS.md)。

前端源码统一使用 TypeScript 严格检查。文档库的仓库访问、凭证解锁、缓存、会话、目录和阅读器分别位于 `src/documents/`；`src/app.ts` 只负责公共外壳、路由和共享会话组装；`src/components/site-header.*` 是共用顶部菜单，`src/pages/` 分别封装工具目录和文档页模板与生命周期。新增工具在独立目录定义 `ToolDefinition`，公共编辑器只通过接口调用工具，不导入具体工具的业务代码。

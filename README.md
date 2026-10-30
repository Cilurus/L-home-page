# L 起始页（L Start Page）

一个**单文件**的浏览器新标签页 / 起始页：零依赖、零构建、双击即用。
深色玻璃质感 + 极简布局，只做四件事：看时间、搜索、换壁纸、存收藏。

![版本](https://img.shields.io/badge/version-V3.0.0%20F-2ea44f)
![许可](https://img.shields.io/badge/license-MIT-blue)

## 在线使用

| 用法 | 链接 |
|---|---|
| **直接打开**（GitHub Pages） | https://cilurus.github.io/L-home-page/ |
| **下载单文件**（Releases，约 160 KB） | https://github.com/Cilurus/L-home-page/releases/download/v2.2.1/L-home-page-v2.2.1.html |
| CDN 直链（jsDelivr，无需配置） | `https://cdn.jsdelivr.net/gh/Cilurus/L-home-page@main/index%20-%20new.html` |
| 查看源码原文 | `https://raw.githubusercontent.com/Cilurus/L-home-page/main/index%20-%20new.html` |

下载得到的 HTML 双击即可用，不需要安装任何东西。

---

## 浏览器扩展（V3.0.0「F」）

同一个起始页现在也能**整屏覆盖到 DeepSeek 网页上**：打开 `chat.deepseek.com` 先看到起始页，
右上角点鲸鱼回到原页面，原页面右上角留一个「F」圆标再切回来。

| 交互 | 位置 | 行为 |
|---|---|---|
| 鲸鱼圆钮 | 起始页右上角，齿轮左边 | 收起浮层，露出 DeepSeek 原页面 |
| 「F」圆标 | DeepSeek 原页面右上角 | 重新展开起始页 |
| `deepseek` 引擎 | 搜索引擎下拉 | 搜索框下移到底部，上方开一个对话大窗（真实聊天区） |

选 `deepseek` 后，底部输入框回车会把内容**代填进 DeepSeek 的输入框并发送**，回复就地显示在上方窗口里。

```bash
# 安装：chrome://extensions → 开发者模式 → 加载已解压的扩展程序 → 选 extension/
node tools/build-extension.mjs    # 改了 index - new.html 之后必须重新构建
```

> 两个必须知道的约束：DeepSeek 返回 `frame-ancestors 'none'`，iframe 嵌不了，所以走的是
> 「Shadow DOM 注入 + 遮罩挖洞」；扩展不申请任何权限，数据存 `LSP:` 前缀的 localStorage。
> 细节见 [extension/README.md](extension/README.md)。

## 功能

| 模块 | 说明 |
|---|---|
| 时钟 | 大号时钟；**点击时间**弹出农历（干支年、生肖、节气、时辰） |
| 搜索 | 支持 Google / Bing / Yandex 切换，回车即搜 |
| 壁纸 | 9 张预设（Orca、Sky、Deep Space、Grade Grey、Evening Sunshine、Moonlit Asteroid、灵动、雨滴、萤火）+ 自定义上传（自动压缩） |
| 收藏夹 | 底部 macOS Dock 风格书签栏，20 个槽位、图标自动抓取、拖动排序、自动补位 |
| 外观设置 | 透明卡片、模糊程度、文字颜色（白/灰/黑/自定义）、显示格言、极简模式、恢复默认 |
| 格言 | 底部一句话，可自定义 |

不再包含任何 AI / API / 账号相关功能 —— V2.2.0 起已整体移除，代码里也不留残骸。

## 快速开始

```bash
# 方式一：直接双击
# 从 Releases 下载的 L-home-page-v2.2.1.html，或仓库里的 index - new.html，双击即可

# 方式二：本地起个静态服务（推荐，localStorage 行为与线上一致）
python3 -m http.server 8080
# 然后访问 http://localhost:8080/index%20-%20new.html
```

设为浏览器主页 / 新标签页：

- **Chrome / Edge**：设置 → 启动时 → 打开特定网页 → 填入本地文件路径或部署后的网址
- 新标签页替换需要扩展（如 New Tab Redirect）指向该地址

> 所有数据都存在浏览器 `localStorage` 里，不上传、不联网（除搜索跳转与收藏图标抓取外无外部请求）。
> 换浏览器 / 清缓存会丢数据，重要收藏请自行备份。

## 部署

主文件是纯静态 HTML，任何能托管网页的地方都能跑。本仓库当前的发布形态：

### GitHub Pages（已启用）

- 网址：**https://cilurus.github.io/L-home-page/**
- 由 `.github/workflows/pages.yml` 自动发布：push 到 `main` 即触发；发布目录只放页面（`archive/`、`tests/`、`tools/` 不上线）
- 仓库 Settings → Pages → Source 为 **GitHub Actions**（即 `build_type: workflow`）
- 根路径返回的是**真实页面**：工作流把主文件复制为 `dist/index.html`，所以打开没有跳转闪屏；同时保留一份带空格的原名供旧链接使用。
  仓库根目录的 `index.html` 只是给「Deploy from a branch」模式用的跳转页，Actions 模式下不参与发布。

> 首次启用 Pages 时 Actions 会报 `Create Pages site failed. Resource not accessible by integration`：
> GITHUB_TOKEN 没有创建 Pages 站点的权限，必须由管理员在 Settings → Pages 里手动选一次 **GitHub Actions**。
> 启用后再 push（或 Re-run jobs）即可成功。

### 本地起服务

```bash
python3 -m http.server 8080
# 打开 http://localhost:8080/
```

### 其他静态托管

Vercel / Netlify / Cloudflare Pages / 对象存储（OSS、COS、S3）：连仓库、构建命令留空、输出目录填 `/`。
主文件名带空格，想让根路径直接访问就把 `index.html` 一起部署。

### 发布新版本

```bash
# 1. 改主文件 + 快照进 archive/ + 补 CHANGELOG
git add -A && git commit -m "feat: V2.2.2 ..."

# 2. 打 tag 并推送（Pages 随 push 自动更新）
git tag -a v2.2.2 -m "V2.2.2"
git push origin main --tags
```

然后在 Releases 里基于该 tag 建 release，把 HTML 作为附件上传；也可以走 API 免拖拽：

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: text/html" \
  --data-binary @"index - new.html" \
  "https://uploads.github.com/repos/Cilurus/L-home-page/releases/<release_id>/assets?name=L-home-page-v2.2.2.html"
```

## 项目结构

```
.
├── index - new.html                 # 主文件：全部 HTML / CSS / JS（唯一交付物）
├── index.html                       # 站点根路径的跳转页（指向主文件，约 1 KB）
├── .github/workflows/pages.yml      # push 到 main 自动发布到 GitHub Pages
├── extension/                       # 浏览器扩展（V3.0.0「F」）
│   ├── manifest.json                # MV3，仅匹配 chat.deepseek.com
│   ├── content/
│   │   ├── startpage-data.js        # 构建产物（勿手改）
│   │   └── shell.js                 # 注入外壳：鲸鱼 / F / 引擎 / 挖洞 / 代填
│   ├── assets/                      # 16/32/48/128 图标
│   └── README.md
├── archive/                         # 历史版本快照（只增不删，可随时回退）
├── tests/                           # Node 原生测试（vm 沙箱跑真实页面代码）
│   ├── harness.mjs                  # 极简 DOM 桩 + localStorage 桩
│   ├── extension.test.mjs           # 扩展资源与契约
│   └── mock/deepseek.html           # 端到端用的 DeepSeek 结构 mock 页
├── tools/
│   ├── verify.mjs                   # 结构自检：语法、键名收敛、CSS 括号、白名单对齐…
│   ├── check-all.mjs                # 一键跑全部检查
│   ├── build-extension.mjs          # 主文件 → 扩展资源包
│   ├── make-icons.mjs               # 渲染扩展图标 PNG
│   └── history/                     # 历次重构变换脚本（可复现审计）
├── CHANGELOG.md                     # 改动记录（按版本/阶段）
├── README.md
└── LICENSE
```

代码在单文件内按 5 层组织，依赖只允许由高到低：

```
§5 应用层  bootstrap + window.L
§4 视图层  PopupManager、data-action 委托、渲染
§2 领域层  Domain（农历 / 收藏槽位，纯函数）
§1 状态层  Store（唯一 localStorage 入口）
§0 配置层  CONFIG / KEYS / DEFAULTS / WALLPAPERS / SETTINGS
```

## 开发与自检

只依赖 Node.js（用于跑测试，页面本身零依赖）：

```bash
node tools/check-all.mjs      # 全部检查（结构自检 + 8 组测试）
node tools/verify.mjs         # 仅结构自检
node --test tests/p2.test.mjs tests/p3.test.mjs tests/p4.test.mjs   # 单跑某组测试
```

测试通过 `tests/harness.mjs` 把页面里的真实主脚本放进 `vm` 沙箱执行，配一套极简 DOM / localStorage 桩，
因此测的是**线上同一份代码**，不是复制出来的逻辑。

## 已知限制

- 收藏图标抓取依赖 `https://<host>/favicon.ico`，跨域站点可能取不到，会退化为首字母色块
- 自定义壁纸与图标都存 `localStorage`，配额约 5MB；已做压缩（壁纸 1920px / 图标 64px，超限会提示）
- 极简模式依赖鼠标移动唤醒，触屏体验一般

## 版本

当前 **V3.0.0「F」**（起始页本体仍是 V2.2.1 的 UI，本版新增扩展形态）。完整改动见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

[MIT](LICENSE) © 2026 JH

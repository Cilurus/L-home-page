# L 起始页 · DeepSeek 扩展（V3.0.0「F」）

把 [L 起始页](../README.md) **整屏覆盖到 DeepSeek 网页**上的浏览器扩展（Manifest V3）。
打开 `chat.deepseek.com` 先看到的是起始页；点右上角鲸鱼回到 DeepSeek 原页面，原页面右上角留一个「F」圆标可以再切回来。

---

## 安装（Chrome / Edge，免打包）

1. 打开 `chrome://extensions`（Edge 是 `edge://extensions`）
2. 右上角打开 **开发者模式**
3. 点 **加载已解压的扩展程序**，选择本目录 `extension/`
4. 打开或刷新 <https://chat.deepseek.com>，起始页会直接盖在上面

> 不需要任何权限：扩展没有 `permissions` 字段，不读 cookie、不写网络请求、不注入远程代码。
> 数据存在 `chat.deepseek.com` 这个源的 `localStorage` 里，键名统一加 `LSP:` 前缀，不与 DeepSeek 自己的存储混用。

## 三个交互

| 位置 | 控件 | 行为 |
|---|---|---|
| 起始页右上角（齿轮左边） | 鲸鱼圆钮，36px | 收起浮层，露出 DeepSeek 原页面 |
| DeepSeek 原页面右上角 | 「F」圆标，36px | 重新展开起始页 |
| 搜索引擎下拉 | `deepseek`（鲸鱼图标） | 搜索框下移到底部，上方开一个大对话框 |

选了 `deepseek` 之后：

- 中间那块是**真实的 DeepSeek 聊天区**（不是 iframe、不是仿制界面），可以在上面直接滚动、选中文字
- 底部输入框回车 → 内容代填进 DeepSeek 的输入框并点发送，回复照常出现在上面的对话框里
- 切回 Google / Bing / Yandex，输入框回到原位，恢复正常搜索

## 为什么不是 iframe

DeepSeek 返回了这条响应头：

```
content-security-policy: frame-ancestors 'none'
```

`'none'` 意味着任何 iframe 都无法加载它 —— 扩展页里嵌、同站自嵌、嵌套嵌全部被拦。
所以这里的做法是：**把起始页 UI 用 Shadow DOM 注入真页面**，再在浮层上「挖一个洞」，
洞里露出的就是 DeepSeek 自己的聊天区。

具体三层结构：

```
#lsp-root-host（宿主 div，fixed 铺满，pointer-events: none）
└─ shadowRoot
   ├─ <style> 起始页样式（html/body 已改写为 :host）+ 外壳样式
   ├─ .lsp-ui      起始页 UI，容器不吃事件，子元素恢复 auto
   ├─ .lsp-shield  点击屏蔽层，与 #bg 用同一份 mask 挖洞
   ├─ .lsp-frame   洞口的描边（看起来像一张卡片）
   └─ .lsp-fab     「F」角标
```

挖洞用的是两层 mask 相减：

```css
mask-image: linear-gradient(#000,#000), linear-gradient(#000,#000);
mask-composite: exclude;   /* 第二层从第一层里抠掉，于是中间透明 */
```

因为 `mask` 不影响命中测试，所以洞口另外靠 `pointer-events` 放行：屏蔽层和壁纸层都不吃事件，
点击自然落到下面的真页面上。

## 目录

```
extension/
├── manifest.json              # MV3，仅匹配 https://chat.deepseek.com/*
├── content/
│   ├── startpage-data.js      # 构建产物：起始页的 CSS / HTML / 三段脚本（勿手改）
│   └── shell.js               # 外壳：注入、鲸鱼/F、引擎项、挖洞测距、代填发送
├── assets/                    # 16/32/48/128 图标（由脚本渲染，与页面里同一个鲸鱼路径）
└── README.md
```

## 构建

`startpage-data.js` 是从根目录的 `index - new.html` 自动生成的 —— **改了主文件必须重新构建**：

```bash
node tools/build-extension.mjs    # 重新生成 content/startpage-data.js
node tools/make-icons.mjs         # 重新生成 assets/*.png（改了鲸鱼路径时才需要）
```

构建做了什么：

1. 抽出 `<style>`，把 `html.xxx` / `body` 改写成 `:host(...)` / `:host`（Shadow DOM 里没有 html/body）
2. 抽出 `<body>` 结构，剔除其中的内联 `<script>`（Shadow DOM 不执行内联脚本）
3. 把主脚本包成 `function (document, window, localStorage) {...}`，由外壳传入**假的 document**
   （`getElementById` 走 shadowRoot、`documentElement` 指宿主元素），于是主文件一行都不用改

## 测试

```bash
node tools/check-all.mjs                       # 含"扩展资源与契约"一项
node --test tests/extension.test.mjs           # 只跑扩展部分
```

端到端（真实浏览器渲染）用仓库里的 mock 页面，它复刻了「侧栏 + 可滚动消息区 + 底部输入框」的结构：

```bash
# 功能链路：注入 → 鲸鱼 → F → deepseek 模式 → 代填发送 → 切回搜索引擎
chrome --headless=new --virtual-time-budget=8000 --dump-dom \
  "file:///<仓库路径>/tests/mock/deepseek.html?auto=1"

# 三种状态的截图
... "?shot=start" / "?shot=page" / "?shot=ds"
```

控制台里还有调试入口：`__LSP__.show() / hide() / ds() / layout() / measure() / send('文本')`。

## 已知限制

- **只覆盖 `chat.deepseek.com`**，不上新标签页（`chrome://newtab` 需要另一套 override 机制）
- 「找输入框 / 找发送按钮」靠可见性与 `aria-label` 推断，DeepSeek 改版后可能失灵；
  找不到时会弹提示，不会静默失败。代填成功后输入框会清空
- 对话框位置由「页面里最大的可滚动容器」自动测出来，空会话时退化为居中 66vw × 约 6 成高度
- 极简模式依赖鼠标移动唤醒，触屏体验一般（继承自主页面）
- 未上架扩展商店，只能以「加载已解压」方式安装；换机器需要重新加载
- 起始页数据与网页版不互通：那边存 `mc_*`，这里存 `LSP:mc_*`，换地址等于换一份数据

## 许可

与主项目一致：[MIT](../LICENSE) © 2026 JH

鲸鱼图形取自 [simple-icons](https://github.com/simple-icons/simple-icons) 的 `deepseek` 图标（CC0-1.0），仅用于标识所服务的产品。

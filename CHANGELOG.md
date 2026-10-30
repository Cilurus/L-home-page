# L 起始页 · 改动记录（CHANGELOG）

单文件新标签页应用。**交付形态永远是单个 `index - new.html`：零依赖、零构建、双击即用。**

## 版本与快照策略

| 版本 | 日期 | 内容 | 快照 |
|---|---|---|---|
| V1.0.3 | 2026-06-08 | 重构前基线（UI 内标注 V1.0.3） | `archive/index-new-v1.0.3-2026-07-09.html` |
| V2.0.0-struct | 2026-10-01 | P0 基线固化 + P1 结构重排（行为等价） | `archive/index-new-v2.0.0-p1-2026-10-01.html` |
| V2.0.0-struct | 2026-10-01 | P2 §1 Store（唯一状态源）+ 缺陷修复 #1–#7 | `archive/index-new-v2.0.0-p2-2026-10-01.html` |
| V2.1.1 | 2026-10-01 | 模糊滑块改 1~10 档，与透明卡片一致 | `archive/index-new-v2.1.1-blur-scale-2026-10-01.html` |
| V2.2.0 | 2026-10-30 | 界面简化：移除 API / 个人资料 / 人设 / 收发信 | `archive/index-new-v2.2.0-simplify-2026-10-30.html` |
| **V2.2.1** | **2026-10-30** | **站点图标改为白色圆环（脱离 API）、深度清理聊天/AI 残留代码、补 README + MIT 协议** | `archive/index-new-v2.2.1-favicon-cleanup-2026-10-30.html` |

- `archive/` 保存全部历史版本（含重构前手工备份的 9 个 `index - new.*.html`），**只增不删**。
- 每个阶段结束先落快照，再进下一阶段；回退 = 换回对应文件。
- 基线哈希（V1.0.3）：`D8DD37EAB0522C2B8DBD88AB5CFC1B243083B0B78B79B871C34FC431B0672BC8`
- ⚠️ **P1 快照曾含一处回归**（`saveApiConfig` 引用 P1 已下线的 `AK`/`AU` 常量，保存 API 配置会抛错），已于 P2 修正快照文件本身；此处记录以免误解。

## 阶段计划

| 阶段 | 内容 | 状态 |
|---|---|---|
| P0 | 建 `archive/`、`tests/`、工具脚本，固化基线 | ✅ 2026-10-01 |
| P1 | 零行为变更的结构重排：§0 配置层、键名统一、去重复实现、分层注释 | ✅ 2026-10-01 |
| P2 | 引入 §1 Store（唯一状态源）+ 必修缺陷 #1–#7（#8 按用户要求暂缓） | ✅ 2026-10-01 |
| P3a | §4 浮层管理器 `PopupManager`（11 个浮层、8 条关闭路径 → 1 处） | ✅ 2026-10-01 |
| P3b | `data-action` 事件委托（83 个内联事件属性 → 0；`window.L` 61 → 34） | ✅ 2026-10-01 |
| P4 | §2 领域层 `Domain`（农历 / 文本 / 收藏槽位 / 会话组装）纯函数化 + 单测 | ✅ 2026-10-01 |
| P5 | §A CSS 令牌化、主题变量化、z-index 阶梯（届时接管 PopupManager 的 z） | ⏳ 待确认 |
| P6 | 收尾：删死代码、补全 JSDoc、版本号升 V2.0.0 | ⏳ |

---

## V2.2.1（2026-10-30）站点图标 + 深度清理

### 站点图标

- 原来是「细白环 + 内部状态点」，点的颜色跟着 API 探测结果变（绿=可用 / 红=不可用），因此标签栏上会挂一个红点。
- 现在改为**静态白色加粗圆环**（`r=12` / `stroke-width=5`，带一层柔和投影），与任何网络状态无关：
  - 深色标签栏：纯白粗环；
  - 浅色标签栏：靠投影勾出轮廓，不会「白环贴白底」消失。
- 顺带删掉 `updateFavicon()` / `testApi()` / `apiOk` 这套「探测 API 可用性」的启动逻辑（页面已无 API）。

### 深度清理（删除约 600 行）

| 类别 | 删除内容 |
|---|---|
| 配置 | `CONFIG.DEFAULT_API_URL` / `SAVE_DEBOUNCE_MS` / `MAX_CONTEXT_MSGS` / `AUTO_MSG_*` |
| 存储键 | `mc_final`（角色+会话+个人资料）、`mc_ak`、`mc_au`、`mc_autoMsg`、`mc_autoNext`、`mc_autoTopics`、`mc_autoLastIdx`、`mc_lastRead` |
| 状态层 | `Store.defaultData / loadData / saveData / flushData` 与 `saveTimer`（会话主数据专用） |
| 领域层 | `Domain.Text`（转义 / Markdown，仅聊天渲染使用）、`Domain.Chat`（上下文裁剪 / system 提示词 / messages 组装） |
| 视图层 | `data` / `save()` / `getChar()` / `esc()` / `md()` / `sanitizeHTML()` / `autoResize`、`beforeunload`+`pagehide` 落盘监听 |
| 设置 | `SETTINGS.autoMsg`、`TOGGLE_IDS.toggleAuto`，以及 `resetDefaults` 里遗留的 `autoMsg` 清理 |
| CSS | `.gender-row` / `.gender-btn` / `.sel1~3`（个人资料弹窗）、`.loading-bubble` 关键帧引用 |
| 对外接口 | `window.L.data` / `testApi` / `getApiKey` / `getApiUrl` |

- 主文件 178 KB / 3,554 行 → **149 KB / 3,236 行**。
- 扫描确认：JS 中 139 个具名函数全部有引用；CSS 中的类名除 SVG 命名空间片段外全部有对应元素。

### 工程化

- 新增 `README.md`（功能、用法、部署方式、结构说明、自检命令、限制）。
- 新增 `LICENSE`（MIT，© 2026 JH）。
- 新增 `.gitignore`，本地 Git 仓库初始化，准备开源。
- 测试与自检按新功能面同步：`p2` 去掉 API 导出断言、`p3b` 改用 `Domain`、`p4` 删除 Text/Chat 用例（改为「应已移除」断言）、`p8` 改为验证已移除动作无效；`tools/verify.mjs` 的 Store API / Domain 子层 / 上下文配置检查同步更新。

### 验证

- `node tools/check-all.mjs`：8 项全通过。
- 无头 Chrome：页面零 JS 报错；设置、壁纸、模糊/透明/文字色、极简、壁纸选择器、收藏弹窗、格言、农历、搜索、恢复默认全部冒烟通过。
- 图标按 96 / 32 / 16 px 在浅色与深色底上逐一渲染比对。

---

## V2.2.0（2026-10-30）界面简化

### 目标

用户要求"简化设计"：只保留 **切换壁纸 / UI 显示设置 / 底部收藏夹** 三类功能，其余全部下掉。

### 移除清单

| 位置 | 移除内容 |
|---|---|
| 左上角 | API 状态灯（红/绿双点，点击打开 API 配置） |
| 右上角 | 个人资料头像入口（称呼 / 性别 / 兴趣） |
| 设置菜单 | 「API 配置」「添加人设」两项；「其他设置」里的「自动消息」开关 |
| 搜索框下方 | 收件箱（邮件角标）、发信两个圆形按钮 |
| 随之下线 | Morph 玻璃面板（邮件 / 发信 / 会话三视图）、AI 会话与流式输出、自动消息定时推送、人设数据写入 |

### 保留清单

- 时钟与农历弹窗（点击时间）
- 搜索引擎切换 + 搜索框
- 设置菜单：修改格言、透明卡片、模糊程度、文字颜色、收藏偏好、更换壁纸、其他设置（显示格言 / 极简模式 / 恢复默认）、关于
- 壁纸：Orca / Sky / Deep Space / Grade Grey / Evening Sunshine / Moonlit Asteroid / 灵动 / 雨滴 / 萤火 / 自定义
- 底部书签 Dock（收藏增删改、拖动排序、图标抓取）

### 代码层改动

- HTML：删除 3 个弹窗（apiPopup / personaPopup / profilePopup）、action-bar、morph 面板、顶部状态盒与头像。
- JS：删除 `openApiConfig` / `saveApiConfig` / `openProfile` / `saveProfile` / `selectGender` / `addPersona` / `savePersona` / `openMorph` / `closeMorph` / `updateMailBadge` / `autoMessage` / `toggleAutoMsg` / morph 会话一族函数（约 490 行）；`testApi()` 收敛为离线占位。
- PopupManager 登记表 11 → 7 项；`ACTIONS` 白名单同步瘦身（页面用到的动作名与白名单仍一一对应）。
- CSS：删除状态灯、头像、动作栏、morph 面板 / 邮件 / 会话、`.morphing` 图标动画、`cardUp` / `mailIn*` 关键帧（约 250 行），主题与响应式里对已删元素的覆盖规则一并清理。
- `.top-bar` 由 `space-between` 改为 `flex-end`（左上元素移除后齿轮仍在右上）。

### 验证

- `node tools/verify.mjs`：结构自检 **全部通过**（浮层 7 项、ACTIONS 与 HTML 动作对齐、CSS 花括号平衡 375/375）。
- `node tools/check-all.mjs`：8 项全通过（结构 / 书签语义 / Store / 浮层 / 事件委托 / 领域层 / 性能 / 新功能）。
- 受影响的 4 个测试（p2 / p3 / p3b / p8）已按新功能面改写：API、人设、自动消息、morph 相关断言改为"已移除"断言，其余用格言弹窗与极简模式顶替。
- 无头浏览器实测：页面无 JS 报错；设置菜单 8 项、壁纸切换、模糊/透明/文字颜色、极简模式、壁纸选择器、收藏弹窗、格言编辑、农历、恢复默认、搜索跳转全部正常。

### 文件变化

- 主文件 223,735 → 约 177 KB，4,389 → 约 3,550 行。

---

## P0（2026-10-01）基线固化

- 新建 `archive/`：当前版本存档 + 9 个历史备份整体移入（未删除任何文件）。
- 新建 `tests/mc_verify.test.js`（由 `shawujie/mc_verify.js` 复制），基线 **21/21 通过**。
- 新建 `tools/verify.mjs` 结构自检器（语法解析、键名收敛、结构指标、分区注释存在性）。
- 新建 `tools/refactor-p1a.mjs` / `refactor-p1b.mjs`：带断言的变换脚本，**每一步都校验命中次数，任一不匹配即中止且不写盘**，可作为本次改动的可复现审计记录。

## P1（2026-10-01）结构重排

### 做了什么

1. **文件头维护说明**：版本、基线、六层结构、五条维护约定（依赖方向、领域层禁触 DOM、新增键/壁纸先登记注册表、视觉改变量、JSDoc 标注副作用）。
2. **CSS 层目录**：在 `<style>` 顶部标注 §A 令牌 → §B 布局 → §C 组件 → §D 主题/响应式的分区地图。
3. **§0 配置层**（新增，约 70 行）：`CONFIG` / `KEYS` / `DEFAULTS` / `WALLPAPERS` / `BG_CLASSES`。
   - **21 个存储键收敛到唯一来源**：原先 `mc_*` 字面量散落 70 处；现在 §0 之外**零字面量键**（`'mc_' + id` 这类动态键除外，属设置开关 DOM id 派生）。
   - 下线的旧常量：`SK`、`AK`/`AU`、`PREF_KEY`、`BM_KEY`；`BM_TOTAL`/`BM_VISIBLE` 改为引用 `CONFIG`。
4. **§1–§5 分层 banner**：在主脚本的 morph 面板、对话、农历、收藏、启动序列、对外接口处标注所属层（先建立地图，物理归位在 P2/P3）。
5. **消除重复实现（原结构问题 S8）**：
   - 壁纸逻辑 5 份 → `currentBgType()` / `bgClear()` / `bgApplyType()` / `bgApplyImage()` / `bgRunEffect()` 5 个统一入口；
   - 书签删除 2 份 → `removeBookmarkAt(idx)`；
   - 选中态反查 7 处 `getAttribute('onclick')` 字符串匹配 → HTML `data-wp` / `data-color` 属性 + `markActiveColor()`。**这类反查此前"改一次按钮文案就静默失效"**。
6. **JSDoc**：新增/重写的 9 个函数补齐 `@param` / `@returns` / `@sideEffect`（其余函数在 P2–P4 逐步补）。

### 结构指标变化（`node tools/verify.mjs`）

| 指标 | P1 前 | P1 后 |
|---|---|---|
| 内联 onclick 字符串反查 | 7 | **0** |
| 字面量存储键（§0 之外） | 约 70 处 | **0** |
| localStorage 调用点 | 70 | 66 |
| 直接写 `.style` | 100 | 95 |
| `classList` 操作 | 166 | 154 |
| `getElementById` | 193 | 190 |
| `querySelector*` | 39 | 36 |
| `window.L` 导出 | 61 | 61（未变，P3 收敛） |

### 行为等价性说明

唯一有意的行为差异（视觉等价，已确认）：

- 启动恢复壁纸时由"直接叠加类"改为"先清后加"。旧写法会保留 `#bg` 的初始类 `bg-orca`，与 `bg-vivid` 等叠加；由于新类用 `background` 简写覆盖，**渲染结果一致**，但类列表不再脏。

其余全部为字符串搬家与函数抽取，未改动任何判断分支。

### 验证方式

- `node tools/verify.mjs`：主脚本 vm 语法解析通过；§0 外无字面量键；分区注释齐全；head 内 anti-FOUC 脚本仍自包含（不依赖 §0）。
- `node tests/mc_verify.test.js`：21/21 通过（书签数据容错、下标校验、配额保护、自动消息默认值语义、数组 `-1` 键副作用）。
- 结构核对：`data-wp` 20 处、`data-color` 4 处、残留 onclick 反查 0、重复 bg 类清单 0、局部 `EFFECTS` 表 0。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p1-2026-10-01.html" "index - new.html" -Force
```

---

## P2（2026-10-01）§1 状态层 Store + 必修缺陷 #1–#7

### 做了什么

1. **§0 新增 `SETTINGS` 注册表**：11 个设置项集中声明（类型 + 默认值 + 显示名），并派生 `SETTING_BY_KEY`（键名→设置项）与 `TOGGLE_IDS`（开关 DOM id→设置项）。**新增一个开关从"改 6 处"变成"注册表加一行"**。
2. **§1 新增 `Store`（唯一状态源）**
   - `raw / write / remove / json`：全文件唯一直接接触 localStorage 的地方；写入一律 try/catch，配额超限返回 `false` 并回调报错，不再静默抛错/静默失败；
   - `setting / setSetting`：按注册表的类型与默认值读写，写入后 `emit()` 广播；
   - `subscribe / onStorageError`：变更订阅与错误回调（回调由 §5 装配 toast，状态层不反向依赖 UI）；
   - `loadData / saveData / flushData`：会话主数据加载（含结构容错）与防抖落盘；
   - 后端 `data` / `save()` 保留原变量名与签名，因此 30+ 处调用点无需改动。
3. **全部存储读写迁移到 Store**：`localStorage` 直连从 **66 处 → 3 处**（且全部在 Store 内部）；§0 之外零字面量键、零拼接键。
4. **新增自动化测试 `tests/harness.mjs` + `tests/p2.test.mjs`**：用 vm 沙箱 + 极简 DOM 桩**直接执行页面主脚本**（不再测复制件），12 项用例覆盖开关默认值、收藏容错、越界拒绝、配额失败、事件拦截、农历弹窗。
5. **修复 7 类缺陷**（详见下表）。

### 缺陷修复明细

| # | 缺陷 | 修复方式 |
|---|---|---|
| 1 | 自动消息"视觉为开、逻辑为关" | 初始化与发送逻辑统一读 `Store.setting('autoMsg')`，默认关；测试保证两边一致 |
| 2 | `getBookmarks` 数据被改坏即静默丢空 20 槽 | 数组长度不符 → 截断/补齐后回写；非数组 → 按空槽位处理并提示一次，**不删除原始数据** |
| 3 | `saveBookmark` 无下标校验 | `Number.isInteger` + 范围校验；越界提示并放弃，不再出现"越界写 −1 键却提示已保存" |
| 4 | 配额超限静默失败 | 全部写入经 `Store.write`，失败返回 false；保存收藏/壁纸失败时明确 toast |
| 5 | 壁纸与图标存原始 dataURL | `compressImage()` 等比压缩（壁纸 ≤1920px JPEG q0.82 / 图标 64px PNG）+ 体积上限 2MB / 64KB + 失败提示 |
| 6 | 全局 `selectstart` / `contextmenu` / `dblclick` 拦截过宽 | 输入框、textarea、contenteditable、聊天正文（含 `pre/code`）放行；非输入区保留原有"不可选中、右键唤出书签栏"手感 |
| 7 | 农历弹窗 | 删除日期串里的下划线占位符；删除算了不用的 `lu` / `gzDay`；定时器与外部点击监听改为单例，再次点时钟即关闭（消除泄漏） |

> 缺陷 #8（未读角标把自己发送的消息计为未读、邮件时间恒为"刚刚"）**按用户要求暂缓**，留待后续确认。

### 结构指标变化

| 指标 | P1 后 | P2 后 |
|---|---|---|
| localStorage 直连（Store 之外） | 66 | **0** |
| 字面量/拼接存储键（§0 之外） | 0 / 有 | **0 / 0** |
| `document.addEventListener` | 13 | 13 |
| 直接写 `.style` | 95 | 95 |
| 主脚本行数 | 1953 | 2300 |
| 自动化测试用例 | 21（逻辑副本） | 21 + **12（真实代码）** |

### 验证方式

```powershell
node tools\verify.mjs          # 结构自检：语法、Store 唯一性、注册表、缺陷落位、指标
node tests\mc_verify.test.js   # 书签/存储语义基线 21 项
node --test tests/p2.test.mjs  # 真实页面代码回归 12 项
```

三套全绿：`verify 全部通过` / `21 通过 0 失败` / `12 pass 0 fail`。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p2-2026-10-01.html" "index - new.html" -Force   # 退回 P2
Copy-Item "archive\index-new-v2.0.0-p1-2026-10-01.html" "index - new.html" -Force   # 退回 P1（已修正回归）
```

---

## 附：Markdown 列表/代码块修复（P4 后，随 P5a 一起快照）

用户确认后修的，`Domain.Text.markdown` 重写了行级处理：

| 现象（修复前） | 修复后 |
|---|---|
| `- 甲\n- 乙` → `<ul><li>甲</li><br><li>乙</li></ul>`，项间多空行 | `<ul><li>甲</li><li>乙</li></ul>` |
| `1. 第一步\n2. 第二步` → `<p><li>…</li><br><li>…</li></p>`，**编号丢失**且 `<li>` 套在 `<p>` 里 | `<ol><li>第一步</li><li>第二步</li></ol>`（编号交给浏览器） |
| 列表接段落 → 列表尾部与后文之间空两层 | `<ul>…</ul><p>下面是一段普通文字</p>` |
| 代码块内容被**二次转义**：`<b>` → `&amp;lt;b&amp;gt;` | `&lt;b&gt;` |
| 多行代码块内换行被转成 `<br>`（`<pre>` 里双倍行距） | 原样保留 `\n` |
| `> 引用` 永远不生效（先转义后匹配 `>`，条件永远不成立） | 匹配转义后的 `&gt;`，`<blockquote>` 正常工作 |

根因是三步顺序问题：`\n → <br>` 排在列表包裹之后、有序列表的 `<li>` 生成在容器包裹之后、容器正则把 `</li>` 后的换行吃进了 `<ul>`。改法是把代码块先抽成占位符 → 行级语法（标题/引用/列表整块包裹）→ 行内强调 → 段落与换行 → 还原代码块，并在段落与块级元素交界处做一次清理。

新增/更新断言：`tests/p4.test.mjs` 现共 **15 项**，覆盖无序/有序/混合列表、列表接段落、列表项内强调、代码块单次转义与换行保留、引用。

---

## P5a（2026-10-01）CSS 令牌层 + 层级阶梯 + 玻璃配方 + 焦点可见性

### 做了什么

1. **新增 `:root` 设计令牌层**（此前全站**没有任何 `:root`**）：
   - 过渡时长 `--dur-fast/med/slow`；`--tr-fast` 从 `*` 通配选择器上迁走（原先给每个元素都生成一条自定义属性）
   - 玻璃拟态 `--glass-bg / --glass-blur-1..5 / --glass-sat / --glass-sat-strong`
   - **层级阶梯 `--z-menu`(10) / `--z-menu-2`(20) / `--z-dimmer`(40) / `--z-panel`(41) / `--z-overlay`(100) / `--z-popup`(200) / `--z-list`(250) / `--z-popup-strong`(300) / `--z-dock`(999) / `--z-toast`(9999)**
2. **11 处 z-index 改为取 token**，数值与重构前**逐一对应**（零视觉变化），层级从此只有一处可改。组件内部用于微叠放的 `z-index: 1/2` 保持原样。
3. **玻璃模糊半径全部改 token**：`calc(Npx * var(--card-blur-mul,1))` → `calc(var(--glass-blur-N) * var(--card-blur-mul,1))`，共 27 处（含 2 处无 calc 的写法）。
4. **补齐 3 处缺失的 `-webkit-backdrop-filter`**（含单行压缩规则里的写法），Safari ≤17 的毛玻璃不再失效；现 15 处普通声明与 15 处前缀声明一一对应。
5. **焦点可见性**：新增全局 `:focus-visible` 焦点环（含 gray/black 主题变体），并修掉"搜索框聚焦时边框反而从 0.2 变暗到 0.12"的反向反馈。

### 校验

- CSS 花括号平衡：568 / 568
- `:root` 块存在；`z-index: var(--z-*)` 11 处；无遗漏的全局层级硬编码
- 七套检查全绿（`verify` + 21 + 12 + 11 + 10 + 15）

### 尚未做（P5b）

主题合并（gray/black 各 76 条规则、逐条同构 → 1 份变量规则）、移动端 `100dvh` 与安全区、`!important` 清理、`box-shadow: inset 0 0 0 999px` 悬停底色的改法、常驻无限动画的 `prefers-reduced-motion` 兜底。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p5a-2026-10-01.html" "index - new.html" -Force
```

---

## P5b（2026-10-01）主题合并 + 移动端 + 动效偏好

### 做了什么

1. **gray/black 两套主题合并**（原 83 + 83 条手抄规则，逐条同构、只差颜色）：
   - 按「选择器 + 属性」对齐两套规则，两主题取值不同的生成 `--fg-1 … --fg-23` 令牌，取值相同的直接写字面量
   - 产物：`html.gray-text { 23 个令牌 }` + `html.black-text { 23 个令牌 }` + **83 条合并规则**（`html.gray-text X, html.black-text X { color: var(--fg-N) }`）
   - **脚本内置等价性校验**：把生成结果按主题分别代入令牌反解成具体值，与合并前的每条规则逐属性比对 —— **0 处差异**才允许写盘（`tools/refactor-p5b-theme.mjs` 可重复运行复核）
   - 主题专属规则 0 条（说明两套确实完全同构）
2. **custom-text 主题补缺**：补上此前 gray/black 有、自定义颜色主题漏掉的 4 个选择器（搜索框 placeholder、tooltip、书签标签、邮件预览）。
3. **移动端**：`body` 增加 `height: 100dvh`（保留 `100vh` 兜底，iOS 地址栏不再裁切）；书签 Dock 底部改为 `calc(12px + env(safe-area-inset-bottom, 0px))`。
4. **弹窗最小宽度**：三个弹窗的内联 `min-width: 320/360/380px` 改为 `min(原值, 88vw)` —— 桌面像素级不变，窄屏不再溢出（原来手机上的 `max-width: 90vw` 被内联 `min-width` 压过）。
5. **`prefers-reduced-motion` 兜底**：关掉常驻无限动画（背景渐变、呼吸图形、打字点）与"从透明淡入"的入场动画（邮件卡、壁纸选项），避免动效被禁用时内容永久不可见。
6. **`!important` 的处理结论**：@media 里的 5 处 `!important`（morph 面板尺寸、`#mottoPopup` 宽度）**故意保留** —— 它们是为了压过 JS 在运行时写入的内联样式，属结构性需要；已在代码里注明，避免后人误删。

### 校验

- 主题合并等价性：**0 处差异**（166 条规则逐属性反解比对）
- CSS 花括号平衡 505/505；毛玻璃前缀 15/15 一一对应
- `verify.mjs` 新增第 11 节（15 项 CSS 断言），七套检查全绿

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p5b-2026-10-01.html" "index - new.html" -Force
```

---

## P6（2026-10-01）收尾

### 做了什么

1. **版本号升 V2.0.0**：文件头与「关于」面板同步（`V1.0.3 / 2026.06.08` → `V2.0.0 / 2026.10.01`），文件头的分层说明改为最终形态（§1 Store、§2 Domain、§4 PopupManager + 事件委托）。
2. **删除已无调用方的兼容别名**：`C()`、`getLunar()`、`getSolarTerm()`、`ganzhiDay()`（实现都在 `Domain.Lunar` / `Domain.Text` 里，保留会形成两套入口）。
3. **内联样式 33 → 27 处**，清掉的都是可安全移除的：
   - `#toast` 的 `display:none`（CSS 里本来就有）
   - `#rainCanvas` 的定位/隐藏、`.search-wrap` 的初始 `--search-shadow`、`#lunarPopup` 的定位与尺寸 → 移入 CSS
   - `apiPopup` / `profilePopup` 的初始 `top/left`（含 `left: 1162px` 这种魔法值）→ 删除，JS 打开前会定位
   - 保留的 27 处里，`--ec` 是供引擎切换读取的数据、`display:none` 用于避免首屏闪烁、其余在 JS 生成的内容里
4. **补 15 个函数的 JSDoc**（API 配置、资料、格言、设置菜单、透明度、开关、自动消息、toast、时钟、书签栏渲染与保存等对外/主流程函数），每个都标注 `@sideEffect`。
5. **工程化整理**：
   - 12 个阶段变换脚本移入 `tools/history/`（保留可复现记录），日常入口只留 `tools/verify.mjs`
   - 新增 `tools/check-all.mjs`：一条命令跑结构自检 + 5 组测试
   - 新增 `tools/README.md`：目录速查、分层与依赖规矩、**四类常见改动的落点**（加设置项/壁纸/浮层/可点击元素）、回退方式、已知取舍清单
   - 死文件 `assets/lunar-constants.js` 移入 `archive/`（仅重构前的备份引用它），空的 `assets/` 目录移除

### 校验

```powershell
node tools/check-all.mjs
# ✔ 结构自检 / ✔ 基线 21 项 / ✔ Store 12 项 / ✔ 浮层 11 项 / ✔ 委托 10 项 / ✔ 领域 15 项 → 全部通过（6 项）
```

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p6-2026-10-01.html" "index - new.html" -Force
```

---

## P7（2026-10-01）性能收尾（行为不变）

审计里列过、但前几阶段没落地的性能项，本轮挑了三处低风险、不改行为的做掉：

1. **浮层状态刷新合并到 rAF**（原问题 F1）
   重构前 `markPopupChange()` 在一次点击链里会被调用 4~40 次，每次都做一次整文档 `querySelector`。现在同一帧内只真正刷新一次（`_popupStateQueued` 去重 + `requestAnimationFrame`）。
2. **"显示图形"的形变定时器改为随开关启停**（原问题 F6）
   Reuleaux ↔ 圆的 2 秒 `setInterval` 原本常驻运行——即使"显示图形"关着（默认关）也一直空转。现在抽成 `setShapeAnimation(on)`：启动时按 `Store.setting('shape')` 决定是否创建，开关切换与"恢复默认"都会正确清理；定时器同时保证只有一个。
3. **粒子系统去掉每帧的临时分配**（原问题 F7）
   - 雨滴的 `drawBatch` 原本定义在每帧执行的 `draw()` 内部 → 每帧新建一个闭包；现已外提
   - 萤火原本每帧建 3 个数组并 push 上百个 `{x,y,s,a}` 对象字面量 → 改为复用数值缓冲（每 4 个数一簇），消除绝大部分每帧 GC

### 顺带

- 测试沙箱（`tests/harness.mjs`）现在**区分"仍存活"与"已被清理"的定时器**（`clearTimeout/clearInterval/cancelAnimationFrame` 真正生效），因此"不叠加循环""切换后清理"这类回归可以被断言。
- 新增 `tests/p7.test.mjs`（6 项），并纳入 `check-all`：图形关闭不建定时器、开启建一个/关闭清理、浮层状态合并到下一帧、雨滴/萤火不叠加且切走后清理、复帧渲染不抛错。

### 校验

```powershell
node tools/check-all.mjs   # ✔ 全部通过（7 项）
```

### 未做（有意跳过，附原因）

| 项 | 原因 |
|---|---|
| 流式渲染增量更新（原 F2） | Markdown 结构随文本增长会变化（如围栏闭合），要做得对需要重写渲染管线；没有实测数据前不动 |
| 书签栏 DOM 复用（原 F4） | 重建成本可接受，而重写会牵动 Dock 测量与点击闭包 |
| Dock 放大中心的漂移（原 F5） | 缓存中心点在缩放后略有滞后，但修正它需要改放大算法，会改变手感 |
| 悬停 `box-shadow: inset 0 0 0 999px` 换实现 | 这些值已经并入主题令牌（`--fg-11/12`），换写法要同时改令牌与属性，收益不抵风险 |

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p7-2026-10-01.html" "index - new.html" -Force
```

---

## V2.0.1（2026-10-01）修复：壁纸选择器点遮罩无法关闭

### 现象

双击空白唤出壁纸选择器后，**点窗口外的遮罩区域关不掉**（只能按 Esc 或再双击）。

### 根因（P3b 引入的回归）

- 重构前遮罩元素上挂着内联 `onclick="L.hideWpPicker()"`，点遮罩即关；
- P3b 把内联事件迁到 `data-action` 时删掉了它，改为用登记项 `triggers: ['.wp-picker']` 表达"点卡片内部不关"；
- 但管理器外部点击判断里有一句 `if (t.closest('#' + id)) return;` —— **登记元素本身就是那个全屏遮罩**，于是"点遮罩"被当成"点在浮层内部"，永远不会关闭。

### 修法

给登记项增加通用语义 `backdrop: true`（登记元素是遮罩，**只有 `triggers` 区域算内部**），壁纸选择器改用它。这样"点遮罩关闭、点卡片内部不关"仍由同一处逻辑表达，不再依赖元素上的内联事件。

### 为什么之前的测试没抓住

原来的 `p3.test.mjs` 只调 `L.showWpPicker()` / `L.hideWpPicker()` 两个 API，**没有模拟"点击遮罩背景"这个用户动作**，逻辑回归了测试仍然是绿的。

本次补 2 条用例，并**实测它们确实能抓住这个 bug**：

```
摘掉 backdrop: true → 跑 p3 测试 → 退出码 1（失败）
还原               → 再跑        → 退出码 0（通过）
文件哈希未变（1de9a6a56f4e3536 → 1de9a6a56f4e3536）
```

### 校验

`node tools/check-all.mjs` → ✔ 全部通过（7 项，其中浮层管理器 13 项）。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.1-wppicker-2026-10-01.html" "index - new.html" -Force
```

---

## V2.0.2（2026-10-01）移除搜索框下方的动态图形

### 定位

按"搜索框下的动态图形"确认目标为 **Reuleaux 三角 ↔ 圆的"呼吸"图形**：首页 CSS 里时钟在 `top: 24%`、搜索框在 `top: 33%`、该图形在 `top: 42%`，正是搜索框下方那一个；由设置里的「显示图形」开关控制（默认关）。

### 删除清单（一个不留）

| 位置 | 删除内容 |
|---|---|
| HTML | `#breathSvg` / `#breathPath` / `.circle-balls-wrap` 整个元素；设置面板"其他设置"里的「显示图形」整行 |
| CSS | `.circle-balls-wrap` 定位、`.circle-balls`（两条）、`#breathSvg` 动画、`@keyframes rtSpin`、`#breathPath` 的 `d` 过渡、窄屏媒体查询里的定位覆盖、`prefers-reduced-motion` 里对 `#breathSvg` 的引用 |
| JS | `SHAPE_REULEAUX` / `SHAPE_CIRCLE` / `_shapeTimer` / `_shapeIsCircle`、`setShapeAnimation()` 整个函数、启动序列里的初始化调用、`toggleSwitch` 的图形分支、`initToggles` 与 `resetDefaults` 里的图形处理 |
| 注册表 | `KEYS.TOGGLE_SHAPE`、`SETTINGS.shape`、`TOGGLE_IDS.toggleShape` |
| 测试/自检 | `p7.test.mjs` 里两条形变定时器用例（并为"不再有任何 2 秒常驻定时器"保留一条守门用例）、`p2.test.mjs` 的图形默认值断言、`verify.mjs` 的旧断言改为"已删除"断言 + 新增第 14 节残留扫描 |

`tools/history/refactor-rm-shape.mjs` 是本次删除脚本，末尾带**残留断言**：`显示图形 / toggleShape / circle-balls / breathSvg / breathPath / rtSpin / morphGrad / SHAPE_* / setShapeAnimation / _shapeTimer / TOGGLE_SHAPE / setting('shape')` 在全文件中命中数必须为 0，否则不写盘。

### 影响与说明

- 页面上不再有该图形；设置面板"其他设置"里剩下 **显示格言 / 极简模式 / 自动消息** 三项。
- 已开启过该图形的用户，本地会留下一个孤儿键 `mc_toggleShape`（不再被任何代码读取，无副作用）。如需清理，控制台执行 `localStorage.removeItem('mc_toggleShape')` 即可。
- 时钟、搜索框、动作栏、格言的位置与交互未受影响（标签平衡复核：div 172/172、svg 14/14）。

### 校验

`node tools/check-all.mjs` → ✔ 全部通过（7 项）。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.2-no-shape-2026-10-01.html" "index - new.html" -Force
```

---

## V2.1.0（2026-10-01）新增：模糊程度独立可调 + 收藏管理拖动排序

### ① 模糊程度：从"隐藏耦合"变成独立滑块

改造前，玻璃模糊是**跟透明度绑死**的：`setCardOpacity()` 顺手把 `--card-blur-mul` 设为 `1 - 透明度档位`，所以把"透明卡片"调高会连模糊一起压掉，用户既看不到这个规则、也没法单独调模糊。

现在拆成两个独立控件：

| 控件 | 作用 | 取值范围 | 默认 |
|---|---|---|---|
| 透明卡片 | 只改 `--card-alpha`（卡片底色透明度） | 1~10 | 2 |
| **模糊程度**（新增） | 只改 `--card-blur-mul`，**统一作用于全部 27 处玻璃表面** | 0~100% | **90%** |

- 默认 90% ≈ 改造前的实际效果（原值 0.889），**默认观感不变**；
- 0% = 完全清晰，100% = 设计满值；
- 新增设置项走注册表：`KEYS.BLUR = 'mc_blur'`、`SETTINGS.blur = { type:'int', def:90 }`、`DEFAULTS.blur = 90`，「恢复默认设置」会一并重置；
- `:root` 里给了 `--card-blur-mul: 0.9` 初值，避免首帧满模糊；
- 两个滑块共用样式（`.slider-item` / `.slider-val`，原 `.opacity-item` / `#sliderVal` 已中性化重命名）；顺带修掉数值标签在深色卡片上是黑字（改为白字 + 投影）。

**行为差异**：以前"透明度拉高 → 模糊自动变小"，现在两者互不影响。想要"越透明越清晰"的老手感，把模糊滑块往下拉即可。

### ② 收藏管理：拖动排序

- 新增纯函数 `Domain.Bookmarks.move(slots, from, to)`：只在**已占用槽位**之间移动内容，物理槽位不动 —— 因此"自动补位"与"维持原状"两种偏好下都成立，并有单测覆盖（前移/后移/同位置/无效下标/稀疏槽位）。
- 列表项 `draggable`，拖到哪一项就插到那一项的位置；拖动中有 `dragging`（半透明）与 `drag-target`（高亮）反馈，标题右侧加了"拖动可排序"提示；删除按钮设了 `draggable=false` 且 `mousedown` 阻止冒泡，不会误触发拖动。
- 落盘后立即重渲染并提示"✓ 已调整顺序"。

### ③ 附带修掉两个"白名单漏登记"回归

新增的系统性检查「HTML 里用到的每个 `data-action`/`data-input`… 动作名都必须在 `ACTIONS` 白名单里」当场抓出两个**已存在的静默故障**：

| 动作 | 症状 | 起始版本 |
|---|---|---|
| `savePersona` | 「添加人设」的 ✔ 按钮点了没反应（白名单外被静默忽略） | P3b 起 |
| `setCardBlur` | 本次新增的模糊滑块完全不生效 | 本轮开发中 |

两条都已修复，并各自补了回归用例。这也说明 P3b 的白名单机制本身是对的（未登记就不执行），但当时缺一条"白名单是否覆盖全部 HTML 动作名"的交叉校验 —— 现在补上了。

### 校验

```
node tools/check-all.mjs → ✔ 全部通过（8 项）
结构自检 / 基线 21 / Store 12 / 浮层 13 / 委托 10 / 领域 15 / 性能 5 / 新功能 14
```

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.1.0-blur-drag-2026-10-01.html" "index - new.html" -Force
```

---

## V2.1.1（2026-10-01）模糊滑块改为 1~10 档，与「透明卡片」一致

按使用反馈调整：

| 项 | 调整前 | 调整后 |
|---|---|---|
| 档位显示 | 0~100% | **1~10 档**（与"透明卡片"同一套观感） |
| 滑块量程 | `min=0 max=100 step=5` | `min=1 max=10 step=1`，默认 **9** |
| 数值标签 | 白字 + 投影（可读性补丁） | **黑色** `rgba(0,0,0,0.55)` |
| 数值标签宽度 | 30px（显示 "90%" 用） | **20px** —— 与滑块圆点等宽，数字正好居中在圆点上 |

**档位映射** `(v-1)/9`：第 1 档 = 完全清晰（0），第 10 档 = 设计满值（1.0），**第 9 档 = 0.889**，正好等于重构前"透明度=2"时的实际模糊倍率 —— 所以默认观感与之前完全一致。

另加**旧值兼容迁移**：V2.1.0 里短暂存过的 0~100 值（如 `mc_blur=90`）在启动时自动折算成对应档位（90 → 9，40 → 4），不会出现"存着 90 而滑块只有 1~10"的错位。

顺带把测试沙箱的 `textContent / innerHTML / value` 改成**字符串化访问器**（与真实 DOM 语义一致），避免 `el.textContent = 3` 之后断言拿到数字 3 而不是 `'3'`。

### 校验

```
node tools/check-all.mjs → ✔ 全部通过（8 项）
新功能回归 16 项（新增：档位越界夹取、旧百分比值迁移）
```

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.1.1-blur-scale-2026-10-01.html" "index - new.html" -Force
```

---

## 重构总览（V1.0.3 → V2.0.0）

| 指标 | V1.0.3（重构前） | V2.0.0 |
|---|---|---|
| 单文件交付 / 零依赖 / 零构建 | ✅ | ✅（保持不变） |
| 结构分层 | 无（单 IIFE 平铺） | §0 配置 / §1 状态 / §2 领域 / §3 服务 / §4 视图 / §5 应用 |
| localStorage 直连 | 66 处散落全文 | **3 处，全在 §1 Store 内** |
| 字面量存储键 | 21 个键在 3~5 处各写一遍 | §0 `KEYS` 一处 |
| 设置项 | 读写/默认值分散且互相矛盾 | §0 `SETTINGS` 注册表驱动 |
| 浮层关闭逻辑 | 8 条各自为政（Esc 只能关书签栏） | 1 个 `PopupManager`（Esc 关最上层） |
| 内联事件属性 | 83 个 | **0 个**（`data-action` 委托） |
| `window.L` 导出 | 61 个 | 34 个（仅调试入口，页面零依赖） |
| CSS 主题 | gray/black 各 83 条手抄规则 | 23 个 `--fg-*` 令牌 + 83 条合并规则（脚本校验 0 差异） |
| CSS 令牌 | 无 `:root` | `:root`：时长 / 玻璃 / 层级阶梯 |
| z-index | 手填 10~9999 | `--z-*` 阶梯（11 处引用） |
| 毛玻璃前缀 | 3 处缺失 | 15/15 一一对应 |
| 可测性 | 无（逻辑长在视图里） | 领域层纯函数 + vm 沙箱跑真实代码，**75 项断言** |
| 常驻定时器 / 每帧分配 | 图形关着也跑 2s 定时器；粒子每帧建闭包与上百对象 | 随开关启停；复用缓冲 |
| 已知缺陷 | 8 类（数据丢失/静默失败/交互拦截…） | 7 类已修（#8 按用户要求暂缓） |

**验证**：`node tools/check-all.mjs` 一条命令覆盖结构自检 + 6 组测试（21+12+11+10+15+6 项）。

## 待办（用户后续可选）

1. **暂缓项 #8**：未读角标统计口径（把自发消息算作未读）、邮件时间恒显示"刚刚"。
2. 自动消息与主动对话的 system 提示词格式统一（P4 为保持行为未合并）。
3. 聊天"停止生成"按钮（`AbortController` 已就位但无 UI）、消息重新生成/删除。
4. 角色编辑/删除、模型与采样参数在 UI 可调。
5. 收藏分组或分页（当前上限 20 槽、每行可见 10）。
6. 大数据量下的存储方案（IndexedDB + 历史裁剪）——目前仍是 localStorage，但已加配额保护与失败提示。

1. **P5**：CSS 令牌化与主题变量化（3 份手抄主题 → 1 份变量；z-index 阶梯统一，届时由 PopupManager 接管层级）。
2. **P6**：补全 JSDoc、清理死代码（`assets/lunar-constants.js`、`C()` 兼容别名、`getLunar/getSolarTerm` 别名）、版本号升 V2.0.0。
3. **暂缓项 #8**：未读角标统计口径、邮件时间显示。
4. **待定的既有小瑕疵**：Markdown 列表项之间会多一个 `<br>`（`Domain.Text.markdown` 里"先包列表、后统一把换行变 `<br>`"的顺序导致），P4 按原样保留，测试已显式锁住现状。

---

## P4（2026-10-01）§2 领域层 Domain

### 做了什么

1. **新增 §2 `Domain`（纯逻辑：不碰 DOM、不碰存储、不改全局状态）**，四个子层：
   - `Domain.Lunar`：`shichenIndex` / `zodiacOf` / `ganzhiDay` / `solarTerm` / **`snapshot(date)`**（一次取齐年月日、生肖、节气、时辰）
   - `Domain.Text`：`escape`（纯字符串转义，**不再 `createElement` 建节点**）、`markdown`
   - `Domain.Bookmarks`：`normalizeSlots`（返回 `{slots, repaired, corrupt}`，把"读数据 + 判损坏 + 修复"的规则与提示解耦）、`isValidIndex`、`removeAt`、`compact`、`nextFree`
   - `Domain.Chat`：`recent`（上下文裁剪）、`systemPrompt(char, profile, mode)`、`toApiMessages`
2. **视图函数降为薄封装**：`getBookmarks`、`removeBookmarkAt`、`compactAllBookmarks`、`bmListAdd`、`saveBookmark` 的下标校验、`renderLunar`、`esc`/`md`、`sendMorphMsg`、`autoMessage` 全部改为调用 §2，行为逐条对齐。
3. **时区稳健性修复**：`ganzhiDay` 的天数差由 `Math.floor` 改为 `Math.round`（本地时区在夏令时/历史时区下两日之差可能不是整数天，`floor` 会整体差一天；南半球时区尤其明显）。锚点仍是 1900-01-01 = 甲戌，已用 3 个已知日期核对。
4. **新增 §0 `CONFIG.MAX_CONTEXT_MSGS: 30`**，替换 `slice(-30)` 魔数。
5. **`window.L` 增加 `Domain` 入口**，调试与自动化测试可直接调用领域函数。
6. **harness 升级**：现在会按页面顺序先执行 `<head>` 里的前置脚本（anti-FOUC、`LUNAR_CONSTANTS`），再执行主脚本 —— 领域测试因此跑在**真实常量**上。
7. **新增 `tests/p4.test.mjs`（13 项）**：日柱干支对照已知日期、农历快照、时辰边界、节气抽样、转义等价性、Markdown 语法与转义安全性、槽位规整/校验/删除/压缩、会话裁剪与两种 system 提示词、API 消息组装（并验证 `timestamp` 等内部字段不会外发）。

### 结构指标变化

| 指标 | P3b 后 | P4 后 |
|---|---|---|
| §2 领域层 | 无 | **4 个子层 / 15 个纯函数** |
| 主脚本行数 | 2632 | 2829 |
| 可直接单测的逻辑 | 基本没有 | 农历、文本、槽位、会话组装 |
| 自动化用例 | 21+12+11+10 | 21+12+11+10+**13** |

### 行为说明

除 `ganzhiDay` 的取整方式（当前 UI 未展示日柱，无可见影响）外，**所有逻辑与渲染结果保持原样**。Markdown 列表的 `<br>` 小瑕疵按原样保留并用测试锁住（见待办 4）。

### 验证方式

```powershell
node tools\verify.mjs            # 结构自检（第 10 节为 P4 断言）
node tests\mc_verify.test.js     # 21 项基线
node --test tests/p2.test.mjs    # 12 项 Store / 缺陷回归
node --test tests/p3.test.mjs    # 11 项浮层管理器回归
node --test tests/p3b.test.mjs   # 10 项事件委托回归
node --test tests/p4.test.mjs    # 13 项领域层纯函数
```

六套全绿。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p4-2026-10-01.html" "index - new.html" -Force
```


---

## P3b（2026-10-01）事件委托 data-action

### 做了什么

1. **新增 §4 分发器**：`ACTIONS` 白名单（42 个动作）+ `dispatchAction()` + `delegateTarget()`，每类事件只有一个文档级监听：
   - `click` → `data-action`（可选 `data-arg` / `data-self`）
   - `input` → `data-input`（`data-value-arg` 表示把 `el.value` 当参数）
   - `change` → `data-change`、`blur` → `data-blur`（用捕获阶段，blur 不冒泡）
   - `keydown` → `data-enter`（`data-enter-prevent` 保留"回车提交、Shift+回车换行"语义）
   - **白名单外的动作名一律忽略**，DOM 上写着也不会执行到任意函数。
2. **83 个内联事件属性全部迁移**：74 个 `onclick` + 4 `oninput` + 1 `onchange` + 1 `onblur` + 3 `onkeydown` → 0。产物属性统计：`data-action` 73、`data-arg` 35、`data-self` 11、`data-input` 4、`data-enter` 3。
3. **多语句内联抽成具名函数**：`resetMotto()`、`resetProfile()`、`saveMottoAndClose()`、`pickIconFile()`；冗余的双语句（`saveApiConfig();closePopup()`、`saveProfile();closePopup()`）直接合并到原函数。
4. **壁纸选择器的内联遮罩点击与 `event.stopPropagation()` 删除**，改由 PopupManager 的 `triggers: ['.wp-picker']` 表达。
5. **`window.L` 从 61 个导出收敛到 34 个**：页面自身已零依赖，只留控制台调试 / 自动化测试 / 将来扩展用得上的主入口。
6. **顺带修复一个既存缺陷**：个人资料"恢复默认资料"按钮的内联 `onclick` 里嵌了 `\"` 转义引号，HTML 解析会在该处截断属性，**这个按钮此前根本点不动**；现在改为 `data-action="resetProfile"`，功能恢复正常。
7. **新增 `tests/p3b.test.mjs`（10 项）**：走真实委托路径验证基础动作、`data-arg`（含布尔还原）、`data-self`、`data-input`、`data-enter`（搜索跳转）、白名单拒绝、与浮层管理器协同、导出数量上限。

### 结构指标变化

| 指标 | P3a 后 | P3b 后 |
|---|---|---|
| 内联事件属性 | 83 | **0** |
| `data-*` 事件属性 | 20（data-wp/color） | **126** |
| `window.L` 导出 | 61 | **34** |
| 页面自身调用 `L.xxx` | 83 处内联 | **0** |
| 文档级 `click` 监听 | 3 | 3（新增委托、移除引擎与列表监听后持平） |
| 自动化测试用例 | 21+12+11 | 21+12+11+**10** |

### 有意的行为变化

1. **资料"恢复默认"按钮从"点击无反应"变为正常工作**（修复上面的截断缺陷）。
2. 其余交互逐条对齐：所有 `onclick`/`oninput`/`onkeydown`/`onblur`/`onchange` 的触发时机、参数、`this` 指向、Shift+回车换行、覆盖元素自身的选择器都保持不变。

### 验证方式

```powershell
node tools\verify.mjs            # 结构自检（第 9 节为 P3b 断言）
node tests\mc_verify.test.js     # 21 项基线
node --test tests/p2.test.mjs    # 12 项 Store / 缺陷回归
node --test tests/p3.test.mjs    # 11 项浮层管理器回归
node --test tests/p3b.test.mjs   # 10 项事件委托回归
```

五套全绿。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p3b-2026-10-01.html" "index - new.html" -Force
```


---

## P3a（2026-10-01）§4 浮层管理器 PopupManager

### 做了什么

1. **新增 §4 `PopupManager`**：11 个浮层（设置菜单、API、人设、资料、格言、收藏编辑、收藏管理、引擎下拉、农历、壁纸选择器、morph 面板）在**一张登记表**里声明一次：
   `triggers`（点哪些区域不该关自己）、`pointerGuard`（按下在弹窗内不误关）、`group`（分组关闭）、`countsAsPopup`（是否计入"有浮层打开"）、`external`（显隐由既有代码控制，只跟踪顺序）。
2. **关闭路径 8 条 → 1 条**：删除 6 段各自为政的关闭判断、引擎下拉的独立文档监听、收藏列表的独立文档监听、农历自建的外部点击监听；统一走 `handleOutsideClick()`，行为与重构前逐条对齐（一次外部点击关闭所有"规则允许关闭"的浮层）。
3. **Esc 语义升级**：从"只关书签栏"改为"关最上层浮层；没有浮层时再收书签栏"。从此设置/API/资料等弹窗都能用 Esc 关掉。
4. **morph 面板纳入栈**：面板显隐仍由原动画代码控制（`external`），但会入栈，因此 Esc 也能关它。
5. **z-index 暂不接管**：API 已预留 `z` 能力，但现有 CSS 手填了 20/40/41/200/250/300/999，本轮强行接管风险大于收益，统一交给 P5 的 CSS 阶梯后再启用。
6. **新增 `tests/p3.test.mjs`（11 项）**：开关、Esc 关栈顶、多层栈、触发按钮不误关、点内部不自关、一次点击关全部、引擎下拉、壁纸选择器、收藏弹窗 onClose 收尾（无递归）、morph 入栈可 Esc、无浮层时 Esc 收书签栏。

### 结构指标变化

| 指标 | P2 后 | P3a 后 |
|---|---|---|
| 文档级 `addEventListener` | 13 | **10** |
| 文档级 `click` 监听 | 4 | **2** |
| `getElementById` | 191 | **170** |
| 手写浮层关闭路径 | 8 | **1** |
| `querySelector*` | 36 | 36 |
| 自动化测试用例 | 21 + 12 | 21 + 12 + **11** |

### 有意的行为变化（仅两处，均可回退）

1. **Esc**：由"关书签栏（+收藏弹窗）"改为"关最上层浮层，其次收书签栏"。开着的设置/API 弹窗现在也能被 Esc 关掉。
2. **morph 面板**：Esc 现在可以关闭它（此前只能点遮罩或 ✕）。

其余交互（右键唤书签栏、双击唤壁纸选择器、点外部关闭、点触发按钮不误关、收藏弹窗关闭后回到书签栏/列表）均保持原样。

### 验证方式

```powershell
node tools\verify.mjs            # 结构自检（第 8 节为 P3 断言）
node tests\mc_verify.test.js     # 21 项基线
node --test tests/p2.test.mjs    # 12 项 P2 回归
node --test tests/p3.test.mjs    # 11 项 P3 浮层回归
```

四套全绿。

### 回退方式

```powershell
Copy-Item "archive\index-new-v2.0.0-p3a-2026-10-01.html" "index - new.html" -Force
```


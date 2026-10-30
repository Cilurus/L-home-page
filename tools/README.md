# L 起始页 · 开发者速查

单文件新标签页应用：**交付物只有根目录的 `index - new.html`**，零依赖、零构建、双击即用。
它同时是源码与产物 —— 所以文件内部的**分层**就是本项目唯一的"目录结构"。

## 目录

```
LLL/
├─ index - new.html          ← 唯一交付物（源码 + 产物同体）
├─ CHANGELOG.md              ← 改动记录：每个阶段做了什么、怎么验证、怎么回退
├─ archive/                  ← 历史版本（只增不删）
│   ├─ index-new-v1.0.3-*.html         重构前基线
│   ├─ index-new-v2.0.0-p1..p7-*.html  各阶段快照（回退用）
│   ├─ index-new-v2.0.1-wppicker-*.html 遮罩点击修复快照
│   ├─ index-new-v2.0.2-no-shape-*.html  移除动态图形快照
│   ├─ index-new-v2.1.0-blur-drag-*.html 模糊/拖动功能快照
│   ├─ index-new-v2.1.1-blur-scale-*.html 模糊档位 1~10 快照
│   └─ assets-lunar-constants.js       已废弃的外部常量文件（仅旧备份引用）
├─ tests/                    ← 回归测试（跑的是 index - new.html 里的真实代码）
│   ├─ harness.mjs           vm 沙箱 + 极简 DOM 桩，加载页面主脚本
│   ├─ mc_verify.test.js     书签/存储语义基线（21 项）
│   ├─ p2.test.mjs           Store 与缺陷修复（12 项）
│   ├─ p3.test.mjs           浮层管理器（13 项，含遮罩点击回归）
│   ├─ p3b.test.mjs          事件委托（10 项）
│   ├─ p4.test.mjs           领域层纯函数（15 项）
│   ├─ p7.test.mjs           性能收尾：定时器与粒子循环（5 项）
│   └─ p8.test.mjs           新功能：模糊档位 / 拖动排序 / 白名单（16 项）
└─ tools/
    ├─ check-all.mjs         ← 一键自检（结构自检 + 全部测试）
    ├─ verify.mjs            结构自检：语法、分层约束、CSS 断言、指标
    └─ history/              各阶段的变换脚本（带断言，可复现当时的改动）
```

## 日常命令

```powershell
node tools/check-all.mjs          # 改完代码就跑这个
node tools/verify.mjs             # 只看结构自检与指标
node --test tests/p4.test.mjs     # 只跑某一组测试
```

## 文件内部的分层（改代码前先看这里）

| 层 | 位置 | 规矩 |
|---|---|---|
| §0 配置 | `CONFIG` / `KEYS` / `DEFAULTS` / `SETTINGS` / `WALLPAPERS` | 新增存储键、设置项、壁纸**先在这里登记**，别在业务代码里写字面量 |
| §1 状态 | `Store` | **全文件唯一直接访问 localStorage 的地方**；写入走 `try/catch`，失败返回 `false` |
| §2 领域 | `Domain.Lunar / Text / Bookmarks / Chat` | 纯逻辑，**不碰 DOM、不碰存储**，可直接单测（`tests/p4.test.mjs`） |
| §3 服务 | `getApiKey/getApiUrl` + `fetch` 调用点 | HTTP / SSE；错误与中止在这里归一 |
| §4 视图 | `PopupManager` + `ACTIONS` 分发器 + 渲染函数 | 浮层的开/关/Esc/外点全交给 PopupManager；交互走 `data-action` |
| §5 应用 | `DOMContentLoaded` 启动序列 + `window.L` | 启动只在这里；`window.L` 仅作控制台调试入口 |

**依赖方向只能由高层指向低层**（§5 → §4 → §3 → §2 → §1 → §0）。`node tools/verify.mjs` 会检查其中几条硬约束。

## 四个常见改动的落点

1. **加一个设置开关**：§0 `SETTINGS` 加一行 → HTML 里给控件加 `data-action="toggleXxx"`（或复用 `toggleSwitch`）→ §4 `ACTIONS` 加转发 → 需要联动就订阅 `Store.setting()` 的返回值。**不必改初始化、重置、存储键三处。**
2. **加一张壁纸**：§0 `WALLPAPERS` 加一行（`cls` + 可选 `effect`）→ 在两个壁纸列表里加一个 `data-wp="键名" data-action="applyWallpaper" data-arg="键名"` 的元素 → CSS 里写 `.bg-键名`。
3. **加一个浮层/面板**：HTML 里给根元素一个 id → §4 登记表 `PopupManager.register('id', {...})` 一行（写明 `triggers`：点哪些区域不该关自己）→ 打开用 `PopupManager.open('id')`。Esc/外点/层级自动生效。
4. **加一个可点击元素**：写 `data-action="函数名"`（可选 `data-arg` / `data-self` / `data-value-arg`），然后在 §4 `ACTIONS` 白名单里加一条。**白名单外的名字不会被 DOM 触发**，所以不要往 DOM 上写函数名以外的花活。

## 注释约定

- 每个对外/主流程函数写 JSDoc：`@param` / `@returns` / `@sideEffect`（是否写存储、是否改 DOM）
- 关键决策写"为什么"（WHY），而不是复述代码在做什么
- 分区 banner 不要删：`§0`–`§5`、CSS 的 `§A`–`§D` 是文件的地图

## 回退

```powershell
Copy-Item "archive\index-new-v2.0.0-p5b-2026-10-01.html" "index - new.html" -Force
```
`archive/` 里每个阶段一个快照，文件名带阶段号；`CHANGELOG.md` 里记录每个快照对应的改动与验证方式。

## 已知取舍（不是遗漏）

- `@media` 里的 `!important`（morph 面板尺寸、`#mottoPopup` 宽度）**故意保留**：它们要压过 JS 运行时写入的内联样式。
- 组件内部的 `z-index: 1/2` 保留字面量：那是层内微叠放，不属于全局层级阶梯（阶梯在 `:root` 的 `--z-*`）。
- 农历节气用近似交节日期表，**交节当天可能差 1 天**；日柱干支锚点为 1900-01-01 = 甲戌日（已用 2024-01-01、1949-10-01 核对）。
- 自动消息的 system 提示词与主动对话的格式不同（`\n用户称呼：` vs `\n\n用户信息：`），这是重构前就有的差异，P4 保持原样未统一。
- 邮件未读角标仍把自己发出的最后一条消息算作未读；邮件时间仍固定显示"刚刚"（用户暂缓项 #8）。

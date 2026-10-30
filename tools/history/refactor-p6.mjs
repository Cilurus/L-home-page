/**
 * P6 收尾
 *  · 版本号升 V2.0.0（文件头 + 关于面板）
 *  · 删除已无调用方的兼容别名：C()、getLunar()、getSolarTerm()、ganzhiDay()
 *  · 清掉 6 处可安全移除的内联样式（toast / rainCanvas / search-wrap / 两个弹窗初始定位 / 农历弹窗）
 *  · 给 12 个对外与主流程函数补 JSDoc
 * 用法：node tools/refactor-p6.mjs [--write]
 */
import fs from 'node:fs';

const FILE = './index - new.html';
const WRITE = process.argv.includes('--write');
let txt = fs.readFileSync(FILE, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);

const report = [];
let failed = 0;
function step(name, from, to, expect) {
  const n = txt.split(from).length - 1;
  const ok = expect === null ? n >= 1 : n === expect;
  report.push([ok ? 'OK  ' : 'FAIL', name, n, expect === null ? '>=1' : expect]);
  if (!ok) { failed++; return; }
  txt = txt.split(from).join(to);
}

/* ==========================================================================
 * 1. 版本号
 * ======================================================================== */
step('文件头版本说明',
`  版本  V2.0.0-struct（P1：结构重排，行为与 V1.0.3 一致）
  基线  V1.0.3 / 2026-06-08`,
`  版本  V2.0.0（2026-10-01，结构重构完成）
  基线  V1.0.3 / 2026-06-08（重构前，行为与重构后一致）`, 1);

step('关于面板版本',
  '开发者：JH<br>版本：V1.0.3<br>更新：2026.06.08',
  '开发者：JH<br>版本：V2.0.0<br>更新：2026.10.01', 1);

step('头部结构说明同步（§1/§2/§4）',
`         §1 状态层  数据与偏好（P2 起收敛为 Store，成为唯一状态源）
         §2 领域层  纯逻辑（农历换算、壁纸规则、收藏规则），不碰 DOM
         §3 服务层  HTTP / SSE（/models、/chat/completions）
         §4 视图层  浮层管理、渲染、事件`,
`         §1 状态层  Store：唯一状态源（类型化设置读写 + 配额保护 + 变更订阅）
         §2 领域层  Domain：纯逻辑（农历换算、文本清洗、收藏槽位、会话组装），不碰 DOM
         §3 服务层  HTTP / SSE（/models、/chat/completions）
         §4 视图层  PopupManager（浮层统一管理）、事件委托（data-action）、渲染`, 1);

/* ==========================================================================
 * 2. 删除无调用方的别名
 * ======================================================================== */
step('删除农历三个薄封装',
`/* 以下三个是 Domain.Lunar 的薄封装（保持既有函数名，便于阅读与将来扩展） */
/** @param {Date} date @returns {object} 同 Domain.Lunar.snapshot */
function getLunar(date) { return Domain.Lunar.snapshot(date); }
/** @param {Date} date @returns {string} 日柱干支，如 '甲子' */
function ganzhiDay(date) { return Domain.Lunar.ganzhiDay(date); }
/** @param {Date} date @returns {string} 当前节气名 */
function getSolarTerm(date) { return Domain.Lunar.solarTerm(date); }`,
`/* 农历/文本的具体实现都在 §2 Domain 中；此处不再保留同名薄封装（P6 清理，已无调用方） */`, 1);

step('删除 C() 兼容别名',
`/** @deprecated 与 esc 等价，保留兼容 @param {string} s @returns {string} */
function C(s) { return Domain.Text.escape(s); }`,
`/* C() 与 esc 等价，调用点已统一为 esc / Domain.Text.escape（P6 清理） */`, 1);

/* ==========================================================================
 * 3. 内联样式清理
 * ======================================================================== */
step('toast 内联 display 删除（CSS 已有）',
  '<div class="toast" id="toast" style="display: none;">已切换为自动补位模式</div>',
  '<div class="toast" id="toast">已切换为自动补位模式</div>', 1);

step('rainCanvas 内联移到 CSS',
  '<canvas id="rainCanvas" style="position:fixed;inset:0;z-index:0;pointer-events:none;display:none"></canvas>',
  '<canvas id="rainCanvas"></canvas>', 1);

step('search-wrap 初始阴影移到 CSS',
  '<div class="search-wrap" style="--search-shadow: rgba(0,120,212,0.35);">',
  '<div class="search-wrap">', 1);

step('apiPopup 初始定位删除（JS 会定位）',
  '<div class="popup" id="apiPopup" style="top: 55.8px; left: 24px;">',
  '<div class="popup" id="apiPopup">', 1);

step('profilePopup 初始定位删除（JS 会定位）',
  '<div class="popup" id="profilePopup" style="top: 62px; left: 1162px;">',
  '<div class="popup" id="profilePopup">', 1);

step('lunarPopup 内联移到 CSS',
  '<div class="settings-popup" id="lunarPopup" style="position:fixed;z-index: var(--z-popup-strong);width:220px;text-align:center;padding:14px;">',
  '<div class="settings-popup" id="lunarPopup">', 1);

/* 在 CSS 里补上被移出的三条规则 */
step('CSS 补 :rainCanvas / .search-wrap / #lunarPopup',
`  /* §A-2 键盘可达：所有可交互元素都要有可见焦点（原来大量 outline:none 无替代） */`,
`  /* 从 HTML 内联样式移入（P6）：初始值集中在这里 */
  #rainCanvas { position: fixed; inset: 0; z-index: 0; pointer-events: none; display: none; }
  .search-wrap { --search-shadow: rgba(0,120,212,0.35); }
  #lunarPopup { position: fixed; z-index: var(--z-popup-strong); width: 220px; text-align: center; padding: 14px; }

  /* §A-2 键盘可达：所有可交互元素都要有可见焦点（原来大量 outline:none 无替代） */`, 1);

/* ==========================================================================
 * 4. 补 JSDoc（对外与主流程函数）
 * ======================================================================== */
const DOCS = [
  ['function openApiConfig(fromRight) {',
    `/**
 * 打开 API 配置弹窗。
 * @param {boolean} [fromRight] true 时对齐设置菜单（从齿轮进入），否则对齐左上状态点
 * @sideEffect 关掉其它表单浮层与设置菜单；填表；定位；打开浮层
 */`],
  ['function saveApiConfig() {',
    `/**
 * 保存 API 配置到本地。
 * @sideEffect 写 localStorage（KEYS.API_KEY / API_URL）；关弹窗；探测可用性；弹 toast
 */`],
  ['function openProfile() {',
    `/**
 * 打开个人资料弹窗并回填当前资料。
 * @sideEffect 关掉其它表单浮层与设置菜单；定位；打开浮层
 */`],
  ['function saveProfile() {',
    `/**
 * 保存个人资料（称呼 / 性别 / 兴趣），这些内容会被拼进 AI 的系统提示词。
 * @sideEffect 写会话主数据（防抖落盘）；关弹窗；弹 toast
 */`],
  ['function editMotto() {',
    `/**
 * 打开格言编辑弹窗并回填当前格言。
 * @sideEffect 关掉其它表单浮层与设置菜单；定位；打开浮层
 */`],
  ['function saveMotto() {',
    `/**
 * 保存格言（单行显示，空值回落到默认格言）。
 * @sideEffect 改 DOM（#motto 文本）；写 localStorage（KEYS.MOTTO）
 */`],
  ['function toggleSettings() {',
    `/**
 * 打开 / 关闭设置菜单（再次点击即关闭）。
 * @sideEffect 关掉表单类浮层；定位；切换浮层显隐；刷新各选项选中态
 */`],
  ['function setCardOpacity(v) {',
    `/**
 * 设置卡片透明度（1~10 档）。
 * @param {number|string} v 滑块值
 * @sideEffect 写 localStorage（KEYS.OPACITY）；改 CSS 变量 --card-alpha / --card-blur-mul；移动数值标签
 */`],
  ['function toggleSwitch(row) {',
    `/**
 * 通用开关：按行的 track id 找到注册表里的设置项并翻转。
 * @param {HTMLElement} row 带 .toggle-track 的行元素
 * @sideEffect 写 localStorage（§0 SETTINGS）；按开关名联动显隐（格言 / 图形）
 */`],
  ['function autoMessage() {',
    `/**
 * 到点后由 AI 主动发一条消息（间隔 1 小时 ~ 1 周随机）。
 * @sideEffect 写会话主数据与 KEYS.AUTO_* ；发起一次非流式请求；刷新未读角标
 * 说明：仅在 §0 SETTINGS.autoMsg 为开、且 API 可用时才触发。
 */`],
  ['function toggleAutoMsg(row) {',
    `/**
 * 翻转"自动消息"开关。
 * @param {HTMLElement} row 开关行
 * @sideEffect 写 localStorage（KEYS.AUTO_MSG）；开启时立即尝试触发一次
 */`],
  ['function showToast(m) {',
    `/**
 * 顶部提示条。
 * @param {string} m 文案
 * @sideEffect 改 DOM；CONFIG.TOAST_MS 后自动隐藏
 */`],
  ['function updateClock() {',
    `/**
 * 刷新时钟文本与悬停日期。
 * @sideEffect 改 DOM（#clock 文本与 data-date）
 */`],
  ['function showBookmarkBar() {',
    `/**
 * 唤出书签 Dock（右键触发）。
 * @sideEffect 改 DOM；绑定 dock 放大监听；重置空闲计时；抬高格言
 */`],
  ['function renderBookmarkBar() {',
    `/**
 * 渲染书签 Dock（可见槽位 + "更多"入口）并绑定 Dock 放大效果。
 * @sideEffect 重建 DOM 子树；读取收藏与偏好
 */`],
  ['function saveBookmark() {',
    `/**
 * 保存 / 新建收藏槽位。
 * @returns {void}
 * @sideEffect 写 localStorage（KEYS.BOOKMARKS）；关弹窗；弹 toast
 * 说明：下标非法或写入失败（配额超限）时明确提示，不再静默"假装成功"。
 */`]
];
for (const [anchor, doc] of DOCS) {
  const n = txt.split(anchor).length - 1;
  step('JSDoc: ' + anchor.slice(9, 34), anchor, doc + '\n' + anchor, n);
}

/* ==========================================================================
 * 写盘
 * ======================================================================== */
const w = Math.max(...report.map(r => r[1].length));
console.log('步骤'.padEnd(6) + '结果  命中/期望');
for (const [ok, name, n, exp] of report) console.log(`${ok}  ${name.padEnd(w)}  ${n} / ${exp}`);
console.log(`\n共 ${report.length} 步，失败 ${failed} 步；文件 ${txt.length} 字符`);
if (failed) { console.log('存在未命中步骤，未写盘。'); process.exit(1); }
if (!WRITE) { console.log('干跑通过（未写盘）。加 --write 实际写入。'); process.exit(0); }
fs.writeFileSync(FILE, txt, { encoding: 'utf8' });
console.log('已写入：' + FILE);

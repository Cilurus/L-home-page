/**
 * P1-a 结构重排（零行为变更）
 * 目标：建立 §0 配置层（CONFIG / KEYS / DEFAULTS / WALLPAPERS）、统一存储键名、
 *       补文件头与分层注释。
 * 纪律：只做"字符串搬家"，不改任何逻辑分支；每步都断言命中次数，任一不匹配即中止且不写盘。
 * 用法：node tools/refactor-p1a.mjs          （干跑，打印报告）
 *       node tools/refactor-p1a.mjs --write  （实际写盘）
 */
import fs from 'node:fs';

const FILE = './index - new.html';
const WRITE = process.argv.includes('--write');

let txt = fs.readFileSync(FILE, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);

/* ---------- 主脚本区域定位：head 里的 anti-FOUC 脚本必须保持自包含，不能碰 ---------- */
const ANCHOR = "  const SK = 'mc_final';";
const anchorIdx = txt.indexOf(ANCHOR);
if (anchorIdx < 0) throw new Error('定位失败：找不到主脚本锚点');
let head = txt.slice(0, anchorIdx);
let main = txt.slice(anchorIdx);

const report = [];
let failed = 0;

/** 在 target 上执行一次替换，并断言命中次数 */
function step(target, name, from, to, expect) {
  const n = target.split(from).length - 1;
  const ok = expect === null ? n >= 1 : n === expect;
  report.push([ok ? 'OK  ' : 'FAIL', name, n, expect === null ? '>=1' : expect]);
  if (!ok) { failed++; return target; }
  return target.split(from).join(to);
}

/* ==========================================================================
 * 一、文件头注释（放在 DOCTYPE 之后，避免影响标准模式）
 * ======================================================================== */
head = step(head, '文件头维护说明',
  '<!DOCTYPE html>\n<html lang="zh-CN"><head>',
  `<!DOCTYPE html>
<!--
  ============================================================================
  L 起始页 · 单文件新标签页
  ============================================================================
  版本  V2.0.0-struct（P1：结构重排，行为与 V1.0.3 一致）
  基线  V1.0.3 / 2026-06-08
        快照 archive/index-new-v1.0.3-2026-07-09.html
        SHA256 D8DD37EAB0522C2B8DBD88AB5CFC1B243083B0B78B79B871C34FC431B0672BC8
  历史  全部历史版本存于 archive/（只增不删）；改动记录见 CHANGELOG.md

  文件结构（自上而下）
    1. <head>   样式 <style>：§A 令牌与重置 → §B 布局 → §C 组件 → §D 主题/响应式
    2. <body>   静态骨架（浮层/弹窗/面板）；交互经 data-action / 内联 onclick 调用 window.L
    3. <script> 主脚本，内部按 6 层组织：
         §0 配置层  CONFIG / KEYS / DEFAULTS / WALLPAPERS
         §1 状态层  数据与偏好（P2 起收敛为 Store，成为唯一状态源）
         §2 领域层  纯逻辑（农历换算、壁纸规则、收藏规则），不碰 DOM
         §3 服务层  HTTP / SSE（/models、/chat/completions）
         §4 视图层  浮层管理、渲染、事件
         §5 应用层  bootstrap 启动序列与对外接口 window.L

  维护约定
    1) 依赖只能由高层指向低层：§5 → §4 → §3 → §2 → §1 → §0，禁止反向。
    2) §2 领域层禁止直接访问 DOM；状态修改统一走 §1。
    3) 新增存储键先登记到 §0 的 KEYS；新增壁纸先登记到 §0 的 WALLPAPERS。
    4) 改视觉优先改 §A 的 CSS 变量，不要在函数里写死颜色/尺寸。
    5) 每个函数标注 @sideEffect：是否写存储 / 是否改 DOM。
  ============================================================================
-->
<html lang="zh-CN"><head>`, 1);

/* ==========================================================================
 * 二、样式层目录（§A–§D）
 * ======================================================================== */
head = step(head, 'CSS 层目录',
  '<style>\n  * { ',
  `<style>
/* ==========================================================================
 * 样式层结构（改样式先看这里）
 *   §A 设计令牌与全局重置  变量、字体、滚动条、toast 基础
 *   §B 布局骨架            #bg 背景、顶栏、主页、搜索区、动作栏
 *   §C 组件                玻璃浮层、时钟、图形、格言、morph 面板、书签 Dock、弹窗
 *   §D 主题与显示模式      gray-text / black-text / custom-text / minimal / 响应式
 * 约定：颜色、圆角、模糊半径、时长、层级优先取 §A 变量，不写死数值。
 * ======================================================================== */
  * { `, 1);

/* ==========================================================================
 * 三、存储键名统一 + 旧常量下线（全部在 main 区域内）
 * ======================================================================== */

// 3.1 SK
main = step(main, 'SK → KEYS.STORE (读)', "localStorage.getItem(SK)", 'localStorage.getItem(KEYS.STORE)', 1);
main = step(main, 'SK → KEYS.STORE (写)', "localStorage.setItem(SK, JSON.stringify(data))", 'localStorage.setItem(KEYS.STORE, JSON.stringify(data))', 2);

// 3.2 AK / AU
main = step(main, 'AK/AU 常量下线 + getter 改写',
`const AK = 'mc_ak', AU = 'mc_au';
function getApiKey() { return localStorage.getItem(AK) || ''; }
function getApiUrl() { return localStorage.getItem(AU) || 'https://api.deepseek.com/v1'; }`,
`/**
   * 读取 API Key。
   * @returns {string} 未配置时返回空串
   * @sideEffect 只读 localStorage（KEYS.API_KEY）
   */
  function getApiKey() { return localStorage.getItem(KEYS.API_KEY) || ''; }
  /**
   * 读取 API 基址。
   * @returns {string} 未配置时回落到 CONFIG.DEFAULT_API_URL
   * @sideEffect 只读 localStorage（KEYS.API_URL）
   */
  function getApiUrl() { return localStorage.getItem(KEYS.API_URL) || CONFIG.DEFAULT_API_URL; }`, 1);

// 3.3 PREF_KEY
main = step(main, 'PREF_KEY 下线', "// Preferences\nconst PREF_KEY = 'mc_prefs';\n", '// Preferences（键名统一到 §0 KEYS.PREFS）\n', 1);
main = step(main, 'PREF_KEY → KEYS.PREFS (读)', 'localStorage.getItem(PREF_KEY)', 'localStorage.getItem(KEYS.PREFS)', 1);
main = step(main, 'PREF_KEY → KEYS.PREFS (写)', 'localStorage.setItem(PREF_KEY, JSON.stringify(p))', 'localStorage.setItem(KEYS.PREFS, JSON.stringify(p))', 1);

// 3.4 BM_KEY / 槽位常量
main = step(main, 'BM_KEY 下线', "var _bmSkipBarClose = false;\nconst BM_KEY = 'mc_bookmarks';", 'var _bmSkipBarClose = false;', 1);
main = step(main, 'BM_KEY → KEYS.BOOKMARKS (读)', 'localStorage.getItem(BM_KEY)', 'localStorage.getItem(KEYS.BOOKMARKS)', 1);
main = step(main, 'BM_KEY → KEYS.BOOKMARKS (写)', 'localStorage.setItem(BM_KEY, JSON.stringify(arr))', 'localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(arr))', 1);
main = step(main, '槽位常量接 §0',
`const BM_TOTAL = 20;
const BM_VISIBLE = 10;`,
`const BM_TOTAL = CONFIG.BM_TOTAL;      // 收藏槽位总数（来源 §0）
const BM_VISIBLE = CONFIG.BM_VISIBLE;  // Dock 可见槽位数（来源 §0）`, 1);

// 3.5 默认值接 §0
main = step(main, '口号默认值', "localStorage.getItem('mc_motto') || '春眠不觉晓，处处闻啼鸟。'", 'localStorage.getItem(KEYS.MOTTO) || DEFAULTS.motto', 1);
main = step(main, '恢复默认口号', "if (!val) val = '鹰击长空，鱼翔浅底，万类霜天竞自由。';", 'if (!val) val = DEFAULTS.mottoFallback;', 1);
main = step(main, 'API 地址默认值', "|| 'https://api.deepseek.com/v1';", '|| CONFIG.DEFAULT_API_URL;', 1);
main = step(main, '透明度默认值', "localStorage.getItem('mc_opacity') || '2'", 'localStorage.getItem(KEYS.OPACITY) || String(DEFAULTS.opacity)', 2);

// 3.6 余下字面量键 → KEYS.*（§0 尚未插入，此处替换的是旧代码里的散落字面量）
const LITERALS = [
  ['mc_motto', 'MOTTO'], ['mc_bg_type', 'BG_TYPE'], ['mc_bg', 'BG'],
  ['mc_font', 'FONT'], ['mc_customColor', 'CUSTOM_COLOR'], ['mc_opacity', 'OPACITY'],
  ['mc_toggleMotto', 'TOGGLE_MOTTO'], ['mc_toggleShape', 'TOGGLE_SHAPE'],
  ['mc_toggleMinimal', 'TOGGLE_MINIMAL'], ['mc_autoMsg', 'AUTO_MSG'],
  ['mc_autoNext', 'AUTO_NEXT'], ['mc_autoTopics', 'AUTO_TOPICS'],
  ['mc_autoLastIdx', 'AUTO_LAST_IDX'], ['mc_whiteClock', 'WHITE_CLOCK'],
  ['mc_whiteMotto', 'WHITE_MOTTO'], ['mc_lastRead', 'LAST_READ']
];
for (const [literal, key] of LITERALS) {
  main = step(main, `字面量 ${literal} → KEYS.${key}`, `'${literal}'`, `KEYS.${key}`, null);
}

/* ==========================================================================
 * 四、插入 §0 配置层（放在所有使用之前，同时下线 const SK）
 * ======================================================================== */
const SECTION_0 = `  /* ==========================================================================
   * §0  配置层   CONFIG / KEYS / DEFAULTS / WALLPAPERS
   * --------------------------------------------------------------------------
   * 职责：全站唯一的常量与默认值来源。
   * 依赖：无（最底层）。
   * 约定：新增存储键 → 先登记 KEYS；新增壁纸 → 先登记 WALLPAPERS；
   *       新增默认值 → 先登记 DEFAULTS。禁止在业务代码里再写字面量键名。
   * 背景：重构前这些字面量散落在 70 处 localStorage 调用里，同一个键名
   *       在 3~5 个地方各写一遍，改一处必漏一处（详见 CHANGELOG P1）。
   * ======================================================================== */

  /** 运行期配置（不持久化） */
  const CONFIG = {
    BM_TOTAL: 20,                  // 收藏槽位总数
    BM_VISIBLE: 10,                // 书签 Dock 可见槽位数
    DEFAULT_API_URL: 'https://api.deepseek.com/v1',
    SAVE_DEBOUNCE_MS: 500,         // mc_final 落盘防抖
    TOAST_MS: 3000,                // toast 停留时长
    MINIMAL_HIDE_DELAY_MS: 6600,   // 极简模式空闲隐藏延迟
    AUTO_MSG_MIN_MS: 3600000,      // 自动消息最短间隔（1 小时）
    AUTO_MSG_MAX_MS: 604800000     // 自动消息最长间隔（1 周）
  };

  /** localStorage 键名表（全站唯一来源） */
  const KEYS = {
    STORE: 'mc_final',          // 角色 + 会话 + 个人资料
    API_KEY: 'mc_ak',
    API_URL: 'mc_au',
    PREFS: 'mc_prefs',          // 收藏偏好（紧凑 / 详细）
    BOOKMARKS: 'mc_bookmarks',
    MOTTO: 'mc_motto',
    BG: 'mc_bg',                // 自定义壁纸（dataURL）
    BG_TYPE: 'mc_bg_type',
    FONT: 'mc_font',
    CUSTOM_COLOR: 'mc_customColor',
    OPACITY: 'mc_opacity',
    TOGGLE_MOTTO: 'mc_toggleMotto',
    TOGGLE_SHAPE: 'mc_toggleShape',
    TOGGLE_MINIMAL: 'mc_toggleMinimal',
    AUTO_MSG: 'mc_autoMsg',
    AUTO_NEXT: 'mc_autoNext',
    AUTO_TOPICS: 'mc_autoTopics',
    AUTO_LAST_IDX: 'mc_autoLastIdx',
    WHITE_CLOCK: 'mc_whiteClock',
    WHITE_MOTTO: 'mc_whiteMotto',
    LAST_READ: 'mc_lastRead'
  };

  /** 首次使用时的默认值 */
  const DEFAULTS = {
    opacity: 2,
    font: 'black',
    bgType: 'orca',
    motto: '春眠不觉晓，处处闻啼鸟。',
    mottoFallback: '鹰击长空，鱼翔浅底，万类霜天竞自由。',
    customColor: '#FFFFFF'
  };

  /** 预设壁纸表：cls 为 #bg 上的类名；effect 为联动的粒子特效 */
  const WALLPAPERS = {
    orca:      { label: 'Orca',             cls: 'bg-orca' },
    sky:       { label: 'Sky',              cls: 'bg-sky' },
    deepspace: { label: 'Deep Space',       cls: 'bg-deepspace' },
    gray:      { label: 'Grade Grey',       cls: 'bg-gray' },
    sunshine:  { label: 'Evening Sunshine', cls: 'bg-sunshine' },
    asteroid:  { label: 'Moonlit Asteroid', cls: 'bg-asteroid' },
    vivid:     { label: '灵动',             cls: 'bg-vivid' },
    rain:      { label: '雨滴',             cls: 'bg-rain',    effect: 'rain' },
    firefly:   { label: '萤火',             cls: 'bg-firefly', effect: 'firefly' }
  };

  /** 全部壁纸类名，供"先清后加"统一使用 */
  const BG_CLASSES = Object.keys(WALLPAPERS).map(function (k) { return WALLPAPERS[k].cls; });

  /* ==========================================================================
   * §1  状态层   （当前仍在收敛中：data 为会话主状态，偏好散在 KEYS.* 各键）
   * 说明：P2 将把散落的闭包变量与 localStorage 读写收敛为 Store（唯一状态源），
   *       届时 §1 会成为唯一允许写存储的地方。
   * ======================================================================== */
`;

main = step(main, '插入 §0 / §1 分区', ANCHOR + '\n  let data;', SECTION_0 + '\n  let data;', 1);

/* ==========================================================================
 * 五、其余分层 banner（只加注释，不移动代码，便于先建立地图再逐步归位）
 * ======================================================================== */
main = step(main, 'banner: morph 面板',
  '// ====================================================================\n//  MORPH PANEL',
  `// ====================================================================
//  §4 视图层 · MORPH PANEL（展开式玻璃面板：邮件 / 发信 / 会话）
//  说明：面板的尺寸与位移由 JS 逐帧写内联样式（P3 计划改为 CSS 变量驱动）`,
  1);

main = step(main, 'banner: 对话',
  '// ====================================================================\n//  CHAT',
  `// ====================================================================
//  §2 领域层 + §3 服务层 · CHAT
//  §3：/chat/completions 的 SSE 解析、错误归一；§2：消息清洗与 Markdown 渲染`,
  1);

main = step(main, 'banner: 农历',
  '// ===== Lunar Calendar =====',
  `// ===== §2 领域层 · 农历与干支换算（纯函数，无 DOM 依赖） =====`, 1);

main = step(main, 'banner: 收藏',
  '// Bookmark bar (right-click)',
  `// ===== §1 状态层 + §4 视图层 · 收藏（存储读写 + Dock 渲染） =====`, 1);

main = step(main, 'banner: 启动序列',
  "document.addEventListener('DOMContentLoaded', () => {",
  `// ===== §5 应用层 · 启动序列（P3 起收敛为唯一的 App.bootstrap） =====
document.addEventListener('DOMContentLoaded', () => {`, 1);

main = step(main, 'banner: 对外接口',
  '  // Expose public API',
  `  // ===== §5 应用层 · 对外接口（供 HTML 内联 onclick 调用） =====
  // Expose public API`, 1);

/* ==========================================================================
 * 写盘
 * ======================================================================== */
const out = head + main;
const w = Math.max(...report.map(r => r[1].length));
console.log('步骤'.padEnd(6) + '结果  ' + '命中/期望');
for (const [ok, name, n, exp] of report) {
  console.log(`${ok}  ${name.padEnd(w)}  ${n} / ${exp}`);
}
console.log(`\n共 ${report.length} 步，失败 ${failed} 步；文件 ${txt.length} → ${out.length} 字符`);

if (failed) { console.log('存在未命中步骤，未写盘。'); process.exit(1); }
if (!WRITE) { console.log('干跑通过（未写盘）。加 --write 实际写入。'); process.exit(0); }

fs.writeFileSync(FILE, out, { encoding: 'utf8' });
console.log('已写入：' + FILE);

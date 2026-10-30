/**
 * P5-a  §A 令牌层 + 层级阶梯 + 玻璃配方 + 焦点可见性
 *  · 新增 :root 设计令牌（时长 / 玻璃模糊 / 层级阶梯），把 --tr-fast 从 * 上移走
 *  · 全站 z-index（10/20/40/41/100/200/250/300/999/9999）改为取 token —— 数值完全不变，
 *    零视觉变化，但层级从此只有一处可改
 *  · 玻璃模糊半径改为 --glass-blur-*，并补齐缺失的 -webkit-backdrop-filter 前缀
 *  · 新增 :focus-visible 焦点环，修掉"搜索框聚焦时边框反而变暗"
 * 用法：node tools/refactor-p5a.mjs [--write]
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
function replaceAll(name, re, to, min) {
  const n = (txt.match(re) || []).length;
  const ok = n >= min;
  report.push([ok ? 'OK  ' : 'FAIL', name, n, '>=' + min]);
  if (!ok) { failed++; return; }
  txt = txt.replace(re, to);
}

/* ==========================================================================
 * 1. :root 令牌层 + 把 --tr-fast 从 * 移走
 * ======================================================================== */
step('--tr-fast 迁出通配选择器',
  '  * { margin: 0; padding: 0; box-sizing: border-box; --tr-fast: background-color .2s, border-color .2s, transform .2s, opacity .2s, box-shadow .2s; }',
  `  /* §A-1 设计令牌：颜色、时长、玻璃、层级都从这里取，别在业务规则里写死 */
  :root {
    /* 过渡时长 */
    --tr-fast: background-color .2s, border-color .2s, transform .2s, opacity .2s, box-shadow .2s;
    --dur-fast: .2s;
    --dur-med: .25s;
    --dur-slow: .6s;
    /* 玻璃拟态 */
    --glass-bg: rgba(255, 255, 255, var(--card-alpha, 0.04));
    --glass-blur-1: 8px;
    --glass-blur-2: 12px;
    --glass-blur-3: 20px;
    --glass-blur-4: 24px;
    --glass-blur-5: 40px;
    --glass-sat: 1.3;
    --glass-sat-strong: 1.4;
    /* 层级阶梯（数值与重构前逐一对应，仅换了写法） */
    --z-menu: 10;            /* 搜索框下拉 */
    --z-menu-2: 20;          /* 设置菜单 */
    --z-dimmer: 40;          /* morph 遮罩 */
    --z-panel: 41;           /* morph 面板 */
    --z-overlay: 100;        /* 壁纸选择器遮罩 */
    --z-popup: 200;          /* 表单类弹窗 */
    --z-list: 250;           /* 收藏管理列表 */
    --z-popup-strong: 300;   /* 格言弹窗 / 农历弹窗 */
    --z-dock: 999;           /* 书签 Dock 与 tooltip */
    --z-toast: 9999;         /* 提示条 */
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }`, 1);

/* ==========================================================================
 * 2. z-index 改用 token（值不变）
 * ======================================================================== */
const Z_MAP = [
  [9999, '--z-toast'], [999, '--z-dock'], [300, '--z-popup-strong'], [250, '--z-list'],
  [200, '--z-popup'], [100, '--z-overlay'], [41, '--z-panel'], [40, '--z-dimmer'],
  [20, '--z-menu-2'], [10, '--z-menu']
];
for (const [v, token] of Z_MAP) {
  replaceAll(`z-index: ${v} → ${token}`, new RegExp('z-index:\\s*' + v + '\\b', 'g'), 'z-index: var(' + token + ')', 1);
}

/* ==========================================================================
 * 3. 玻璃模糊半径改 token（值不变）
 * ======================================================================== */
const BLUR_MAP = [['8px', '--glass-blur-1'], ['12px', '--glass-blur-2'], ['20px', '--glass-blur-3'],
['24px', '--glass-blur-4'], ['40px', '--glass-blur-5']];
for (const [px, token] of BLUR_MAP) {
  replaceAll(`玻璃 calc(${px}) → var(${token})`,
    new RegExp('calc\\(' + px.replace('px', '') + 'px \\* var\\(--card-blur-mul, 1\\)\\)', 'g'),
    'calc(var(' + token + ') * var(--card-blur-mul, 1))', 1);
}
replaceAll('玻璃 blur(8px) 无 calc → token', /blur\(8px\)/g, 'blur(var(--glass-blur-1))', 1);
replaceAll('玻璃 blur(12px) 无 calc → token', /blur\(12px\)/g, 'blur(var(--glass-blur-2))', 1);

/* ==========================================================================
 * 4. 补齐缺失的 -webkit-backdrop-filter（含单行压缩规则）
 * ======================================================================== */
{
  const before = (txt.match(/backdrop-filter:/g) || []).length;
  let added = 0;
  txt = txt.replace(/(^|[;{]\s*)(backdrop-filter:\s*([^;}]+);)(?!\s*-webkit-backdrop-filter)/gm,
    function (m, pre, decl, val) { added++; return pre + decl + '-webkit-backdrop-filter: ' + val.trim() + ';'; });
  const ok = added > 0;
  report.push([ok ? 'OK  ' : 'FAIL', '补齐 -webkit-backdrop-filter', added, '>=1']);
  if (!ok) failed++;
  console.log(`     （原 backdrop-filter 声明 ${before} 处，补前缀 ${added} 处）`);
}

/* ==========================================================================
 * 5. 焦点可见性：全局 focus-visible + 修正搜索框聚焦
 * ======================================================================== */
step('搜索框聚焦不再变暗 + 焦点环',
  '  .search-wrap:focus-within { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.06); }',
  `  .search-wrap:focus-within { border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.06); box-shadow: 0 0 0 3px rgba(120,150,255,0.35); }
  /* §A-2 键盘可达：所有可交互元素都要有可见焦点（原来大量 outline:none 无替代） */
  :focus-visible { outline: 2px solid rgba(140,170,255,0.9); outline-offset: 2px; }
  html.gray-text :focus-visible { outline-color: rgba(80,80,80,0.9); }
  html.black-text :focus-visible { outline-color: rgba(0,0,0,0.8); }`, 1);

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

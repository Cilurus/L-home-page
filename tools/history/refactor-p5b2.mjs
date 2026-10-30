/**
 * P5b-② 收尾：移动端视口/安全区、custom-text 补缺、reduced-motion 兜底、弹窗最小宽度
 *  · body 增加 100dvh（iOS 地址栏不再裁切）
 *  · 书签 Dock 底部加 safe-area-inset-bottom
 *  · 三个弹窗的内联 min-width 改为 min(原值, 88vw)：桌面像素级不变，手机不再溢出
 *  · custom-text 主题补 4 个此前遗漏的选择器
 *  · 新增 prefers-reduced-motion 兜底（常驻无限动画与入场动画）
 * 说明：@media 里的 !important（morph 面板尺寸、#mottoPopup 宽度）保留 —— 它们是为了
 *       压过 JS 写入的内联样式，属于结构性需要，不是历史遗留的滥用。
 * 用法：node tools/refactor-p5b2.mjs [--write]
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

/* 1. 视口高度：100vh 兜底 + 100dvh 实际值 */
step('body 使用 100dvh',
  'body { font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; height: 100vh; overflow: hidden;',
  'body { font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; height: 100vh; height: 100dvh; overflow: hidden;', 1);

/* 2. 书签 Dock 底部安全区 */
step('Dock 底部安全区',
  'position: fixed; bottom: 12px; left: 0; right: 0; z-index: var(--z-dock);',
  'position: fixed; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); left: 0; right: 0; z-index: var(--z-dock);', 1);

/* 3. 弹窗最小宽度：桌面不变、手机不溢出 */
step('personaPopup min-width', 'id="personaPopup" style="min-width:320px"', 'id="personaPopup" style="min-width:min(320px, 88vw)"', 1);
step('bmPopup min-width', 'id="bmPopup" style="min-width:360px"', 'id="bmPopup" style="min-width:min(360px, 88vw)"', 1);
step('mottoPopup min-width', 'id="mottoPopup" style="min-width:380px"', 'id="mottoPopup" style="min-width:min(380px, 88vw)"', 1);

/* 4. custom-text 补齐遗漏选择器（追加在其最后一条规则之后） */
step('custom-text 补 4 个选择器',
  `html.custom-text .avatar-btn svg circle, html.custom-text .avatar-btn svg path { stroke: var(--custom-text-color); }`,
  `html.custom-text .avatar-btn svg circle, html.custom-text .avatar-btn svg path { stroke: var(--custom-text-color); }
  /* 补齐：这三处此前的 gray/black 主题有覆盖，自定义颜色主题漏了 */
  html.custom-text .search-input::placeholder, html.custom-text [data-tooltip]::after,
  html.custom-text .bookmark-bar .bm-slot .bm-label, html.custom-text .mail-item .m-preview { color: var(--custom-text-color); }`, 1);

/* 5. reduced-motion 兜底 */
step('prefers-reduced-motion 兜底',
  '</style>',
  `  /* §D-3 降低动效偏好：关掉常驻无限动画与"从透明淡入"的入场动画 */
  @media (prefers-reduced-motion: reduce) {
    #bg, #bg::before, #bg.bg-vivid, #bg.bg-vivid::before, #breathSvg, .loading-bubble span { animation: none; }
    .outbox-card, .wp-pick-opt { animation: none; opacity: 1; }
  }
</style>`, 1);

/* ---------- 写盘 ---------- */
const w = Math.max(...report.map(r => r[1].length));
console.log('步骤'.padEnd(6) + '结果  命中/期望');
for (const [ok, name, n, exp] of report) console.log(`${ok}  ${name.padEnd(w)}  ${n} / ${exp}`);
console.log(`\n共 ${report.length} 步，失败 ${failed} 步；文件 ${txt.length} 字符`);
if (failed) { console.log('存在未命中步骤，未写盘。'); process.exit(1); }
if (!WRITE) { console.log('干跑通过（未写盘）。加 --write 实际写入。'); process.exit(0); }
fs.writeFileSync(FILE, txt, { encoding: 'utf8' });
console.log('已写入：' + FILE);

/**
 * 删除"搜索框下的动态图形"（Reuleaux 三角 ↔ 圆的呼吸图形）及其全部相关代码
 * 覆盖：HTML 元素与设置项、CSS 规则/关键帧/媒体查询、JS 常量/函数/开关分支/初始化/重置、
 *       注册表项（KEYS、SETTINGS、TOGGLE_IDS）
 * 末尾自带"彻底删除"断言：全文件不得再出现任何相关标识符。
 * 用法：node tools/refactor-rm-shape.mjs [--write]
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
/** 删除 [startMarker, endMarker) 区间（用于整块代码） */
function cut(name, startMarker, endMarker, expect) {
  let n = 0;
  for (;;) {
    const i = txt.indexOf(startMarker);
    if (i < 0) break;
    const j = txt.indexOf(endMarker, i + startMarker.length);
    if (j < 0) break;
    txt = txt.slice(0, i) + txt.slice(j);
    n++;
  }
  const ok = n === expect;
  report.push([ok ? 'OK  ' : 'FAIL', name, n, expect]);
  if (!ok) failed++;
}

/* ---------------- HTML ---------------- */
step('删除图形元素',
  '\n  <div class="circle-balls-wrap" style="display:none"><div class="circle-balls"><svg id="breathSvg" viewBox="0 0 56 56" width="56" height="56"><defs><radialGradient id="morphGrad" cx="32%" cy="32%"><stop offset="0%" stop-color="rgba(255,255,255,0.1)"/><stop offset="100%" stop-color="rgba(200,230,255,0.03)"/></radialGradient></defs><path id="breathPath" fill="url(#morphGrad)" stroke="rgba(255,255,255,0.05)" stroke-width="1" d=""/></svg></div></div>',
  '', 1);

step('删除设置项"显示图形"',
  '<div class="toggle-row" data-action="toggleSwitch" data-self="1">显示图形<div class="toggle-track" id="toggleShape"><div class="toggle-dot"></div></div></div>',
  '', 1);

/* ---------------- CSS ---------------- */
step('删除 CSS 图形规则',
`  /* ===== Reuleaux triangle ===== */
  .circle-balls-wrap {
    position: absolute; top: calc(42% + 28px); left: 50%; transform: translate(-50%, -50%); z-index: 2;
  }
  .circle-balls { width: 56px; height: 56px; }
  #breathSvg {
    animation: rtSpin 26.7s linear infinite;
    will-change: transform;
  }
  @keyframes rtSpin {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  #breathPath {
    transition: d 1s ease-in-out;
  }
  .circle-balls { contain: layout style paint; }

`, '', 1);

step('删除媒体查询里的图形定位',
  '  .circle-balls-wrap { top: calc(36% + 20px); }\n', '', 1);

step('reduced-motion 选择器去掉 #breathSvg',
  '#bg, #bg::before, #bg.bg-vivid, #bg.bg-vivid::before, #breathSvg, .loading-bubble span { animation: none; }',
  '#bg, #bg::before, #bg.bg-vivid, #bg.bg-vivid::before, .loading-bubble span { animation: none; }', 1);

/* ---------------- JS：注册表 ---------------- */
step('KEYS 去掉 TOGGLE_SHAPE', "    TOGGLE_SHAPE: 'mc_toggleShape',\n", '', 1);
step('SETTINGS 去掉 shape',
  "    shape:       { key: KEYS.TOGGLE_SHAPE,   type: 'flag', def: false,    label: '显示图形' },\n", '', 1);
step('TOGGLE_IDS 去掉 toggleShape',
  "toggleMotto: 'motto', toggleShape: 'shape', toggleMinimal: 'minimal',",
  "toggleMotto: 'motto', toggleMinimal: 'minimal',", 1);

/* ---------------- JS：动画实现 ---------------- */
cut('删除形变动画实现（常量 + setShapeAnimation）',
  '  /** Reuleaux 三角形路径 */',
  '  /**\n   * 按壁纸类型启停粒子特效', 1);

step('toggleSwitch 去掉图形分支',
`  } else if (id === 'toggleShape') {
    document.querySelector('.circle-balls-wrap').style.display = on ? '' : 'none';
    setShapeAnimation(on);
  }`,
`  }`, 1);

step('initToggles 去掉图形',
`  var tm = document.getElementById('toggleMotto');
  var ts = document.getElementById('toggleShape');
  if (!Store.setting('motto')) { tm.classList.remove('on'); document.getElementById('motto').style.display = 'none'; }
  if (!Store.setting('shape')) { ts.classList.remove('on'); document.querySelector('.circle-balls-wrap').style.display = 'none'; }`,
`  var tm = document.getElementById('toggleMotto');
  if (!Store.setting('motto')) { tm.classList.remove('on'); document.getElementById('motto').style.display = 'none'; }`, 1);

step('resetDefaults 去掉图形',
`  Store.setSetting('motto', true);
  Store.setSetting('shape', false);
  document.getElementById('motto').style.display = '';
  document.querySelector('.circle-balls-wrap').style.display = 'none';
  setShapeAnimation(false);
  var tm = document.getElementById('toggleMotto');
  var ts = document.getElementById('toggleShape');
  if (tm) tm.classList.add('on');
  if (ts) ts.classList.remove('on');`,
`  Store.setSetting('motto', true);
  document.getElementById('motto').style.display = '';
  var tm = document.getElementById('toggleMotto');
  if (tm) tm.classList.add('on');`, 1);

step('启动序列去掉图形初始化',
  `  // 图形：Reuleaux ↔ 圆的形变（随"显示图形"开关启停，避免常驻定时器空转）
  setShapeAnimation(Store.setting('shape'));
`, '', 1);

/* ---------------- 彻底性断言 ---------------- */
const LEFTOVER = ['显示图形', 'toggleShape', 'circle-balls', 'breathSvg', 'breathPath', 'rtSpin',
  'morphGrad', 'SHAPE_REULEAUX', 'SHAPE_CIRCLE', 'setShapeAnimation', '_shapeTimer', '_shapeIsCircle',
  'TOGGLE_SHAPE', "setting('shape')", "setSetting('shape'"];
for (const p of LEFTOVER) {
  const n = txt.split(p).length - 1;
  report.push([n === 0 ? 'OK  ' : 'FAIL', '残留检查: ' + p, n, 0]);
  if (n) failed++;
}

/* ---------------- 写盘 ---------------- */
const w = Math.max(...report.map(r => r[1].length));
console.log('步骤'.padEnd(6) + '结果  命中/期望');
for (const [ok, name, n, exp] of report) console.log(`${ok}  ${name.padEnd(w)}  ${n} / ${exp}`);
console.log(`\n共 ${report.length} 步，失败 ${failed} 步；文件 ${txt.length} 字符`);
if (failed) { console.log('存在未命中步骤，未写盘。'); process.exit(1); }
if (!WRITE) { console.log('干跑通过（未写盘）。加 --write 实际写入。'); process.exit(0); }
fs.writeFileSync(FILE, txt, { encoding: 'utf8' });
console.log('已写入：' + FILE);

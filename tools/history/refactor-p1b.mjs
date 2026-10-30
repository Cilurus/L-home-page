/**
 * P1-b 结构重排（零行为变更，除已注明的"先清后加"视觉等价项）
 * 目标：① 消除 S8 类重复实现（壁纸 5 份 → 1 组函数；书签删除 2 份 → 1 个函数；
 *           选中态反查 7 处 onclick 字符串 → data-* 属性）
 *       ② 统一入口函数补 JSDoc，作为后续阶段的模块雏形
 * 纪律：每步断言命中次数，任一不匹配即中止且不写盘。
 * 用法：node tools/refactor-p1b.mjs [--write]
 */
import fs from 'node:fs';

const FILE = './index - new.html';
const WRITE = process.argv.includes('--write');
let txt = fs.readFileSync(FILE, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);

const report = [];
let failed = 0;
function step(target, name, from, to, expect) {
  const n = target.split(from).length - 1;
  const ok = expect === null ? n >= 1 : n === expect;
  report.push([ok ? 'OK  ' : 'FAIL', name, n, expect === null ? '>=1' : expect]);
  if (!ok) { failed++; return target; }
  return target.split(from).join(to);
}

/* ==========================================================================
 * 一、HTML：给可切换选项加 data-* 语义属性（选中态不再靠解析 onclick 字符串）
 * ======================================================================== */
const WPS = ['orca', 'sky', 'deepspace', 'gray', 'sunshine', 'asteroid', 'vivid', 'rain', 'firefly', 'custom'];
for (const t of WPS) {
  txt = step(txt, `HTML data-wp=${t}（设置面板）`,
    `<div class="wp-opt" onclick="L.applyWallpaper(&#39;${t}&#39;)"`,
    `<div class="wp-opt" data-wp="${t}" onclick="L.applyWallpaper(&#39;${t}&#39;)"`, 1);
  txt = step(txt, `HTML data-wp=${t}（选择器）`,
    `<div class="wp-pick-opt" onclick="L.wpPickApply(&#39;${t}&#39;)"`,
    `<div class="wp-pick-opt" data-wp="${t}" onclick="L.wpPickApply(&#39;${t}&#39;)"`, 1);
}
for (const c of ['white', 'gray', 'black', 'custom']) {
  txt = step(txt, `HTML data-color=${c}`,
    `onclick="L.setFontColor(&#39;${c}&#39;)"`,
    `data-color="${c}" onclick="L.setFontColor(&#39;${c}&#39;)"`, 1);
}

/* ==========================================================================
 * 二、壁纸：5 份重复实现 → 4 个统一入口函数
 * ======================================================================== */
const BG_HELPERS = `/* ------------------------------------------------------------------------
   * §2 领域 + §4 视图 · 壁纸
   * 重构说明：同一套"清旧 bg 类 → 加新类 / 应用自定义图 / 启停粒子特效"的逻辑
   *           此前散在 5 处（applyWallpaper、上传回调、启动 IIFE、resetDefaults、
   *           showWpPicker 的状态反查）。现统一为下面 4 个入口 + 1 个取值函数，
   *           类名表来自 §0 WALLPAPERS：新增壁纸只需在 §0 登记一行。
   * ---------------------------------------------------------------------- */

  /**
   * 读取当前壁纸标识。
   * @returns {string} 预设类型名；存在自定义图且无预设类型时返回 'custom'
   * @sideEffect 只读 localStorage（KEYS.BG / KEYS.BG_TYPE）
   */
  function currentBgType() {
    return localStorage.getItem(KEYS.BG_TYPE) || (localStorage.getItem(KEYS.BG) ? 'custom' : DEFAULTS.bgType);
  }

  /**
   * 清空 #bg 上全部预设壁纸类与内联背景，返回该元素。
   * @returns {HTMLElement}
   * @sideEffect 改 DOM
   */
  function bgClear() {
    var bg = document.getElementById('bg');
    BG_CLASSES.forEach(function (c) { bg.classList.remove(c); });
    bg.style.background = ''; bg.style.backgroundSize = ''; bg.style.animation = '';
    return bg;
  }

  /**
   * 应用预设壁纸（不处理自定义图，也不启停特效）。
   * @param {string} type §0 WALLPAPERS 的键
   * @returns {string} 实际生效的类型；未知类型返回 ''
   * @sideEffect 改 DOM
   */
  function bgApplyType(type) {
    var w = WALLPAPERS[type];
    var bg = bgClear();
    if (!w) return '';
    bg.classList.add(w.cls);
    return type;
  }

  /**
   * 应用自定义图片壁纸。
   * @param {string} url dataURL 或图片地址
   * @sideEffect 改 DOM（写内联 background）
   */
  function bgApplyImage(url) {
    var bg = bgClear();
    bg.style.background = 'url(' + url + ') center/cover no-repeat';
    bg.style.animation = 'none';
  }

  /**
   * 按壁纸类型启停粒子特效（雨滴 / 萤火；其余类型一律停止）。
   * @param {string} type
   * @sideEffect 启停 rAF 循环
   */
  function bgRunEffect(type) {
    if (type === 'rain') { stopFirefly(); startRain(); }
    else if (type === 'firefly') { stopRain(); startFirefly(); }
    else { stopRain(); stopFirefly(); }
  }

  `;

txt = step(txt, 'applyWallpaper 重写为统一入口',
`function applyWallpaper(type) {
  if (type === 'custom') { document.getElementById('wallpaperInput').click(); return; }
  var EFFECTS = { rain:{enter:function(){stopFirefly();startRain()},exit:stopRain}, firefly:{enter:function(){stopRain();startFirefly()},exit:stopFirefly} };
  if (type !== 'rain' && type !== 'firefly') { stopRain(); stopFirefly(); }
  const bg = document.getElementById('bg');
  bg.classList.remove('bg-vivid','bg-orca','bg-gray','bg-deepspace','bg-sky','bg-sunshine','bg-asteroid','bg-rain','bg-firefly');
  bg.style.background = ''; bg.style.backgroundSize = ''; bg.style.animation = '';
  bg.classList.add('bg-'+type);
  localStorage.setItem(KEYS.BG, '');
  localStorage.setItem(KEYS.BG_TYPE, type);
  var fx = EFFECTS[type];
  if (fx) fx.enter();
  refreshWallpaperOpts();
  showToast('壁纸已更换');
}
function refreshWallpaperOpts() {
  var t = localStorage.getItem(KEYS.BG_TYPE) || (localStorage.getItem(KEYS.BG) ? 'custom' : 'orca');
  document.querySelectorAll('.wp-opt, .wp-pick-opt').forEach(function(o) {
    o.classList.remove('active');
    if (o.getAttribute('onclick').includes("'"+t+"'")) o.classList.add('active');
  });
  markPopupChange();
}`,
BG_HELPERS +
`/**
 * 切换壁纸（预设或自定义图片）。
 * @param {string} type 'custom' 或 §0 WALLPAPERS 的键
 * @sideEffect 写存储（KEYS.BG / KEYS.BG_TYPE）；改 DOM；可能启停粒子；弹 toast
 */
function applyWallpaper(type) {
  if (type === 'custom') { document.getElementById('wallpaperInput').click(); return; }
  bgApplyType(type);
  localStorage.setItem(KEYS.BG, '');
  localStorage.setItem(KEYS.BG_TYPE, type);
  bgRunEffect(type);
  refreshWallpaperOpts();
  showToast('壁纸已更换');
}

/**
 * 同步壁纸选项的选中态。
 * 说明：选中依据是 HTML 上的 data-wp 属性；重构前靠解析 onclick 字符串，
 *       改一次文案就会静默失效。
 * @sideEffect 改 DOM；触发 markPopupChange
 */
function refreshWallpaperOpts() {
  var t = currentBgType();
  document.querySelectorAll('.wp-opt, .wp-pick-opt').forEach(function (o) {
    o.classList.toggle('active', o.dataset.wp === t);
  });
  markPopupChange();
}`, 1);

txt = step(txt, '上传自定义壁纸走统一入口',
  `  r.onload = ev => { const url = ev.target.result; localStorage.setItem(KEYS.BG, url); localStorage.setItem(KEYS.BG_TYPE, ''); const bg = document.getElementById('bg'); bg.classList.remove('bg-vivid','bg-orca','bg-gray','bg-deepspace','bg-sky','bg-sunshine','bg-asteroid','bg-rain','bg-firefly'); bg.style.background = 'url(' + url + ') center/cover no-repeat'; bg.style.animation = 'none'; showToast('✓ 壁纸已更换'); };`,
  `  r.onload = ev => { const url = ev.target.result; localStorage.setItem(KEYS.BG, url); localStorage.setItem(KEYS.BG_TYPE, ''); bgApplyImage(url); showToast('✓ 壁纸已更换'); };`, 1);

txt = step(txt, '启动恢复壁纸走统一入口',
  `(function() { const s = localStorage.getItem(KEYS.BG); const t = localStorage.getItem(KEYS.BG_TYPE); const b = document.getElementById('bg'); if (s && !t) { b.style.background = 'url('+s+') center/cover no-repeat'; b.style.animation = 'none'; return; } var M={vivid:'bg-vivid',gray:'bg-gray',orca:'bg-orca',deepspace:'bg-deepspace',sky:'bg-sky',sunshine:'bg-sunshine',asteroid:'bg-asteroid',rain:'bg-rain',firefly:'bg-firefly'},cls=M[t]; if(cls){b.classList.add(cls);if(t==='rain'||t==='firefly'){setTimeout(function(){if(t==='rain')startRain();else startFirefly()},100)}} })();`,
`/**
 * §5 启动：按存档恢复壁纸。
 * 注：此处由"直接叠加类"改为"先清后加"，视觉结果一致（旧写法会同时留下
 *     #bg 的初始类 bg-orca，属历史遗留）。
 * @sideEffect 改 DOM；可能延迟启动粒子
 */
(function initBackground() {
  var saved = localStorage.getItem(KEYS.BG), type = localStorage.getItem(KEYS.BG_TYPE);
  if (saved && !type) { bgApplyImage(saved); return; }
  var t = type || DEFAULTS.bgType;
  bgApplyType(t);
  if (t === 'rain' || t === 'firefly') setTimeout(function () { bgRunEffect(t); }, 100);
})();`, 1);

txt = step(txt, 'resetDefaults 背景段走统一入口',
`  // 壁纸: orca
  stopRain(); stopFirefly();
  var bg = document.getElementById('bg');
  bg.classList.remove('bg-vivid','bg-orca','bg-gray','bg-deepspace','bg-sky','bg-sunshine','bg-asteroid','bg-rain','bg-firefly');
  bg.style.background = '';
  bg.style.backgroundSize = '';
  bg.style.animation = '';
  bg.classList.add('bg-orca');
  localStorage.setItem(KEYS.BG, '');
  localStorage.setItem(KEYS.BG_TYPE, 'orca');`,
`  // 壁纸: 恢复默认（§0 DEFAULTS.bgType）
  stopRain(); stopFirefly();
  bgApplyType(DEFAULTS.bgType);
  localStorage.setItem(KEYS.BG, '');
  localStorage.setItem(KEYS.BG_TYPE, DEFAULTS.bgType);`, 1);

txt = step(txt, 'showWpPicker 选中态改 data-wp',
`  var t = localStorage.getItem(KEYS.BG_TYPE) || (localStorage.getItem(KEYS.BG) ? 'custom' : 'orca');
  for (var j = 0; j < opts.length; j++) {
    opts[j].classList.remove('active');
    if (opts[j].getAttribute('onclick').includes("'"+t+"'")) opts[j].classList.add('active');
  }`,
`  var t = currentBgType();
  for (var j = 0; j < opts.length; j++) {
    opts[j].classList.toggle('active', opts[j].dataset.wp === t);
  }`, 1);

txt = step(txt, '启动时同步壁纸选中态改 data-wp',
  `(function(){var t=localStorage.getItem(KEYS.BG_TYPE)||(localStorage.getItem(KEYS.BG)?'custom':'orca');document.querySelectorAll('.wp-opt').forEach(function(o){if(o.getAttribute('onclick').includes("'"+t+"'"))o.classList.add('active')})})();`,
  `(function(){var t=currentBgType();document.querySelectorAll('.wp-opt').forEach(function(o){if(o.dataset.wp===t)o.classList.add('active')})})();`, 1);

/* ==========================================================================
 * 三、文字颜色：4 处选中态反查 → 1 个函数
 * ======================================================================== */
txt = step(txt, 'refreshColorOpts 重写 + markActiveColor',
`function refreshColorOpts() {
  var m = localStorage.getItem(KEYS.FONT) || 'black';
  document.querySelectorAll('.color-opt').forEach(function(o) {
    o.classList.remove('active');
    if (o.getAttribute('onclick').includes("L.setFontColor('"+m+"')")) o.classList.add('active');
  });
  markPopupChange();
}`,
`/**
 * 同步文字颜色选项的选中态。
 * 说明：选中依据是 HTML 上的 data-color 属性，不再解析 onclick 字符串。
 * @param {string} m 'white' | 'gray' | 'black' | 'custom'
 * @sideEffect 改 DOM
 */
function markActiveColor(m) {
  document.querySelectorAll('.color-opt').forEach(function (o) {
    o.classList.toggle('active', o.dataset.color === m);
  });
}

/**
 * 按存储值刷新颜色选中态。
 * @sideEffect 改 DOM；触发 markPopupChange
 */
function refreshColorOpts() {
  markActiveColor(localStorage.getItem(KEYS.FONT) || DEFAULTS.font);
  markPopupChange();
}`, 1);

txt = step(txt, 'setFontColor 选中态',
  `  document.querySelectorAll('.color-opt').forEach(function(o){ o.classList.remove('active'); if(o.getAttribute('onclick').includes("L.setFontColor('"+m+"')")) o.classList.add('active'); });`,
  `  markActiveColor(m);`, 1);

txt = step(txt, 'initCustomColor 选中态',
  `    document.querySelectorAll('.color-opt').forEach(function(o){ o.classList.remove('active'); if(o.getAttribute('onclick').includes("L.setFontColor('custom')")) o.classList.add('active'); });`,
  `    markActiveColor('custom');`, 1);

txt = step(txt, '启动时同步颜色选中态',
  `(function(){var m=localStorage.getItem(KEYS.FONT)||'black';if(m==='gray'){document.documentElement.classList.add('gray-text')}else if(m==='black'){document.documentElement.classList.add('black-text')};document.querySelectorAll('.color-opt').forEach(function(o){if(o.getAttribute('onclick').includes("L.setFontColor('"+(m||'black')+"')"))o.classList.add('active')})})();`,
  `(function(){var m=localStorage.getItem(KEYS.FONT)||DEFAULTS.font;if(m==='gray'){document.documentElement.classList.add('gray-text')}else if(m==='black'){document.documentElement.classList.add('black-text')};markActiveColor(m)})();`, 1);

/* ==========================================================================
 * 四、收藏删除：2 份重复 → 1 个函数
 * ======================================================================== */
txt = step(txt, 'deleteBookmark 抽 removeBookmarkAt',
`function deleteBookmark() {
  if (bmEditIdx < 0) return;
  const bms = getBookmarks();
  if (isCompact()) {
    for (let j = bmEditIdx; j < BM_TOTAL - 1; j++) bms[j] = bms[j + 1];
    bms[BM_TOTAL - 1] = null;
  } else {
    bms[bmEditIdx] = null;
  }
  saveBookmarks(bms);
  closeBmPopup();
  showToast('✓ 已删除');
}`,
`/**
 * 按槽位删除收藏；是否压缩（自动补位）取决于 §1 的收藏偏好。
 * @param {number} idx 槽位下标
 * @sideEffect 写存储（KEYS.BOOKMARKS）
 */
function removeBookmarkAt(idx) {
  const bms = getBookmarks();
  if (isCompact()) {
    for (let j = idx; j < BM_TOTAL - 1; j++) bms[j] = bms[j + 1];
    bms[BM_TOTAL - 1] = null;
  } else {
    bms[idx] = null;
  }
  saveBookmarks(bms);
}

/**
 * 删除"编辑中"的收藏（弹窗流程）。
 * @sideEffect 写存储；关弹窗；重开书签栏；弹 toast
 */
function deleteBookmark() {
  if (bmEditIdx < 0) return;
  removeBookmarkAt(bmEditIdx);
  closeBmPopup();
  showToast('✓ 已删除');
}`, 1);

txt = step(txt, 'bmListDelete 复用 removeBookmarkAt',
`function bmListDelete(idx) {
  if (idx < 0) return;
  const bms = getBookmarks();
  if (isCompact()) {
    for (var j = idx; j < BM_TOTAL - 1; j++) bms[j] = bms[j + 1];
    bms[BM_TOTAL - 1] = null;
  } else {
    bms[idx] = null;
  }
  saveBookmarks(bms);
  renderBmList();
  showToast('\\u2713 已删除');
}`,
`/**
 * 删除收藏（管理列表流程）。
 * @param {number} idx 槽位下标
 * @sideEffect 写存储；重渲染列表；弹 toast
 */
function bmListDelete(idx) {
  if (idx < 0) return;
  removeBookmarkAt(idx);
  renderBmList();
  showToast('\\u2713 已删除');
}`, 1);

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

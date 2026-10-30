/**
 * 功能二则：
 *  A. 模糊程度独立可调：把原先"模糊跟透明度绑死"的隐藏耦合拆开，新增「模糊程度」滑块
 *     （0~100%，统一作用于所有玻璃表面；默认 90% ≈ 保持现有观感）
 *  B. 收藏管理支持拖动排序：新增 Domain.Bookmarks.move()（纯函数）+ 列表拖放交互
 * 用法：node tools/feat-blur-and-drag.mjs [--write]
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
 * A. 模糊程度独立可调
 * ======================================================================== */

/* A1. 存储键 */
step('KEYS 增加 BLUR',
  "    OPACITY: 'mc_opacity',",
  "    OPACITY: 'mc_opacity',\n    BLUR: 'mc_blur',            // 玻璃模糊程度（0~100）", 1);

/* A2. 设置注册表 */
step('SETTINGS 增加 blur',
  "    opacity:     { key: KEYS.OPACITY,        type: 'int',  def: 2,        label: '透明卡片' },",
  "    opacity:     { key: KEYS.OPACITY,        type: 'int',  def: 2,        label: '透明卡片' },\n    blur:        { key: KEYS.BLUR,           type: 'int',  def: 90,       label: '模糊程度' },", 1);

/* A3. 默认值 */
step('DEFAULTS 增加 blur',
  '    opacity: 2,',
  '    opacity: 2,\n    blur: 90,', 1);

/* A4. 解耦：透明度滑块不再改模糊 */
step('setCardOpacity 解耦模糊',
` * @sideEffect 写 localStorage（KEYS.OPACITY）；改 CSS 变量 --card-alpha / --card-blur-mul；移动数值标签
 */
function setCardOpacity(v) {
  Store.setSetting('opacity', v);
  var solid = (v - 1) / 9;
  var alpha = (0.03 + solid * 0.87).toFixed(3);
  var blurMul = (1 - solid).toFixed(3);
  document.documentElement.style.setProperty('--card-alpha', alpha);
  document.documentElement.style.setProperty('--card-blur-mul', blurMul);
  var s = document.getElementById('opacitySlider');
  var fill = ((v-1)/9*100)+'%';
  s.style.background = 'linear-gradient(to right, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) ' + fill + ', rgba(255,255,255,0.08) ' + fill + ', rgba(255,255,255,0.08) 100%)';
  var valEl = document.getElementById('sliderVal');
  valEl.textContent = v;
  var pct = (v - 1) / 9;
  var sw = s.offsetWidth;
  if (sw > 0) valEl.style.left = (pct * (sw - 20)) + 'px';
}`,
` * @sideEffect 写 localStorage（KEYS.OPACITY）；改 CSS 变量 --card-alpha；移动数值标签
 * 说明：模糊程度自 V2.1.0 起由独立的 setCardBlur() 控制，不再与透明度联动。
 */
function setCardOpacity(v) {
  Store.setSetting('opacity', v);
  var solid = (v - 1) / 9;
  var alpha = (0.03 + solid * 0.87).toFixed(3);
  document.documentElement.style.setProperty('--card-alpha', alpha);
  var s = document.getElementById('opacitySlider');
  if (s) {
    var fill = ((v - 1) / 9 * 100) + '%';
    s.style.background = 'linear-gradient(to right, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) ' + fill + ', rgba(255,255,255,0.08) ' + fill + ', rgba(255,255,255,0.08) 100%)';
  }
  var valEl = document.getElementById('opacityVal');
  if (valEl) {
    valEl.textContent = v;
    var sw = s ? s.offsetWidth : 0;
    if (sw > 0) valEl.style.left = ((v - 1) / 9 * (sw - 20)) + 'px';
  }
}

/**
 * 设置玻璃模糊程度（0~100，统一作用于所有玻璃表面）。
 * @param {number|string} v 0 = 完全清晰，100 = 设计满值
 * @sideEffect 写 localStorage（KEYS.BLUR）；改 CSS 变量 --card-blur-mul；移动数值标签
 */
function setCardBlur(v) {
  Store.setSetting('blur', v);
  document.documentElement.style.setProperty('--card-blur-mul', (v / 100).toFixed(2));
  var s = document.getElementById('blurSlider');
  if (s) {
    var fill = v + '%';
    s.style.background = 'linear-gradient(to right, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) ' + fill + ', rgba(255,255,255,0.08) ' + fill + ', rgba(255,255,255,0.08) 100%)';
  }
  var valEl = document.getElementById('blurVal');
  if (valEl) {
    valEl.textContent = v + '%';
    var sw = s ? s.offsetWidth : 0;
    if (sw > 0) valEl.style.left = ((v / 100) * (sw - 20)) + 'px';
  }
}`, 1);

/* A5. 启动时同时应用两个滑块 */
step('启动应用两个滑块',
`(function(){
  var v = String(Store.setting('opacity'));
  var s = document.getElementById('opacitySlider');
  if (!s) return;
  s.value = v;
  setCardOpacity(v);
  window.addEventListener('resize', function(){ setCardOpacity(s.value); });
})();`,
`(function initCardEffects(){
  var s = document.getElementById('opacitySlider');
  if (s) {
    s.value = String(Store.setting('opacity'));
    setCardOpacity(s.value);
    window.addEventListener('resize', function(){ setCardOpacity(s.value); });
  }
  var b = document.getElementById('blurSlider');
  if (b) {
    b.value = String(Store.setting('blur'));
    setCardBlur(b.value);
    window.addEventListener('resize', function(){ setCardBlur(b.value); });
  }
})();`, 1);

/* A6. 恢复默认 */
step('resetDefaults 重置模糊',
`  // 透明卡片度: 2
  Store.setSetting('opacity', DEFAULTS.opacity);
  var s = document.getElementById('opacitySlider');
  if (s) { s.value = '2'; setCardOpacity('2'); }`,
`  // 透明卡片度: 2
  Store.setSetting('opacity', DEFAULTS.opacity);
  var s = document.getElementById('opacitySlider');
  if (s) { s.value = String(DEFAULTS.opacity); setCardOpacity(DEFAULTS.opacity); }
  // 模糊程度: 90%
  Store.setSetting('blur', DEFAULTS.blur);
  var bs = document.getElementById('blurSlider');
  if (bs) { bs.value = String(DEFAULTS.blur); setCardBlur(DEFAULTS.blur); }`, 1);

/* A7. CSS：滑块容器类名中性化 */
step('CSS .opacity-item → .slider-item',
  '.settings-popup .opacity-item', '.settings-popup .slider-item', 4);

/* A8. CSS：两个滑块共用样式 */
step('CSS 滑块选择器并入 blurSlider',
  '#opacitySlider {', '#opacitySlider, #blurSlider {', 1);
step('CSS webkit thumb 并入',
  '#opacitySlider::-webkit-slider-thumb {', '#opacitySlider::-webkit-slider-thumb, #blurSlider::-webkit-slider-thumb {', 1);
step('CSS moz thumb 并入',
  '#opacitySlider::-moz-range-thumb {', '#opacitySlider::-moz-range-thumb, #blurSlider::-moz-range-thumb {', 1);

/* A9. CSS：数值标签改为类名 + 提升可读性 */
step('CSS #sliderVal → .slider-val（并修可读性）',
`  #sliderVal {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;
    font-size: 10px; font-weight: 700; color: rgba(0,0,0,0.55);
    width: 20px; text-align: center; line-height: 1;
  }`,
`  .slider-val {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;
    font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.9);
    text-shadow: 0 0 3px rgba(0,0,0,0.65);
    width: 30px; text-align: center; line-height: 1;
  }`, 1);

/* A10. CSS :root 里给模糊倍率一个初值（避免首帧满模糊） */
step('CSS :root 增加 --card-blur-mul 初值',
  '    --glass-sat-strong: 1.4;',
  '    --glass-sat-strong: 1.4;\n    --card-blur-mul: 0.9;   /* 玻璃模糊倍率，由「模糊程度」滑块（0~100%）驱动 */', 1);

/* A11. HTML：透明度标签 + 新增模糊滑块项 */
step('HTML 透明度数值标签',
  '<input type="range" id="opacitySlider" min="1" max="10" value="2" step="1" data-input="setCardOpacity" data-value-arg="1"><div id="sliderVal">10</div>',
  '<input type="range" id="opacitySlider" min="1" max="10" value="2" step="1" data-input="setCardOpacity" data-value-arg="1"><div class="slider-val" id="opacityVal">2</div>', 1);

step('HTML 新增模糊程度项',
  '<div class="item color-item">',
  `<div class="item slider-item"><div class="opacity-top"><span class="icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/></svg></span> 模糊程度</div><div class="opacity-expand"><div class="slider-wrap"><div class="slider-dots"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div><input type="range" id="blurSlider" min="0" max="100" value="90" step="5" data-input="setCardBlur" data-value-arg="1"><div class="slider-val" id="blurVal">90%</div></div></div></div><div class="item color-item">`, 1);

/* A12. 透明度项的类名同步 */
step('HTML 透明度项类名',
  '<div class="item opacity-item">', '<div class="item slider-item">', 1);

/* A13. 对外接口 */
step('window.L 增加 setCardBlur',
  '    setCardOpacity: setCardOpacity,',
  '    setCardOpacity: setCardOpacity,\n    setCardBlur: setCardBlur,', 1);

/* ==========================================================================
 * B. 收藏管理拖动排序
 * ======================================================================== */

/* B1. 领域层：纯函数 move */
step('Domain.Bookmarks.move',
`      /**
       * 第一个空槽下标。
       * @param {Array} slots
       * @returns {number} 没有空位时返回 -1
       */
      nextFree: function (slots) {`,
`      /**
       * 在"已占用槽位"之间移动收藏：物理槽位不变，只移动内容。
       * 这样"自动补位"与"维持原状"两种偏好下都成立。
       * @param {Array} slots 定长槽位数组
       * @param {number} from 源槽位下标
       * @param {number} to 目标槽位下标
       * @returns {boolean} 是否真的发生了移动（下标相同或无效时为 false）
       */
      move: function (slots, from, to) {
        if (from === to) return false;
        var order = [];
        for (var i = 0; i < slots.length; i++) { if (slots[i]) order.push(i); }
        var p = order.indexOf(from), q = order.indexOf(to);
        if (p < 0 || q < 0) return false;
        var items = order.map(function (k) { return slots[k]; });
        items.splice(q, 0, items.splice(p, 1)[0]);
        for (var j = 0; j < order.length; j++) slots[order[j]] = items[j];
        return true;
      },

      /**
       * 第一个空槽下标。
       * @param {Array} slots
       * @returns {number} 没有空位时返回 -1
       */
      nextFree: function (slots) {`, 1);

/* B2. 视图：拖动状态变量与动作 */
step('新增拖动状态与 bmListMove',
`let bmEditIdx = -1;
var _bmFromList = false;
var _bmCurrentIcon = '';`,
`let bmEditIdx = -1;
var _bmFromList = false;
var _bmCurrentIcon = '';
/** 收藏管理列表中正在拖动的槽位下标（-1 = 没有拖动） */
var _bmDragIdx = -1;

/**
 * 把收藏从 from 槽位移到 to 槽位（仅改变顺序，不改变占用情况）。
 * @param {number} from
 * @param {number} to
 * @sideEffect 写 localStorage（KEYS.BOOKMARKS）；重渲染列表；弹 toast
 */
function bmListMove(from, to) {
  var slots = getBookmarks();
  if (!Domain.Bookmarks.move(slots, from, to)) return;
  saveBookmarks(slots);
  renderBmList();
  showToast('✓ 已调整顺序');
}`, 1);

/* B3. 视图：列表项可拖动 */
step('renderBmList 支持拖动排序',
`    const item = document.createElement('div'); item.className = 'bm-list-item';
    const ic = createBookmarkIcon(bms[idx], 'bm-li-icon');
    const nm = document.createElement('span'); nm.className = 'bm-li-name'; nm.textContent = bms[idx].name;
    const del = document.createElement('button'); del.className = 'bm-li-del'; del.textContent = '\\u2715';
    del.addEventListener('click', function(e) { e.stopPropagation(); bmListDelete(idx); });
    item.appendChild(ic); item.appendChild(nm); item.appendChild(del);
    item.addEventListener('click', function() { bmListEdit(idx); });
    item.addEventListener('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); bmListEdit(idx); });
    wrap.appendChild(item);`,
`    const item = document.createElement('div'); item.className = 'bm-list-item';
    item.draggable = true;
    item.dataset.idx = idx;
    const ic = createBookmarkIcon(bms[idx], 'bm-li-icon');
    const nm = document.createElement('span'); nm.className = 'bm-li-name'; nm.textContent = bms[idx].name;
    const del = document.createElement('button'); del.className = 'bm-li-del'; del.textContent = '\\u2715';
    del.draggable = false;
    del.addEventListener('mousedown', function(e) { e.stopPropagation(); });   // 拖动手柄不落在删除键上
    del.addEventListener('click', function(e) { e.stopPropagation(); bmListDelete(idx); });
    item.appendChild(ic); item.appendChild(nm); item.appendChild(del);
    item.addEventListener('click', function() { if (_bmDragIdx < 0) bmListEdit(idx); });
    item.addEventListener('contextmenu', function(e) { e.preventDefault(); e.stopPropagation(); bmListEdit(idx); });
    /* —— 拖动排序：拖到谁的槽位就插到谁那里 —— */
    item.addEventListener('dragstart', function(e) {
      _bmDragIdx = idx;
      item.classList.add('dragging');
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (err) {} }
    });
    item.addEventListener('dragend', function() {
      item.classList.remove('dragging');
      var t = wrap.querySelector('.drag-target');
      if (t) t.classList.remove('drag-target');
      _bmDragIdx = -1;
    });
    item.addEventListener('dragover', function(e) {
      if (_bmDragIdx < 0 || _bmDragIdx === idx) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
      item.classList.add('drag-target');
    });
    item.addEventListener('dragleave', function() { item.classList.remove('drag-target'); });
    item.addEventListener('drop', function(e) {
      e.preventDefault();
      e.stopPropagation();
      item.classList.remove('drag-target');
      var from = _bmDragIdx;
      _bmDragIdx = -1;
      if (from >= 0) bmListMove(from, idx);
    });
    wrap.appendChild(item);`, 1);

/* B4. CSS：拖动反馈 */
step('CSS 拖动样式',
`  .bm-list-item + .bm-list-item { border-top: 1px solid rgba(255,255,255,0.03); }`,
`  .bm-list-item + .bm-list-item { border-top: 1px solid rgba(255,255,255,0.03); }
  .bm-list-item { cursor: grab; }
  .bm-list-item.dragging { opacity: 0.45; cursor: grabbing; }
  .bm-list-item.drag-target { background: rgba(255,255,255,0.1); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.22); }
  .bm-list-hint { font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.3); margin-left: 6px; }`, 1);

/* B5. 标题提示 */
step('收藏管理标题加拖动提示',
  '<div class="title">收藏管理</div>',
  '<div class="title">收藏管理<span class="bm-list-hint">拖动可排序</span></div>', 1);

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

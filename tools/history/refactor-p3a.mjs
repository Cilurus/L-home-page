/**
 * P3-a  浮层管理器 PopupManager
 *  · 新增 §4 PopupManager：登记 / open / close / toggle / closeTop / closeGroup /
 *    closeAll / 外部点击 / Esc / 订阅
 *  · 全部浮层的显隐改由管理器统一切换，删除 4 处各自的文档级监听与手写关闭逻辑
 *  · Esc 改为"关最上层"（重构前只关书签栏）
 *  · 层级：API 保留 z 能力但本轮不启用（现有 CSS 手填 20/40/41/200/250/300/999，
 *    在 CSS 阶段（P5）统一阶梯后再接管，避免与 CSS 打架）
 * 用法：node tools/refactor-p3a.mjs [--write]
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
 * 1. 插入 PopupManager + 登记表
 * ======================================================================== */
const MANAGER = `  /* ==========================================================================
   * §4  视图层 · PopupManager（浮层管理器）
   * --------------------------------------------------------------------------
   * 职责：统一管理全部浮层的"打开 / 关闭 / 切换 / 顺序"。
   *   · 每个浮层在下面的登记表里声明一次，并写明"点到哪些区域不该关自己"
   *   · 外部点击 → handleOutsideClick()：一次点击关闭所有规则允许关闭的浮层
   *     （结果与重构前各弹窗独立判断一致，但逻辑只剩一处）
   *   · Esc → handleKeydown()：只关最上层（重构前只关书签栏，设置/API 弹窗关不掉）
   *   · 打开顺序即层级顺序；z 能力已预留，P5 统一 CSS 阶梯后再接管
   * 约定：新增浮层 = 登记表加一行；关闭逻辑不必再写。
   * ======================================================================== */
  const PopupManager = (function () {
    const entries = {};   // id -> 登记项
    const order = [];     // 打开顺序（栈底 → 栈顶）
    const listeners = [];

    /**
     * 登记一个浮层。
     * @param {string} id 元素 id
     * @param {object} [opts]
     * @param {string[]} [opts.triggers] 命中这些选择器的点击不关闭自己（触发按钮等）
     * @param {boolean} [opts.pointerGuard] mousedown 落在自己内部时也不关闭（防误关）
     * @param {string} [opts.showClass] 显示类名，默认 'show'
     * @param {string} [opts.group] 分组，供 closeGroup() 使用
     * @param {number|null} [opts.z] 基础层级（null = 不接管，沿用 CSS）
     * @param {boolean} [opts.countsAsPopup] 是否计入"有浮层打开"（影响极简模式暂停）
     * @param {boolean} [opts.external] 显隐由既有代码控制，管理器只跟踪顺序（如 morph 面板）
     * @param {()=>boolean} [opts.isOpenFn] external 项的打开判定
     * @param {()=>void} [opts.onClose] 关闭后的回调
     */
    function register(id, opts) {
      const o = opts || {};
      entries[id] = {
        id: id,
        showClass: o.showClass || 'show',
        triggers: o.triggers || [],
        pointerGuard: !!o.pointerGuard,
        group: o.group || 'misc',
        z: (o.z === undefined ? null : o.z),
        countsAsPopup: o.countsAsPopup !== false,
        external: !!o.external,
        isOpenFn: o.isOpenFn || null,
        onClose: o.onClose || null,
        _el: null
      };
      return entries[id];
    }

    /** 惰性取元素：脚本在 <body> 中段执行，文件末尾的浮层元素此刻还不存在 */
    function nodeOf(e) {
      if (!e._el) e._el = document.getElementById(e.id);
      return e._el;
    }

    /**
     * 浮层是否打开。
     * @param {string} id
     * @returns {boolean}
     */
    function isOpen(id) {
      const e = entries[id];
      if (!e) return false;
      if (e.external) return !!(e.isOpenFn && e.isOpenFn());
      const n = nodeOf(e);
      return !!(n && n.classList.contains(e.showClass));
    }

    /** @returns {string[]} 当前打开的浮层，自栈底到栈顶 */
    function stack() { return order.filter(isOpen); }

    function notify() { listeners.forEach(function (fn) { try { fn(); } catch (err) {} }); }
    function push(id) { const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); order.push(id); }
    function pull(id) { const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); }

    /** 按栈序重算层级（仅对登记了 z 的浮层生效） */
    function applyZ() {
      stack().forEach(function (id, i) {
        const e = entries[id];
        if (e.z === null) return;
        const n = nodeOf(e);
        if (n) n.style.zIndex = String(e.z + i * 5);
      });
    }

    /**
     * 打开浮层。
     * @param {string} id
     * @sideEffect 加显示类、刷新层级、通知订阅者（重复调用无副作用）
     */
    function open(id) {
      const e = entries[id];
      if (!e) return;
      // external 项（如 morph 面板）的显隐由既有代码负责，这里只补记顺序
      if (e.external) { push(id); applyZ(); notify(); return; }
      if (isOpen(id)) return;
      push(id);
      const n = nodeOf(e);
      if (n) n.classList.add(e.showClass);
      applyZ();
      notify();
    }

    /**
     * 关闭浮层并触发 onClose。
     * @param {string} id
     * @sideEffect 移除显示类、刷新层级、回调、通知订阅者
     */
    function close(id) {
      const e = entries[id];
      if (!e || !isOpen(id)) return;
      pull(id);
      if (!e.external) { const n = nodeOf(e); if (n) n.classList.remove(e.showClass); }
      applyZ();
      if (e.onClose) e.onClose();
      notify();
    }

    /**
     * 只从栈里摘除，不触发 onClose。
     * 供 external 项自己收尾时调用，避免 closeMorph → onClose → closeMorph 递归。
     * @param {string} id
     */
    function markClosed(id) { pull(id); applyZ(); notify(); }

    /** @param {string} id */
    function toggle(id) { isOpen(id) ? close(id) : open(id); }

    /**
     * 关闭最上层浮层。
     * @returns {boolean} 是否关掉了东西
     */
    function closeTop() { const s = stack(); if (!s.length) return false; close(s[s.length - 1]); return true; }

    /**
     * 按分组关闭。closeAllPopups() 用的是 'form' 组，语义与重构前的
     * "document.querySelectorAll('.popup.show')" 完全一致。
     * @param {string} group
     */
    function closeGroup(group) { stack().slice().forEach(function (id) { if (entries[id].group === group) close(id); }); }

    /**
     * 全部关闭。
     * @param {boolean} [includeExternal] 是否包含 external 项（默认不含，与重构前一致）
     */
    function closeAll(includeExternal) {
      stack().slice().forEach(function (id) {
        if (!includeExternal && entries[id].external) return;
        close(id);
      });
    }

    /**
     * 外部点击：一次点击关闭所有"规则允许关闭"的浮层。
     * @param {MouseEvent} e
     * @param {EventTarget|null} ptrDown mousedown 目标，用于避免"按下在弹窗内、松开在外"的误关
     * @sideEffect 可能关闭若干浮层
     */
    function handleOutsideClick(e, ptrDown) {
      stack().slice().forEach(function (id) {
        const en = entries[id];
        if (en.external) return;
        const t = e.target;
        if (t && t.closest && t.closest('#' + id)) return;
        if (en.pointerGuard && ptrDown && ptrDown.closest && ptrDown.closest('#' + id)) return;
        if (en.triggers.some(function (sel) { return t && t.closest && t.closest(sel); })) return;
        close(id);
      });
    }

    /**
     * Esc：关最上层。
     * @param {KeyboardEvent} e
     * @returns {boolean} 是否消费了该按键
     */
    function handleKeydown(e) {
      if (e.key !== 'Escape') return false;
      return closeTop();
    }

    /**
     * 订阅浮层状态变化。
     * @param {()=>void} fn
     * @returns {()=>void} 取消订阅
     */
    function subscribe(fn) { listeners.push(fn); return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; }

    /** @returns {boolean} 是否存在"计入浮层"的打开项 */
    function anyOpen() { return stack().some(function (id) { return entries[id].countsAsPopup; }); }

    return {
      register: register, open: open, close: close, toggle: toggle, markClosed: markClosed,
      closeTop: closeTop, closeGroup: closeGroup, closeAll: closeAll,
      isOpen: isOpen, stack: stack, anyOpen: anyOpen,
      handleOutsideClick: handleOutsideClick, handleKeydown: handleKeydown, subscribe: subscribe
    };
  })();

  /* ---------- 浮层登记表（新增浮层只需加一行） ----------
   * triggers：点这些区域不该关自己；pointerGuard：按下在弹窗内也不关；
   * z 一律留空，层级由 P5 的 CSS 阶梯统一接管。 */
  PopupManager.register('settingsPopup',  { group: 'menu', triggers: ['.settings-btn'] });
  PopupManager.register('apiPopup',       { group: 'form', triggers: ['.status-box', '.settings-popup'], pointerGuard: true });
  PopupManager.register('personaPopup',   { group: 'form', triggers: ['.settings-popup'], pointerGuard: true });
  PopupManager.register('profilePopup',   { group: 'form', triggers: ['.avatar-btn'], pointerGuard: true });
  PopupManager.register('mottoPopup',     { group: 'form', triggers: ['.settings-popup'], pointerGuard: true });
  PopupManager.register('bmPopup',        { group: 'form', triggers: ['.bm-slot', '.bm-list-popup'], pointerGuard: true,
                                            onClose: function () { onBmPopupClosed(); } });
  PopupManager.register('bmListPopup',    { group: 'list' });
  PopupManager.register('engineDropdown', { group: 'menu', triggers: ['.engine-btn'] });
  PopupManager.register('lunarPopup',     { group: 'info', triggers: ['.clock'], countsAsPopup: false });
  PopupManager.register('wpPickerOverlay',{ group: 'overlay', triggers: ['.wp-picker'] });
  PopupManager.register('morphPanel',     { group: 'panel', external: true,
                                            isOpenFn: function () { return morphActive; },
                                            onClose: function () { closeMorph(); } });

let _ptrDown = null;`;

step('插入 PopupManager + 登记表', 'let _ptrDown = null;', MANAGER, 1);

/* ==========================================================================
 * 2. 规则 A：6 段独立的关闭判断 → 一处统一处理
 * ======================================================================== */
step('外部点击统一处理',
`document.addEventListener('mousedown', e => { _ptrDown = e.target; });
document.addEventListener('click', e => {
  const sp = document.getElementById('settingsPopup');
  if (sp.classList.contains('show') && !e.target.closest('.settings-popup') && !e.target.closest('.settings-btn')) sp.classList.remove('show'); markPopupChange();
  const ap = document.getElementById('apiPopup');
  if (ap.classList.contains('show') && !e.target.closest('#apiPopup') && !_ptrDown?.closest('#apiPopup') && !e.target.closest('.status-box') && !e.target.closest('.settings-popup')) ap.classList.remove('show'); markPopupChange();
  const pp = document.getElementById('profilePopup');
  if (pp.classList.contains('show') && !e.target.closest('#profilePopup') && !_ptrDown?.closest('#profilePopup') && !e.target.closest('.avatar-btn')) pp.classList.remove('show'); markPopupChange();
  const mp = document.getElementById('mottoPopup');
  if (mp.classList.contains('show') && !e.target.closest('#mottoPopup') && !_ptrDown?.closest('#mottoPopup') && !e.target.closest('.settings-popup')) mp.classList.remove('show'); markPopupChange();
  const pap = document.getElementById('personaPopup');
  if (pap.classList.contains('show') && !e.target.closest('#personaPopup') && !_ptrDown?.closest('#personaPopup') && !e.target.closest('.settings-popup')) pap.classList.remove('show'); markPopupChange();
  const bp = document.getElementById('bmPopup');
  if (bp.classList.contains('show') && !e.target.closest('#bmPopup') && !_ptrDown?.closest('#bmPopup') && !e.target.closest('.bm-slot') && !e.target.closest('.bm-list-popup')) closeBmPopup();
  _ptrDown = null;
});`,
`document.addEventListener('mousedown', e => { _ptrDown = e.target; });
/* 重构前这里有 6 段各自为政的关闭判断、外加 3 处独立的文档级监听；
   现在统一交给 §4 PopupManager（规则表见上面的登记表）。 */
document.addEventListener('click', e => {
  PopupManager.handleOutsideClick(e, _ptrDown);
  _ptrDown = null;
});`, 1);

step('closePopup / closeAllPopups 走管理器',
`function closePopup(id) { document.getElementById(id).classList.remove('show'); markPopupChange(); }
function closeAllPopups() { document.querySelectorAll('.popup.show').forEach(function(p){ p.classList.remove('show'); }); markPopupChange(); }`,
`/**
 * 关闭指定浮层。
 * @param {string} id
 * @sideEffect 改 DOM；由 PopupManager 触发状态刷新
 */
function closePopup(id) { PopupManager.close(id); }

/** 关闭全部表单类浮层（apiPopup / personaPopup / profilePopup / mottoPopup / bmPopup）。 */
function closeAllPopups() { PopupManager.closeGroup('form'); }`, 1);

/* ==========================================================================
 * 3. 设置菜单
 * ======================================================================== */
step('toggleSettings 走管理器',
`function toggleSettings() {
  closeAllPopups();
  var sp = document.getElementById('settingsPopup');
  sp.classList.toggle('show');
  if (sp.classList.contains('show')) {`,
`function toggleSettings() {
  closeAllPopups();
  var sp = document.getElementById('settingsPopup');
  if (!PopupManager.isOpen('settingsPopup')) {`, 1);

step('toggleSettings 打开/关闭分支',
`    // reposition slider value after layout
    setTimeout(function(){ setCardOpacity(document.getElementById('opacitySlider').value); }, 100);
  }
  refreshPrefsOpts();`,
`    // reposition slider value after layout
    setTimeout(function(){ setCardOpacity(document.getElementById('opacitySlider').value); }, 100);
    PopupManager.open('settingsPopup');
  } else {
    PopupManager.close('settingsPopup');
  }
  refreshPrefsOpts();`, 1);

/* ==========================================================================
 * 4. 四个表单浮层：显隐改由管理器
 * ======================================================================== */
step('openApiConfig 走管理器',
`function openApiConfig(fromRight) {
  closeAllPopups();
  document.getElementById('settingsPopup').classList.remove('show'); markPopupChange();
  document.getElementById('apiKeyInput').value = getApiKey();`,
`function openApiConfig(fromRight) {
  closeAllPopups();
  PopupManager.close('settingsPopup');
  document.getElementById('apiKeyInput').value = getApiKey();`, 1);
step('apiPopup 打开',
`    popup.style.left = rect.left + 'px';
  }
  requestAnimationFrame(function(){ popup.classList.add('show'); markPopupChange(); });
}`,
`    popup.style.left = rect.left + 'px';
  }
  requestAnimationFrame(function(){ PopupManager.open('apiPopup'); });
}`, 1);

step('openProfile 走管理器',
`function openProfile() {
  closeAllPopups();
  document.getElementById('settingsPopup').classList.remove('show'); markPopupChange();
  document.getElementById('pName').value = data.profile.name || '';`,
`function openProfile() {
  closeAllPopups();
  PopupManager.close('settingsPopup');
  document.getElementById('pName').value = data.profile.name || '';`, 1);
step('profilePopup 打开',
`  popup.style.left = Math.max(8, rect.right - 280) + 'px';
  requestAnimationFrame(function(){ popup.classList.add('show'); markPopupChange(); });
}
function saveProfile() {`,
`  popup.style.left = Math.max(8, rect.right - 280) + 'px';
  requestAnimationFrame(function(){ PopupManager.open('profilePopup'); });
}
function saveProfile() {`, 1);

step('editMotto 走管理器',
`function editMotto() {
  closeAllPopups();
  document.getElementById('settingsPopup').classList.remove('show'); markPopupChange();
  document.getElementById('mottoInput').value = document.getElementById('motto').textContent;`,
`function editMotto() {
  closeAllPopups();
  PopupManager.close('settingsPopup');
  document.getElementById('mottoInput').value = document.getElementById('motto').textContent;`, 1);
step('mottoPopup 打开',
`  document.getElementById('mottoPopup').style.transformOrigin = 'right top';
  requestAnimationFrame(function(){ popup.classList.add('show'); markPopupChange(); });
}`,
`  document.getElementById('mottoPopup').style.transformOrigin = 'right top';
  requestAnimationFrame(function(){ PopupManager.open('mottoPopup'); });
}`, 1);

step('addPersona 走管理器',
`function addPersona() {
  closeAllPopups();
  document.getElementById('settingsPopup').classList.remove('show'); markPopupChange();
  document.getElementById('paName').value = '';`,
`function addPersona() {
  closeAllPopups();
  PopupManager.close('settingsPopup');
  document.getElementById('paName').value = '';`, 1);
step('personaPopup 打开',
`  popup.style.transform = 'none';
  requestAnimationFrame(function(){ popup.classList.add('show'); markPopupChange(); });
}
function savePersona() {`,
`  popup.style.transform = 'none';
  requestAnimationFrame(function(){ PopupManager.open('personaPopup'); });
}
function savePersona() {`, 1);

/* ==========================================================================
 * 5. 收藏弹窗与列表
 * ======================================================================== */
step('bmPopup 打开',
`  bmResetPage();
  const popup = document.getElementById('bmPopup');
  requestAnimationFrame(function(){ popup.classList.add('show'); markPopupChange(); });
  animateCloseBookmarkBar();`,
`  bmResetPage();
  requestAnimationFrame(function(){ PopupManager.open('bmPopup'); });
  animateCloseBookmarkBar();`, 1);

step('closeBmPopup 拆分（关闭 + 收尾）',
`function closeBmPopup() {
  var popup = document.getElementById('bmPopup');
  if (!popup.classList.contains('show')) return;
  closePopup('bmPopup');
  bmEditIdx = -1;
  _bmCurrentIcon = '';
  updateIconPreview();
  var fromList = _bmFromList;
  _bmFromList = false;
  if (fromList) { renderBmList(); document.getElementById('bmListPopup').classList.add('show'); markPopupChange(); return; }
  _bmSkipBarClose = true;
  showBookmarkBar();
}`,
`/**
 * 关闭收藏编辑浮层（弹窗流程入口）。
 * @sideEffect 由 PopupManager 回调 onBmPopupClosed() 完成收尾
 */
function closeBmPopup() {
  if (!PopupManager.isOpen('bmPopup')) return;
  PopupManager.close('bmPopup');
}

/**
 * bmPopup 关闭后的收尾：复位编辑态、刷新预览，并回到"收藏管理列表"或书签栏。
 * 由登记表的 onClose 调用，因此内部改用 PopupManager.open，避免递归。
 * @sideEffect 改 DOM；可能打开列表或书签栏
 */
function onBmPopupClosed() {
  bmEditIdx = -1;
  _bmCurrentIcon = '';
  updateIconPreview();
  var fromList = _bmFromList;
  _bmFromList = false;
  if (fromList) { renderBmList(); PopupManager.open('bmListPopup'); return; }
  _bmSkipBarClose = true;
  showBookmarkBar();
}`, 1);

step('bmListPopup 走管理器',
`function openBmList() {
  closeBookmarkBar();
  renderBmList();
  document.getElementById('bmListPopup').classList.add('show'); markPopupChange();
}
function closeBmListPopup() {
  document.getElementById('bmListPopup').classList.remove('show'); markPopupChange();
}`,
`function openBmList() {
  closeBookmarkBar();
  renderBmList();
  PopupManager.open('bmListPopup');
}
function closeBmListPopup() { PopupManager.close('bmListPopup'); }`, 1);

/* ==========================================================================
 * 6. 搜索引擎下拉：管理器 + 触发器已覆盖，删除独立监听
 * ======================================================================== */
step('toggleEngine 走管理器',
`function toggleEngine() {
  var dd = document.getElementById('engineDropdown');
  if (dd.classList.contains('show')) { dd.classList.remove('show'); markPopupChange(); return; }`,
`function toggleEngine() {
  var dd = document.getElementById('engineDropdown');
  if (PopupManager.isOpen('engineDropdown')) { PopupManager.close('engineDropdown'); return; }`, 1);
step('engineDropdown 打开',
`  dd.style.left = (br.left - ar.left) + 'px';
  requestAnimationFrame(function(){ dd.classList.add('show'); markPopupChange(); });
}`,
`  dd.style.left = (br.left - ar.left) + 'px';
  requestAnimationFrame(function(){ PopupManager.open('engineDropdown'); });
}`, 1);
step('引擎项点选后关闭',
`    document.getElementById('engineDropdown').classList.remove('show'); markPopupChange();
  });
});`,
`    PopupManager.close('engineDropdown');
  });
});`, 1);
step('删除引擎独立文档监听',
`document.addEventListener('click', e => { if (!e.target.closest('.engine-dropdown') && !e.target.closest('.engine-btn')) { var dd = document.getElementById('engineDropdown'); if (dd.classList.contains('show')) { dd.classList.remove('show'); markPopupChange(); } } });
`,
'', 1);

/* ==========================================================================
 * 7. 壁纸选择器
 * ======================================================================== */
step('wpPicker 走管理器',
`function showWpPicker(){
  var overlay = document.getElementById('wpPickerOverlay');
  overlay.classList.add('show'); markPopupChange();`,
`function showWpPicker(){
  PopupManager.open('wpPickerOverlay');`, 1);
step('hideWpPicker 走管理器',
`function hideWpPicker(){
  var overlay = document.getElementById('wpPickerOverlay');
  overlay.classList.remove('show'); markPopupChange();
}`,
`function hideWpPicker(){ PopupManager.close('wpPickerOverlay'); }`, 1);

/* ==========================================================================
 * 8. 农历弹窗：只保留定时器，外部点击交给管理器
 * ======================================================================== */
step('农历变量只留定时器', 'var _lunarTimer = null, _lunarOutside = null;', 'var _lunarTimer = null;', 1);
step('closeLunarPopup 走管理器',
`function closeLunarPopup() {
  if (_lunarTimer) { clearInterval(_lunarTimer); _lunarTimer = null; }
  if (_lunarOutside) { document.removeEventListener('click', _lunarOutside); _lunarOutside = null; }
  var p = document.getElementById('lunarPopup');
  if (p) p.classList.remove('show');
  markPopupChange();
}`,
`function closeLunarPopup() {
  if (_lunarTimer) { clearInterval(_lunarTimer); _lunarTimer = null; }
  PopupManager.close('lunarPopup');
}`, 1);
step('renderLunar 打开走管理器',
`  requestAnimationFrame(function () { popup.classList.add('show'); });
  markPopupChange();
  return si;`,
`  requestAnimationFrame(function () { PopupManager.open('lunarPopup'); });
  return si;`, 1);
step('openLunarPopup 去掉自建外部监听',
`function openLunarPopup() {
  var popup = document.getElementById('lunarPopup');
  if (popup.classList.contains('show')) { closeLunarPopup(); return; }
  var base = new Date();`,
`function openLunarPopup() {
  if (PopupManager.isOpen('lunarPopup')) { closeLunarPopup(); return; }
  var base = new Date();`, 1);
step('openLunarPopup 删除 setTimeout 监听块',
`  }, 60000);
  setTimeout(function () {
    if (_lunarOutside) document.removeEventListener('click', _lunarOutside);
    _lunarOutside = function (e) {
      if (!e.target.closest('#lunarPopup') && !e.target.closest('#clock')) closeLunarPopup();
    };
    document.addEventListener('click', _lunarOutside);
  }, 100);
}`,
`  }, 60000);
}`, 1);

/* ==========================================================================
 * 9. Esc：关最上层，其次收书签栏
 * ======================================================================== */
step('Esc 统一',
`document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeBookmarkBar(); closeBmPopup(); closeBmListPopup(); } });`,
`/* Esc：先关最上层浮层；没有浮层时再收起书签栏（保留原有"Esc 收起"的手感） */
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!PopupManager.handleKeydown(e)) closeBookmarkBar();
});`, 1);

/* ==========================================================================
 * 10. morph 面板：纳入栈（external，仅跟踪顺序以便 Esc 可关）
 * ======================================================================== */
step('openMorph 入栈',
`  morphActive = true;
  }); // end requestAnimationFrame
}`,
`  morphActive = true;
    PopupManager.open('morphPanel');
  }); // end requestAnimationFrame
}`, 1);
step('closeMorph 出栈',
`    panel.style.display = 'none';
    morphActive = false;
    morphView = null;`,
`    panel.style.display = 'none';
    morphActive = false;
    PopupManager.markClosed('morphPanel');
    morphView = null;`, 1);

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

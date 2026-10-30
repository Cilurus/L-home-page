/**
 * P3-b  事件委托（data-action）
 *  · 新增 §4 分发表 ACTIONS（白名单）+ 单一分发器（click/input/change/blur/keydown）
 *  · 83 个内联事件属性（74 onclick + 9 input/keydown/change/blur）→ data-* 属性
 *  · 3 个多语句内联序列抽成具名函数（resetMotto / resetProfile / saveMottoAndClose / pickIconFile）
 *  · 壁纸选择器遮罩与 stopPropagation 内联处理删除（改由 PopupManager triggers 处理）
 *  · window.L 从 61 个导出收敛为 11 个调试入口（页面自身不再依赖）
 *  · 顺带修复：资料"恢复默认"按钮的 onclick 因内嵌 \" 被 HTML 解析截断（本来就是坏的）
 * 用法：node tools/refactor-p3b.mjs [--write]
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
/** 定点替换：从 startMarker 起，到 endMarker（含）为止整段替换（用于含转义引号的畸形属性） */
function stepSpan(name, startMarker, endMarker, to, expect) {
  let n = 0, idx = txt.indexOf(startMarker);
  while (idx >= 0) {
    const end = txt.indexOf(endMarker, idx);
    if (end < 0) break;
    txt = txt.slice(0, idx) + to + txt.slice(end + endMarker.length);
    n++;
    idx = txt.indexOf(startMarker, idx + to.length);
  }
  const ok = n === expect;
  report.push([ok ? 'OK  ' : 'FAIL', name, n, expect]);
  if (!ok) failed++;
}

/* ==========================================================================
 * 1. 插入 §4 分发表 + 分发器
 * ======================================================================== */
const DISPATCHER = `  /* ==========================================================================
   * §4  视图层 · 事件委托（data-action）
   * --------------------------------------------------------------------------
   * 用法：HTML 里写 data-action="函数名"，可选 data-arg / data-self /
   *       data-value-arg；输入类事件写 data-input / data-change / data-blur /
   *       data-enter。新增按钮只需加一个 data-action，不必再写内联 onclick、
   *       也不必往 window.L 上挂新函数。
   * 安全：只允许 ACTIONS 白名单里的名字被 DOM 触发，避免任意函数暴露给标记。
   * 约定：ACTIONS 的每个处理函数签名为 (el, arg)；el 是带 data-* 的元素本身。
   * ======================================================================== */

  /* ---------- data-action 用到的具名流程（原先是内联多语句） ---------- */

  /** 打开收藏图标的本地上传文件框 */
  function pickIconFile() { document.getElementById('bmIconUpload').click(); }

  /** 保存格言并关闭弹窗（原先内联写了两条语句） */
  function saveMottoAndClose() { saveMotto(); PopupManager.close('mottoPopup'); }

  /** 格言恢复默认并保存 */
  function resetMotto() {
    document.getElementById('mottoInput').value = DEFAULTS.mottoFallback;
    saveMotto();
  }

  /**
   * 个人资料恢复默认并保存。
   * 顺带修复：原先的内联 onclick 里嵌了 \\" 转义引号，HTML 解析会在该处截断属性，
   *           这个"恢复默认"按钮此前实际是坏的（点击无反应）。
   */
  function resetProfile() {
    document.getElementById('pName').value = '';
    selectGender(document.querySelector('.gender-btn[data-v=""]'));
    document.getElementById('pInterests').value = '';
    saveProfile();
  }

  /* ---------- 白名单分发表 ---------- */

  /** @type {Object.<string, (el:HTMLElement, arg:(string|undefined))=>void>} */
  const ACTIONS = {
    /* 浮层 */
    toggleSettings: function () { toggleSettings(); },
    openApiConfig: function (el, arg) { openApiConfig(arg === 'right'); },
    closePopup: function (el, arg) { PopupManager.close(arg); },
    openProfile: function () { openProfile(); },
    editMotto: function () { editMotto(); },
    addPersona: function () { addPersona(); },
    openLunarPopup: function () { openLunarPopup(); },
    openMorph: function (el, arg) { openMorph(arg); },
    closeMorph: function () { closeMorph(); },
    hideWpPicker: function () { PopupManager.close('wpPickerOverlay'); },
    wpPickApply: function (el, arg) { applyWallpaper(arg); },
    /* 设置 */
    applyWallpaper: function (el, arg) { applyWallpaper(arg); },
    setFontColor: function (el, arg) { setFontColor(arg); },
    applyCustomColor: function () { applyCustomColor(); },
    previewCustomColor: function () { previewCustomColor(); },
    setCardOpacity: function (el, arg) { setCardOpacity(arg !== undefined ? arg : el.value); },
    toggleSwitch: function (el) { toggleSwitch(el); },
    toggleMinimal: function (el) { toggleMinimal(el); },
    toggleAutoMsg: function (el) { toggleAutoMsg(el); },
    toggleWhiteClock: function (el) { toggleWhiteClock(el); },
    toggleWhiteMotto: function (el) { toggleWhiteMotto(el); },
    setCompactMode: function (el, arg) { setCompactMode(arg === 'true'); },
    setDisplayMode: function (el, arg) { setDisplayMode(arg === 'true'); },
    resetDefaults: function () { resetDefaults(); },
    saveApiConfig: function () { saveApiConfig(); },
    saveProfile: function () { saveProfile(); },
    saveMottoAndClose: function () { saveMottoAndClose(); },
    resetMotto: function () { resetMotto(); },
    resetProfile: function () { resetProfile(); },
    /* 收藏 */
    saveBookmark: function () { saveBookmark(); },
    deleteBookmark: function () { deleteBookmark(); },
    bmShowPage1: function () { bmShowPage1(); },
    bmShowPage2: function () { bmShowPage2(); },
    bmAutoIcon: function () { bmAutoIcon(); },
    bmIconUrlChanged: function () { bmIconUrlChanged(); },
    bmUrlChanged: function () { bmUrlChanged(); },
    bmListAdd: function () { bmListAdd(); },
    handleIconUpload: function (el) { handleIconUpload(el); },
    pickIconFile: function () { pickIconFile(); },
    /* 其它 */
    doSearch: function () { doSearch(); },
    toggleEngine: function () { toggleEngine(); },
    selectGender: function (el) { selectGender(el); },
    sendMorphMsg: function () { sendMorphMsg(); },
    backFromChat: function () { backFromChat(); },
    autoResize: function (el) { autoResize(el); }
  };

  /**
   * 按名字执行动作（白名单外的名字直接忽略）。
   * @param {string} name
   * @param {HTMLElement} el 触发元素
   * @param {string|undefined} arg
   * @sideEffect 取决于具体动作
   */
  function dispatchAction(name, el, arg) {
    const fn = ACTIONS[name];
    if (!fn) return;
    fn(el, arg);
  }

  /** 从事件目标向上找带指定 data 属性的元素 */
  function delegateTarget(e, attr) {
    const t = e.target;
    return (t && t.closest) ? t.closest('[' + attr + ']') : null;
  }

  /* ---------- 分发器（每类事件只有一个文档级监听） ---------- */
  document.addEventListener('click', function (e) {
    const el = delegateTarget(e, 'data-action');
    if (el) dispatchAction(el.dataset.action, el, el.dataset.arg);
  });
  document.addEventListener('input', function (e) {
    const el = delegateTarget(e, 'data-input');
    if (el) dispatchAction(el.dataset.input, el, el.dataset.valueArg !== undefined ? el.value : undefined);
  });
  document.addEventListener('change', function (e) {
    const el = delegateTarget(e, 'data-change');
    if (el) dispatchAction(el.dataset.change, el);
  });
  /* blur 不冒泡，必须用捕获阶段 */
  document.addEventListener('blur', function (e) {
    const el = delegateTarget(e, 'data-blur');
    if (el) dispatchAction(el.dataset.blur, el);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    const el = delegateTarget(e, 'data-enter');
    if (!el) return;
    // data-enter-prevent 表示"回车提交、Shift+回车换行"
    if (el.dataset.enterPrevent !== undefined) {
      if (e.shiftKey) return;
      e.preventDefault();
    }
    dispatchAction(el.dataset.enter, el);
  });

let _ptrDown = null;`;
step('插入 §4 分发表与分发器', 'let _ptrDown = null;', DISPATCHER, 1);

/* ==========================================================================
 * 2. 简单点击：onclick="L.fn()" → data-action="fn"
 * ======================================================================== */
const SIMPLE = ['addPersona', 'applyCustomColor', 'backFromChat', 'bmAutoIcon', 'bmListAdd',
  'bmShowPage1', 'bmShowPage2', 'closeMorph', 'deleteBookmark', 'doSearch', 'editMotto',
  'openApiConfig', 'openLunarPopup', 'openProfile', 'resetDefaults', 'saveBookmark',
  'savePersona', 'sendMorphMsg', 'toggleEngine', 'toggleSettings'];
for (const fn of SIMPLE) {
  step(`委托 ${fn}`, `onclick="L.${fn}()"`, `data-action="${fn}"`, null);
}

/* ==========================================================================
 * 3. 带参数点击
 * ======================================================================== */
const ARG_FAMILIES = [
  ['applyWallpaper', ['orca', 'sky', 'deepspace', 'gray', 'sunshine', 'asteroid', 'vivid', 'rain', 'firefly', 'custom']],
  ['wpPickApply', ['orca', 'sky', 'deepspace', 'gray', 'sunshine', 'asteroid', 'vivid', 'rain', 'firefly', 'custom']],
  ['setFontColor', ['white', 'gray', 'black', 'custom']],
  ['openMorph', ['mail', 'outbox']],
  ['closePopup', ['apiPopup', 'mottoPopup', 'profilePopup']]
];
for (const [fn, args] of ARG_FAMILIES) {
  for (const a of args) {
    step(`委托 ${fn}(${a})`, `onclick="L.${fn}(&#39;${a}&#39;)"`, `data-action="${fn}" data-arg="${a}"`, 1);
  }
}
/* setCompactMode / setDisplayMode 的参数是裸布尔量，不是带引号的字符串 */
for (const fn of ['setCompactMode', 'setDisplayMode']) {
  for (const a of ['true', 'false']) {
    step(`委托 ${fn}(${a})`, `onclick="L.${fn}(${a})"`, `data-action="${fn}" data-arg="${a}"`, 1);
  }
}
step('委托 closePopup(personaPopup)', `onclick="L.closePopup('personaPopup')"`, `data-action="closePopup" data-arg="personaPopup"`, 1);
step('委托 openApiConfig(true)', 'onclick="L.openApiConfig(true)"', 'data-action="openApiConfig" data-arg="right"', 1);

/* ==========================================================================
 * 4. 传 this 的点击
 * ======================================================================== */
for (const fn of ['selectGender', 'toggleSwitch', 'toggleAutoMsg', 'toggleMinimal', 'toggleWhiteClock', 'toggleWhiteMotto']) {
  step(`委托 ${fn}(this)`, `onclick="L.${fn}(this)"`, `data-action="${fn}" data-self="1"`, null);
}

/* ==========================================================================
 * 5. 多语句内联 → 具名流程
 * ======================================================================== */
step('保存 API（内联双语句）', `onclick="L.saveApiConfig();L.closePopup(&#39;apiPopup&#39;)"`, 'data-action="saveApiConfig"', 1);
step('保存资料（内联双语句）', `onclick="L.saveProfile();L.closePopup(&#39;profilePopup&#39;)"`, 'data-action="saveProfile"', 1);
step('保存格言（内联双语句）', `onclick="L.saveMotto();L.closePopup('mottoPopup')"`, 'data-action="saveMottoAndClose"', 1);
step('上传图标文件框', `onclick="document.getElementById('bmIconUpload').click()"`, 'data-action="pickIconFile"', 1);
stepSpan('格言恢复默认', `onclick="document.getElementById('mottoInput')`, 'L.saveMotto()"', 'data-action="resetMotto"', 1);
stepSpan('资料恢复默认（原先属性被转义引号截断）', `onclick="document.getElementById('pName')`, 'L.saveProfile()"', 'data-action="resetProfile"', 1);

/* ==========================================================================
 * 6. 非点击事件
 * ======================================================================== */
step('input: 图标 URL', 'oninput="L.bmIconUrlChanged()"', 'data-input="bmIconUrlChanged"', 1);
step('input: 颜色预览', 'oninput="L.previewCustomColor()"', 'data-input="previewCustomColor"', 1);
step('input: 透明度滑块', 'oninput="L.setCardOpacity(this.value)"', 'data-input="setCardOpacity" data-value-arg="1"', 1);
step('input: 聊天框自增高', 'oninput="autoResize(this)"', 'data-input="autoResize" data-self="1"', 1);
step('change: 图标上传', 'onchange="L.handleIconUpload(this)"', 'data-change="handleIconUpload" data-self="1"', 1);
step('blur: 链接自动填名', 'onblur="L.bmUrlChanged()"', 'data-blur="bmUrlChanged"', 1);
step('keydown: 搜索框回车', 'onkeydown="if(event.key===&#39;Enter&#39;)L.doSearch()"', 'data-enter="doSearch"', 1);
step('keydown: 自定义颜色回车', "onkeydown=\"if(event.key==='Enter')L.applyCustomColor()\"", 'data-enter="applyCustomColor"', 1);
step('keydown: 聊天回车发送',
  "onkeydown=\"if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();L.sendMorphMsg()}\"",
  'data-enter="sendMorphMsg" data-enter-prevent="1"', 1);

/* ==========================================================================
 * 7. 壁纸选择器：遮罩与 stopPropagation 交给 PopupManager
 * ======================================================================== */
step('壁纸遮罩内联删除', '<div class="wp-picker-overlay" id="wpPickerOverlay" onclick="L.hideWpPicker()">', '<div class="wp-picker-overlay" id="wpPickerOverlay">', 1);
step('壁纸卡片 stopPropagation 删除', '<div class="wp-picker" onclick="event.stopPropagation()">', '<div class="wp-picker">', 1);

/* ==========================================================================
 * 8. window.L 收敛为调试入口
 * ======================================================================== */
const oldExportStart = '  // ===== §5 应用层 · 对外接口（供 HTML 内联 onclick 调用） =====\n  // Expose public API\n  window.L = {';
const exportEndMarker = '\n  };\n})();';
const startIdx = txt.indexOf(oldExportStart);
if (startIdx < 0) {
  report.push(['FAIL', '定位 window.L 导出块', 0, 1]); failed++;
} else {
  const endIdx = txt.indexOf(exportEndMarker, startIdx);
  if (endIdx < 0) {
    report.push(['FAIL', '定位 window.L 导出块结尾', 0, 1]); failed++;
  } else {
    const NEW_EXPORT = `  // ===== §5 应用层 · 对外接口 =====
  // P3b 起页面内交互全部走 data-action 事件委托，window.L 不再被页面自身依赖。
  // 下面只保留"控制台调试 / 自动化测试 / 将来扩展"用得上的主入口（原来 61 个）。
  window.L = {
    /* 状态与调试 */
    data: function () { return data; },
    showToast: showToast,
    testApi: testApi,
    getApiKey: getApiKey,
    getApiUrl: getApiUrl,
    /* 浮层 */
    openApiConfig: openApiConfig,
    closePopup: closePopup,
    toggleSettings: toggleSettings,
    openProfile: openProfile,
    editMotto: editMotto,
    addPersona: addPersona,
    openLunarPopup: openLunarPopup,
    openMorph: openMorph,
    closeMorph: closeMorph,
    /* 外观 */
    applyWallpaper: applyWallpaper,
    setFontColor: setFontColor,
    setCardOpacity: setCardOpacity,
    setCompactMode: setCompactMode,
    setDisplayMode: setDisplayMode,
    resetDefaults: resetDefaults,
    /* 收藏 */
    showBookmarkBar: showBookmarkBar,
    openBmPopup: openBmPopup,
    closeBmPopup: closeBmPopup,
    openBmList: openBmList,
    closeBmListPopup: closeBmListPopup,
    saveBookmark: saveBookmark,
    deleteBookmark: deleteBookmark,
    handleIconUpload: handleIconUpload,
    /* 其它 */
    doSearch: doSearch,
    toggleEngine: toggleEngine,
    showWpPicker: showWpPicker,
    hideWpPicker: hideWpPicker,
    toggleAutoMsg: toggleAutoMsg,
    selectGender: selectGender`;
    txt = txt.slice(0, startIdx) + NEW_EXPORT + txt.slice(endIdx);
    report.push(['OK  ', 'window.L 收敛为调试入口', 1, 1]);
  }
}

/* ==========================================================================
 * 9. 收敛校验：页面里不应再出现内联事件属性或 L.xxx 调用
 * ======================================================================== */
const inlineLeft = (txt.match(/\son(click|input|change|blur|keydown)=/g) || []).length;
report.push([inlineLeft === 0 ? 'OK  ' : 'FAIL', '内联事件属性清零', inlineLeft, 0]);
if (inlineLeft) {
  failed++;
  let mi; const re = /\son(click|input|change|blur|keydown)=/g;
  while ((mi = re.exec(txt))) console.log('    残留: ...' + JSON.stringify(txt.slice(Math.max(0, mi.index - 60), mi.index + 90)) + '...');
}

const exportIdx = txt.indexOf('window.L = {');
const outsideExport = txt.slice(0, exportIdx);
const lCalls = (outsideExport.match(/\bL\.\w+\(/g) || []).length;
report.push([lCalls === 0 ? 'OK  ' : 'FAIL', '页面内不再调用 L.xxx', lCalls, 0]);
if (lCalls) failed++;

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

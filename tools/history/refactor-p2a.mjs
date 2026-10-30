/**
 * P2-a  引入 §1 状态层 Store（唯一状态源）
 *  · 新增 §0 SETTINGS 注册表（类型 + 默认值，全站唯一声明）
 *  · 新增 §1 Store：raw/write/json/setting/setSetting/subscribe/loadData/saveData/flushData
 *  · 全部 localStorage 直连改为经 Store（§1 之外不再直接接触 localStorage）
 *  · 修复缺陷 #1：自动消息开关"视觉为开、逻辑为关"
 *  · 修复 P1 引入的回归：saveApiConfig 残留已下线的 AK/AU 常量
 * 用法：node tools/refactor-p2a.mjs [--write]
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
 * 0. 修复 P1 回归：saveApiConfig 引用了已下线的 AK / AU
 * ======================================================================== */
step('修复 AK/AU 回归（saveApiConfig）',
  '  localStorage.setItem(AK, k); localStorage.setItem(AU, u);',
  '  Store.write(KEYS.API_KEY, k); Store.write(KEYS.API_URL, u);', 1);

/* ==========================================================================
 * 1. §0 追加 SETTINGS 注册表
 * ======================================================================== */
step('§0 追加 SETTINGS 注册表',
  `  /** 全部壁纸类名，供"先清后加"统一使用 */
  const BG_CLASSES = Object.keys(WALLPAPERS).map(function (k) { return WALLPAPERS[k].cls; });`,
`  /** 全部壁纸类名，供"先清后加"统一使用 */
  const BG_CLASSES = Object.keys(WALLPAPERS).map(function (k) { return WALLPAPERS[k].cls; });

  /**
   * 设置项注册表 —— 全站唯一的状态声明。
   * 新增一个开关：在这里登记一行 + HTML 里加一个 data-action 控件即可，不需要
   * 再去改初始化、重置、存储键三处。
   * type: 'flag' 布尔（存 '1'/'0'） | 'int' 整数 | 'text' 文本（'' 有意义）
   * 说明：重构前每个设置项的默认值分散在 3~5 处且互相矛盾——最典型的是"自动
   *       消息"开关：初始化按"非 '0' 即开"点亮开关，而发送逻辑要求严格等于 '1'，
   *       于是开关看起来是开的、功能却永远不会触发。现在两边都读 Store.setting()。
   */
  const SETTINGS = {
    motto:       { key: KEYS.TOGGLE_MOTTO,   type: 'flag', def: true,     label: '显示格言' },
    shape:       { key: KEYS.TOGGLE_SHAPE,   type: 'flag', def: false,    label: '显示图形' },
    minimal:     { key: KEYS.TOGGLE_MINIMAL, type: 'flag', def: false,    label: '极简模式' },
    autoMsg:     { key: KEYS.AUTO_MSG,       type: 'flag', def: false,    label: '自动消息' },
    whiteClock:  { key: KEYS.WHITE_CLOCK,    type: 'flag', def: true,     label: '白色时间' },
    whiteMotto:  { key: KEYS.WHITE_MOTTO,    type: 'flag', def: true,     label: '白色格言' },
    opacity:     { key: KEYS.OPACITY,        type: 'int',  def: 2,        label: '透明卡片' },
    font:        { key: KEYS.FONT,           type: 'enum', def: 'black',  label: '文字颜色' },
    bgType:      { key: KEYS.BG_TYPE,        type: 'text', def: '',       label: '壁纸' },
    mottoText:   { key: KEYS.MOTTO,          type: 'text', def: '春眠不觉晓，处处闻啼鸟。', label: '格言内容' },
    customColor: { key: KEYS.CUSTOM_COLOR,   type: 'text', def: '#FFFFFF', label: '自定义颜色' }
  };

  /** 存储键 → 设置项名 的反查表（供仍以键名传参的旧接口使用） */
  const SETTING_BY_KEY = {};
  Object.keys(SETTINGS).forEach(function (n) { SETTING_BY_KEY[SETTINGS[n].key] = n; });

  /** 开关 DOM id → 设置项名（HTML 里 .toggle-track 的 id） */
  const TOGGLE_IDS = {
    toggleMotto: 'motto', toggleShape: 'shape', toggleMinimal: 'minimal',
    toggleAuto: 'autoMsg', toggleWhiteClock: 'whiteClock', toggleWhiteMotto: 'whiteMotto'
  };`, 1);

/* ==========================================================================
 * 2. §1 替换为 Store 实现
 * ======================================================================== */
const STORE_BLOCK = `  /* ==========================================================================
   * §1  状态层 · Store
   * --------------------------------------------------------------------------
   * 职责：全站唯一的状态读写入口。
   *   · 设置项按 §0 SETTINGS 的类型与默认值读写
   *   · 所有写入走 try/catch：配额超限 / 存储被禁用时返回 false 并回调报错，
   *     不再像以前那样静默抛错或静默失败
   *   · 会话主数据 data 的加载（含结构容错）与防抖落盘
   *   · subscribe()：状态变化通知视图（P3 起使用）
   * 约定：§2 及以上模块一律不得直接调用 localStorage，全部经 Store。
   * ======================================================================== */
  const Store = (function () {
    const listeners = [];
    let saveTimer = null;
    let onError = null;

    /* ---------- 底层读写（全文件唯一直接接触 localStorage 的地方） ---------- */

    /**
     * 读取原始字符串。
     * @param {string} key
     * @returns {string|null} 读取失败（隐私模式等）返回 null
     */
    function raw(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

    /**
     * 安全写入。
     * @param {string} key
     * @param {string} value
     * @returns {boolean} 成功为 true；配额超限或存储被禁用为 false
     * @sideEffect 写 localStorage；失败时触发 onStorageError 回调
     */
    function write(key, value) {
      try { localStorage.setItem(key, value); return true; }
      catch (e) { if (onError) onError(e, key); return false; }
    }

    /**
     * 删除键。
     * @param {string} key
     * @sideEffect 改 localStorage（失败静默）
     */
    function remove(key) { try { localStorage.removeItem(key); } catch (e) {} }

    /**
     * 解析 JSON 存储项。
     * @param {string} key
     * @param {*} fallback 缺省或解析失败时的返回值
     * @returns {*}
     */
    function json(key, fallback) {
      const v = raw(key);
      if (v === null || v === '') return fallback;
      try { const d = JSON.parse(v); return d === null ? fallback : d; }
      catch (e) { return fallback; }
    }

    /* ---------- 设置项 ---------- */

    /**
     * 读设置项，未设置时返回注册表默认值。
     * @param {string} name §0 SETTINGS 的键
     * @returns {boolean|number|string|undefined} 未注册的名称返回 undefined
     * @sideEffect 只读 localStorage
     */
    function setting(name) {
      const s = SETTINGS[name];
      if (!s) return undefined;
      const v = raw(s.key);
      if (s.type === 'flag') return v === null ? !!s.def : v === '1';
      if (s.type === 'int') { const n = parseInt(v, 10); return isNaN(n) ? s.def : n; }
      return (v === null || v === '') ? s.def : v;
    }

    /**
     * 写设置项并广播变更。
     * @param {string} name §0 SETTINGS 的键
     * @param {boolean|number|string} value
     * @returns {boolean} 写入是否成功
     * @sideEffect 写 localStorage；通知订阅者
     */
    function setSetting(name, value) {
      const s = SETTINGS[name];
      if (!s) return false;
      const ok = write(s.key, s.type === 'flag' ? (value ? '1' : '0') : String(value));
      if (ok) emit(name);
      return ok;
    }

    /* ---------- 订阅 ---------- */

    /**
     * 订阅状态变化。
     * @param {(name:string)=>void} fn
     * @returns {()=>void} 取消订阅
     */
    function subscribe(fn) {
      listeners.push(fn);
      return function () { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
    }

    /** 广播变更（订阅者异常不影响其他订阅者） */
    function emit(name) { listeners.forEach(function (fn) { try { fn(name); } catch (e) {} }); }

    /**
     * 注册存储错误回调（由 §4 注入 toast，避免状态层反向依赖 UI）。
     * @param {(err:Error, key:string)=>void} fn
     */
    function onStorageError(fn) { onError = fn; }

    /* ---------- 会话主数据 ---------- */

    /** 首次使用的默认数据结构。@returns {object} */
    function defaultData() {
      return {
        characters: [
          { id:'e1', avatar:'🤖', name:'DeepSeek 助手', desc:'万能 AI 助手', systemPrompt:'你是有帮助的 AI。用中文回答。', model:'deepseek-chat', temperature:0.7, maxTokens:4096 },
          { id:'e2', avatar:'📝', name:'写作顾问', desc:'润色创作', systemPrompt:'你专业写作顾问。给出具体修改意见。', model:'deepseek-chat', temperature:0.8, maxTokens:4096 },
          { id:'e3', avatar:'💻', name:'代码审查员', desc:'毒舌审代码', systemPrompt:'资深程序员。讽刺但一针见血，最终给正确建议。', model:'deepseek-chat', temperature:0.9, maxTokens:4096 },
          { id:'e4', avatar:'🎨', name:'创意顾问', desc:'灵感和脑洞', systemPrompt:'创意专家。帮用户头脑风暴、激发灵感。', model:'deepseek-chat', temperature:0.95, maxTokens:4096 },
          { id:'e5', avatar:'🧘', name:'心灵导师', desc:'温暖治愈', systemPrompt:'温柔心灵导师。用温暖共情语气倾听，给柔和建议。', model:'deepseek-chat', temperature:0.6, maxTokens:4096 }
        ],
        conversations: {},
        profile: { name:'', gender:'', interests:'' }
      };
    }

    /**
     * 读取会话主数据，并修补缺失字段（旧数据 / 被外部改坏的数据不再导致崩溃）。
     * @returns {object} 至少含 characters / conversations / profile
     * @sideEffect 只读 localStorage
     */
    function loadData() {
      const d = json(KEYS.STORE, null);
      if (!d || typeof d !== 'object') return defaultData();
      if (!Array.isArray(d.characters) || d.characters.length === 0) d.characters = defaultData().characters;
      if (!d.conversations || typeof d.conversations !== 'object') d.conversations = {};
      if (!d.profile || typeof d.profile !== 'object') d.profile = { name:'', gender:'', interests:'' };
      return d;
    }

    /**
     * 防抖落盘会话主数据。
     * @param {object} d
     * @sideEffect 延迟写 localStorage
     */
    function saveData(d) {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(function () { saveTimer = null; write(KEYS.STORE, JSON.stringify(d)); }, CONFIG.SAVE_DEBOUNCE_MS);
    }

    /**
     * 立即落盘（页面卸载 / 隐藏时调用）。
     * @param {object} d
     * @returns {boolean} 是否写入成功
     * @sideEffect 写 localStorage
     */
    function flushData(d) {
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
      return write(KEYS.STORE, JSON.stringify(d));
    }

    return {
      raw: raw, write: write, remove: remove, json: json,
      setting: setting, setSetting: setSetting,
      subscribe: subscribe, onStorageError: onStorageError,
      loadData: loadData, saveData: saveData, flushData: flushData
    };
  })();

  /* ---------- 会话主状态（§1 的对外形态，保持既有变量名以降低改动面） ---------- */
  /** 会话主数据：角色 / 会话 / 个人资料；写操作统一经 save() */
  let data = Store.loadData();

  /**
   * 防抖保存会话主数据。
   * @sideEffect 写 localStorage（KEYS.STORE）
   */
  function save() { Store.saveData(data); }

  window.addEventListener('beforeunload', function () { Store.flushData(data); });
  window.addEventListener('pagehide', function () { Store.flushData(data); });
`;

step('§1 替换为 Store 实现',
`  /* ==========================================================================
   * §1  状态层   （当前仍在收敛中：data 为会话主状态，偏好散在 KEYS.* 各键）
   * 说明：P2 将把散落的闭包变量与 localStorage 读写收敛为 Store（唯一状态源），
   *       届时 §1 会成为唯一允许写存储的地方。
   * ======================================================================== */

  let data;
  function load() {
  try { const r = localStorage.getItem(KEYS.STORE); if (r) { const d = JSON.parse(r); if (!d.conversations) d.conversations = {}; return d; } } catch(e) {}
  return {
    characters: [
      { id:'e1', avatar:'🤖', name:'DeepSeek 助手', desc:'万能 AI 助手', systemPrompt:'你是有帮助的 AI。用中文回答。', model:'deepseek-chat', temperature:0.7, maxTokens:4096 },
      { id:'e2', avatar:'📝', name:'写作顾问', desc:'润色创作', systemPrompt:'你专业写作顾问。给出具体修改意见。', model:'deepseek-chat', temperature:0.8, maxTokens:4096 },
      { id:'e3', avatar:'💻', name:'代码审查员', desc:'毒舌审代码', systemPrompt:'资深程序员。讽刺但一针见血，最终给正确建议。', model:'deepseek-chat', temperature:0.9, maxTokens:4096 },
      { id:'e4', avatar:'🎨', name:'创意顾问', desc:'灵感和脑洞', systemPrompt:'创意专家。帮用户头脑风暴、激发灵感。', model:'deepseek-chat', temperature:0.95, maxTokens:4096 },
      { id:'e5', avatar:'🧘', name:'心灵导师', desc:'温暖治愈', systemPrompt:'温柔心灵导师。用温暖共情语气倾听，给柔和建议。', model:'deepseek-chat', temperature:0.6, maxTokens:4096 }
    ],
    conversations: {},
    profile: { name:'', gender:'', interests:'' }
  };
}
var _saveTimer = null;
function save() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function() { localStorage.setItem(KEYS.STORE, JSON.stringify(data)); }, 500);
}
window.addEventListener('beforeunload', function() {
  if (_saveTimer) { clearTimeout(_saveTimer); localStorage.setItem(KEYS.STORE, JSON.stringify(data)); }
});`,
STORE_BLOCK, 1);

/* ==========================================================================
 * 3. API Key / 地址
 * ======================================================================== */
step('getApiKey 走 Store', "function getApiKey() { return localStorage.getItem(KEYS.API_KEY) || ''; }",
  "function getApiKey() { return Store.raw(KEYS.API_KEY) || ''; }", 1);
step('getApiUrl 走 Store', "function getApiUrl() { return localStorage.getItem(KEYS.API_URL) || CONFIG.DEFAULT_API_URL; }",
  "function getApiUrl() { return Store.raw(KEYS.API_URL) || CONFIG.DEFAULT_API_URL; }", 1);

/* ==========================================================================
 * 4. 格言 / 壁纸 / 透明度
 * ======================================================================== */
step('格言写入', 'localStorage.setItem(KEYS.MOTTO, val);', "Store.setSetting('mottoText', val);", 1);
step('格言读取', 'mt.textContent = localStorage.getItem(KEYS.MOTTO) || DEFAULTS.motto;',
  "mt.textContent = Store.setting('mottoText');", 1);

step('currentBgType 走 Store',
  "return localStorage.getItem(KEYS.BG_TYPE) || (localStorage.getItem(KEYS.BG) ? 'custom' : DEFAULTS.bgType);",
  "return Store.setting('bgType') || (Store.raw(KEYS.BG) ? 'custom' : DEFAULTS.bgType);", 1);
step('applyWallpaper 写壁纸',
  "  localStorage.setItem(KEYS.BG, '');\n  localStorage.setItem(KEYS.BG_TYPE, type);",
  "  Store.write(KEYS.BG, '');\n  Store.setSetting('bgType', type);", 1);
step('上传壁纸写存储',
  "localStorage.setItem(KEYS.BG, url); localStorage.setItem(KEYS.BG_TYPE, '');",
  "Store.write(KEYS.BG, url); Store.setSetting('bgType', '');", 1);
step('启动恢复壁纸读存储',
  "var saved = localStorage.getItem(KEYS.BG), type = localStorage.getItem(KEYS.BG_TYPE);",
  "var saved = Store.raw(KEYS.BG), type = Store.setting('bgType');", 1);
step('resetDefaults 壁纸',
  "  localStorage.setItem(KEYS.BG, '');\n  localStorage.setItem(KEYS.BG_TYPE, DEFAULTS.bgType);",
  "  Store.write(KEYS.BG, '');\n  Store.setSetting('bgType', DEFAULTS.bgType);", 1);
step('壁纸类型判断（rain）', "localStorage.getItem(KEYS.BG_TYPE) === 'rain'", "Store.setting('bgType') === 'rain'", 2);
step('壁纸类型判断（firefly）', "localStorage.getItem(KEYS.BG_TYPE) === 'firefly'", "Store.setting('bgType') === 'firefly'", 2);

step('透明度写入', 'localStorage.setItem(KEYS.OPACITY, v);', "Store.setSetting('opacity', v);", 1);
step('透明度写入（重置）', "localStorage.setItem(KEYS.OPACITY, '2');", "Store.setSetting('opacity', DEFAULTS.opacity);", 1);
step('透明度读取 a', "var v = localStorage.getItem(KEYS.OPACITY) || String(DEFAULTS.opacity);", "var v = String(Store.setting('opacity'));", 1);
step('透明度读取 b', "var opv = localStorage.getItem(KEYS.OPACITY) || String(DEFAULTS.opacity);", "var opv = String(Store.setting('opacity'));", 1);

/* ==========================================================================
 * 5. 开关（含缺陷 #1 修复）
 * ======================================================================== */
step('toggleSwitch 动态键 → 注册表',
  "  localStorage.setItem('mc_' + id, on ? '1' : '0');",
  "  var name = TOGGLE_IDS[id];\n  if (name) Store.setSetting(name, on);", 1);
step('toggleMinimal 写存储', "  localStorage.setItem(KEYS.TOGGLE_MINIMAL, on ? '1' : '0');", "  Store.setSetting('minimal', on);", 1);
step('toggleAutoMsg 写存储',
  "  localStorage.setItem(KEYS.AUTO_MSG, on ? '1' : '0');\n  if (on) { localStorage.removeItem(KEYS.AUTO_NEXT); autoMessage(); }",
  "  Store.setSetting('autoMsg', on);\n  if (on) { Store.remove(KEYS.AUTO_NEXT); autoMessage(); }", 1);
step('toggleWhiteSetting 写存储', "  localStorage.setItem(key, on ? '1' : '0');",
  "  var name = SETTING_BY_KEY[key];\n  if (name) Store.setSetting(name, on);", 1);

step('initWhiteToggles 时钟', "  var wc = localStorage.getItem(KEYS.WHITE_CLOCK) !== '0';", "  var wc = Store.setting('whiteClock');", 1);
step('initWhiteToggles 格言', "  var wm = localStorage.getItem(KEYS.WHITE_MOTTO) !== '0';", "  var wm = Store.setting('whiteMotto');", 1);
step('initAutoMsg（缺陷 #1）', "  if (localStorage.getItem(KEYS.AUTO_MSG) !== '0') {", "  if (Store.setting('autoMsg')) {", 1);
step('initToggles 格言', "  if (localStorage.getItem(KEYS.TOGGLE_MOTTO) === '0') {", "  if (!Store.setting('motto')) {", 1);
step('initToggles 图形', "  if (localStorage.getItem(KEYS.TOGGLE_SHAPE) !== '1') {", "  if (!Store.setting('shape')) {", 1);
step('initToggles 极简', "  if (tmin && localStorage.getItem(KEYS.TOGGLE_MINIMAL) === '1') {", "  if (tmin && Store.setting('minimal')) {", 1);

step('autoMessage 开关判断（缺陷 #1）', "  if (localStorage.getItem(KEYS.AUTO_MSG) !== '1') return;", "  if (!Store.setting('autoMsg')) return;", 1);
step('autoMessage 下次时间读', "var next = parseInt(localStorage.getItem(KEYS.AUTO_NEXT)) || 0;", "var next = parseInt(Store.raw(KEYS.AUTO_NEXT), 10) || 0;", 1);
step('autoMessage 已用主题读', "var usedTopics = JSON.parse(localStorage.getItem(KEYS.AUTO_TOPICS) || '[]');", "var usedTopics = Store.json(KEYS.AUTO_TOPICS, []);", 1);
step('autoMessage 已用主题写', "localStorage.setItem(KEYS.AUTO_TOPICS, JSON.stringify(usedTopics));", "Store.write(KEYS.AUTO_TOPICS, JSON.stringify(usedTopics));", 1);
step('autoMessage 上次角色读', "var lastIdx = parseInt(localStorage.getItem(KEYS.AUTO_LAST_IDX)) || -1;", "var lastIdx = parseInt(Store.raw(KEYS.AUTO_LAST_IDX), 10) || -1;", 1);
step('autoMessage 上次角色写', "localStorage.setItem(KEYS.AUTO_LAST_IDX, idx);", "Store.write(KEYS.AUTO_LAST_IDX, String(idx));", 1);
step('autoMessage 间隔常量', "var delay = 3600000 + Math.floor(Math.random() * 604800000);",
  "var delay = CONFIG.AUTO_MSG_MIN_MS + Math.floor(Math.random() * CONFIG.AUTO_MSG_MAX_MS);", 1);
step('autoMessage 下次时间写', "localStorage.setItem(KEYS.AUTO_NEXT, now + delay);", "Store.write(KEYS.AUTO_NEXT, String(now + delay));", 1);

step('极简延迟常量', "var _minimalTimer = null, _minimalHideDelay = 6600;", "var _minimalTimer = null, _minimalHideDelay = CONFIG.MINIMAL_HIDE_DELAY_MS;", 1);
step('toast 时长常量', "tt = setTimeout(()=>e.style.display='none',3000);", "tt = setTimeout(()=>e.style.display='none',CONFIG.TOAST_MS);", 1);

/* ==========================================================================
 * 6. resetDefaults 其余项
 * ======================================================================== */
step('重置文字颜色', "localStorage.setItem(KEYS.FONT, 'black');", "Store.setSetting('font', DEFAULTS.font);", 1);
step('重置自定义颜色', 'localStorage.removeItem(KEYS.CUSTOM_COLOR);', 'Store.remove(KEYS.CUSTOM_COLOR);', 1);
step('重置格言开关', "localStorage.setItem(KEYS.TOGGLE_MOTTO, '1');", "Store.setSetting('motto', true);", 1);
step('重置图形开关', "localStorage.setItem(KEYS.TOGGLE_SHAPE, '0');", "Store.setSetting('shape', false);", 1);
step('重置自动消息', "if (ta) { ta.classList.remove('on'); localStorage.setItem(KEYS.AUTO_MSG, '0'); }",
  "if (ta) { ta.classList.remove('on'); Store.setSetting('autoMsg', false); }", 1);
step('重置极简', "if (tmin) { tmin.classList.remove('on'); localStorage.setItem(KEYS.TOGGLE_MINIMAL, '0'); applyMinimal(false); }",
  "if (tmin) { tmin.classList.remove('on'); Store.setSetting('minimal', false); applyMinimal(false); }", 1);
step('重置白色时间', "if (tw) { tw.classList.add('on'); localStorage.setItem(KEYS.WHITE_CLOCK, '1'); applyWhiteClock(true); }",
  "if (tw) { tw.classList.add('on'); Store.setSetting('whiteClock', true); applyWhiteClock(true); }", 1);
step('重置白色格言', "if (wm) { wm.classList.add('on'); localStorage.setItem(KEYS.WHITE_MOTTO, '1'); applyWhiteMotto(true); }",
  "if (wm) { wm.classList.add('on'); Store.setSetting('whiteMotto', true); applyWhiteMotto(true); }", 1);

/* ==========================================================================
 * 7. 文字颜色
 * ======================================================================== */
step('颜色选中态读取', "markActiveColor(localStorage.getItem(KEYS.FONT) || DEFAULTS.font);", "markActiveColor(Store.setting('font'));", 1);
step('setFontColor 写入', "localStorage.setItem(KEYS.FONT,m);", "Store.setSetting('font', m);", 1);
step('setFontColor custom', "localStorage.setItem(KEYS.FONT,'custom');", "Store.setSetting('font', 'custom');", 1);
step('applyCustomColor 写入', "localStorage.setItem(KEYS.CUSTOM_COLOR, v);", "Store.setSetting('customColor', v);", 1);
step('initCustomColor 读字体', "var cf = localStorage.getItem(KEYS.FONT);", "var cf = Store.setting('font');", 1);
step('initCustomColor 读颜色', "var cc = localStorage.getItem(KEYS.CUSTOM_COLOR) || '#FFFFFF';", "var cc = Store.setting('customColor');", 1);
step('启动颜色 IIFE', "var m=localStorage.getItem(KEYS.FONT)||DEFAULTS.font;", "var m=Store.setting('font');", 1);

/* ==========================================================================
 * 8. 未读时间戳 / 偏好 / 收藏
 * ======================================================================== */
step('未读时间戳写', "localStorage.setItem(KEYS.LAST_READ, Date.now());", "Store.write(KEYS.LAST_READ, String(Date.now()));", 1);
step('未读时间戳读', "var lastRead = parseInt(localStorage.getItem(KEYS.LAST_READ)) || 0;", "var lastRead = parseInt(Store.raw(KEYS.LAST_READ), 10) || 0;", 1);
step('getPrefs 走 Store', "  try { return JSON.parse(localStorage.getItem(KEYS.PREFS)) || {}; } catch(e) { return {}; }",
  "  return Store.json(KEYS.PREFS, {});", 1);
step('savePrefs 走 Store', "function savePrefs(p) { localStorage.setItem(KEYS.PREFS, JSON.stringify(p)); }",
  "function savePrefs(p) { Store.write(KEYS.PREFS, JSON.stringify(p)); }", 1);

/* ==========================================================================
 * 9. 启动时注入存储错误提示（§1 不反向依赖 §4，由 §5 装配）
 * ======================================================================== */
step('DOMContentLoaded 注入存储错误回调',
  "document.addEventListener('DOMContentLoaded', () => {\n  updateFavicon(false); testApi(); updateMailBadge();",
  `document.addEventListener('DOMContentLoaded', () => {
  Store.onStorageError(function () { showToast('存储写入失败：空间已满或浏览器禁用了本地存储'); });
  updateFavicon(false); testApi(); updateMailBadge();`, 1);

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

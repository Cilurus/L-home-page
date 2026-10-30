/**
 * 测试用最小宿主环境：把 index - new.html 的主脚本放进 vm 沙箱执行，
 * 让测试直接跑"真实页面代码"而不是复制一份逻辑（历史上 mc_verify 就是复制件）。
 *
 * 提供：
 *   · 极简 DOM（元素桩 + classList + style.setProperty + 事件记录与手动派发）
 *   · 可控 localStorage（可模拟配额超限）
 *   · 不真正调度的 setTimeout/setInterval/rAF（测试内手动触发，保证确定性）
 *
 * 用法：const p = loadPage(); p.document.dispatch('DOMContentLoaded'); ...
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 与仓库位置无关：始终读本文件上一级目录里的主页面 */
const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index - new.html');

/* ----------------------------- DOM 桩 ----------------------------- */

function makeStyle() {
  const store = {};
  return new Proxy(store, {
    get(t, k) {
      if (k === 'setProperty') return (n, v) => { t[n] = v; };
      if (k === 'removeProperty') return (n) => { delete t[n]; };
      if (k === 'getPropertyValue') return (n) => (n in t ? t[n] : '');
      if (k === 'cssText') return t.cssText || '';
      return k in t ? t[k] : '';
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

function makeClassList(el) {
  return {
    add: (...cs) => cs.forEach(c => el._classes.add(c)),
    remove: (...cs) => cs.forEach(c => el._classes.delete(c)),
    contains: c => el._classes.has(c),
    toggle: (c, force) => {
      const want = force === undefined ? !el._classes.has(c) : !!force;
      if (want) el._classes.add(c); else el._classes.delete(c);
      return want;
    }
  };
}

function makeCtx2d() {
  const noop = () => {};
  return {
    drawImage: noop, clearRect: noop, fillRect: noop, beginPath: noop, closePath: noop,
    moveTo: noop, lineTo: noop, arc: noop, stroke: noop, fill: noop, save: noop, restore: noop,
    createRadialGradient: () => ({ addColorStop: noop })
  };
}

function makeEl(tag = 'div') {
  const el = {
    tagName: String(tag).toUpperCase(), id: '', className: '',
    checked: false, disabled: false,
    _classes: new Set(), dataset: {}, style: makeStyle(), attributes: {},
    children: [], files: [], offsetWidth: 100, offsetHeight: 100, scrollTop: 0, scrollHeight: 0,
    onload: null, onerror: null,
    classList: null,
    getContext: () => makeCtx2d(),
    toDataURL: () => 'data:image/png;base64,AAAA',
    getBoundingClientRect: () => ({ top: 10, left: 10, right: 110, bottom: 50, width: 100, height: 40 }),
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.push(c); return c; },
    append() {},
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    remove() {}, focus() {}, blur() {}, click() {},
    closest: () => null,
    querySelector(sel) { this._qs = this._qs || {}; if (!this._qs[sel]) this._qs[sel] = makeEl('div'); return this._qs[sel]; },
    querySelectorAll: () => [],
    getElementsByTagName: () => [],
    addEventListener(type, fn) { (this._ev = this._ev || {})[type] = fn; },
    removeEventListener() {},
    dispatchEvent() {},
    getAttribute(k) { return k in this.attributes ? this.attributes[k] : null; },
    setAttribute(k, v) { this.attributes[k] = String(v); },
    removeAttribute(k) { delete this.attributes[k]; }
  };
  el.classList = makeClassList(el);
  /* textContent / innerHTML / value 按真实 DOM 的语义做字符串化，
     否则 `el.textContent = 3` 之后断言会拿到数字而不是 '3'。 */
  for (const prop of ['textContent', 'innerHTML', 'value']) {
    let v = '';
    Object.defineProperty(el, prop, {
      get() { return v; },
      set(x) { v = x === null || x === undefined ? '' : String(x); },
      enumerable: true
    });
  }
  return el;
}

/* ------------------------- 页面加载函数 ------------------------- */

export function loadPage(opts = {}) {
  const txt = fs.readFileSync(FILE, 'utf8');
  const scriptStart = txt.lastIndexOf('<script>');
  const scriptEnd = txt.indexOf('</script>', scriptStart);
  const mainJs = txt.slice(scriptStart + '<script>'.length, scriptEnd);

  /* 页面里还有几段前置脚本（anti-FOUC、LUNAR_CONSTANTS、时钟初值）。
     测试同样按页面顺序先跑它们，才能拿到真实的农历常量。 */
  const headScripts = [];
  {
    const re = /<script>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(txt))) {
      if (m.index === scriptStart) continue;          // 主脚本稍后执行
      if (/currentScript/.test(m[1])) continue;       // 依赖 document.currentScript，测试环境无法模拟
      headScripts.push(m[1]);
    }
  }

  const state = { quota: !!opts.quotaExceeded, errors: [] };
  const store = new Map(Object.entries(opts.seed || {}));

  const localStorageStub = {
    getItem: k => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => {
      if (state.quota) { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; }
      store.set(k, String(v));
    },
    removeItem: k => store.delete(k),
    clear: () => store.clear()
  };

  const byId = new Map();
  const bySel = new Map();
  const getEl = (id) => { if (!byId.has(id)) { const e = makeEl('div'); e.id = id; byId.set(id, e); } return byId.get(id); };
  const selEl = (sel) => { if (!bySel.has(sel)) bySel.set(sel, makeEl('div')); return bySel.get(sel); };

  const docListeners = {};
  const documentStub = {
    documentElement: makeEl('html'),
    body: makeEl('body'),
    hidden: false,
    currentScript: null,
    getElementById: getEl,
    querySelector: selEl,
    querySelectorAll: () => [],
    createElement: (t) => makeEl(t),
    addEventListener: (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); },
    removeEventListener: () => {},
    /** 测试辅助：手动派发文档事件 */
    dispatch(type, ev = {}) {
      (docListeners[type] || []).forEach(fn => fn({
        type, target: makeEl('div'), preventDefault() {}, stopPropagation() {}, ...ev
      }));
    },
    _listeners: docListeners
  };

  const timers = [];
  const liveTimers = new Set();
  let timerSeq = 0;
  const addTimer = (fn, ms, kind) => { const id = ++timerSeq; timers.push({ id, fn, ms, kind }); liveTimers.add(id); return id; };
  const opened = [];
  const sandbox = {
    console,
    document: documentStub,
    localStorage: localStorageStub,
    open: (url) => { opened.push(url); },
    setTimeout: (fn, ms) => addTimer(fn, ms, 'timeout'),
    clearTimeout: (id) => { liveTimers.delete(id); },
    setInterval: (fn, ms) => addTimer(fn, ms, 'interval'),
    clearInterval: (id) => { liveTimers.delete(id); },
    requestAnimationFrame: (fn) => addTimer(fn, 16, 'raf'),
    cancelAnimationFrame: (id) => { liveTimers.delete(id); },
    fetch: () => Promise.reject(new Error('network disabled in tests')),
    AbortController,
    TextDecoder,
    Intl, Date, Math, JSON, Promise, URL, Error, RegExp, Number, String, Array, Object, parseInt, parseFloat, isNaN,
    Image: function Image() { return makeEl('img'); },
    FileReader: function FileReader() { this.readAsDataURL = () => {}; },
    navigator: { userAgent: 'node-test' },
    innerWidth: 1280, innerHeight: 800
  };
  sandbox.window = sandbox;
  sandbox.self = sandbox;
  sandbox.window.addEventListener = (type, fn) => { (docListeners[type] = docListeners[type] || []).push(fn); };
  sandbox.window.removeEventListener = () => {};

  vm.createContext(sandbox);
  headScripts.forEach((src, i) => {
    try { vm.runInContext(src, sandbox, { filename: 'head-' + i + '.js' }); }
    catch (e) { /* 前置脚本失败不影响主脚本验证 */ }
  });
  vm.runInContext(mainJs, sandbox, { filename: 'index-main.js' });

  /** 造一个"带 data-* 的委托目标"，closest() 能按属性选择器命中它自己 */
  function makeActionEl(attrs) {
    const el = makeEl('div');
    Object.keys(attrs || {}).forEach(k => { if (attrs[k] !== undefined) el.dataset[k] = String(attrs[k]); });
    el.closest = (sel) => {
      const map = {
        '[data-action]': 'action', '[data-input]': 'input', '[data-change]': 'change',
        '[data-blur]': 'blur', '[data-enter]': 'enter'
      };
      const key = map[sel];
      return key && el.dataset[key] !== undefined ? el : null;
    };
    return el;
  }

  return {
    window: sandbox,
    L: sandbox.L,
    document: documentStub,
    el: getEl,
    sel: selEl,
    store,
    timers,
    opened,
    makeActionEl,
    /** 模拟点击 data-action 元素（可选在派发前定制元素） */
    click(action, arg, customize) {
      const el = makeActionEl({ action, arg });
      if (customize) customize(el);
      documentStub.dispatch('click', { target: el });
      return el;
    },
    /** 模拟在 data-enter 元素上按回车 */
    enter(action, value, customize) {
      const el = makeActionEl({ enter: action, enterPrevent: '' });
      if (value !== undefined) el.value = value;
      if (customize) customize(el);
      documentStub.dispatch('keydown', { key: 'Enter', shiftKey: false, target: el, preventDefault() {} });
      return el;
    },
    /** 模拟 input 事件（useValueArg=true 时按 data-value-arg 传 el.value） */
    inputFire(action, value, useValueArg, customize) {
      const el = makeActionEl({ input: action, valueArg: useValueArg ? '1' : undefined });
      if (value !== undefined) el.value = value;
      if (customize) customize(el);
      documentStub.dispatch('input', { target: el });
      return el;
    },
    setQuota(v) { state.quota = !!v; },
    /** 触发所有 DOMContentLoaded 处理函数 */
    fireReady() { documentStub.dispatch('DOMContentLoaded'); },
    /** 取出指定毫秒的"仍存活"的定时器回调（默认取保存防抖 500ms） */
    timer(ms) { const t = timers.filter(x => x.ms === ms && liveTimers.has(x.id)); return t.length ? t[t.length - 1] : null; },
    /** 统计仍存活的定时器数量（可按毫秒/类型过滤） */
    liveCount(kind, ms) {
      return timers.filter(x => liveTimers.has(x.id)
        && (kind === undefined || x.kind === kind)
        && (ms === undefined || x.ms === ms)).length;
    },
    /** 执行当前记录的、仍存活的 rAF 回调（模拟下一帧） */
    frame() {
      timers.filter(x => x.kind === 'raf' && liveTimers.has(x.id)).forEach(t => { liveTimers.delete(t.id); t.fn(); });
    }
  };
}

/* ------------------------------------------------------------------
 * L 起始页 · DeepSeek 扩展外壳（V3.0.0「F」）
 *
 * 职责：
 *   1. 把起始页 UI 以 Shadow DOM 注入 chat.deepseek.com（DeepSeek 是
 *      frame-ancestors 'none'，iframe 方案完全不可行）
 *   2. 右上角鲸鱼按钮 → 收起浮层，露出 DeepSeek 原页面
 *   3. DeepSeek 原页面右上角「F」按钮 → 重新展开起始页
 *   4. 搜索引擎新增 deepseek：搜索框下移，上方挖一个洞露出真实聊天区
 *   5. 下移后的输入框回车 → 代填到 DeepSeek 输入框并发送
 *
 * 约定：
 *   - 不修改 index - new.html 一行代码，全部通过伪 document/window 适配
 *   - 起始页自己的存储加 `LSP:` 前缀，避免污染 DeepSeek 的 localStorage
 *   - 所有 DOM 查询限定在 shadow root 内，绝不碰 DeepSeek 的节点结构
 * ------------------------------------------------------------------ */
(function () {
  'use strict';

  if (window.__LSP_SHELL__) return;
  window.__LSP_SHELL__ = true;

  const D = self.__LSP_DATA__;
  if (!D || !self.__LSP_MAIN__) {
    console.warn('[L 起始页] 资源包缺失，请先执行 node tools/build-extension.mjs');
    return;
  }
  if (window.top !== window) return;          // 只在顶层文档注入
  if (document.getElementById('lsp-root-host')) return;

  const STORE_PREFIX = 'LSP:';
  const ENGINE_DS = 'deepseek';

  /* ================= 图标 ================= */

  /**
   * DeepSeek 鲸鱼标（官方 logo 的矢量轮廓）
   * 来源：simple-icons / deepseek（CC0-1.0），仅作识别本服务用途
   */
  const WHALE_PATH = 'M23.748 4.651c-.254-.124-.364.113-.512.233-.051.04-.094.09-.137.137-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.155-.708-.311-.955-.65-.172-.24-.219-.509-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.094.172.187.129.323-.082.28-.18.553-.266.833-.055.179-.137.218-.328.14a5.5 5.5 0 0 1-1.737-1.179c-.857-.828-1.631-1.743-2.597-2.46a12 12 0 0 0-.689-.47c-.985-.957.13-1.743.387-1.836.27-.098.094-.433-.778-.428-.872.003-1.67.295-2.687.685a3 3 0 0 1-.465.136 9.6 9.6 0 0 0-2.883-.101c-1.885.21-3.39 1.1-4.497 2.622C.082 8.776-.231 10.854.152 13.02c.403 2.284 1.568 4.175 3.36 5.653 1.857 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.132-.284 4.994-1.86.47.234.962.328 1.78.398.629.058 1.235-.031 1.705-.129.735-.155.684-.836.418-.961-2.155-1.004-1.682-.595-2.112-.926 1.095-1.295 2.768-3.598 3.284-6.733.05-.346.115-.834.108-1.114-.004-.171.035-.238.23-.257a4.2 4.2 0 0 0 1.545-.475c1.397-.763 1.96-2.016 2.093-3.517.02-.23-.004-.467-.247-.588M11.58 18.168c-2.088-1.642-3.101-2.183-3.52-2.16-.39.024-.32.472-.234.763.09.288.207.487.371.74.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.168-1.361-.801-2.5-1.86-3.301-3.306-.775-1.393-1.225-2.888-1.299-4.482-.02-.385.094-.522.477-.592a4.7 4.7 0 0 1 1.53-.038c2.131.311 3.946 1.264 5.467 2.774.868.86 1.525 1.887 2.202 2.89.72 1.066 1.494 2.082 2.48 2.915.348.291.626.513.892.677-.802.09-2.14.109-3.055-.615zm1.001-6.44a.306.306 0 0 1 .415-.287.3.3 0 0 1 .113.074.3.3 0 0 1 .086.214c0 .17-.136.307-.308.307a.303.303 0 0 1-.306-.307m3.11 1.596c-.2.081-.4.151-.591.16a1.25 1.25 0 0 1-.798-.254c-.274-.23-.47-.358-.551-.758a1.7 1.7 0 0 1 .015-.588c.07-.327-.007-.537-.238-.727-.188-.156-.426-.199-.689-.199a.6.6 0 0 1-.254-.078.253.253 0 0 1-.114-.358 1 1 0 0 1 .192-.21c.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.392.451.462.576.685.915.176.264.336.536.446.848.066.194-.02.353-.25.45';
  function whaleSvg(size) {
    return '<svg class="lsp-whale-svg" width="' + size + '" height="' + size +
      '" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="' + WHALE_PATH + '"/></svg>';
  }

  /* ================= 外壳样式 ================= */

  const SHELL_CSS = `
    /* 宿主：整层浮在最上面，自身不接收点击，交互交给子元素 */
    :host {
      background: transparent !important;
      overflow: visible !important;
      position: fixed;
      inset: 0;
      z-index: 2147483000;
      pointer-events: none;
      contain: layout style;
    }

    /* 壁纸层：唯一的不透明层，挖洞就挖在它身上 */
    #bg { pointer-events: none; }

    /* 点击屏蔽层：洞口区域的点击放给真页面 */
    .lsp-shield {
      position: fixed; inset: 0;
      pointer-events: auto;
      z-index: 1;
    }

    /* 面板描边：让洞口看起来像一张卡片 */
    .lsp-frame {
      position: fixed;
      pointer-events: none;
      z-index: 2;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.14);
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08);
      opacity: 0;
      transition: opacity 0.28s ease;
    }

    /* 起始页 UI 整体：容器不吃事件，子元素恢复 */
    .lsp-ui { pointer-events: none; }
    .lsp-ui > * { pointer-events: auto; }

    /* 挖洞：两段 radial 渐变合成后排除中间那块 → 透明窗 */
    :host(.lsp-ds) #bg.lsp-hole,
    .lsp-shield.lsp-hole {
      -webkit-mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
      -webkit-mask-position: 0 0, var(--lsp-hx, 0px) var(--lsp-hy, 0px);
      -webkit-mask-size: 100% 100%, var(--lsp-hw, 0px) var(--lsp-hh, 0px);
      -webkit-mask-repeat: no-repeat, no-repeat;
      -webkit-mask-composite: xor;
      mask-image: linear-gradient(#000, #000), linear-gradient(#000, #000);
      mask-position: 0 0, var(--lsp-hx, 0px) var(--lsp-hy, 0px);
      mask-size: 100% 100%, var(--lsp-hw, 0px) var(--lsp-hh, 0px);
      mask-repeat: no-repeat, no-repeat;
      mask-composite: exclude;
    }
    :host(.lsp-ds) .lsp-frame { opacity: 1; }

    /* 鲸鱼按钮：位置与尺寸对齐原来的齿轮，同为 36px 圆 */
    .lsp-whale {
      width: 36px; height: 36px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: rgba(255, 255, 255, var(--card-alpha, 0.06));
      -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px);
      border: 1.5px solid rgba(255, 255, 255, 0.2);
      color: rgba(255, 255, 255, 0.82);
      cursor: pointer;
      transition: box-shadow 0.22s, border-color 0.22s, transform 0.22s, color 0.22s;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
    }
    .lsp-whale:hover {
      box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.06), 0 4px 20px rgba(0, 0, 0, 0.2);
      border-color: rgba(255, 255, 255, 0.38);
      transform: translateY(-1px);
      color: #fff;
    }
    .lsp-whale-svg { display: block; }

    /* 「F」角标：只在收起浮层后出现 */
    .lsp-fab {
      position: fixed; top: 18px; right: 24px;
      width: 36px; height: 36px; border-radius: 50%;
      display: none; align-items: center; justify-content: center;
      background: rgba(13, 13, 26, 0.55);
      -webkit-backdrop-filter: blur(14px) saturate(1.2); backdrop-filter: blur(14px) saturate(1.2);
      border: 1.5px solid rgba(255, 255, 255, 0.32);
      color: rgba(255, 255, 255, 0.92);
      font: 700 13px/1 -apple-system, 'Segoe UI', sans-serif;
      cursor: pointer; z-index: 5; pointer-events: auto;
      box-shadow: 0 6px 22px rgba(0, 0, 0, 0.3);
      transition: transform 0.22s, border-color 0.22s, background-color 0.22s;
    }
    .lsp-fab:hover { transform: scale(1.08); border-color: rgba(255, 255, 255, 0.7); background: rgba(13, 13, 26, 0.7); }

    /* 收起态：整层只剩「F」 */
    :host(.lsp-page) #bg,
    :host(.lsp-page) .lsp-shield,
    :host(.lsp-page) .lsp-frame,
    :host(.lsp-page) .lsp-ui { display: none !important; }
    :host(.lsp-page) .lsp-fab { display: flex; }

    /* deepseek 模式：把中间让给聊天区 */
    :host(.lsp-ds) .clock,
    :host(.lsp-ds) .motto { opacity: 0; pointer-events: none; transition: opacity 0.25s; }
    :host(.lsp-ds) .search-area {
      top: auto !important;
      bottom: 6.5vh !important;
      transform: translate(-50%, 0) !important;
    }
    :host(.lsp-ds) .search-area:hover { transform: translate(-50%, 0) scale(1.02) !important; }
    :host(.lsp-ds) .search-wrap { box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28); }

    /* 引擎下拉里的 DeepSeek 项：图标用鲸鱼，保持与字母徽标同尺寸 */
    .engine-dropdown .opt .eng-icon > svg { width: 13px; height: 13px; display: block; }
    .engine-dropdown .opt .eng-icon {
      display: inline-flex; align-items: center; justify-content: center;
    }
  `;

  /* ================= 注入 ================= */

  const host = document.createElement('div');
  host.id = 'lsp-root-host';
  host.className = 'lsp-mode-start';
  document.documentElement.appendChild(host);

  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<style>' + D.css + '\n' + SHELL_CSS + '</style>' +
    '<div class="lsp-ui">' + D.html + '</div>';

  // 三个辅助层：屏蔽层 / 描边 / F 角标
  const shield = document.createElement('div');
  shield.className = 'lsp-shield';
  root.appendChild(shield);

  const frame = document.createElement('div');
  frame.className = 'lsp-frame';
  root.appendChild(frame);

  const fab = document.createElement('div');
  fab.className = 'lsp-fab';
  fab.title = '打开 L 起始页';
  fab.textContent = 'F';
  root.appendChild(fab);

  /* ================= 伪 document / localStorage ================= */

  const ls = {
    getItem: (k) => window.localStorage.getItem(STORE_PREFIX + k),
    setItem: (k, v) => window.localStorage.setItem(STORE_PREFIX + k, v),
    removeItem: (k) => window.localStorage.removeItem(STORE_PREFIX + k),
    get length() { return 0; },
    key: () => null
  };

  const doc = {
    getElementById: (id) => root.getElementById(id),
    querySelector: (s) => root.querySelector(s),
    querySelectorAll: (s) => root.querySelectorAll(s),
    createElement: (t) => document.createElement(t),
    createElementNS: (ns, t) => document.createElementNS(ns, t),
    createTextNode: (t) => document.createTextNode(t),
    addEventListener: (type, fn, opt) => {
      // 注入时机已过 DOMContentLoaded，直接异步补一次，别让启动逻辑永远等下去
      if (type === 'DOMContentLoaded') { setTimeout(() => fn({ type: type }), 0); return; }
      document.addEventListener(type, fn, opt);
    },
    removeEventListener: (type, fn, opt) => document.removeEventListener(type, fn, opt),
    get documentElement() { return host; },
    get body() { return root; },
    get head() { return root; },
    get hidden() { return document.hidden; },
    get visibilityState() { return document.visibilityState; },
    get readyState() { return 'complete'; },
    get currentScript() { return null; },
    get activeElement() { return root.activeElement || document.activeElement; }
  };

  /* ================= 启动起始页 ================= */

  try {
    if (self.__LSP_PRE__) self.__LSP_PRE__(doc, ls);
    if (self.__LSP_CONST__) self.__LSP_CONST__(window);
    self.__LSP_MAIN__(doc, window, ls);
  } catch (err) {
    console.error('[L 起始页] 初始化失败', err);
    return;
  }

  const L = window.L || {};

  function toast(msg) {
    if (L.showToast) L.showToast(msg);
  }

  /* ================= 模式切换 ================= */

  let mode = 'start';         // start | page
  let engine = 'search';      // search | deepseek

  function setMode(next) {
    mode = next;
    host.classList.toggle('lsp-page', next === 'page');
    host.classList.toggle('lsp-mode-start', next === 'start');
    if (next === 'page') {
      exitDs();
      if (L.closeAllPopups) L.closeAllPopups();
    }
  }

  function enterDs() {
    engine = 'deepseek';
    host.classList.add('lsp-ds');
    root.querySelector('#searchInput').placeholder = '和 DeepSeek 说点什么…';
    root.querySelector('#bg').classList.add('lsp-hole');
    shield.classList.add('lsp-hole');
    // 布局依赖 search-area 下移后的位置，立刻算一次，再补两拍兜住过渡/重排
    layoutPanel();
    requestAnimationFrame(layoutPanel);
    setTimeout(layoutPanel, 320);
  }

  function exitDs() {
    engine = 'search';
    host.classList.remove('lsp-ds');
    root.querySelector('#searchInput').placeholder = '搜索…';
    root.querySelector('#bg').classList.remove('lsp-hole');
    shield.classList.remove('lsp-hole');
  }

  /* ================= 鲸鱼按钮 / F 角标 ================= */

  const topRight = root.querySelector('.top-right');
  if (topRight) {
    const whale = document.createElement('div');
    whale.className = 'lsp-whale';
    whale.title = '回到 DeepSeek 页面';
    whale.innerHTML = whaleSvg(18);
    whale.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode('page');
    }, true);
    topRight.insertBefore(whale, topRight.firstChild);
  }

  fab.addEventListener('click', (e) => {
    e.stopPropagation();
    setMode('start');
  }, true);

  /* ================= 引擎：新增 deepseek ================= */

  const dropdown = root.querySelector('#engineDropdown');
  let dsOpt = null;

  function buildDsOption() {
    const opt = document.createElement('div');
    opt.className = 'opt';
    opt.dataset.lspEngine = ENGINE_DS;
    opt.innerHTML = '<span class="eng-icon" style="--ec:#4D6BFE">' + whaleSvg(13) + '</span> deepseek';
    opt.addEventListener('click', (e) => {
      e.stopPropagation();
      selectDs();
    }, true);
    return opt;
  }

  function selectDs() {
    if (!dsOpt) return;
    root.querySelectorAll('.engine-dropdown .opt').forEach((o) => o.classList.remove('active'));
    dsOpt.classList.add('active');

    const label = root.querySelector('#engineLabel');
    if (label) {
      label.innerHTML = whaleSvg(15);
      label.style.setProperty('--ec', '#4D6BFE');
    }
    if (window.PopupManager) window.PopupManager.close('engineDropdown');
    else if (L.closePopup) L.closePopup('engineDropdown');

    enterDs();
  }

  if (dropdown) {
    dsOpt = buildDsOption();
    dropdown.appendChild(dsOpt);

    // 选回 Google / Bing / Yandex 时退出深聊模式
    dropdown.addEventListener('click', (e) => {
      const opt = e.target.closest && e.target.closest('.opt');
      if (opt && !opt.dataset.lspEngine) exitDs();
    }, true);
  }

  /* ================= 回车 / 点击搜索：deepseek 模式改写行为 ================= */

  root.addEventListener('keydown', (e) => {
    if (engine !== 'deepseek') return;
    if (e.key !== 'Enter' || e.isComposing) return;
    if (e.target && e.target.id === 'searchInput') {
      e.preventDefault();
      e.stopPropagation();
      submitToDs();
    }
  }, true);

  root.addEventListener('click', (e) => {
    if (engine !== 'deepseek') return;
    if (e.target.closest && e.target.closest('.search-btn')) {
      e.preventDefault();
      e.stopPropagation();
      submitToDs();
    }
  }, true);

  /* ================= 与 DeepSeek 页面交互 ================= */

  function isVisible(el) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 10) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.01;
  }

  /** 找 DeepSeek 的输入框：优先可见 textarea，其次 contenteditable */
  function findComposer() {
    const areas = [...document.querySelectorAll('textarea')].filter(isVisible);
    if (areas.length) {
      areas.sort((a, b) => {
        const ra = a.getBoundingClientRect(); const rb = b.getBoundingClientRect();
        return (rb.width * rb.height) - (ra.width * ra.height);
      });
      return areas[0];
    }
    const editables = [...document.querySelectorAll('[contenteditable="true"]')].filter(isVisible);
    return editables[0] || null;
  }

  /** 在输入框附近找发送按钮 */
  function findSendBtn(composer) {
    const named = document.querySelectorAll(
      'button[aria-label*="发送"], button[aria-label*="Send"], [role="button"][aria-label*="发送"], [role="button"][aria-label*="Send"]'
    );
    if (named.length) return named[0];

    let box = composer;
    for (let i = 0; i < 6 && box; i++) {
      const cands = [...box.querySelectorAll('button, [role="button"], div[class*="send" i]')]
        .filter(isVisible)
        .filter((el) => el !== composer);
      if (cands.length) return cands[cands.length - 1];
      box = box.parentElement;
    }
    return null;
  }

  function setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const desc = Object.getOwnPropertyDescriptor(proto, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
  }

  /** 把文本灌进 DeepSeek 输入框并发送 */
  function sendToDs(text) {
    const box = findComposer();
    if (!box) {
      toast('没找到 DeepSeek 输入框，页面可能还没加载完');
      return false;
    }
    box.focus();
    if (box.tagName === 'TEXTAREA') {
      setNativeValue(box, text);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      box.textContent = text;
      box.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
    }

    const btn = findSendBtn(box);
    if (btn && !btn.disabled) { btn.click(); return true; }

    const opts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    box.dispatchEvent(new KeyboardEvent('keydown', opts));
    box.dispatchEvent(new KeyboardEvent('keypress', opts));
    box.dispatchEvent(new KeyboardEvent('keyup', opts));
    return true;
  }

  function submitToDs() {
    const input = root.querySelector('#searchInput');
    const text = (input.value || '').trim();
    if (!text) { input.focus(); return; }
    if (sendToDs(text)) {
      input.value = '';
      toast('已发送到 DeepSeek');
    }
  }

  /* ================= 挖洞位置（跟随真实聊天区） ================= */

  /** 找页面里最大的可纵向滚动容器 —— 就是消息列表 */
  function findChatRect() {
    const vh = window.innerHeight;
    let best = null;
    const all = document.querySelectorAll('div');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      const st = getComputedStyle(el);
      if (!/(auto|scroll)/.test(st.overflowY)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 320 || r.height < 180) continue;
      if (r.top < -40 || r.bottom > vh + 40) continue;
      // 空会话时内容可能还不满一屏，所以只要求"能滚动"而不是"正在滚动"
      if (el.scrollHeight + 20 < el.clientHeight) continue;
      const area = r.width * r.height;
      if (!best || area > best.area) {
        best = { area: area, r: { left: r.left, top: r.top, width: r.width, height: r.height } };
      }
    }
    return best ? best.r : null;
  }

  function layoutPanel() {
    if (engine !== 'deepseek' || mode !== 'start') return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const area = root.querySelector('.search-area');
    const areaRect = area.getBoundingClientRect();

    const chat = findChatRect();
    let x, w, y;
    if (chat) {
      w = Math.min(chat.width, 1020);
      x = chat.left + (chat.width - w) / 2;
      y = Math.max(8, chat.top);
    } else {
      w = Math.min(880, vw * 0.66);
      x = (vw - w) / 2;
      y = Math.max(8, vh * 0.08);
    }

    const bottomLimit = areaRect.top - 18;
    let h = bottomLimit - y;
    if (h < 140) { h = Math.max(120, bottomLimit - y); }
    h = Math.max(0, Math.min(h, vh - y - 8));

    host.style.setProperty('--lsp-hx', Math.round(x) + 'px');
    host.style.setProperty('--lsp-hy', Math.round(y) + 'px');
    host.style.setProperty('--lsp-hw', Math.round(w) + 'px');
    host.style.setProperty('--lsp-hh', Math.round(h) + 'px');

    frame.style.left = Math.round(x) + 'px';
    frame.style.top = Math.round(y) + 'px';
    frame.style.width = Math.round(w) + 'px';
    frame.style.height = Math.round(h) + 'px';
  }

  let rafId = 0;
  function scheduleLayout() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => { rafId = 0; layoutPanel(); });
  }
  window.addEventListener('resize', scheduleLayout);
  document.addEventListener('scroll', scheduleLayout, true);

  /* ================= 调试出口 ================= */

  window.__LSP__ = {
    show: () => setMode('start'),
    hide: () => setMode('page'),
    ds: () => { selectDs(); return engine; },
    exitDs: () => exitDs(),
    get mode() { return mode; },
    get engine() { return engine; },
    layout: layoutPanel,
    measure: findChatRect,
    send: sendToDs,
    composer: findComposer
  };
})();

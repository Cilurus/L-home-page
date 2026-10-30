/**
 * P4  §2 领域层抽取（纯函数，不碰 DOM / 存储）
 *  · 新增 Domain.Lunar / Domain.Text / Domain.Bookmarks / Domain.Chat
 *  · 视图函数改为薄封装：getBookmarks、removeBookmarkAt、bmListAdd、compactAllBookmarks、
 *    saveBookmark 下标校验、renderLunar、esc/md、sendMorphMsg、autoMessage
 *  · ganzhiDay 的取整由 Math.floor 改为 Math.round（南半球夏令时下本地时区可能差一天）
 *  · window.L 增加 Domain 入口，便于调试与单测
 * 用法：node tools/refactor-p4.mjs [--write]
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
 * 1. §0 配置：上下文条数
 * ======================================================================== */
step('CONFIG 增加上下文条数',
  '    SAVE_DEBOUNCE_MS: 500,         // mc_final 落盘防抖',
  `    SAVE_DEBOUNCE_MS: 500,         // mc_final 落盘防抖
    MAX_CONTEXT_MSGS: 30,          // 每次请求携带的最近消息条数`, 1);

/* ==========================================================================
 * 2. 插入 §2 领域层
 * ======================================================================== */
const DOMAIN = `  /* ==========================================================================
   * §2  领域层   Domain（纯逻辑：不碰 DOM、不碰存储、不改全局状态）
   * --------------------------------------------------------------------------
   * 为什么单独一层：农历换算、文本清洗、收藏槽位、会话组装这些规则原先直接长在视图
   * 函数里，既不好测、也容易被顺手改坏。抽成纯函数后可被 tests/p4.test.mjs 直接调用。
   * 约定：只接收参数、只返回新值（少数就地修改数组的方法会返回同一数组以便链式使用）。
   * ======================================================================== */

  /** 二十四节气名（小寒起） */
  const SOLAR_TERMS = [
    '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨',
    '立夏', '小满', '芒种', '夏至', '小暑', '大暑', '立秋', '处暑',
    '白露', '秋分', '寒露', '霜降', '立冬', '小雪', '大雪', '冬至'
  ];
  /** 每个节气的近似交节日期（月*100+日），与小寒一一对应 */
  const SOLAR_TERM_DAYS = [105, 120, 204, 219, 305, 320, 405, 420, 505, 521, 605, 621,
    707, 722, 807, 823, 907, 923, 1008, 1023, 1107, 1122, 1207, 1222];

  const Domain = {
    /* ---------- 农历与干支 ---------- */
    Lunar: {
      /**
       * 十二时辰序号。
       * @param {Date} date
       * @returns {number} 0~11（0 = 子时）
       */
      shichenIndex: function (date) { return Math.floor((date.getHours() + 1) / 2) % 12; },

      /**
       * 由干支年名取生肖。
       * @param {string} yearName 如 '丙午'
       * @returns {string} 如 '马'；取不到时返回 ''
       */
      zodiacOf: function (yearName) {
        var zhi = yearName && yearName.length >= 2 ? yearName[yearName.length - 1] : '';
        for (var i = 0; i < ZHI.length; i++) { if (ZHI[i] === zhi) return SHENGXIAO[i] || ''; }
        return '';
      },

      /**
       * 日柱干支。锚点：1900-01-01 = 甲戌日（已用 2024-01-01 甲子、1949-10-01 甲子核对）。
       * @param {Date} date
       * @returns {string} 如 '甲子'
       * 说明：用 Math.round 而非 Math.floor —— 本地时区在夏令时/历史时区下两日之差可能
       *       不是整数天，floor 会整体差一天（南半球时区尤其明显）。
       */
      ganzhiDay: function (date) {
        var ref = new Date(1900, 0, 1);
        var diff = Math.round((date - ref) / 86400000);
        return GAN[((diff % 10) + 10) % 10] + ZHI[((diff % 12) + 10) % 12];
      },

      /**
       * 当前所处节气（近似表，交节当天可能差 1 天）。
       * @param {Date} date
       * @returns {string}
       */
      solarTerm: function (date) {
        var v = date.getMonth() * 100 + date.getDate() + 100;
        for (var i = SOLAR_TERM_DAYS.length - 1; i >= 0; i--) {
          if (v >= SOLAR_TERM_DAYS[i]) return SOLAR_TERMS[i];
        }
        return SOLAR_TERMS[SOLAR_TERMS.length - 1];
      },

      /**
       * 农历 / 干支快照，供视图一次性取用。
       * @param {Date} date
       * @returns {{yearName:string, zodiac:string, month:string, day:string, solarTerm:string,
       *            shichen:string, shichenRange:string, shichenIndex:number, ganzhiDay:string}}
       */
      snapshot: function (date) {
        var p = _lunarFull.formatToParts(date), y = '', m = '', d = '';
        p.forEach(function (x) {
          if (x.type === 'yearName') y = x.value;
          else if (x.type === 'month') m = x.value;
          else if (x.type === 'day') d = x.value;
        });
        var si = Domain.Lunar.shichenIndex(date);
        return {
          yearName: y,
          zodiac: Domain.Lunar.zodiacOf(y),
          month: m,
          day: d,
          solarTerm: Domain.Lunar.solarTerm(date),
          shichen: SHICHEN[si] || '',
          shichenRange: SHICHEN_RANGE[si] || '',
          shichenIndex: si,
          ganzhiDay: Domain.Lunar.ganzhiDay(date)
        };
      }
    },

    /* ---------- 文本 ---------- */
    Text: {
      /**
       * 转义 HTML 元字符（等价于原先"建 div 取 innerHTML"，但不再碰 DOM）。
       * @param {string} s
       * @returns {string}
       */
      escape: function (s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      },

      /**
       * 极简 Markdown 渲染（先整体转义，再套用有限语法，输出仍须过 sanitizeHTML）。
       * @param {string} t
       * @returns {string} HTML 片段
       */
      markdown: function (t) {
        var E = Domain.Text.escape;
        var h = E(t);
        h = h.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, function (_, l, c) {
          return '<pre><code class="language-' + E(l || '') + '">' + E(c.trim()) + '</code></pre>';
        });
        h = h.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
        h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
        h = h.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>');
        h = h.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>');
        h = h.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
        h = h.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
        h = h.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
        h = h.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');
        h = h.replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>');
        h = h.replace(/\\n\\n/g, '</p><p>');
        h = h.replace(/\\n/g, '<br>');
        if (!h.startsWith('<h') && !h.startsWith('<pre') && !h.startsWith('<ul') && !h.startsWith('<blockquote')) h = '<p>' + h + '</p>';
        return h;
      }
    },

    /* ---------- 收藏槽位 ---------- */
    Bookmarks: {
      /**
       * 把存储里的原始值规整为定长槽位数组。
       * @param {*} raw Store.json 读到的原始值
       * @param {number} total 槽位总数
       * @returns {{slots:Array<object|null>, repaired:boolean, corrupt:boolean}}
       *          repaired=true 表示长度不符（已截断/补齐，内容不丢）；
       *          corrupt=true 表示根本不是数组（调用方提示用户，但不要删原始数据）
       */
      normalizeSlots: function (raw, total) {
        if (Array.isArray(raw)) {
          if (raw.length === total) return { slots: raw, repaired: false, corrupt: false };
          var slots = raw.slice(0, total);
          while (slots.length < total) slots.push(null);
          return { slots: slots, repaired: true, corrupt: false };
        }
        var empty = [];
        for (var i = 0; i < total; i++) empty.push(null);
        return { slots: empty, repaired: false, corrupt: raw !== null && raw !== undefined };
      },

      /**
       * 槽位下标是否合法。
       * @param {*} idx
       * @param {number} total
       * @returns {boolean}
       */
      isValidIndex: function (idx, total) { return Number.isInteger(idx) && idx >= 0 && idx < total; },

      /**
       * 删除槽位。compact=true 时后续槽位整体前移（自动补位）。
       * @param {Array} slots
       * @param {number} idx
       * @param {boolean} compact
       * @returns {Array} 同一个数组（便于链式使用）
       */
      removeAt: function (slots, idx, compact) {
        if (compact) {
          for (var j = idx; j < slots.length - 1; j++) slots[j] = slots[j + 1];
          slots[slots.length - 1] = null;
        } else {
          slots[idx] = null;
        }
        return slots;
      },

      /**
       * 全部前移去掉空槽（"自动补位"偏好切换时使用）。
       * @param {Array} slots
       * @returns {Array} 同一个数组
       */
      compact: function (slots) {
        var filled = slots.filter(function (s) { return !!s; });
        for (var i = 0; i < slots.length; i++) slots[i] = filled[i] || null;
        return slots;
      },

      /**
       * 第一个空槽下标。
       * @param {Array} slots
       * @returns {number} 没有空位时返回 -1
       */
      nextFree: function (slots) {
        for (var i = 0; i < slots.length; i++) { if (!slots[i]) return i; }
        return -1;
      }
    },

    /* ---------- 会话 ---------- */
    Chat: {
      /**
       * 取最近 max 条消息（发给 API 的上下文窗口）。
       * @param {Array<{role:string, content:string}>} messages
       * @param {number} max
       * @returns {Array}
       */
      recent: function (messages, max) { return (messages || []).slice(-max); },

      /**
       * 组装系统提示词。
       * @param {{systemPrompt:string}} char 角色
       * @param {{name?:string, interests?:string}} profile 个人资料
       * @param {'chat'|'auto'} mode 'chat' 追加称呼+兴趣；'auto' 仅追加称呼（沿用各自的原有格式）
       * @returns {string}
       */
      systemPrompt: function (char, profile, mode) {
        var sys = (char && char.systemPrompt) || '';
        profile = profile || {};
        if (mode === 'auto') {
          if (profile.name) sys += '\\n用户称呼：' + profile.name;
          return sys;
        }
        if (profile.name || profile.interests) {
          sys += '\\n\\n用户信息：' + (profile.name ? '称呼：' + profile.name + '。' : '') +
                 (profile.interests ? '兴趣爱好：' + profile.interests + '。' : '');
        }
        return sys;
      },

      /**
       * 拼成 /chat/completions 的 messages 数组。
       * @param {string} systemText
       * @param {Array<{role:string, content:string}>} messages
       * @returns {Array<{role:string, content:string}>}
       */
      toApiMessages: function (systemText, messages) {
        return [{ role: 'system', content: systemText }].concat(
          (messages || []).map(function (m) { return { role: m.role, content: m.content }; })
        );
      }
    }
  };

  /* ==========================================================================
   * §4  视图层 · PopupManager（浮层管理器）`;

step('插入 §2 领域层', '  /* ==========================================================================\n   * §4  视图层 · PopupManager（浮层管理器）', DOMAIN, 1);

/* ==========================================================================
 * 3. 收藏：视图函数改为薄封装
 * ======================================================================== */
step('getBookmarks 委托 Domain',
`function getBookmarks() {
  const d = Store.json(KEYS.BOOKMARKS, null);
  if (Array.isArray(d)) {
    if (d.length === BM_TOTAL) return d;
    const fixed = d.slice(0, BM_TOTAL);
    while (fixed.length < BM_TOTAL) fixed.push(null);
    Store.write(KEYS.BOOKMARKS, JSON.stringify(fixed));
    return fixed;
  }
  if (d !== null && !_bmCorruptReported) {
    _bmCorruptReported = true;
    showToast('收藏数据格式异常，已按空槽位处理（原始数据未被删除）');
  }
  return Array(BM_TOTAL).fill(null);
}`,
`function getBookmarks() {
  const res = Domain.Bookmarks.normalizeSlots(Store.json(KEYS.BOOKMARKS, null), BM_TOTAL);
  if (res.repaired) Store.write(KEYS.BOOKMARKS, JSON.stringify(res.slots));
  if (res.corrupt && !_bmCorruptReported) {
    _bmCorruptReported = true;
    showToast('收藏数据格式异常，已按空槽位处理（原始数据未被删除）');
  }
  return res.slots;
}`, 1);

step('removeBookmarkAt 委托 Domain',
`function removeBookmarkAt(idx) {
  const bms = getBookmarks();
  if (isCompact()) {
    for (let j = idx; j < BM_TOTAL - 1; j++) bms[j] = bms[j + 1];
    bms[BM_TOTAL - 1] = null;
  } else {
    bms[idx] = null;
  }
  saveBookmarks(bms);
}`,
`function removeBookmarkAt(idx) {
  saveBookmarks(Domain.Bookmarks.removeAt(getBookmarks(), idx, isCompact()));
}`, 1);

step('compactAllBookmarks 委托 Domain',
`function compactAllBookmarks() {
  const bms = getBookmarks();
  var filled = [];
  for (var i = 0; i < BM_TOTAL; i++) { if (bms[i]) filled.push(bms[i]); }
  for (var i = 0; i < BM_TOTAL; i++) { bms[i] = filled[i] || null; }
  saveBookmarks(bms);
}`,
`function compactAllBookmarks() {
  saveBookmarks(Domain.Bookmarks.compact(getBookmarks()));
}`, 1);

step('bmListAdd 取空槽委托 Domain',
`  const bms = getBookmarks();
  var nextIdx = -1;
  for (var i = 0; i < BM_TOTAL; i++) { if (!bms[i]) { nextIdx = i; break; } }
  if (nextIdx < 0) { _bmFromList = false; showToast('收藏已满（最多20个）'); return; }`,
`  var nextIdx = Domain.Bookmarks.nextFree(getBookmarks());
  if (nextIdx < 0) { _bmFromList = false; showToast('收藏已满（最多20个）'); return; }`, 1);

step('saveBookmark 下标校验委托 Domain',
`  if (!Number.isInteger(bmEditIdx) || bmEditIdx < 0 || bmEditIdx >= BM_TOTAL) {
    showToast('收藏位置无效，请重新打开书签栏');
    return;
  }`,
`  if (!Domain.Bookmarks.isValidIndex(bmEditIdx, BM_TOTAL)) {
    showToast('收藏位置无效，请重新打开书签栏');
    return;
  }`, 1);

/* ==========================================================================
 * 4. 农历：纯函数下沉，视图只负责取数与排版
 * ======================================================================== */
step('农历纯函数下沉',
`function getLunar(date) {
  var p = _lunarFull.formatToParts(date), y, m, d;
  p.forEach(function(x){ if(x.type==='yearName') y=x.value; else if(x.type==='month') m=x.value; else if(x.type==='day') d=x.value; });
  return { yearName: y, month: m, day: d };
}
function ganzhiDay(date) {
  var ref=new Date(1900,0,1); // 甲戌日
  var diff=Math.floor((date-ref)/86400000);
  return GAN[((diff%10)+10)%10]+ZHI[((diff%12)+10)%12];
}
function getSolarTerm(date) {
  var terms=[
    '小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨',
    '立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑',
    '白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'
  ];
  // Approximate dates for each solar term (month.day * 100 for easy comparison)
  var approx=[105,120,204,219,305,320,405,420,505,521,605,621,707,722,807,823,907,923,1008,1023,1107,1122,1207,1222];
  var v=date.getMonth()*100+date.getDate()+100; // offset by 100 to match approx format
  // Find the most recent solar term
  for(var i=23;i>=0;i--){
    if(v>=approx[i]) return terms[i];
  }
  return terms[23];
}`,
`/* 以下三个是 Domain.Lunar 的薄封装（保持既有函数名，便于阅读与将来扩展） */
/** @param {Date} date @returns {object} 同 Domain.Lunar.snapshot */
function getLunar(date) { return Domain.Lunar.snapshot(date); }
/** @param {Date} date @returns {string} 日柱干支，如 '甲子' */
function ganzhiDay(date) { return Domain.Lunar.ganzhiDay(date); }
/** @param {Date} date @returns {string} 当前节气名 */
function getSolarTerm(date) { return Domain.Lunar.solarTerm(date); }`, 1);

step('renderLunar 改用快照',
`function renderLunar(d) {
  var lu2 = getLunar(d);
  var gz = lu2.yearName;
  var zhiStr = gz.length >= 2 ? gz[gz.length - 1] : '';
  var sx = '';
  for (var zi = 0; zi < ZHI.length; zi++) { if (ZHI[zi] === zhiStr) { sx = SHENGXIAO[zi]; break; } }
  var si = Math.floor((d.getHours() + 1) / 2) % 12;
  var term = getSolarTerm(d);
  document.getElementById('lunarGanzhi').textContent = gz + sx + '年';
  // 缺陷修复：旧实现在日期与节气之间留了一个多余的下划线占位符
  document.getElementById('lunarDate').textContent = lu2.month + lu2.day + '  ' + term;
  document.getElementById('lunarHour').textContent = SHICHEN[si] + ' (' + SHICHEN_RANGE[si] + ')';`,
`function renderLunar(d) {
  var info = Domain.Lunar.snapshot(d);
  document.getElementById('lunarGanzhi').textContent = info.yearName + info.zodiac + '年';
  // 缺陷修复：旧实现在日期与节气之间留了一个多余的下划线占位符
  document.getElementById('lunarDate').textContent = info.month + info.day + '  ' + info.solarTerm;
  document.getElementById('lunarHour').textContent = info.shichen + ' (' + info.shichenRange + ')';`, 1);

step('renderLunar 返回时辰序号',
`  requestAnimationFrame(function () { PopupManager.open('lunarPopup'); });
  return si;
}`,
`  requestAnimationFrame(function () { PopupManager.open('lunarPopup'); });
  return info.shichenIndex;
}`, 1);

step('openLunarPopup 用 Domain 计算时辰',
`    var nsi = Math.floor((nd.getHours() + 1) / 2) % 12;
    if (nsi !== si) { si = nsi; renderLunar(nd); }                                        // 时辰变化时刷新`,
`    var nsi = Domain.Lunar.shichenIndex(nd);
    if (nsi !== si) { si = nsi; renderLunar(nd); }                                        // 时辰变化时刷新`, 1);

/* ==========================================================================
 * 5. 文本：escape / markdown 下沉
 * ======================================================================== */
step('esc / md / C 改为薄封装',
`function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function md(t) {
  let h = t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  h = h.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, (_, l, c) => \`<pre><code class="language-\${l||''}">\${C(c.trim())}</code></pre>\`);
  h = h.replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  h = h.replace(/^### (.+)$/gm, '<h3>$1</h3>'); h = h.replace(/^## (.+)$/gm, '<h2>$1</h2>'); h = h.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  h = h.replace(/\\*\\*\\*(.+?)\\*\\*\\*/g, '<strong><em>$1</em></strong>'); h = h.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>'); h = h.replace(/\\*(.+?)\\*/g, '<em>$1</em>');
  h = h.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  h = h.replace(/^[-*] (.+)$/gm, '<li>$1</li>'); h = h.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>'); h = h.replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>');
  h = h.replace(/\\n\\n/g, '</p><p>'); h = h.replace(/\\n/g, '<br>');
  if (!h.startsWith('<h') && !h.startsWith('<pre') && !h.startsWith('<ul') && !h.startsWith('<blockquote')) h = '<p>'+h+'</p>';
  return h;
}
function C(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }`,
`/* 文本处理已下沉到 Domain.Text；以下保留同名薄封装，调用点无需改动 */
/** @param {string} s @returns {string} 转义后的 HTML 文本 */
function esc(s) { return Domain.Text.escape(s); }
/** @param {string} t @returns {string} Markdown 渲染结果（仍需过 sanitizeHTML） */
function md(t) { return Domain.Text.markdown(t); }
/** @deprecated 与 esc 等价，保留兼容 @param {string} s @returns {string} */
function C(s) { return Domain.Text.escape(s); }`, 1);

/* ==========================================================================
 * 6. 会话组装下沉
 * ======================================================================== */
step('sendMorphMsg 用 Domain 组装',
`  const recent = data.conversations[currentCharId].slice(-30);
  let sys = char.systemPrompt;
  if (data.profile.name || data.profile.interests) sys += '\\n\\n用户信息：' + (data.profile.name ? '称呼：' + data.profile.name + '。' : '') + (data.profile.interests ? '兴趣爱好：' + data.profile.interests + '。' : '');
  const apiMsgs = [{ role:'system', content:sys }, ...recent.map(m=>({role:m.role,content:m.content})) ];`,
`  const recent = Domain.Chat.recent(data.conversations[currentCharId], CONFIG.MAX_CONTEXT_MSGS);
  const sys = Domain.Chat.systemPrompt(char, data.profile, 'chat');
  const apiMsgs = Domain.Chat.toApiMessages(sys, recent);`, 1);

step('autoMessage 用 Domain 组装',
`  var sys = char.systemPrompt;
  if (data.profile.name) sys += '\\n用户称呼：' + data.profile.name;
  var apiMsgs = [{ role:'system', content: sys }, { role:'user', content: topic }];`,
`  var sys = Domain.Chat.systemPrompt(char, data.profile, 'auto');
  var apiMsgs = Domain.Chat.toApiMessages(sys, [{ role: 'user', content: topic }]);`, 1);

/* ==========================================================================
 * 7. 开放 Domain 调试入口
 * ======================================================================== */
step('window.L 暴露 Domain',
`    data: function () { return data; },
    showToast: showToast,`,
`    data: function () { return data; },
    Domain: Domain,
    showToast: showToast,`, 1);

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

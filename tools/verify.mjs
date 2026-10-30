/**
 * 结构自检器（可长期保留，后续每个阶段都跑）
 * 用法：node tools/verify.mjs
 * 检查项：
 *   1. 主脚本能否通过语法解析（vm.Script，不执行）
 *   2. 主脚本里是否还残留字面量存储键（只允许出现在 §0 KEYS 定义块内）
 *   3. 关键结构指标（DOM 耦合度、内联样式、存储调用、导出数量）
 *   4. 文件头/分区注释是否存在
 */
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* 与仓库位置无关：始终读本文件上一级目录里的主页面 */
const FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'index - new.html');
const txt = fs.readFileSync(FILE, 'utf8');
const lines = txt.split(/\r?\n/);
let fail = 0;
const ok = (cond, msg, extra = '') => {
  if (cond) console.log('  PASS  ' + msg + (extra ? '  ' + extra : ''));
  else { fail++; console.log('  FAIL  ' + msg + (extra ? '  ' + extra : '')); }
};

/* ---------- 抽取主脚本（最后一个 <script> 块） ---------- */
const scriptStart = txt.lastIndexOf('<script>');
const scriptEnd = txt.indexOf('</script>', scriptStart);
const mainJs = txt.slice(scriptStart + '<script>'.length, scriptEnd);

console.log('\n[1] 主脚本语法解析');
try { new vm.Script(mainJs, { filename: 'main.js' }); ok(true, 'vm.Script 解析通过', `${mainJs.split('\n').length} 行`); }
catch (e) { ok(false, '语法错误', e.message); }

console.log('\n[2] 字面量存储键是否已收敛到 §0');
const keysBlockStart = mainJs.indexOf('const KEYS = {');
const keysBlockEnd = mainJs.indexOf('};', keysBlockStart);
const outsideKeys = mainJs.slice(0, keysBlockStart) + mainJs.slice(keysBlockEnd);
const leftovers = [...outsideKeys.matchAll(/'mc_[A-Za-z_]+'/g)].map(m => m[0]);
ok(leftovers.length === 0, '§0 之外无字面量 mc_* 键', leftovers.length ? '残留: ' + [...new Set(leftovers)].join(', ') : '');
ok(!/'mc_' \+/.test(mainJs), '不存在拼接式存储键（开关已改用 §0 SETTINGS 注册表）');
ok(/\bconst SETTINGS = \{/.test(mainJs), '§0 SETTINGS 注册表存在');
ok(/const Store = \(function/.test(mainJs), '§1 Store 存在');
for (const api of ['raw', 'write', 'remove', 'json', 'setting', 'setSetting', 'subscribe', 'onStorageError']) {
  if (!new RegExp('\\b' + api + ':\\s*' + api).test(mainJs)) ok(false, 'Store API 缺失: ' + api);
}
ok(true, 'Store API 齐全（raw/write/remove/json/setting/setSetting/subscribe/onStorageError）');

console.log('\n[3] 结构指标');
const count = (re) => (mainJs.match(re) || []).length;
const exportBlock = mainJs.slice(mainJs.indexOf('window.L = {'));
const metrics = {
  'getElementById': count(/getElementById\(/g),
  '直接写 .style': count(/\.style\.\w+\s*=/g),
  'classList 操作': count(/classList\./g),
  'querySelector*': count(/querySelector(All)?\(/g),
  'localStorage 调用': count(/localStorage\./g),
  'document.addEventListener': count(/document\.addEventListener/g),
  '内联 onclick 字符串反查': count(/getAttribute\('onclick'\)/g),
  'window.L 导出': (exportBlock.match(/^\s{4}\w+:/gm) || []).length
};
for (const [k, v] of Object.entries(metrics)) console.log(`        ${k.padEnd(26)} ${v}`);

console.log('\n[4] 注释与分区');
ok(txt.includes('L 起始页 · 单文件新标签页'), '文件头维护说明存在');
ok(txt.includes('§0  配置层'), '§0 配置层分区存在');
ok(txt.includes('§5 应用层 · 启动序列'), '§5 启动序列分区存在');
ok(txt.includes('样式层结构（改样式先看这里）'), 'CSS 层目录存在');

console.log('\n[5] head 内 anti-FOUC 脚本保持自包含');
const headScript = txt.slice(txt.indexOf('<script>if(localStorage'), txt.indexOf('</script>', txt.indexOf('<script>if(localStorage')));
ok(headScript.includes("'mc_toggleMinimal'"), 'head 脚本仍使用字面量键（不依赖 §0）');
ok(!headScript.includes('KEYS.'), 'head 脚本未引用 §0 常量');

console.log('\n[6] §1 Store 是唯一接触 localStorage 的地方');
const storeStart = mainJs.indexOf('const Store = (function');
const storeEnd = storeStart < 0 ? -1 : mainJs.indexOf('\n  })();', storeStart);
if (storeStart < 0 || storeEnd < 0) ok(false, '未能定位 §1 Store 实现块');
else {
  const inside = mainJs.slice(storeStart, storeEnd);
  const outside = mainJs.slice(0, storeStart) + mainJs.slice(storeEnd);
  const outerHits = (outside.match(/localStorage\./g) || []).length;
  ok(outerHits === 0, 'Store 之外无 localStorage 直连', outerHits ? outerHits + ' 处残留' : `Store 内 ${(inside.match(/localStorage\./g) || []).length} 处`);
}
ok(!/\bdata = load\(\)/.test(mainJs) && !/\b_saveTimer\b/.test(mainJs), '旧 load()/_saveTimer 已下线');
ok(!/\b(AK|AU|SK|PREF_KEY|BM_KEY)\b/.test(mainJs), 'P1 下线常量无孤儿引用');

console.log('\n[7] P2 缺陷修复落位');
ok(/Domain\.Bookmarks\.isValidIndex\(bmEditIdx, BM_TOTAL\)/.test(mainJs), '#3 saveBookmark 下标校验（委托 §2 Domain）');
ok(/Domain\.Bookmarks\.normalizeSlots\(Store\.json\(KEYS\.BOOKMARKS/.test(mainJs), '#2 getBookmarks 容错（委托 §2 Domain）');
ok(/function saveBookmarks\(arr\) \{ return Store\.write/.test(mainJs), '#4 saveBookmarks 配额保护');
ok(/function compressImage\(/.test(mainJs) && /WALLPAPER_MAX_BYTES/.test(mainJs), '#5 图片压缩与体积上限');
ok(/if \(e\.target\.closest\('input, textarea, select, \[contenteditable="true"\], \.msg-bubble, pre, code'\)\) return;\s*\n\s*e\.preventDefault\(\);/.test(mainJs), '#6 selectstart 放行输入区');
ok(/if \(e\.target\.closest\('input, textarea, \[contenteditable="true"\]'\)\) return;/.test(mainJs), '#6 contextmenu 放行输入区');
ok(/_lunarTimer/.test(mainJs) && !/var refreshTimer=setInterval/.test(mainJs), '#7 农历定时器单例化');
ok(!/\+\s*'  _'\+term/.test(mainJs), '#7 农历日期串多余下划线已删');
ok(!/var gzDay=ganzhiDay\(d\);/.test(mainJs), '#7 未使用的 gzDay 已删');

console.log('\n[8] P3 浮层管理器落位');
ok(/const PopupManager = \(function/.test(mainJs), '§4 PopupManager 存在');
const regCount = (mainJs.match(/PopupManager\.register\(/g) || []).length;
ok(regCount === 7, '浮层登记表 7 项（V2.2 简化后）', '实际 ' + regCount);
for (const api of ['handleOutsideClick', 'handleKeydown', 'closeTop', 'closeGroup']) {
  ok(new RegExp(api + ': ' + api).test(mainJs), 'PopupManager API: ' + api);
}
ok(!/^\s*(?:var|const|let)?\s*document\.querySelectorAll\('\.popup\.show'\)/m.test(mainJs), '旧的 closeAllPopups 选择器写法已删');
ok(!/const sp = document\.getElementById\('settingsPopup'\);\s*\n\s*if \(sp\.classList\.contains\('show'\) && !e\.target/.test(mainJs), '旧的 6 段手写关闭判断已删');
ok(!/_lunarOutside/.test(mainJs), '农历自建外部点击监听已删');
ok(!/document\.addEventListener\('click', e => \{ if \(!e\.target\.closest\('\.engine-dropdown'\)/.test(mainJs), '引擎独立文档监听已删');
ok(!/closest\('\.bm-list-popup'\)\) closeBmListPopup/.test(mainJs), '收藏列表独立文档监听已删');
const docClicks = (mainJs.match(/document\.addEventListener\('click'/g) || []).length;
ok(docClicks === 3, '文档级 click 监听收敛为 3 处（浮层外部点击 + 书签栏 + data-action 分发）', '实际 ' + docClicks);

console.log('\n[9] P3b 事件委托落位');
ok(/const ACTIONS = \{/.test(mainJs), '§4 ACTIONS 白名单存在');
const actionCount = (txt.match(/data-action="/g) || []).length;
ok(actionCount >= 45, 'data-action 数量', '实际 ' + actionCount);
ok((txt.match(/data-arg="/g) || []).length >= 25, 'data-arg 数量', '实际 ' + (txt.match(/data-arg="/g) || []).length);
ok((txt.match(/data-self="/g) || []).length >= 4, 'data-self 数量', '实际 ' + (txt.match(/data-self="/g) || []).length);
ok((txt.match(/data-input="/g) || []).length >= 4, 'data-input 数量', '实际 ' + (txt.match(/data-input="/g) || []).length);
ok((txt.match(/data-change="/g) || []).length >= 1 && (txt.match(/data-blur="/g) || []).length >= 1, 'data-change / data-blur 已用');
ok((txt.match(/data-enter="/g) || []).length >= 2, 'data-enter 数量', '实际 ' + (txt.match(/data-enter="/g) || []).length);
const inlineAttrs = (txt.match(/\son(click|input|change|blur|keydown)=/g) || []).length;
ok(inlineAttrs === 0, '全文件内联事件属性为 0', '实际 ' + inlineAttrs);
const exportIdx = mainJs.indexOf('window.L = {');
const pageCalls = (mainJs.slice(0, exportIdx).match(/\bL\.\w+\(/g) || []).length;
ok(pageCalls === 0, '页面自身不再调用 window.L', '实际 ' + pageCalls);
const exportCount = (mainJs.slice(exportIdx).match(/^\s{4}\w+:/gm) || []).length;
ok(exportCount <= 40, 'window.L 导出已收敛（原 61）', '实际 ' + exportCount);
ok(/function dispatchAction\(/.test(mainJs) && /function delegateTarget\(/.test(mainJs), '分发器函数存在');
ok(/data-enter-prevent/.test(mainJs), '回车提交 / Shift+回车换行 语义保留');

console.log('\n[10] P4 领域层落位');
ok(/const Domain = \{/.test(mainJs), '§2 Domain 存在');
for (const layer of ['Lunar', 'Bookmarks']) {
  ok(new RegExp('\\n    ' + layer + ': \\{').test(mainJs), 'Domain.' + layer + ' 存在');
}
ok(/snapshot: function \(date\)/.test(mainJs), 'Domain.Lunar.snapshot 存在');
ok(/Math\.round\(\(date - ref\) \/ 86400000\)/.test(mainJs), 'ganzhiDay 取整改用 Math.round（时区稳健）');
ok(!/function esc\(s\) \{ const d = document\.createElement/.test(mainJs), 'esc 不再建 DOM（纯函数）');
ok(/info\.yearName \+ info\.zodiac/.test(mainJs), 'renderLunar 改用 Domain.Lunar.snapshot');
ok(!/sendMorphMsg/.test(mainJs), '收发信 / 会话面板已移除（V2.2）');
ok(!/function autoMessage/.test(mainJs), '自动消息功能已移除（V2.2）');
ok(/Domain: Domain,/.test(mainJs), 'window.L 暴露 Domain（调试/测试入口）');
ok(!/MAX_CONTEXT_MSGS/.test(mainJs), '会话上下文配置已随聊天功能移除');

console.log('\n[11] P5 CSS 令牌化 / 主题合并 / 可访问性');
const styleCss = txt.slice(txt.indexOf('<style>'), txt.indexOf('</style>'));
ok(/:\s*root\s*\{/.test(styleCss), '§A :root 令牌层存在');
ok(/--glass-blur-1:/.test(styleCss) && /--z-toast:/.test(styleCss), '玻璃与层级令牌存在');
ok(!/\*\s*\{[^}]*--tr-fast/.test(styleCss), '--tr-fast 不再挂在通配选择器上');
const zHard = (styleCss.match(/z-index:\s*(?:10|20|40|41|100|200|250|300|999|9999)\b/g) || []).length;
ok(zHard === 0, '全局层级不再硬编码（全部取 --z-*）', '残留 ' + zHard);
ok((styleCss.match(/z-index:\s*var\(--z-/g) || []).length >= 10, 'z-index 取令牌处数', '实际 ' + (styleCss.match(/z-index:\s*var\(--z-/g) || []).length);
const fgTokens = (styleCss.match(/--fg-\d+:/g) || []).length;
ok(fgTokens === 46, '主题令牌数量（23×2）', '实际 ' + fgTokens);
ok(/html\.gray-text [^,]+, html\.black-text /.test(styleCss), 'gray/black 已合并为同一份规则');
ok(!/html\.black-text \.clock \{ color: rgba/.test(styleCss), '不再存在手抄的 black 主题规则');
ok(/prefers-reduced-motion/.test(styleCss), 'reduced-motion 兜底存在');
ok(/height:\s*100dvh/.test(styleCss), '移动端 100dvh 兜底存在');
ok(/env\(safe-area-inset-bottom/.test(styleCss), 'Dock 安全区适配存在');
ok(/:focus-visible/.test(styleCss), '焦点可见性样式存在');
ok(/html\.custom-text \[data-tooltip\]::after/.test(styleCss), 'custom-text 主题补缺完成');

console.log('\n[13] 遮罩型浮层（V2.0.1 修复）');
ok(/backdrop: !!o\.backdrop/.test(mainJs), 'register 保存 backdrop 选项');
ok(/if \(en\.backdrop\) \{/.test(mainJs), 'handleOutsideClick 支持遮罩型浮层');
ok(/register\('wpPickerOverlay',\{ group: 'overlay', backdrop: true, triggers: \['\.wp-picker'\] \}\)/.test(mainJs),
  '壁纸选择器已登记为 backdrop');
ok(/V2\.(0\.[12]|1\.0)/.test(txt), '版本号已升到 V2.0.1+');

console.log('\n[14] 搜索框下的动态图形已彻底删除（V2.0.2）');
for (const token of ['circle-balls', 'breathSvg', 'breathPath', 'rtSpin', 'morphGrad', 'setShapeAnimation', 'toggleShape', 'TOGGLE_SHAPE', '显示图形']) {
  const n = (txt.match(new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  ok(n === 0, `全文件无残留：${token}`, '实际 ' + n);
}
ok(!/id="toggleShape"/.test(txt), '设置面板已无"显示图形"开关');
const plainBd = (styleCss.match(/(^|[^-])backdrop-filter:/g) || []).length;
const webkitBd = (styleCss.match(/-webkit-backdrop-filter:/g) || []).length;
ok(plainBd === webkitBd, '毛玻璃前缀与普通声明一一对应', `${plainBd} / ${webkitBd}`);
const cssOpen = (styleCss.match(/\{/g) || []).length, cssClose = (styleCss.match(/\}/g) || []).length;
ok(cssOpen === cssClose, 'CSS 花括号平衡', `${cssOpen} / ${cssClose}`);

console.log('\n[12] P7 性能收尾');
ok(/_popupStateQueued/.test(mainJs) && /requestAnimationFrame\(function \(\) \{ _popupStateQueued = false; updatePopupState\(\); \}\)/.test(mainJs),
  '浮层状态刷新已合并到 rAF');
ok(/function setShapeAnimation\(on\)/.test(mainJs) === false, '图形形变动画已按用户要求删除');
ok(!/setInterval\(function\(\) \{\s*isCircle/.test(mainJs), '旧的常驻形变定时器不复存在');
ok(/Store\.setting\('shape'\)/.test(mainJs) === false, 'shape 设置项已从注册表与调用点移除');
ok(/_flyBufSmall/.test(mainJs) && !/small\.push\(\{x:f\.x/.test(mainJs), '萤火改用复用数值缓冲');
const batchDefs = (mainJs.match(/function drawBatch\(/g) || []).length;
ok(batchDefs === 2, 'drawBatch 定义数（雨滴外提 + 萤火各一处）', '实际 ' + batchDefs);
ok(!/function drawBatch\(arr, color, width\) \{\s*\n\s*if \(!arr\.length\) return;\s*\n\s*ctx\.strokeStyle/.test(mainJs.slice(mainJs.indexOf('function draw()') < 0 ? 0 : mainJs.indexOf('function draw()'))),
  '雨滴批次函数已移出每帧执行的 draw()');

console.log('\n[15] 委托白名单与新增功能（V2.1.0）');
{
  // 系统性防护：HTML 里出现的每个 data-* 动作名，都必须在 ACTIONS 白名单里
  const used = new Set();
  const re = /data-(action|input|change|blur|enter)="([A-Za-z0-9_]+)"/g;
  let m;
  while ((m = re.exec(txt))) used.add(m[2]);
  const actionsBlock = mainJs.slice(mainJs.indexOf('const ACTIONS = {'), mainJs.indexOf('function dispatchAction('));
  const missing = [...used].filter((name) => !new RegExp('\\n\\s{4}' + name + ':').test(actionsBlock));
  ok(missing.length === 0, 'HTML 用到的动作名都已登记进 ACTIONS 白名单', missing.length ? '缺失: ' + missing.join(', ') : `共 ${used.size} 个`);
}
ok(/blur:\s*\{ key: KEYS\.BLUR,\s*type: 'int',\s*def: 9,/.test(mainJs), 'SETTINGS.blur 已登记（默认第 9 档）');
ok(/BLUR: 'mc_blur'/.test(mainJs), 'KEYS.BLUR 已登记');
ok(/function setCardBlur\(v\)/.test(mainJs), 'setCardBlur 存在');
ok(/setCardBlur: function \(el, arg\)/.test(mainJs), 'setCardBlur 已进 ACTIONS 白名单');
ok(/var pct = \(v - 1\) \/ 9;/.test(mainJs), '模糊档位映射 (v-1)/9');
ok(!/setCardOpacity[\s\S]{0,400}--card-blur-mul'/.test(mainJs), '透明度滑块不再写 --card-blur-mul（已解耦）');
ok(/--card-blur-mul: 0\.889;/.test(txt), ':root 给了与默认档位一致的模糊初值 0.889');
ok(/id="blurSlider" min="1" max="10" value="9" step="1"/.test(txt), '模糊滑块为 1~10 档、默认 9');
ok(/id="blurVal"/.test(txt), '模糊数值标签存在');
ok(!/id="sliderVal"/.test(txt) && /class="slider-val"/.test(txt), '数值标签用类名（两个滑块共用样式）');
ok(/\.slider-val \{[\s\S]{0,220}color: rgba\(0,0,0,0\.55\);[\s\S]{0,120}width: 20px; text-align: center;/.test(styleCss),
  '数值标签为黑色、20px 宽并居中（与圆点对齐）');
ok(/move: function \(slots, from, to\)/.test(mainJs), 'Domain.Bookmarks.move 存在');
ok(/item\.draggable = true/.test(mainJs), '列表项可拖动');
ok(/addEventListener\('dragstart'/.test(mainJs) && /addEventListener\('drop'/.test(mainJs), '拖放事件已绑定');
ok(/function bmListMove\(from, to\)/.test(mainJs), 'bmListMove 存在');
ok(/\.bm-list-item\.dragging/.test(styleCss) && /\.bm-list-item\.drag-target/.test(styleCss), '拖动反馈样式存在');
ok(/bm-list-hint/.test(txt), '列表标题带拖动提示');

console.log(`\n结果：${fail ? fail + ' 项失败' : '全部通过'}；文件 ${txt.length} 字符 / ${lines.length} 行`);
process.exit(fail ? 1 : 0);

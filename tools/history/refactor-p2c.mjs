/**
 * P2-c  必修缺陷（交互与定时器）
 *   #6 全局 selectstart / contextmenu / dblclick 拦截过宽 → 输入框无法选中、右键菜单失效
 *   #7 农历弹窗：日期串里多余的下划线、两个算了不用的变量、重复打开导致 setInterval 泄漏
 * 用法：node tools/refactor-p2c.mjs [--write]
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

const KEEP_SELECTABLE = "input, textarea, select, [contenteditable=\"true\"], .msg-bubble, pre, code";

/* ---- #6a 文本选择 ---- */
step('selectstart 放行可编辑区域',
  "document.addEventListener('selectstart',function(e){ e.preventDefault(); });",
`/* 缺陷修复：旧实现全局阻止 selectstart。Chromium 下这会连 input/textarea 一起
   禁选，导致聊天里选不中、复制不了 AI 回复与代码（Firefox 行为还不一致）。
   现在仅在非输入区域阻止选择。 */
document.addEventListener('selectstart', function (e) {
  if (e.target.closest('${KEEP_SELECTABLE}')) return;
  e.preventDefault();
});`, 1);

/* ---- #6b 右键菜单 ---- */
step('contextmenu 放行可编辑区域',
  "document.addEventListener('contextmenu', e => { e.preventDefault(); showBookmarkBar(); showMinimalElements(); });",
`/* 缺陷修复：右键唤出书签栏是既定交互，但旧实现连输入框里的原生菜单（粘贴、
   拼写检查）也一并取消。现在在可编辑区域放行原生菜单。 */
document.addEventListener('contextmenu', e => {
  if (e.target.closest('input, textarea, [contenteditable="true"]')) return;
  e.preventDefault(); showBookmarkBar(); showMinimalElements();
});`, 1);

/* ---- #6c 双击 ---- */
step('dblclick 放行可编辑与聊天内容',
`document.addEventListener('dblclick',function(e){
  e.preventDefault();
  var t=e.target;`,
`document.addEventListener('dblclick',function(e){
  var t=e.target;
  /* 缺陷修复：可编辑区域与聊天正文放行，保留双击选词与复制能力 */
  if (t.closest('${KEEP_SELECTABLE}')) return;
  e.preventDefault();`, 1);

/* ---- #7 农历弹窗 ---- */
step('农历弹窗：去下划线 / 去死变量 / 单例定时器',
`function openLunarPopup() {
  var d=new Date();
  var lu=_lunarFull.format(d); // e.g. "2026丙午年五月廿五星期四"
  var lu2=getLunar(d);
  var gz=lu2.yearName;
  // Extract 生肖 from yearName using GAN/ZHI
  var zhiStr=gz.length>=2?gz[gz.length-1]:'';
  var sx=''; for(var zi=0;zi<ZHI.length;zi++){ if(ZHI[zi]===zhiStr){ sx=SHENGXIAO[zi]; break; } }
  var hour=d.getHours();
  var si=Math.floor((hour+1)/2)%12;
  var scName=SHICHEN[si];
  var scRange=SHICHEN_RANGE[si];
  var gzDay=ganzhiDay(d);
  var term=getSolarTerm(d);
  document.getElementById('lunarGanzhi').textContent=gz+sx+'年';
  document.getElementById('lunarDate').textContent=lu2.month+lu2.day+'  _'+term;
  document.getElementById('lunarHour').textContent=scName+' ('+scRange+')';
  var popup=document.getElementById('lunarPopup');
  var rect=document.getElementById('clock').getBoundingClientRect();
  popup.style.position='fixed';
  popup.style.top=Math.max(8, rect.top-90)+'px';
  popup.style.left=Math.max(8, rect.left+rect.width/2-110)+'px';
  requestAnimationFrame(function(){ popup.classList.add('show'); });
  // Auto-refresh every 60s to catch midnight rollover
  var refreshTimer=setInterval(function refresh(){
    var nd=new Date();
    if(nd.getDate()!==d.getDate()){ clearInterval(refreshTimer); refreshTimer=null; openLunarPopup(); return; }
    // Update hour (时辰) every time it changes
    var nh=nd.getHours(), nsi=Math.floor((nh+1)/2)%12;
    var csi=Math.floor((hour+1)/2)%12;
    if(nsi!==csi){
      var ns=SHICHEN[nsi], nr=SHICHEN_RANGE[nsi];
      document.getElementById('lunarHour').textContent=ns+' ('+nr+')';
      hour=nh; // track latest hour
    }
  },60000);
  setTimeout(function(){
    document.addEventListener('click', function h(e){
      if(!e.target.closest('#lunarPopup')&&!e.target.closest('#clock')){
        clearInterval(refreshTimer);
        popup.classList.remove('show');
        document.removeEventListener('click',h);
      }
    });
  },100);
}`,
`/** 农历弹窗的刷新定时器与外部点击监听（单例，避免重复打开叠加） */
var _lunarTimer = null, _lunarOutside = null;

/**
 * 关闭农历弹窗，并清理定时器与外部点击监听。
 * @sideEffect 改 DOM；清理定时器与事件监听
 */
function closeLunarPopup() {
  if (_lunarTimer) { clearInterval(_lunarTimer); _lunarTimer = null; }
  if (_lunarOutside) { document.removeEventListener('click', _lunarOutside); _lunarOutside = null; }
  var p = document.getElementById('lunarPopup');
  if (p) p.classList.remove('show');
  markPopupChange();
}

/**
 * 渲染农历弹窗内容并定位到时钟下方。
 * @param {Date} d 基准时间
 * @returns {number} 当前时辰序号（0~11），供定时器比对是否需要刷新
 * @sideEffect 改 DOM 文本、内联定位与 class
 */
function renderLunar(d) {
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
  document.getElementById('lunarHour').textContent = SHICHEN[si] + ' (' + SHICHEN_RANGE[si] + ')';
  var popup = document.getElementById('lunarPopup');
  var rect = document.getElementById('clock').getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = Math.max(8, rect.top - 90) + 'px';
  popup.style.left = Math.max(8, rect.left + rect.width / 2 - 110) + 'px';
  requestAnimationFrame(function () { popup.classList.add('show'); });
  markPopupChange();
  return si;
}

/**
 * 打开 / 关闭农历弹窗（再次点击时钟即关闭）。
 * 缺陷修复：旧实现每次打开都新建一个 setInterval 和 document 监听，外部点击不
 *          关闭时重复点击时钟会不断叠加，形成定时器泄漏；现在为单例并统一清理。
 * @sideEffect 改 DOM；创建/清理定时器与事件监听
 */
function openLunarPopup() {
  var popup = document.getElementById('lunarPopup');
  if (popup.classList.contains('show')) { closeLunarPopup(); return; }
  var base = new Date();
  var si = renderLunar(base);
  _lunarTimer = setInterval(function () {
    var nd = new Date();
    if (nd.getDate() !== base.getDate()) { closeLunarPopup(); openLunarPopup(); return; }  // 跨天重算
    var nsi = Math.floor((nd.getHours() + 1) / 2) % 12;
    if (nsi !== si) { si = nsi; renderLunar(nd); }                                        // 时辰变化时刷新
  }, 60000);
  setTimeout(function () {
    if (_lunarOutside) document.removeEventListener('click', _lunarOutside);
    _lunarOutside = function (e) {
      if (!e.target.closest('#lunarPopup') && !e.target.closest('#clock')) closeLunarPopup();
    };
    document.addEventListener('click', _lunarOutside);
  }, 100);
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

/**
 * P7 性能收尾（行为不变）
 *  · markPopupChange 合并到 rAF：一次点击里原本会跑几十次整文档查询，现在每帧最多一次
 *  · "显示图形"的 Reuleaux↔圆 形变改为随开关启停（原来 2 秒定时器常驻，图形关着也在跑）
 *  · 粒子系统去掉每帧新建的闭包与临时对象（雨滴批次函数外提、萤火改用复用数值缓冲）
 * 用法：node tools/refactor-p7.mjs [--write]
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
 * 1. F1：markPopupChange 合并到 rAF
 * ======================================================================== */
step('markPopupChange 合并到 rAF',
`function markPopupChange() { updatePopupState(); }`,
`/** 是否已排队一次浮层状态刷新（把一次点击里的几十次调用合并成每帧最多一次） */
var _popupStateQueued = false;

/**
 * 标记浮层状态发生变化；同一帧内多次调用只会真正刷新一次。
 * @sideEffect 排队一次 updatePopupState（下一帧执行）
 */
function markPopupChange() {
  if (_popupStateQueued) return;
  _popupStateQueued = true;
  requestAnimationFrame(function () { _popupStateQueued = false; updatePopupState(); });
}`, 1);

/* ==========================================================================
 * 2. F6：图形形变随开关启停
 * ======================================================================== */
step('图形形变改为可启停',
`  // Slow rotation (CSS) + pulse: Reuleaux ↔ Circle
  (function() {
    var R = 'M 7.22 40 A 41.57 41.57 0 0 1 28 4 A 41.57 41.57 0 0 1 48.78 40 A 41.57 41.57 0 0 1 7.22 40 Z';
    var C = 'M 28 4 A 24 24 0 0 1 48.78 40 A 24 24 0 0 1 7.22 40 A 24 24 0 0 1 28 4 Z';
    var p = document.getElementById('breathPath');
    if (!p) return;
    var isCircle = false;
    p.setAttribute('d', R);
    setInterval(function() {
      isCircle = !isCircle;
      p.setAttribute('d', isCircle ? C : R);
    }, 2000);
  })();`,
`  // 图形：Reuleaux ↔ 圆的形变（随"显示图形"开关启停，避免常驻定时器空转）
  setShapeAnimation(Store.setting('shape'));`, 1);

step('新增 setShapeAnimation',
`  /**
   * 按壁纸类型启停粒子特效（雨滴 / 萤火；其余类型一律停止）。
   * @param {string} type
   * @sideEffect 启停 rAF 循环
   */
  function bgRunEffect(type) {`,
`  /** Reuleaux 三角形路径 */
  var SHAPE_REULEAUX = 'M 7.22 40 A 41.57 41.57 0 0 1 28 4 A 41.57 41.57 0 0 1 48.78 40 A 41.57 41.57 0 0 1 7.22 40 Z';
  /** 圆形路径（形变目标） */
  var SHAPE_CIRCLE = 'M 28 4 A 24 24 0 0 1 48.78 40 A 24 24 0 0 1 7.22 40 A 24 24 0 0 1 28 4 Z';
  /** 图形形变定时器（null = 未运行） */
  var _shapeTimer = null, _shapeIsCircle = false;

  /**
   * 启停"显示图形"的形变动画。
   * @param {boolean} on
   * @sideEffect 创建/清理 setInterval；改 SVG path
   */
  function setShapeAnimation(on) {
    var p = document.getElementById('breathPath');
    if (!p) return;
    if (_shapeTimer) { clearInterval(_shapeTimer); _shapeTimer = null; }
    _shapeIsCircle = false;
    p.setAttribute('d', SHAPE_REULEAUX);
    if (!on) return;
    _shapeTimer = setInterval(function () {
      _shapeIsCircle = !_shapeIsCircle;
      p.setAttribute('d', _shapeIsCircle ? SHAPE_CIRCLE : SHAPE_REULEAUX);
    }, 2000);
  }

  /**
   * 按壁纸类型启停粒子特效（雨滴 / 萤火；其余类型一律停止）。
   * @param {string} type
   * @sideEffect 启停 rAF 循环
   */
  function bgRunEffect(type) {`, 1);

step('toggleSwitch 联动形变',
`  } else if (id === 'toggleShape') {
    document.querySelector('.circle-balls-wrap').style.display = on ? '' : 'none';
  }`,
`  } else if (id === 'toggleShape') {
    document.querySelector('.circle-balls-wrap').style.display = on ? '' : 'none';
    setShapeAnimation(on);
  }`, 1);

step('resetDefaults 停掉形变',
`  document.getElementById('motto').style.display = '';
  document.querySelector('.circle-balls-wrap').style.display = 'none';`,
`  document.getElementById('motto').style.display = '';
  document.querySelector('.circle-balls-wrap').style.display = 'none';
  setShapeAnimation(false);`, 1);

/* ==========================================================================
 * 3. F7：粒子每帧的临时分配
 * ======================================================================== */
step('雨滴批次函数外提',
`  var _heavyDrops = [], _lightDrops = [], _normalDrops = [];
  function rebuildDropBatches() {`,
`  var _heavyDrops = [], _lightDrops = [], _normalDrops = [];

  /**
   * 按批次画雨滴（同样式只切一次 canvas 状态）。
   * @param {Array} arr 雨滴数组
   * @param {string} color 描边色
   * @param {number} width 线宽
   */
  function drawBatch(arr, color, width) {
    if (!arr.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (var i = 0; i < arr.length; i++) {
      var d = arr[i];
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x, d.y + d.len);
    }
    ctx.stroke();
  }

  function rebuildDropBatches() {`, 1);

step('雨滴 draw 内不再新建闭包',
`    ctx.lineCap = 'round';
    // Batch drops by style to minimize state changes
    function drawBatch(arr, color, width) {
      if (!arr.length) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.beginPath();
      for (var i = 0; i < arr.length; i++) {
        var d = arr[i];
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
      }
      ctx.stroke();
    }
    drawBatch(_heavyDrops, 'rgba(140,220,240,0.6)', 2.2);`,
`    ctx.lineCap = 'round';
    // 按样式分批画（drawBatch 已提到 draw 外面，避免每帧新建闭包）
    drawBatch(_heavyDrops, 'rgba(140,220,240,0.6)', 2.2);`, 1);

step('萤火缓冲声明',
`var _flyRaf = null, _flies = null, _flyMax = 40, _flyFrame = 0;`,
`var _flyRaf = null, _flies = null, _flyMax = 40, _flyFrame = 0;
/** 萤火批处理缓冲：每 4 个数一簇（x, y, 尺寸, 透明度），复用以免每帧产生上百个临时对象 */
var _flyBufSmall = [], _flyBufMed = [], _flyBufLarge = [];`, 1);

step('萤火改用复用缓冲',
`    var small = [], med = [], large = [];`,
`    // 复用缓冲：清空而不重建
    var small = _flyBufSmall, med = _flyBufMed, large = _flyBufLarge;
    small.length = 0; med.length = 0; large.length = 0;`, 1);

step('萤火入队改为数值',
`      if (f.s < 1.5) small.push({x:f.x, y:f.y, s:f.s, a:alpha});
      else if (f.s < 2.2) med.push({x:f.x, y:f.y, s:f.s, a:alpha});
      else large.push({x:f.x, y:f.y, s:f.s, a:alpha});`,
`      if (f.s < 1.5) small.push(f.x, f.y, f.s, alpha);
      else if (f.s < 2.2) med.push(f.x, f.y, f.s, alpha);
      else large.push(f.x, f.y, f.s, alpha);`, 1);

step('萤火批次绘制按簇读取',
`    function drawBatch(arr) {
      if (!arr.length) return;
      // Use first item's size for batch (close enough)
      var sz = arr[0].s;
      ctx.fillStyle = 'rgba(220,255,200,' + arr[0].a + ')';
      for (var i = 0; i < arr.length; i++) {
        var f = arr[i];
        ctx.fillRect(f.x - sz * 0.5, f.y - sz * 0.5, sz, sz);
      }
    }`,
`    function drawBatch(arr) {
      if (!arr.length) return;
      // 每个批次用首簇的尺寸与透明度（与重构前一致）
      var sz = arr[2];
      ctx.fillStyle = 'rgba(220,255,200,' + arr[3] + ')';
      for (var i = 0; i < arr.length; i += 4) {
        ctx.fillRect(arr[i] - sz * 0.5, arr[i + 1] - sz * 0.5, sz, sz);
      }
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

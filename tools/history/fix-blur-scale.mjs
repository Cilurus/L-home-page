/**
 * 模糊滑块与"透明卡片"对齐：
 *  · 档位 0~100% → 1~10 档（映射 (v-1)/9：1 = 完全清晰、10 = 设计满值、默认 9 = 原观感 0.889）
 *  · 数值标签恢复黑色、宽度回到 20px（与滑块圆点精确居中）
 *  · 兼容迁移：V2.1.0 早期版本存过 0~100 的值（如 90），首次启动自动折算成 9
 * 用法：node tools/fix-blur-scale.mjs [--write]
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

/* 1. 设置注册表与默认值：90 → 9 */
step('SETTINGS.blur 默认档位 9',
  "    blur:        { key: KEYS.BLUR,           type: 'int',  def: 90,       label: '模糊程度' },",
  "    blur:        { key: KEYS.BLUR,           type: 'int',  def: 9,        label: '模糊程度' },", 1);
step('DEFAULTS.blur 9', '    blur: 90,', '    blur: 9,', 1);

/* 2. :root 初值与默认档位一致（9/9 = 0.889） */
step(':root 模糊初值',
  '    --card-blur-mul: 0.9;   /* 玻璃模糊倍率，由「模糊程度」滑块（0~100%）驱动 */',
  '    --card-blur-mul: 0.889; /* 玻璃模糊倍率，由「模糊程度」滑块（1~10 档）驱动 */', 1);

/* 3. 滑块实现：1~10 档 + 与透明卡片相同的标签定位 */
step('setCardBlur 改为 1~10 档',
`/**
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
}`,
`/**
 * 设置玻璃模糊程度（1~10 档，统一作用于所有玻璃表面）。
 * 档位映射：(v-1)/9 —— 1 = 完全清晰，10 = 设计满值，默认 9 ≈ 0.889（与重构前观感一致）。
 * @param {number|string} v 1~10
 * @sideEffect 写 localStorage（KEYS.BLUR）；改 CSS 变量 --card-blur-mul；移动数值标签
 */
function setCardBlur(v) {
  v = Math.min(10, Math.max(1, parseInt(v, 10) || 1));
  Store.setSetting('blur', v);
  var pct = (v - 1) / 9;
  document.documentElement.style.setProperty('--card-blur-mul', pct.toFixed(3));
  var s = document.getElementById('blurSlider');
  if (s) {
    var fill = (pct * 100) + '%';
    s.style.background = 'linear-gradient(to right, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.5) ' + fill + ', rgba(255,255,255,0.08) ' + fill + ', rgba(255,255,255,0.08) 100%)';
  }
  var valEl = document.getElementById('blurVal');
  if (valEl) {
    valEl.textContent = v;
    var sw = s ? s.offsetWidth : 0;
    if (sw > 0) valEl.style.left = (pct * (sw - 20)) + 'px';
  }
}`, 1);

/* 4. 启动：迁移旧值 + 应用 */
step('启动迁移旧百分比值',
`  var b = document.getElementById('blurSlider');
  if (b) {
    b.value = String(Store.setting('blur'));
    setCardBlur(b.value);
    window.addEventListener('resize', function(){ setCardBlur(b.value); });
  }`,
`  var b = document.getElementById('blurSlider');
  if (b) {
    var bv = Number(Store.setting('blur'));
    if (bv > 10) { bv = Math.max(1, Math.round(bv / 10)); Store.setSetting('blur', bv); }  // 兼容 V2.1.0 早期的 0~100 旧值
    b.value = String(bv);
    setCardBlur(bv);
    window.addEventListener('resize', function(){ setCardBlur(b.value); });
  }`, 1);

/* 5. HTML：滑块量程与初始值 */
step('HTML 滑块改 1~10 档',
  '<input type="range" id="blurSlider" min="0" max="100" value="90" step="5" data-input="setCardBlur" data-value-arg="1"><div class="slider-val" id="blurVal">90%</div>',
  '<input type="range" id="blurSlider" min="1" max="10" value="9" step="1" data-input="setCardBlur" data-value-arg="1"><div class="slider-val" id="blurVal">9</div>', 1);

/* 6. CSS：数值标签恢复黑色、宽度回 20px（与圆点精确居中） */
step('CSS 数值标签黑字居中',
`  .slider-val {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;
    font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.9);
    text-shadow: 0 0 3px rgba(0,0,0,0.65);
    width: 30px; text-align: center; line-height: 1;
  }`,
`  .slider-val {
    position: absolute; top: 50%; transform: translateY(-50%); z-index: 2; pointer-events: none;
    font-size: 10px; font-weight: 700; color: rgba(0,0,0,0.55);
    width: 20px; text-align: center; line-height: 1;
  }`, 1);

/* ---------- 写盘 ---------- */
const w = Math.max(...report.map(r => r[1].length));
console.log('步骤'.padEnd(6) + '结果  命中/期望');
for (const [ok, name, n, exp] of report) console.log(`${ok}  ${name.padEnd(w)}  ${n} / ${exp}`);
console.log(`\n共 ${report.length} 步，失败 ${failed} 步；文件 ${txt.length} 字符`);
if (failed) { console.log('存在未命中步骤，未写盘。'); process.exit(1); }
if (!WRITE) { console.log('干跑通过（未写盘）。加 --write 实际写入。'); process.exit(0); }
fs.writeFileSync(FILE, txt, { encoding: 'utf8' });
console.log('已写入：' + FILE);

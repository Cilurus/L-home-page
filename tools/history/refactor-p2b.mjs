/**
 * P2-b  必修缺陷（数据安全与输入体积）
 *   #2 getBookmarks 数据被改坏/截断即静默丢空槽位 → 容错 + 修复 + 提示
 *   #3 saveBookmark 缺下标校验（越界写数组 -1 键却提示"已保存"）→ 校验 + 失败不再假装成功
 *   #4 saveBookmarks / 图片入库 无配额保护 → 走 Store.write，失败明确提示
 *   #5 壁纸与图标直接存原始 dataURL（无压缩、无体积限制）→ canvas 压缩 + 体积上限
 * 用法：node tools/refactor-p2b.mjs [--write]
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
 * 1. §0 追加图片体积上限
 * ======================================================================== */
step('CONFIG 追加图片限制',
  "    TOAST_MS: 3000,                // toast 停留时长",
`    TOAST_MS: 3000,                // toast 停留时长
    WALLPAPER_MAX_PX: 1920,        // 壁纸压缩后最长边（像素）
    WALLPAPER_QUALITY: 0.82,       // 壁纸 JPEG 质量
    WALLPAPER_MAX_BYTES: 2097152,  // 壁纸入库上限 2MB（localStorage 配额约 5MB，需与聊天记录共享）
    ICON_MAX_PX: 64,               // 收藏图标压缩后最长边（像素）
    ICON_MAX_BYTES: 65536,         // 收藏图标入库上限 64KB`, 1);

/* ==========================================================================
 * 2. 收藏读写：容错 + 配额保护（#2 / #4）
 * ======================================================================== */
step('getBookmarks 容错 + saveBookmarks 配额保护',
`function getBookmarks() {
  try { const d = JSON.parse(localStorage.getItem(KEYS.BOOKMARKS)); if (Array.isArray(d) && d.length === BM_TOTAL) return d; } catch(e) {}
  return Array(BM_TOTAL).fill(null);
}
function saveBookmarks(arr) { localStorage.setItem(KEYS.BOOKMARKS, JSON.stringify(arr)); }`,
`/** 数据损坏只提示一次，避免每次读取都弹 toast */
var _bmCorruptReported = false;

/**
 * 读取收藏槽位数组（定长 BM_TOTAL）。
 * 容错策略（缺陷修复：旧实现只要长度≠20 就静默返回 20 个空槽 = 收藏全部消失）：
 *   · 数组但长度不符 → 截断 / 补齐后回写修复，内容不丢
 *   · 根本不是数组 → 返回空槽位并提示一次，**不删除原始数据**
 * @returns {Array<object|null>} 长度恒为 BM_TOTAL
 * @sideEffect 发现长度异常时回写修复后的数组
 */
function getBookmarks() {
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
}

/**
 * 写入收藏槽位数组。
 * @param {Array<object|null>} arr
 * @returns {boolean} 是否写入成功（配额超限 / 存储被禁用为 false）
 * @sideEffect 写 localStorage（KEYS.BOOKMARKS）
 */
function saveBookmarks(arr) { return Store.write(KEYS.BOOKMARKS, JSON.stringify(arr)); }`, 1);

/* ==========================================================================
 * 3. saveBookmark：下标校验 + 真实成败反馈（#3 / #4）
 * ======================================================================== */
step('saveBookmark 下标校验与失败反馈',
`  const bms = getBookmarks();
  bms[bmEditIdx] = { icon: icon, name: name, url: url, iconMode: icon.startsWith('__char__') ? 'char' : (icon.startsWith('data:') ? 'upload' : 'auto') };
  saveBookmarks(bms);
  closeBmPopup();
  showToast('✓ 已' + (document.getElementById('bmSaveBtn').textContent === '添加' ? '添加' : '保存'));
}`,
`  // 缺陷修复：旧实现不校验下标，越界时会写出数组的 -1 属性（JSON 往返后被丢弃），
  // 界面却照样提示"已保存"——属于静默失败。
  if (!Number.isInteger(bmEditIdx) || bmEditIdx < 0 || bmEditIdx >= BM_TOTAL) {
    showToast('收藏位置无效，请重新打开书签栏');
    return;
  }
  const isAdd = document.getElementById('bmSaveBtn').textContent === '添加';
  const bms = getBookmarks();
  bms[bmEditIdx] = { icon: icon, name: name, url: url, iconMode: icon.startsWith('__char__') ? 'char' : (icon.startsWith('data:') ? 'upload' : 'auto') };
  // 缺陷修复：写入失败（配额超限）时不再假装成功
  if (!saveBookmarks(bms)) { showToast('保存失败：本地存储空间不足'); return; }
  closeBmPopup();
  showToast('✓ 已' + (isAdd ? '添加' : '保存'));
}`, 1);

/* ==========================================================================
 * 4. 图片压缩工具（#5）
 * ======================================================================== */
step('插入图片压缩工具',
`  /* ------------------------------------------------------------------------
   * §2 领域 + §4 视图 · 壁纸`,
`  /* ------------------------------------------------------------------------
   * §2 领域 · 图片压缩（纯计算，不碰存储）
   * 缺陷修复：旧实现把上传原图直接转 dataURL 存进 localStorage。一张 2MB 的
   *           照片 base64 后约 2.7MB，叠加聊天记录后必然超出 5MB 配额，且当时
   *           没有任何 try/catch —— 结果是"点了更换壁纸，什么也没发生"。
   * ---------------------------------------------------------------------- */

  /**
   * 把图片文件等比缩放后编码为 dataURL。
   * @param {File} file 用户选择的图片
   * @param {number} maxSize 最长边像素上限
   * @param {string} mime 'image/jpeg' | 'image/png' | 'image/webp'
   * @param {number} [quality] 0~1，仅对 jpeg/webp 有效
   * @returns {Promise<string>} dataURL
   * @sideEffect 无（仅使用离屏 canvas）
   */
  function compressImage(file, maxSize, mime, quality) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('不是有效的图片文件')); };
        img.onload = function () {
          var w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
          var scale = Math.min(1, maxSize / Math.max(w, h));
          w = Math.max(1, Math.round(w * scale));
          h = Math.max(1, Math.round(h * scale));
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          try { resolve(cv.toDataURL(mime, quality)); }
          catch (e) { reject(e); }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /**
   * 估算 dataURL 的原始字节数。
   * @param {string} url
   * @returns {number}
   */
  function dataUrlBytes(url) {
    var i = url.indexOf(',');
    return i < 0 ? url.length : Math.round((url.length - i - 1) * 3 / 4);
  }

  /**
   * 字节数转可读文本。
   * @param {number} b
   * @returns {string}
   */
  function humanSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.round(b / 1024) + ' KB'; }

  /* ------------------------------------------------------------------------
   * §2 领域 + §4 视图 · 壁纸`, 1);

/* ==========================================================================
 * 5. 壁纸上传：压缩 + 体积上限 + 写入结果反馈
 * ======================================================================== */
step('壁纸上传压缩入库',
`document.getElementById('wallpaperInput').addEventListener('change', e => {
  const f = e.target.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = ev => { const url = ev.target.result; Store.write(KEYS.BG, url); Store.setSetting('bgType', ''); bgApplyImage(url); showToast('✓ 壁纸已更换'); };
  r.readAsDataURL(f); e.target.value = '';
});`,
`/**
 * 更换自定义壁纸：压缩 → 体积校验 → 入库 → 应用。
 * 缺陷修复：旧实现不压缩、不校验体积、不处理写入失败。
 * @sideEffect 写 localStorage（KEYS.BG / KEYS.BG_TYPE）；改 DOM
 */
document.getElementById('wallpaperInput').addEventListener('change', function (e) {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  showToast('正在处理图片…');
  compressImage(f, CONFIG.WALLPAPER_MAX_PX, 'image/jpeg', CONFIG.WALLPAPER_QUALITY)
    .then(function (url) {
      const bytes = dataUrlBytes(url);
      if (bytes > CONFIG.WALLPAPER_MAX_BYTES) { showToast('图片过大（' + humanSize(bytes) + '），请换一张'); return; }
      if (!Store.write(KEYS.BG, url)) { showToast('保存失败：本地存储空间不足'); return; }
      Store.setSetting('bgType', '');
      bgApplyImage(url);
      showToast('✓ 壁纸已更换（' + humanSize(bytes) + '）');
    })
    .catch(function () { showToast('图片处理失败，请换一张图片'); });
});`, 1);

/* ==========================================================================
 * 6. 收藏图标上传：压缩到 64px 小图
 * ======================================================================== */
step('图标上传压缩',
`function handleIconUpload(input) {
  var f = input.files[0]; if (!f) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _bmCurrentIcon = e.target.result;
    document.getElementById('bmIconUrlInput').value = _bmCurrentIcon;
    updateIconStatus();
    showToast('✓ 图片已上传');
  };
  reader.readAsDataURL(f);
}`,
`/**
 * 上传收藏图标：压缩到 CONFIG.ICON_MAX_PX 的小图再入库。
 * 缺陷修复：旧实现直接存原图 dataURL，几个图标就能把配额吃满。
 * @param {HTMLInputElement} input file 控件
 * @sideEffect 更新 _bmCurrentIcon 与预览
 */
function handleIconUpload(input) {
  var f = input.files[0];
  input.value = '';
  if (!f) return;
  compressImage(f, CONFIG.ICON_MAX_PX, 'image/png')
    .then(function (url) {
      if (dataUrlBytes(url) > CONFIG.ICON_MAX_BYTES) { showToast('图标过大，请换一张'); return; }
      _bmCurrentIcon = url;
      document.getElementById('bmIconUrlInput').value = url;
      updateIconStatus();
      showToast('✓ 图标已上传');
    })
    .catch(function () { showToast('图片处理失败，请换一张图片'); });
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

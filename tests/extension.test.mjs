/**
 * 扩展（V3.0.0「F」）资源与契约测试。
 *
 * 这里不跑浏览器：内容脚本的行为已经在 tests/mock/deepseek.html 里用无头 Chrome
 * 做过端到端验证；本文件守的是"构建产物是否合法"这条线，防止改了主文件却忘记
 * 重新构建、或把不该进包的东西打进包。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const EXT = path.join(ROOT, 'extension');

const read = (p) => fs.readFileSync(path.join(EXT, p), 'utf8');

/** 在假 self 里执行构建产物，拿到导出的四个符号 */
function loadBundle() {
  const ctx = { self: {} };
  vm.createContext(ctx);
  vm.runInContext(read('content/startpage-data.js'), ctx, { filename: 'startpage-data.js' });
  return ctx.self;
}

test('manifest：MV3、只匹配 DeepSeek、脚本顺序正确', () => {
  const mf = JSON.parse(read('manifest.json'));
  assert.equal(mf.manifest_version, 3);
  assert.equal(mf.version, '3.0.0');

  const cs = mf.content_scripts;
  assert.equal(cs.length, 1, '只应有一组 content script');
  assert.deepEqual(cs[0].matches, ['https://chat.deepseek.com/*']);
  assert.equal(cs[0].all_frames, false, '只在顶层文档注入，避免 iframe 里重复注入');
  assert.deepEqual(cs[0].js, ['content/startpage-data.js', 'content/shell.js'],
    '数据必须先于外壳加载');

  for (const f of [...cs[0].js, ...Object.values(mf.icons)]) {
    assert.ok(fs.existsSync(path.join(EXT, f)), `${f} 应存在`);
  }
});

test('构建产物：四个导出符号齐全且类型正确', () => {
  const s = loadBundle();
  assert.equal(typeof s.__LSP_DATA__, 'object');
  assert.equal(typeof s.__LSP_PRE__, 'function');
  assert.equal(typeof s.__LSP_CONST__, 'function');
  assert.equal(typeof s.__LSP_MAIN__, 'function');
  assert.ok(s.__LSP_DATA__.css.length > 20000, '样式应完整抽出来');
  assert.ok(s.__LSP_DATA__.html.length > 5000, '结构应完整抽出来');
});

test('样式已改写成 :host，且不残留 html / body 选择器', () => {
  const { css } = loadBundle().__LSP_DATA__;
  assert.ok(/:host\(\.minimal\)/.test(css), 'html.minimal 应改写成 :host(.minimal)');
  assert.ok(/:host\(\.custom-text\)/.test(css), 'html.custom-text 应改写成 :host(.custom-text)');
  assert.ok(/:host\(\.minimal\.minimal-show\)/.test(css), '复合选择器必须整体改写');
  assert.equal(/(^|[,{}])\s*(html|body)\b/m.test(css), false, '不应残留 html / body 选择器');
});

test('结构里不能带 <script>：Shadow DOM 里不会执行，留着只会变成死代码', () => {
  const { html } = loadBundle().__LSP_DATA__;
  assert.equal(/<script/i.test(html), false);
  assert.ok(/id="engineDropdown"/.test(html), '引擎下拉应存在');
  assert.ok(/id="clock"/.test(html), '时钟应存在');
});

test('外壳：关键钩子齐全，且不依赖任何 chrome.* 权限', () => {
  const js = read('content/shell.js');
  for (const hook of ['lsp-whale', 'lsp-fab', 'lspEngine', 'LSP:', 'mask-composite', 'attachShadow']) {
    assert.ok(js.includes(hook), `外壳应包含 ${hook}`);
  }
  assert.ok(/WHALE_PATH = 'M23\.748/.test(js), '鲸鱼应使用官方 logo 路径');
  assert.equal(/\bchrome\.\w+/.test(js), false, '内容脚本不应调用 chrome.* —— 免申请权限');
  assert.ok(/document\.getElementById\('lsp-root-host'\)/.test(js), '应有重复注入保护');
});

test('图标：四个尺寸存在，且像素尺寸与文件名一致', () => {
  for (const size of [16, 32, 48, 128]) {
    const buf = fs.readFileSync(path.join(EXT, 'assets', `icon-${size}.png`));
    assert.equal(buf.slice(1, 4).toString(), 'PNG', 'icon 必须是 PNG');
    assert.equal(buf.readUInt32BE(16), size, `宽应为 ${size}`);
    assert.equal(buf.readUInt32BE(20), size, `高应为 ${size}`);
  }
});

test('构建产物与主文件同源：改了 index - new.html 必须重新构建', () => {
  const src = fs.readFileSync(path.join(ROOT, 'index - new.html'), 'utf8');
  const { html } = loadBundle().__LSP_DATA__;
  // 用主文件里的一段稳定文案做指纹：格言默认值 / 搜索引擎选项
  const probe = 'yandex.com/search/?text=';
  assert.ok(src.includes(probe));
  assert.ok(html.includes(probe), '产物里应包含主文件的引擎配置 —— 否则是忘记重新构建了');
  assert.ok(html.includes('data-wp="firefly"'), '产物里应包含全部壁纸选项');
});

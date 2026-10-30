/**
 * P3b 回归测试：data-action 事件委托（走真实的委托分发路径，不直接调 window.L）。
 * 运行：node --test tests/p3b.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './harness.mjs';

test('data-action 基本动作：点击即执行', () => {
  const p = loadPage();
  p.click('openLunarPopup');
  p.frame();
  assert.equal(p.el('lunarPopup').classList.contains('show'), true, 'data-action 应触发 openLunarPopup');
});

test('data-action + data-arg：切换壁纸', () => {
  const p = loadPage();
  p.click('applyWallpaper', 'vivid');
  assert.equal(p.store.get('mc_bg_type'), 'vivid', '应写入壁纸类型');
  assert.equal(p.el('bg').classList.contains('bg-vivid'), true, '应应用对应背景类');
});

test('data-action + data-arg（布尔）：收藏偏好', () => {
  const p = loadPage();
  p.click('setCompactMode', 'false');
  assert.equal(JSON.parse(p.store.get('mc_prefs')).compact, false, 'data-arg 字符串应被还原为布尔');
});

test('data-action + data-self：开关行传入自身元素', () => {
  const p = loadPage();
  const el = p.makeActionEl({ action: 'toggleMinimal' });
  const track = p.el('toggleMinimal');
  el.querySelector = () => track;
  p.document.dispatch('click', { target: el });
  assert.equal(p.store.get('mc_toggleMinimal'), '1', 'el 应作为 this 传入 toggleMinimal');
});

test('data-input：透明度滑块把 el.value 当参数', () => {
  const p = loadPage();
  p.inputFire('setCardOpacity', '7', true);
  assert.equal(p.store.get('mc_opacity'), '7', '应写入滑块值');
});

test('data-enter：搜索框回车走 doSearch', () => {
  const p = loadPage();
  p.el('searchInput').value = '测试关键字';
  p.enter('doSearch', '测试关键字');
  assert.equal(p.opened.length, 1, '应调用一次 window.open');
  assert.match(p.opened[0], /^https:\/\/www\.bing\.com\/search\?q=/, '默认引擎应为 Bing');
  assert.match(p.opened[0], /%E6%B5%8B%E8%AF%95/, '关键字应被编码');
});

test('白名单：未登记的动作名被忽略且不抛错', () => {
  const p = loadPage();
  assert.doesNotThrow(() => p.click('notInWhitelist', 'x'));
  assert.doesNotThrow(() => p.click('eval'));
});

test('委托路径下 setFontColor / resetDefaults 仍生效', () => {
  const p = loadPage();
  p.click('setFontColor', 'gray');
  assert.equal(p.store.get('mc_font'), 'gray');
  p.click('resetDefaults');
  assert.equal(p.store.get('mc_font'), 'black', '恢复默认应写回 black');
});

test('委托路径下设置菜单可开关（与 P3a 浮层管理器协同）', () => {
  const p = loadPage();
  // 真实页面里齿轮按钮同时带 .settings-btn 与 data-action，这里如实模拟
  const asGear = (el) => { const base = el.closest; el.closest = (sel) => (sel === '.settings-btn' ? el : base(sel)); };
  p.click('toggleSettings', undefined, asGear);
  assert.equal(p.el('settingsPopup').classList.contains('show'), true);
  p.click('toggleSettings', undefined, asGear);
  assert.equal(p.el('settingsPopup').classList.contains('show'), false);
});

test('window.L 已收敛为调试入口，页面不再依赖它', () => {
  const p = loadPage();
  const keys = Object.keys(p.L);
  assert.ok(keys.length <= 40, `导出数量应 <= 40，实际 ${keys.length}`);
  for (const api of ['showToast', 'editMotto', 'openLunarPopup', 'applyWallpaper', 'resetDefaults']) {
    assert.equal(typeof p.L[api], 'function', `调试入口 ${api} 应保留`);
  }
  assert.equal(typeof p.L.Domain, 'object', 'Domain 应作为调试入口暴露');
});

/**
 * P3 回归测试：浮层管理器（PopupManager）行为，直接跑真实页面代码。
 * 运行：node --test tests/p3.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './harness.mjs';

const outside = () => ({ closest: () => null });
const inTrigger = (sel) => ({ closest: (s) => (s === sel ? {} : null) });
const inId = (id) => ({ closest: (s) => (s === '#' + id ? {} : null) });

test('设置菜单可开关（toggle）', () => {
  const p = loadPage();
  p.L.toggleSettings();
  assert.equal(p.el('settingsPopup').classList.contains('show'), true, '第一次应打开');
  p.L.toggleSettings();
  assert.equal(p.el('settingsPopup').classList.contains('show'), false, '第二次应关闭');
});

test('Esc 关闭最上层浮层（重构前只关书签栏）', () => {
  const p = loadPage();
  p.L.editMotto();
  p.frame();
  assert.equal(p.el('mottoPopup').classList.contains('show'), true, '格言弹窗应打开');
  p.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(p.el('mottoPopup').classList.contains('show'), false, 'Esc 应关掉格言弹窗');
});

test('多层浮层：Esc 只关最上面那一层', () => {
  const p = loadPage();
  p.L.toggleSettings();
  p.L.editMotto();
  p.frame();
  assert.equal(p.el('settingsPopup').classList.contains('show'), false, '打开格言弹窗时应先收起设置菜单');
  p.L.toggleSettings();
  assert.equal(p.el('settingsPopup').classList.contains('show'), true, '再开设置菜单');
  p.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(p.el('settingsPopup').classList.contains('show'), false, 'Esc 关掉栈顶的设置菜单');
});

test('外部点击关闭浮层，点击触发按钮不关闭', () => {
  const p = loadPage();
  p.L.toggleSettings();
  assert.equal(p.el('settingsPopup').classList.contains('show'), true);

  // 点触发按钮（齿轮）→ 不应被"外部点击"关掉
  p.document.dispatch('click', { target: inTrigger('.settings-btn') });
  assert.equal(p.el('settingsPopup').classList.contains('show'), true, '点齿轮不应视为外部点击');

  // 点真正的空白处 → 关闭
  p.document.dispatch('click', { target: outside() });
  assert.equal(p.el('settingsPopup').classList.contains('show'), false, '点空白应关闭');
});

test('点浮层内部不关闭自己', () => {
  const p = loadPage();
  p.L.editMotto();
  p.frame();
  assert.equal(p.el('mottoPopup').classList.contains('show'), true);
  p.document.dispatch('click', { target: inId('mottoPopup') });
  assert.equal(p.el('mottoPopup').classList.contains('show'), true, '点自身内部应保持打开');
  p.document.dispatch('click', { target: outside() });
  assert.equal(p.el('mottoPopup').classList.contains('show'), false);
});

test('一次外部点击关闭所有该关的浮层（与重构前一致）', () => {
  const p = loadPage();
  p.L.toggleSettings();
  p.L.editMotto();
  p.frame();
  p.document.dispatch('click', { target: outside() });
  assert.equal(p.el('settingsPopup').classList.contains('show'), false, '设置菜单应关闭');
  assert.equal(p.el('mottoPopup').classList.contains('show'), false, '格言弹窗应关闭');
});

test('搜索引擎下拉：开关与选项点选', () => {
  const p = loadPage();
  p.L.toggleEngine();
  p.frame();
  assert.equal(p.el('engineDropdown').classList.contains('show'), true, '应打开');
  p.L.toggleEngine();
  assert.equal(p.el('engineDropdown').classList.contains('show'), false, '再点应关闭');
});

test('壁纸选择器：打开 / 关闭', () => {
  const p = loadPage();
  p.L.showWpPicker();
  assert.equal(p.el('wpPickerOverlay').classList.contains('show'), true);
  p.L.hideWpPicker();
  assert.equal(p.el('wpPickerOverlay').classList.contains('show'), false);
});

test('壁纸选择器：点遮罩背景应关闭，点卡片内部不关（回归：P3b 曾漏掉）', () => {
  const p = loadPage();
  p.L.showWpPicker();
  assert.equal(p.el('wpPickerOverlay').classList.contains('show'), true);

  // 点卡片内部（.wp-picker）→ 保持打开
  p.document.dispatch('click', { target: { closest: (sel) => (sel === '.wp-picker' ? {} : null) } });
  assert.equal(p.el('wpPickerOverlay').classList.contains('show'), true, '点卡片内部不应关闭');

  // 点遮罩背景（目标就是 #wpPickerOverlay 本身）→ 应关闭
  p.document.dispatch('click', { target: { closest: (sel) => (sel === '#wpPickerOverlay' ? {} : null) } });
  assert.equal(p.el('wpPickerOverlay').classList.contains('show'), false, '点遮罩背景应关闭');

  // 点窗口外的任意处也应关闭
  p.L.showWpPicker();
  p.document.dispatch('click', { target: outside() });
  assert.equal(p.el('wpPickerOverlay').classList.contains('show'), false, '点窗口外任意处应关闭');
});

test('普通弹窗点自身内部仍不关闭（backdrop 只影响遮罩型浮层）', () => {
  const p = loadPage();
  p.L.editMotto();
  p.frame();
  assert.equal(p.el('mottoPopup').classList.contains('show'), true);
  p.document.dispatch('click', { target: inId('mottoPopup') });
  assert.equal(p.el('mottoPopup').classList.contains('show'), true, '普通弹窗不应受 backdrop 逻辑影响');
});

test('收藏弹窗关闭后回到书签栏（onClose 收尾未递归）', () => {
  const p = loadPage();
  p.L.openBmPopup(0);
  p.frame();
  assert.equal(p.el('bmPopup').classList.contains('show'), true, '收藏弹窗应打开');
  p.L.closeBmPopup();
  assert.equal(p.el('bmPopup').classList.contains('show'), false, '应关闭');
  assert.equal(p.el('bookmarkBar').classList.contains('show'), true, '收尾应重新唤出书签栏');
});

test('无浮层时 Esc 收起书签栏', () => {
  const p = loadPage();
  p.L.showBookmarkBar();
  assert.equal(p.el('bookmarkBar').classList.contains('show'), true);
  p.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(p.el('bookmarkBar').classList.contains('show'), false, 'Esc 应收起书签栏');
});

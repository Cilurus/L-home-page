/**
 * P2 回归测试：直接在 vm 沙箱里执行 index - new.html 的真实主脚本。
 * 运行：node --test tests/
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './harness.mjs';

const KEY = {
  WHITE_CLOCK: 'mc_whiteClock', TOGGLE_MOTTO: 'mc_toggleMotto',
  TOGGLE_MINIMAL: 'mc_toggleMinimal',
  BOOKMARKS: 'mc_bookmarks', BG_TYPE: 'mc_bg_type', BG: 'mc_bg'
};

test('主脚本可在沙箱中加载，window.L 导出齐全', () => {
  const p = loadPage();
  assert.ok(p.L, 'window.L 应存在');
  for (const api of ['editMotto', 'saveBookmark', 'openBmPopup', 'openLunarPopup',
    'applyWallpaper', 'setFontColor', 'showToast', 'doSearch', 'deleteBookmark',
    'showToast', 'setCompactMode', 'resetDefaults']) {
    assert.equal(typeof p.L[api], 'function', `window.L.${api} 应为函数`);
  }
  // V2.2 简化：API 配置 / 个人资料 / 人设 / 收发信入口应已移除
  for (const gone of ['openApiConfig', 'openProfile', 'addPersona', 'openMorph', 'closeMorph', 'toggleAutoMsg']) {
    assert.equal(p.L[gone], undefined, `window.L.${gone} 应已移除`);
  }
});

test('默认值与 HTML 初始状态一致（§0 SETTINGS 注册表）', () => {
  const p = loadPage();
  // 还原真实 HTML：白色时间 / 白色格言 / 显示格言 的 track 初始就带 on
  ['toggleWhiteClock', 'toggleWhiteMotto', 'toggleMotto'].forEach(id => p.el(id).classList.add('on'));
  p.fireReady();
  assert.equal(p.el('toggleWhiteClock').classList.contains('on'), true, '白色时间默认开 → 不应被关闭');
  assert.equal(p.el('toggleWhiteMotto').classList.contains('on'), true, '白色格言默认开 → 不应被关闭');
  assert.equal(p.el('toggleMotto').classList.contains('on'), true, '显示格言默认开 → 不应被关闭');
  assert.equal(p.el('toggleMinimal').classList.contains('on'), false, '极简默认关');
});

test('缺陷 #2：收藏数组被截断 → 自动补齐且内容不丢', () => {
  const two = [{ icon: '__char__A', name: 'A', url: 'https://a.com' }, { icon: '__char__B', name: 'B', url: 'https://b.com' }];
  const p = loadPage({ seed: { [KEY.BOOKMARKS]: JSON.stringify(two) } });
  p.L.openBmPopup(0);
  assert.equal(p.el('bmUrlInput').value, 'https://a.com', '第 0 槽内容应保留');
  const saved = JSON.parse(p.store.get(KEY.BOOKMARKS));
  assert.equal(saved.length, 20, '应修复为 20 槽');
  assert.equal(saved[1].url, 'https://b.com', '第 1 槽内容应保留（修复前会全部丢失）');
});

test('缺陷 #2：非数组的损坏数据 → 不抛错、按空槽位处理、原始数据不删', () => {
  const p = loadPage({ seed: { [KEY.BOOKMARKS]: '{"0":{"name":"A"},"-1":{"name":"B"}}' } });
  assert.doesNotThrow(() => p.L.openBmPopup(0));
  assert.equal(p.el('bmUrlInput').value, '', '损坏数据不应被当成收藏');
  assert.equal(p.store.get(KEY.BOOKMARKS), '{"0":{"name":"A"},"-1":{"name":"B"}}', '原始数据应保留');
});

test('缺陷 #3：收藏下标越界时拒绝保存且不写存储', () => {
  const p = loadPage();
  p.L.openBmPopup(20);                       // 越界下标
  p.el('bmUrlInput').value = 'https://x.com';
  p.el('bmNameInput').value = 'X';
  p.L.saveBookmark();
  assert.equal(p.store.get(KEY.BOOKMARKS), undefined, '越界不应写入存储');
  assert.match(p.el('toast').textContent, /无效/, '应提示位置无效');
});

test('缺陷 #4：存储配额超限时明确失败，不假装成功', () => {
  const p = loadPage();
  p.fireReady();                             // 装好 Store.onStorageError → toast
  p.setQuota(true);
  p.L.openBmPopup(0);
  p.el('bmUrlInput').value = 'https://x.com';
  p.el('bmNameInput').value = 'X';
  p.L.saveBookmark();
  assert.match(p.el('toast').textContent, /失败|空间不足|存储/, '应有失败提示，而不是"✓ 已保存"');
});

test('缺陷 #6：可编辑区域不再被全局 selectstart/contextmenu 拦截', () => {
  const p = loadPage();
  const editable = { closest: (sel) => (sel.includes('input') ? {} : null) };
  let prevented = 0;
  p.document.dispatch('selectstart', { target: editable, preventDefault: () => prevented++ });
  assert.equal(prevented, 0, '输入框内不应阻止文本选择');
  p.document.dispatch('selectstart', { target: { closest: () => null }, preventDefault: () => prevented++ });
  assert.equal(prevented, 1, '非输入区域仍应保持"不可选中"的既有手感');
});

test('缺陷 #7：农历弹窗可切换、日期串无多余下划线', () => {
  const p = loadPage();
  p.L.openLunarPopup();
  p.frame();                                  // 弹窗显隐在下一帧（rAF）里完成
  assert.equal(p.el('lunarPopup').classList.contains('show'), true, '首次点击应打开');
  assert.doesNotMatch(p.el('lunarDate').textContent, /_/, '日期串不应含下划线占位符');
  assert.ok(p.el('lunarGanzhi').textContent.endsWith('年'), '干支年显示应正常');
  p.L.openLunarPopup();
  assert.equal(p.el('lunarPopup').classList.contains('show'), false, '再次点击应关闭（而不是叠加第二层）');
});

test('壁纸类型空串语义：自定义图片不会被误判成预设', () => {
  const p = loadPage({ seed: { [KEY.BG]: 'data:image/jpeg;base64,AAAA', [KEY.BG_TYPE]: '' } });
  const bg = p.el('bg');
  assert.ok(bg.style.background.includes('url('), '应应用自定义图片背景');
  assert.equal(bg.classList.contains('bg-orca'), false, '不应残留预设壁纸类');
});

test('resetDefaults 恢复注册表默认值', () => {
  const p = loadPage({ seed: { [KEY.TOGGLE_MINIMAL]: '1' } });
  p.fireReady();
  p.L.resetDefaults();
  assert.equal(p.store.get(KEY.TOGGLE_MINIMAL), '0', '极简模式应重置为关');
  assert.equal(p.store.get(KEY.TOGGLE_MOTTO), '1', '格言应重置为开');
  assert.equal(p.store.get(KEY.BG_TYPE), 'orca', '壁纸应重置为 orca');
});

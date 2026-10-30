/**
 * 功能回归：① 模糊程度独立可调 ② 收藏管理拖动排序
 * 运行：node --test tests/p8.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './harness.mjs';

const BLUR_VAR = '--card-blur-mul';
const bmOrder = (p) => JSON.parse(p.store.get('mc_bookmarks')).map((b) => (b ? b.name : null));
const seedBookmarks = (names) => ({
  mc_bookmarks: JSON.stringify(names.map((n, i) => ({
    icon: '__char__' + n[0], name: n, url: 'https://' + n.toLowerCase() + '.com', iconMode: 'char'
  })).concat(new Array(20 - names.length).fill(null)))
});

/* ---------------- ① 模糊程度（1~10 档，与"透明卡片"一致） ---------------- */

test('默认第 9 档：与重构前观感一致（0.889）', () => {
  const p = loadPage();
  p.fireReady();
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.889');
  assert.equal(p.el('blurSlider').value, '9');
  assert.equal(p.el('blurVal').textContent, '9');
});

test('模糊滑块独立生效并持久化（1 = 完全清晰，10 = 满值）', () => {
  const p = loadPage();
  p.fireReady();
  p.L.setCardBlur(3);
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.222');
  assert.equal(p.store.get('mc_blur'), '3');
  assert.equal(p.el('blurVal').textContent, '3');
  p.L.setCardBlur(1);
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.000', '第 1 档应完全清晰');
  p.L.setCardBlur(10);
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '1.000', '第 10 档为设计满值');
});

test('模糊档位越界会被夹到 1~10', () => {
  const p = loadPage();
  p.fireReady();
  p.L.setCardBlur(0);
  assert.equal(p.store.get('mc_blur'), '1');
  p.L.setCardBlur(99);
  assert.equal(p.store.get('mc_blur'), '10');
});

test('模糊已与透明度解耦（改透明度不再改模糊）', () => {
  const p = loadPage();
  p.fireReady();
  p.L.setCardBlur(4);
  p.L.setCardOpacity(10);
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.333', '透明度不应再影响模糊');
  p.L.setCardOpacity(1);
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.333');
});

test('经 data-input 委托路径也能调模糊', () => {
  const p = loadPage();
  p.inputFire('setCardBlur', '7', true);
  assert.equal(p.store.get('mc_blur'), '7');
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.667');
});

test('恢复默认设置会把模糊重置为第 9 档', () => {
  const p = loadPage({ seed: { mc_blur: '3' } });
  p.fireReady();
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.222');
  p.L.resetDefaults();
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.889');
  assert.equal(p.store.get('mc_blur'), '9');
});

test('兼容迁移：早期 0~100 的旧值自动折算成档位', () => {
  const p = loadPage({ seed: { mc_blur: '90' } });
  p.fireReady();
  assert.equal(p.store.get('mc_blur'), '9', '90 应折算为第 9 档');
  assert.equal(p.document.documentElement.style.getPropertyValue(BLUR_VAR), '0.889');
  const q = loadPage({ seed: { mc_blur: '40' } });
  q.fireReady();
  assert.equal(q.store.get('mc_blur'), '4', '40 应折算为第 4 档');
});

/* ---------------- ② 收藏拖动排序（领域层） ---------------- */

test('Domain.Bookmarks.move：向后移动', () => {
  const p = loadPage();
  const slots = ['A', 'B', 'C', null, null];
  assert.equal(p.L.Domain.Bookmarks.move(slots, 0, 2), true);
  assert.deepEqual(slots.slice(0, 3), ['B', 'C', 'A']);
});

test('Domain.Bookmarks.move：向前移动', () => {
  const p = loadPage();
  const slots = ['A', 'B', 'C', null];
  p.L.Domain.Bookmarks.move(slots, 2, 0);
  assert.deepEqual(slots.slice(0, 3), ['C', 'A', 'B']);
});

test('Domain.Bookmarks.move：物理槽位不变（维持原状偏好下也成立）', () => {
  const p = loadPage();
  const slots = ['A', null, 'B', null, 'C'];
  assert.equal(p.L.Domain.Bookmarks.move(slots, 0, 4), true);
  // 只重排"已占用槽位"里的内容：0/2/4 三个位置被 B、C、A 依次填入，空槽仍在原处
  assert.deepEqual(slots, ['B', null, 'C', null, 'A']);
});

test('Domain.Bookmarks.move：同位置/无效下标返回 false 且不改动', () => {
  const p = loadPage();
  const slots = ['A', 'B', null];
  assert.equal(p.L.Domain.Bookmarks.move(slots, 0, 0), false);
  assert.equal(p.L.Domain.Bookmarks.move(slots, 0, 5), false);
  assert.equal(p.L.Domain.Bookmarks.move(slots, 7, 0), false);
  assert.deepEqual(slots, ['A', 'B', null]);
});

/* ---------------- ② 收藏拖动排序（界面交互） ---------------- */

test('收藏管理：拖动一项到另一项上即完成排序并落盘', () => {
  const p = loadPage({ seed: seedBookmarks(['A', 'B', 'C']) });
  p.L.openBmList();
  const wrap = p.el('bmListWrap');
  assert.equal(wrap.children.length, 3, '应渲染出 3 项');

  const items = wrap.children;
  assert.equal(items[0].draggable, true, '列表项应可拖动');

  items[0]._ev.dragstart({ dataTransfer: { setData() {} } });
  assert.equal(items[0].classList.contains('dragging'), true, '拖动中应有 dragging 标记');

  items[2]._ev.dragover({ preventDefault() {}, dataTransfer: {} });
  assert.equal(items[2].classList.contains('drag-target'), true, '悬停目标应有高亮');

  items[2]._ev.drop({ preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(bmOrder(p).slice(0, 3), ['B', 'C', 'A'], '顺序应为 B、C、A');
  assert.match(p.el('toast').textContent, /顺序/);
});

test('收藏管理：拖到自己身上不产生变化', () => {
  const p = loadPage({ seed: seedBookmarks(['A', 'B']) });
  p.L.openBmList();
  const items = p.el('bmListWrap').children;
  items[1]._ev.dragstart({ dataTransfer: { setData() {} } });
  items[1]._ev.drop({ preventDefault() {}, stopPropagation() {} });
  assert.deepEqual(bmOrder(p).slice(0, 2), ['A', 'B']);
});

/* ---------------- ③ 委托白名单漏登记的回归 ---------------- */

test('收藏管理：拖动结束后清理标记', () => {
  const p = loadPage({ seed: seedBookmarks(['A', 'B']) });
  p.L.openBmList();
  const items = p.el('bmListWrap').children;
  items[0]._ev.dragstart({ dataTransfer: { setData() {} } });
  items[0]._ev.dragend();
  assert.equal(items[0].classList.contains('dragging'), false);
});

test('V2.2 简化：已移除的动作用户点击无效（白名单只剩现存功能）', () => {
  const p = loadPage();
  for (const gone of ['savePersona', 'saveApiConfig', 'openMorph', 'sendMorphMsg']) {
    p.click(gone);   // 白名单里没有 → dispatchAction 直接忽略，不应抛错
  }
  assert.equal(typeof p.L.openMorph, 'undefined', '已移除的调试入口不应再暴露');
  assert.equal(typeof p.L.data, 'undefined', '会话数据接口已随聊天功能移除');
});

test('模糊滑块的委托动作在白名单内（回归：曾漏登记 setCardBlur）', () => {
  const p = loadPage();
  p.inputFire('setCardBlur', '6', true);
  assert.equal(p.store.get('mc_blur'), '6');
});

test('滑块数值标签用百分比定位并跟随滑块（回归：数字跑到滑块外）', () => {
  const p = loadPage();
  p.L.setCardBlur(10);
  p.L.setCardOpacity(1);
  // 定位必须是与宽度无关的 calc() 百分比，而不是一次性量出的 px（面板隐藏时量不准会错位）
  assert.match(p.el('blurVal').style.left, /^calc\(/, '模糊数值标签应为 calc() 百分比定位');
  assert.match(p.el('opacityVal').style.left, /^calc\(/, '透明度数值标签应为 calc() 百分比定位');
  assert.match(p.el('blurVal').style.left, /100%/, '第 10 档应贴到右端');
  assert.match(p.el('opacityVal').style.left, /0\)$|^calc\(\(100% - 20px\) \* 0\)$/, '第 1 档应贴到左端');
  // 数值与滑块位置保持同步（程序化改值也要回写 input.value）
  assert.equal(p.el('blurSlider').value, '10');
  assert.equal(p.el('opacitySlider').value, '1');
  assert.equal(p.el('blurVal').textContent, '10');
  assert.equal(p.el('opacityVal').textContent, '1');
});

/**
 * P4 回归测试：§2 领域层纯函数（直接调用真实页面里的 Domain，不做任何 DOM 操作）。
 * 运行：node --test tests/p4.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './harness.mjs';

const D = () => loadPage().L.Domain;

test('Domain 子层齐全（V2.2 精简后：农历 / 收藏）', () => {
  const d = D();
  for (const k of ['Lunar', 'Bookmarks']) assert.ok(d[k], `Domain.${k} 应存在`);
  for (const gone of ['Text', 'Chat']) assert.equal(d[gone], undefined, `Domain.${gone} 应随 V2.2 清理移除`);
});

test('日柱干支：与已知日期核对', () => {
  const { Lunar } = D();
  assert.equal(Lunar.ganzhiDay(new Date(2024, 0, 1)), '甲子', '2024-01-01 应为甲子日');
  assert.equal(Lunar.ganzhiDay(new Date(1949, 9, 1)), '甲子', '1949-10-01 应为甲子日');
  assert.equal(Lunar.ganzhiDay(new Date(1900, 0, 1)), '甲戌', '锚点 1900-01-01 应为甲戌日');
});

test('农历快照：年月日、生肖、时辰', () => {
  const { Lunar } = D();
  const s = Lunar.snapshot(new Date(2024, 0, 1, 0, 30));
  assert.equal(s.yearName, '癸卯');
  assert.equal(s.zodiac, '兔');
  assert.match(s.month, /十一/);
  assert.equal(s.day, '二十');
  assert.equal(s.solarTerm, '冬至');
  assert.equal(s.shichen, '子时');
  assert.equal(s.shichenRange, '23:00-01:00');
  assert.equal(s.shichenIndex, 0);
});

test('时辰序号换算（含午夜与正午边界）', () => {
  const { Lunar } = D();
  const at = (h) => Lunar.shichenIndex(new Date(2024, 0, 1, h, 0));
  assert.equal(at(23), 0, '23 点属子时');
  assert.equal(at(0), 0, '0 点属子时');
  assert.equal(at(1), 1);
  assert.equal(at(11), 6, '11 点属午时');
  assert.equal(at(12), 6);
  assert.equal(at(13), 7);
  assert.equal(at(22), 11);
});

test('节气：边界抽样（近似表）', () => {
  const { Lunar } = D();
  const cases = [[1, 1, '冬至'], [1, 5, '小寒'], [1, 6, '小寒'], [1, 19, '小寒'], [1, 20, '大寒'],
  [2, 4, '立春'], [12, 21, '大雪'], [12, 22, '冬至'], [12, 31, '冬至']];
  for (const [m, d, want] of cases) {
    assert.equal(Lunar.solarTerm(new Date(2026, m - 1, d)), want, `${m}-${d} 应为 ${want}`);
  }
});

test('收藏槽位规整：长度正常 / 截断 / 补齐 / 损坏 / 空', () => {
  const { Bookmarks } = D();
  const full = new Array(20).fill(null);
  // 注意：Domain 在 vm 沙箱里创建对象，原型与宿主不同，故用 JSON 比较而非 deepStrictEqual
  assert.equal(JSON.stringify(Bookmarks.normalizeSlots(full, 20)), JSON.stringify({ slots: full, repaired: false, corrupt: false }));

  const short = Bookmarks.normalizeSlots([{ name: 'A' }, { name: 'B' }], 20);
  assert.equal(short.slots.length, 20);
  assert.equal(short.slots[0].name, 'A');
  assert.equal(short.slots[1].name, 'B');
  assert.equal(short.slots[19], null);
  assert.equal(short.repaired, true);

  const long = Bookmarks.normalizeSlots(new Array(25).fill({ name: 'X' }), 20);
  assert.equal(long.slots.length, 20);
  assert.equal(long.repaired, true);

  const corrupt = Bookmarks.normalizeSlots({ 0: { name: 'A' }, '-1': { name: 'B' } }, 20);
  assert.equal(corrupt.corrupt, true);
  assert.equal(corrupt.slots.length, 20);
  assert.ok(corrupt.slots.every((s) => s === null));

  const empty = Bookmarks.normalizeSlots(null, 20);
  assert.equal(empty.corrupt, false, '空存储不算损坏');
  assert.equal(empty.slots.length, 20);
});

test('收藏槽位：下标校验', () => {
  const { Bookmarks } = D();
  for (const [i, ok] of [[-1, false], [0, true], [19, true], [20, false], [NaN, false], [undefined, false], [1.5, false]]) {
    assert.equal(Bookmarks.isValidIndex(i, 20), ok, `isValidIndex(${i}) 应为 ${ok}`);
  }
});

test('收藏槽位：删除（自动补位 / 保持原位）', () => {
  const { Bookmarks } = D();
  const base = () => [{ n: 'A' }, { n: 'B' }, { n: 'C' }, null, null];
  const compacted = Bookmarks.removeAt(base(), 0, true);
  assert.deepEqual(compacted.map((s) => s && s.n), ['B', 'C', null, null, null], '自动补位应整体前移');
  const kept = Bookmarks.removeAt(base(), 0, false);
  assert.deepEqual(kept.map((s) => s && s.n), [null, 'B', 'C', null, null], '保持原位只清空该槽');
});

test('收藏槽位：压缩与取空位', () => {
  const { Bookmarks } = D();
  const slots = [{ n: 'A' }, null, { n: 'B' }, null, null];
  assert.equal(Bookmarks.nextFree(slots), 1);
  assert.equal(Bookmarks.nextFree([{ n: 'A' }]), -1, '全满时返回 -1');
  assert.deepEqual(Bookmarks.compact([{ n: 'A' }, null, { n: 'B' }, null]).map((s) => s && s.n),
    ['A', 'B', null, null]);
});

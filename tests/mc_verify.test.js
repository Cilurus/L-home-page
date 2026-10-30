// 行为验证（修订版）：书签数据保护 + 自动消息默认值
// 说明：前 2 项用于确认"数组写入 -1 键"的真实后果，结论是 JSON 往返会丢弃该键。
const BM_TOTAL = 20, BM_KEY = 'mc_bookmarks';

function makeLS(corrupt) {
  let store = {};
  if (corrupt !== undefined) store[BM_KEY] = corrupt;
  return {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = v; },
    removeItem: k => { delete store[k]; },
  };
}
const oldGetBookmarks = ls => {
  try { const d = JSON.parse(ls.getItem(BM_KEY)); if (Array.isArray(d) && d.length === BM_TOTAL) return d; } catch (e) {}
  return Array(BM_TOTAL).fill(null);
};
const isBookmarksCorrupt = ls => {
  try { const d = JSON.parse(ls.getItem(BM_KEY)); return d !== null && !Array.isArray(d); }
  catch (e) { return true; }
};
const newGetBookmarks = ls => {
  try {
    const d = JSON.parse(ls.getItem(BM_KEY));
    if (Array.isArray(d) && d.length === BM_TOTAL) return d;
    if (Array.isArray(d) && d.length > 0) {
      const fixed = d.slice(0, BM_TOTAL);
      while (fixed.length < BM_TOTAL) fixed.push(null);
      return fixed;
    }
  } catch (e) {}
  return Array(BM_TOTAL).fill(null);
};
const idxValid = i => i >= 0 && i < BM_TOTAL;

let pass = 0, fail = 0;
const check = (name, cond, extra) => {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  -> ' + extra : '')); }
};

console.log('\n[1] 事实核对：数组写入 -1 键的真实后果（推翻原先判断）');
{
  const bms = Array(BM_TOTAL).fill(null);
  bms[3] = { name: '已有收藏', url: 'https://a.com' };
  bms[-1] = { name: '错位写入', url: 'https://b.com' };
  check('内存中确实留下了非索引属性 "-1"', bms[-1] !== undefined);
  const parsed = JSON.parse(JSON.stringify(bms));
  check('JSON 往返后 "-1" 键被丢弃（数组不受污染）', parsed[-1] === undefined);
  check('往返后仍是长度 20 的数组', Array.isArray(parsed) && parsed.length === BM_TOTAL);
  check('旧 getBookmarks 仍能读回原收藏（未丢失）', oldGetBookmarks(makeLS(JSON.stringify(bms)))[3].name === '已有收藏');
}

console.log('\n[2] 新 getBookmarks 能修复异常数据（外部改坏 / 截断）');
{
  const obj = makeLS('{"0":{"name":"A"},"-1":{"name":"B"}}');
  check('对象型数据 -> 安全返回 20 空槽，不再抛错', newGetBookmarks(obj).every(v => v === null));
  const short = makeLS(JSON.stringify([{ name: 'A' }, { name: 'B' }]));
  const got = newGetBookmarks(short);
  check('长度 2 -> 补到 20 且保留内容', got.length === 20 && got[0].name === 'A' && got[1].name === 'B');
  const long = makeLS(JSON.stringify(Array(25).fill({ name: 'X' })));
  check('长度 25 -> 截到 20', newGetBookmarks(long).length === 20);
  check('损坏检测能识别对象型数据', isBookmarksCorrupt(obj) === true);
  check('正常数组不会被误判为损坏', isBookmarksCorrupt(makeLS(JSON.stringify(Array(BM_TOTAL).fill(null)))) === false);
  check('空存储不会被误判为损坏', isBookmarksCorrupt(makeLS()) === false);
}

console.log('\n[3] saveBookmark 下标校验（新增防护，阻止越界槽位写入）');
{
  const cases = [[-1, false], [0, true], [19, true], [20, false], [NaN, false], [undefined, false]];
  for (const [i, ok] of cases) {
    check('bmEditIdx=' + i + ' -> ' + (ok ? '接受' : '拒绝'), idxValid(i) === ok);
  }
}

console.log('\n[4] safeSet 在配额超限时返回 false 而不是静默抛出');
{
  const safeSet = (ls, key, val) => { try { ls.setItem(key, val); return true; } catch (e) { return false; } };
  const ok = { setItem: () => {} };
  const boom = { setItem: () => { const e = new Error('QuotaExceededError'); e.name = 'QuotaExceededError'; throw e; } };
  check('正常写入返回 true', safeSet(ok, 'k', 'v') === true);
  check('配额超限返回 false 且不抛出', safeSet(boom, 'k', 'v') === false);
}

console.log('\n[5] 自动消息默认值语义（原先默认开启，已改为默认关闭）');
{
  const isAutoMsgOn = ls => ls.getItem('mc_autoMsg') === '1';
  check('未设置 -> 关闭（旧代码此处视为开启）', isAutoMsgOn(makeLS()) === false);
  const on = makeLS(); on.setItem('mc_autoMsg', '1');
  check("显式 '1' -> 开启", isAutoMsgOn(on) === true);
  const off = makeLS(); off.setItem('mc_autoMsg', '0');
  check("显式 '0' -> 关闭", isAutoMsgOn(off) === false);
}

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);

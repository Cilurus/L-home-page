/**
 * P7 回归测试：性能收尾（行为不变的守门测试）
 * 运行：node --test tests/p7.test.mjs
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadPage } from './harness.mjs';

test('不存在任何 2 秒常驻定时器（原图形形变已删除，V2.0.2）', () => {
  for (const seed of [undefined, { mc_toggleShape: '1' }]) {
    const p = loadPage(seed ? { seed } : {});
    p.fireReady();
    assert.equal(p.liveCount('interval', 2000), 0, '不应再有任何形变定时器');
  }
});

test('浮层状态刷新合并到下一帧', () => {
  const p = loadPage();
  const root = p.document.documentElement;
  p.L.toggleSettings();
  assert.equal(p.el('settingsPopup').classList.contains('show'), true, '浮层本身同步打开');
  assert.equal(root.classList.contains('popup-open'), false, '状态类应排队到下一帧，而不是同步写');
  p.frame();
  assert.equal(root.classList.contains('popup-open'), true, '下一帧后状态类生效');
});

test('雨滴：重复开启不叠加循环，切走壁纸后清理', () => {
  const p = loadPage();
  p.L.applyWallpaper('rain');
  assert.equal(p.el('rainCanvas').style.display, 'block', '画布应显示');
  p.frame();                                   // 冲刷状态刷新 rAF，并跑一帧粒子
  const n1 = p.liveCount('raf');
  assert.equal(n1, 1, '应恰好维持一个粒子循环');
  p.L.applyWallpaper('rain');
  p.frame();
  assert.equal(p.liveCount('raf'), n1, '重复开启不应叠加 rAF 循环');
  p.L.applyWallpaper('orca');
  p.frame();                                   // 冲刷状态刷新 rAF
  assert.equal(p.liveCount('raf'), 0, '切走后应停掉粒子循环');
});

test('萤火：重复开启不叠加循环，切走后清理', () => {
  const p = loadPage();
  p.L.applyWallpaper('firefly');
  p.frame();
  const n1 = p.liveCount('raf');
  assert.equal(n1, 1, '应恰好维持一个粒子循环');
  p.L.applyWallpaper('firefly');
  p.frame();
  assert.equal(p.liveCount('raf'), n1, '重复开启不应叠加 rAF 循环');
  p.L.applyWallpaper('orca');
  p.frame();
  assert.equal(p.liveCount('raf'), 0, '切走后应停掉粒子循环');
});

test('粒子渲染多帧不抛错（复用缓冲后仍能正常绘制）', () => {
  const p = loadPage({ seed: { mc_bg_type: 'firefly' } });
  p.fireReady();
  assert.doesNotThrow(() => { for (let i = 0; i < 5; i++) p.frame(); });
  const q = loadPage({ seed: { mc_bg_type: 'rain' } });
  q.fireReady();
  assert.doesNotThrow(() => { for (let i = 0; i < 5; i++) q.frame(); });
});

/**
 * 一键自检：结构自检 + 全部回归测试。
 * 用法：node tools/check-all.mjs
 * 说明：子进程用 stdio:'inherit'（沙箱下管道捕获会失败），逐项打印结果并汇总。
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const steps = [
  ['结构自检', ['tools/verify.mjs']],
  ['书签/存储语义基线', ['tests/mc_verify.test.js']],
  ['Store / 缺陷回归', ['--test', 'tests/p2.test.mjs']],
  ['浮层管理器回归', ['--test', 'tests/p3.test.mjs']],
  ['事件委托回归', ['--test', 'tests/p3b.test.mjs']],
  ['领域层回归', ['--test', 'tests/p4.test.mjs']],
  ['性能收尾回归', ['--test', 'tests/p7.test.mjs']],
  ['新功能回归（模糊/拖动/白名单）', ['--test', 'tests/p8.test.mjs']],
  ['扩展资源与契约', ['--test', 'tests/extension.test.mjs']]
];

let failed = 0;
console.log('L 起始页 · 自检开始\n' + '='.repeat(52));
for (const [name, args] of steps) {
  const r = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
  const ok = r.status === 0;
  if (!ok) failed++;
  console.log(`${ok ? '✔' : '✘'} ${name}`);
}
console.log('='.repeat(52));
console.log(failed ? `✘ ${failed} 项失败` : `✔ 全部通过（${steps.length} 项）`);
process.exit(failed ? 1 : 0);

#!/usr/bin/env node
/**
 * 生成扩展图标（16/32/48/128 PNG）。
 *
 * 做法：把同一份 SVG 按目标尺寸渲染到无头 Chrome 里截图，背景设为全透明。
 * 那样不需要引入任何图形库，形状与页面内的鲸鱼标完全一致。
 *
 * 用法：node tools/make-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SHELL = path.join(ROOT, 'extension', 'content', 'shell.js');
const OUT_DIR = path.join(ROOT, 'extension', 'assets');
const TMP = path.join(ROOT, '.tmp-icon.html');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
].find((p) => fs.existsSync(p));

if (!CHROME) {
  console.error('未找到 Chrome / Edge，无法渲染图标');
  process.exit(1);
}

// 从 shell.js 里取出鲸鱼路径，保证图标与页面里用的是同一个形状
const shellSrc = fs.readFileSync(SHELL, 'utf8');
const m = shellSrc.match(/const WHALE_PATH = '([^']+)'/);
if (!m) {
  console.error('shell.js 里找不到 WHALE_PATH');
  process.exit(1);
}
const whalePath = m[1];

const SIZES = [16, 32, 48, 128];
fs.mkdirSync(OUT_DIR, { recursive: true });

for (const size of SIZES) {
  const r = Math.round(size * 0.24);           // 圆角
  const inner = Math.round(size * (size <= 32 ? 0.74 : 0.66));   // 小尺寸放大一点，避免发虚
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    html,body{margin:0;padding:0;width:${size}px;height:${size}px;background:transparent;overflow:hidden}
    svg{display:block}
  </style></head><body>
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#5B78FF"/><stop offset="1" stop-color="#3B54D8"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="url(#g)"/>
    <g transform="translate(${(size - inner) / 2} ${(size - inner) / 2}) scale(${inner / 24})">
      <path d="${whalePath}" fill="#ffffff"/>
    </g>
  </svg></body></html>`;

  fs.writeFileSync(TMP, html, 'utf8');
  const out = path.join(OUT_DIR, `icon-${size}.png`);
  const res = spawnSync(CHROME, [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--default-background-color=00000000',
    `--window-size=${size},${size}`,
    '--force-device-scale-factor=1',
    '--virtual-time-budget=1500',
    `--screenshot=${out}`,
    'file:///' + TMP.replace(/\\/g, '/').replace(/^\//, '')
  ], { stdio: 'pipe' });

  if (!fs.existsSync(out)) {
    console.error(`✘ ${size}px 生成失败`, res.stderr && res.stderr.toString().slice(0, 200));
    process.exit(1);
  }
  const buf = fs.readFileSync(out);
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  console.log(`✔ icon-${size}.png  ${buf.length} B  实际尺寸 ${w}×${h}`);
}

fs.unlinkSync(TMP);
console.log('完成 → extension/assets/');

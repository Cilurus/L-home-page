#!/usr/bin/env node
/**
 * 把起始页主文件（index - new.html）构建成浏览器扩展可注入的资源包。
 *
 * 为什么需要构建：扩展不能直接 iframe 起始页（DeepSeek 是 frame-ancestors 'none'），
 * 只能把 UI 以 Shadow DOM 注入真页面。Shadow DOM 里没有 <html>/<body>，
 * 所以样式里的 `html.xxx` / `body` 选择器必须先改写；内联 <script> 也不会执行，
 * 因此要把脚本拆出来，由外壳（content/shell.js）按顺序带着沙箱参数执行。
 *
 * 输出：extension/content/startpage-data.js
 *   self.__LSP_DATA__   = { css, html }
 *   self.__LSP_PRE__    = function (document, localStorage) {...}   // 首屏极简模式预置
 *   self.__LSP_CONST__  = function (window) {...}                   // 农历常量
 *   self.__LSP_MAIN__   = function (document, window, localStorage) {...}
 *
 * 用法：node tools/build-extension.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const SRC = path.join(ROOT, 'index - new.html');
const OUT_DIR = path.join(ROOT, 'extension', 'content');
const OUT = path.join(OUT_DIR, 'startpage-data.js');

const src = fs.readFileSync(SRC, 'utf8');

// 先剔除 HTML 注释：文件头部的说明注释里出现了字面量 `<script>`，
// 不先清掉的话正则会把"注释 + 后面一段脚本"错当成一个 script 块。
const clean = src.replace(/<!--[\s\S]*?-->/g, '');

/* ---------- 1. 抽样式 ---------- */
const styles = [...clean.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
if (!styles.length) throw new Error('未找到 <style>');

/**
 * 把 `html` / `body` 选择器改写成 :host(...)，让同一份样式在 Shadow DOM 里生效。
 * 关键顺序：`html.minimal.minimal-show` 这类复合选择器必须先于通用规则处理，
 * 否则会被拆成 `:host(.minimal).minimal-show`（语义变了）。
 */
function transformCss(css) {
  let out = css;
  // 复合：html.a.b → :host(.a.b)
  out = out.replace(/\bhtml((?:\.[\w-]+){2,})/g, (_, cls) => `:host(${cls})`);
  // 单个：html.a → :host(.a)
  out = out.replace(/\bhtml(\.[\w-]+)/g, (_, cls) => `:host(${cls})`);
  // 裸 html 选择器（含 `html, body`、`html {`、`, html`）
  out = out.replace(/(^|[,{}])(\s*)html(\s*[,{])/g, '$1$2:host$3');
  // 裸 body 选择器
  out = out.replace(/(^|[,{}])(\s*)body(\s*[,{])/g, '$1$2:host$3');
  return out;
}

const css = transformCss(styles.join('\n'));

/* ---------- 2. 抽脚本 ---------- */
const scripts = [...clean.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]);
const mainIdx = scripts.findIndex((s) => /window\.L\s*=\s*window\.L/.test(s));
if (mainIdx < 0) throw new Error('未找到主脚本（window.L 定义）');

const mainScript = scripts[mainIdx];
const others = scripts.filter((_, i) => i !== mainIdx);
const constScript = others.find((s) => /LUNAR_CONSTANTS\s*=/.test(s)) || '';
const preScript = others.find((s) => /mc_toggleMinimal/.test(s)) || '';

/* ---------- 3. 抽 body 结构 ---------- */
const bodyMatch = clean.match(/<body[^>]*>([\s\S]*)<\/body>/i);
if (!bodyMatch) throw new Error('未找到 <body>');
let bodyHtml = bodyMatch[1];
// 内联 <script> 在 Shadow DOM 里不会执行，且会把源码当文本留在节点里 → 全部移除
bodyHtml = bodyHtml.replace(/<script[\s\S]*?<\/script>/gi, '');
// 主脚本与常量脚本不在 body 内，保险起见再裁一刀
bodyHtml = bodyHtml.trim();

/* ---------- 4. 生成 ---------- */
const banner = `/* ------------------------------------------------------------------
 * 自动生成，请勿手改。
 * 来源：index - new.html   生成器：tools/build-extension.mjs
 * 重新生成：node tools/build-extension.mjs
 * ------------------------------------------------------------------ */`;

const emit = (fnHead, code) =>
  `${fnHead} {\n${code}\n};\n`;

const file = [
  banner,
  `self.__LSP_DATA__ = {\n  css: ${JSON.stringify(css)},\n  html: ${JSON.stringify(bodyHtml)}\n};\n`,
  emit('self.__LSP_PRE__ = function (document, localStorage)', preScript),
  emit('self.__LSP_CONST__ = function (window)', constScript),
  emit('self.__LSP_MAIN__ = function (document, window, localStorage)', mainScript),
].join('\n');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT, file, 'utf8');

/* ---------- 5. 自检 ---------- */
const leftHtml = (css.match(/(^|[,{}])\s*(html|body)\b/gm) || []).length;
const kb = (Buffer.byteLength(file, 'utf8') / 1024).toFixed(1);
console.log(`✔ 生成 ${path.relative(ROOT, OUT)}  (${kb} KB)`);
console.log(`  样式 ${(css.length / 1024).toFixed(1)} KB · 结构 ${(bodyHtml.length / 1024).toFixed(1)} KB · 主脚本 ${(mainScript.length / 1024).toFixed(1)} KB`);
console.log(`  残留 html/body 选择器：${leftHtml}${leftHtml ? '  ← 需要检查' : ''}`);
console.log(`  脚本拆分：pre=${preScript ? 'ok' : '空'} const=${constScript ? 'ok' : '空'} main=ok`);

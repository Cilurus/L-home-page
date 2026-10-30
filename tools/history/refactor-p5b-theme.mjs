/**
 * P5b-① 主题合并：gray-text / black-text 两套手工复制的规则 → 一份变量 + 一份合并规则
 *  · 按"选择器 + 属性"对齐两套规则，颜色对生成 --fg-N 令牌
 *  · 只有一套存在的规则原样保留（主题专属）
 *  · 脚本内置等价性校验：逐条把生成结果反解回具体值，与原规则比对，全部一致才写盘
 * 用法：node tools/refactor-p5b-theme.mjs [--write]
 */
import fs from 'node:fs';

const FILE = './index - new.html';
const WRITE = process.argv.includes('--write');
let txt = fs.readFileSync(FILE, 'utf8');
if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);

const styleStart = txt.indexOf('<style>');
const styleEnd = txt.indexOf('</style>');
const css = txt.slice(styleStart, styleEnd);
const cssLines = css.split('\n');

/* ---------- 抽取主题块（以指定前缀开头，允许块内夹空行） ---------- */
function extractBlock(prefix) {
  const start = cssLines.findIndex(l => l.trim().startsWith(prefix));
  if (start < 0) throw new Error('找不到主题块: ' + prefix);
  let last = start;
  for (let i = start; i < cssLines.length; i++) {
    const s = cssLines[i].trim();
    if (s.startsWith(prefix)) { last = i; continue; }
    if (s === '') continue;                    // 块内允许空行
    break;                                     // 遇到别的规则 → 块结束
  }
  const lines = cssLines.slice(start, last + 1).filter(l => l.trim() !== '');
  for (const l of lines) {
    if (!l.trim().endsWith('}')) throw new Error('主题块存在多行规则，需要人工处理: ' + l.trim().slice(0, 60));
  }
  return { start, end: last + 1, lines };
}

const grayBlk = extractBlock('html.gray-text');
const blackBlk = extractBlock('html.black-text');
if (grayBlk.start > blackBlk.start) throw new Error('主题块顺序异常');

/* ---------- 解析规则 ---------- */
function parseRules(lines, theme) {
  const map = new Map();                       // selector(去主题前缀) -> [{prop, value}]
  for (const line of lines) {
    const m = /^(.*?)\s*\{(.*)\}\s*$/.exec(line.trim());
    if (!m) throw new Error('无法解析规则: ' + line);
    const sels = m[1].split(',').map(s => s.trim());
    const decls = m[2].split(';').filter(d => d.trim()).map(d => {
      const i = d.indexOf(':');
      return { prop: d.slice(0, i).trim(), value: d.slice(i + 1).trim() };
    });
    for (const sel of sels) {
      if (!sel.startsWith(theme)) throw new Error('选择器前缀不符: ' + sel);
      const key = sel.slice(theme.length).trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(...decls);
    }
  }
  return map;
}
const gray = parseRules(grayBlk.lines, 'html.gray-text');
const black = parseRules(blackBlk.lines, 'html.black-text');

/* ---------- 建令牌 ---------- */
const pairKey = (g, b) => g + ' || ' + b;
const tokens = new Map();      // pairKey -> index
function tokenOf(g, b) {
  const k = pairKey(g, b);
  if (!tokens.has(k)) tokens.set(k, tokens.size + 1);
  return tokens.get(k);
}

const merged = [];   // { selectors:[], decls:[{prop, value|token}] }
const themeOnly = { gray: [], black: [] };

for (const sel of new Set([...gray.keys(), ...black.keys()])) {
  const gDecls = gray.get(sel) || [];
  const bDecls = black.get(sel) || [];
  const gByProp = new Map(gDecls.map(d => [d.prop, d.value]));
  const bByProp = new Map(bDecls.map(d => [d.prop, d.value]));
  const decls = [];
  const grayOnly = [], blackOnly = [];
  for (const prop of new Set([...gByProp.keys(), ...bByProp.keys()])) {
    const g = gByProp.get(prop), b = bByProp.get(prop);
    if (g !== undefined && b !== undefined) {
      if (g === b) decls.push({ prop, literal: g });          // 两主题一致 → 直接写字面量
      else decls.push({ prop, token: tokenOf(g, b) });        // 有差异 → 令牌
    } else if (g !== undefined) {
      grayOnly.push({ prop, value: g });
    } else {
      blackOnly.push({ prop, value: b });
    }
  }
  if (decls.length) merged.push({ sel, decls });
  if (grayOnly.length) themeOnly.gray.push({ sel, decls: grayOnly });
  if (blackOnly.length) themeOnly.black.push({ sel, decls: blackOnly });
}

/* ---------- 生成 CSS ---------- */
const tokenGray = new Array(tokens.size + 1);
const tokenBlack = new Array(tokens.size + 1);
for (const [k, i] of tokens) { const [g, b] = k.split(' || '); tokenGray[i] = g; tokenBlack[i] = b; }

const varLine = (arr) => arr.slice(1).map((v, i) => `--fg-${i + 1}: ${v};`).join(' ');
const declText = (decls) => decls.map(d => d.token ? `${d.prop}: var(--fg-${d.token});` : `${d.prop}: ${d.literal};`).join(' ');

const out = [];
out.push('  /* §D-1 主题令牌：两套手抄规则（各 76 条）合并而来，改主题只需改这里的变量 */');
out.push(`  html.gray-text  { ${varLine(tokenGray)} }`);
out.push(`  html.black-text { ${varLine(tokenBlack)} }`);
out.push('  /* §D-2 合并后的规则：同一份选择器在两种主题下各取自己的 --fg-* */');
for (const r of merged) {
  out.push(`  html.gray-text ${r.sel}, html.black-text ${r.sel} { ${declText(r.decls)} }`);
}
for (const r of themeOnly.gray) {
  out.push(`  /* 仅 gray 主题有 */ html.gray-text ${r.sel} { ${r.decls.map(d => `${d.prop}: ${d.value};`).join(' ')} }`);
}
for (const r of themeOnly.black) {
  out.push(`  /* 仅 black 主题有 */ html.black-text ${r.sel} { ${r.decls.map(d => `${d.prop}: ${d.value};`).join(' ')} }`);
}
const newCss = out.join('\n');

/* ---------- 等价性校验：把生成结果反解回具体值，与原规则逐条比对 ---------- */
const problems = [];
const genGray = new Map(), genBlack = new Map();
{
  // 解析生成的令牌块
  const gv = /html\.gray-text\s*\{ ([^}]*) \}/.exec(newCss)[1];
  const bv = /html\.black-text\s*\{ ([^}]*) \}/.exec(newCss)[1];
  const readVars = (s) => {
    const m2 = new Map();
    s.split(';').filter(x => x.trim()).forEach(x => { const i = x.indexOf(':'); m2.set(x.slice(0, i).trim(), x.slice(i + 1).trim()); });
    return m2;
  };
  const gVars = readVars(gv), bVars = readVars(bv);
  const body = newCss.split('§D-2')[1];
  for (const line of body.split('\n')) {
    // 每条合并规则同时驱动两种主题：分别代入各自的 --fg-* 再比对
    const m = /html\.(gray|black)-text ([^{]+?), html\.(gray|black)-text ([^{]+?) \{ ([^}]*) \}/.exec(line);
    if (!m) continue;
    const sel = m[2].trim();
    const raw = m[5].split(';').filter(x => x.trim()).map(x => {
      const i = x.indexOf(':');
      return { prop: x.slice(0, i).trim(), value: x.slice(i + 1).trim() };
    });
    const resolve = (vars) => raw.map(d => {
      const vm = /var\((--fg-\d+)\)/.exec(d.value);
      return { prop: d.prop, value: vm ? vars.get(vm[1]) : d.value };
    });
    genGray.set(sel, resolve(gVars));
    genBlack.set(sel, resolve(bVars));
  }
  // 逐条比对原规则
  for (const [sel, decls] of gray) {
    const got = genGray.get(sel) || [];
    for (const d of decls) {
      const hit = got.find(x => x.prop === d.prop);
      if (!hit) problems.push(`gray ${sel} { ${d.prop} } 丢失`);
      else if (hit.value !== d.value) problems.push(`gray ${sel} { ${d.prop} } ${hit.value} ≠ ${d.value}`);
    }
  }
  for (const [sel, decls] of black) {
    const got = genBlack.get(sel) || [];
    for (const d of decls) {
      const hit = got.find(x => x.prop === d.prop);
      if (!hit) problems.push(`black ${sel} { ${d.prop} } 丢失`);
      else if (hit.value !== d.value) problems.push(`black ${sel} { ${d.prop} } ${hit.value} ≠ ${d.value}`);
    }
  }
  // 反向：生成结果里不应有原主题没有的声明
  for (const [sel, decls] of genGray) {
    const orig = gray.get(sel);
    const greys = themeOnly.gray.find(x => x.sel === sel);
    for (const d of decls) {
      const inOrig = orig && orig.some(x => x.prop === d.prop);
      const inOnly = greys && greys.decls.some(x => x.prop === d.prop);
      if (!inOrig && !inOnly) problems.push(`gray 多出 ${sel} { ${d.prop} }`);
    }
  }
}

console.log('gray 规则数:', gray.size, ' black 规则数:', black.size);
console.log('合并规则数:', merged.length, ' 生成令牌数:', tokens.size);
console.log('主题专属规则:', themeOnly.gray.length, '(gray) /', themeOnly.black.length, '(black)');
console.log('DEBUG genGray/genBlack:', genGray.size, genBlack.size);
console.log('DEBUG 生成样例:', JSON.stringify(out.slice(2, 5)));
console.log('等价性校验问题:', problems.length);
problems.slice(0, 12).forEach(p => console.log('  ✗ ' + p));

if (problems.length) { console.log('\n校验未通过，未写盘。'); process.exit(1); }

/* ---------- 落盘：用新 CSS 替换 gray 块，并删除 black 块 ---------- */
const grayRaw = cssLines.slice(grayBlk.start, grayBlk.end).join('\n');
const blackRaw = cssLines.slice(blackBlk.start, blackBlk.end).join('\n');
if (txt.split(grayRaw).length - 1 !== 1) throw new Error('gray 块定位失败');
if (txt.split('\n' + blackRaw).length - 1 !== 1) throw new Error('black 块定位失败');

let next = txt.replace(grayRaw, newCss);
next = next.replace('\n' + blackRaw, '');
console.log('\n文件', txt.length, '→', next.length, '字符');

if (!WRITE) { console.log('干跑通过（未写盘）。加 --write 实际写入。'); process.exit(0); }
fs.writeFileSync(FILE, next, { encoding: 'utf8' });
console.log('已写入：' + FILE);

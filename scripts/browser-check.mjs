// npm run check:browser [网址] [截图目录]   （可选，不属于 npm test）
//
// 通过 DevTools 协议驱动本机的 Chrome，没有 npm 依赖。对首页、一个详情页、日历、纪律、更新记录，
// 在电脑宽度（1360）和手机宽度（390）各打开一次：截图、检查有没有横向溢出和页面报错，
// 并在首页试一下筛选和排序。先构建并启动站点：
//
//   npm run build && npm start -- -p 3467 &
//   CHROME_DEBUG_PORT=9467 node scripts/browser-check.mjs http://localhost:3467 /tmp/gsw-shots
//
// 这台机器可能有别人在用：调试端口用 CHROME_DEBUG_PORT 指定；只停自己启动的进程。

import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const base = process.argv[2] ?? 'http://localhost:3467';
const outDir = process.argv[3] ?? path.join(tmpdir(), 'gsw-shots');
const port = Number(process.env.CHROME_DEBUG_PORT ?? 9467);
const detail = process.env.DETAIL_TICKER ?? 'NVDA';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
mkdirSync(outDir, { recursive: true });

const chrome = spawn(
  process.env.CHROME_BIN ?? 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`,
    `--user-data-dir=${mkdtempSync(path.join(tmpdir(), 'gsw-chrome-'))}`, 'about:blank'],
  { stdio: 'ignore' },
);
const stop = (code) => { chrome.kill(); process.exit(code); };

let target;
for (let i = 0; i < 40 && !target; i += 1) {
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((p) => p.type === 'page');
  } catch { /* Chrome 还在启动 */ }
  if (!target) await sleep(250);
}
if (!target) { console.error('无法连接到 Chrome 的调试端口'); stop(2); }

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => socket.addEventListener('open', r));
let seq = 0;
const pending = new Map();
const pageErrors = [];
socket.addEventListener('message', (event) => {
  const m = JSON.parse(event.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === 'Runtime.exceptionThrown') pageErrors.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
await send('Page.enable');
await send('Runtime.enable');

const failures = [];
const check = (ok, message) => { console.log(`${ok ? '  ✓' : '  ✗'} ${message}`); if (!ok) failures.push(message); };

async function open(url, width, height) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  await send('Page.navigate', { url: base + url });
  for (let i = 0; i < 80; i += 1) {
    await sleep(250);
    const state = await evaluate(`document.readyState + '|' + (document.querySelector('[data-quote-status="loading"]') ? 'loading' : 'idle')`);
    if (state === 'complete|idle') break;
  }
  await sleep(300);
}
async function shot(name) {
  const { result } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: await evaluate(`({x:0,y:0,width:window.innerWidth,height:Math.min(document.documentElement.scrollHeight, 9000),scale:1})`) });
  writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(result.data, 'base64'));
}
const overflow = () => evaluate(`document.documentElement.scrollWidth - window.innerWidth`);

const pages = [['home', '/'], ['detail', `/t/${detail}`], ['calendar', '/calendar'], ['discipline', '/discipline'], ['updates', '/updates']];
for (const [label, width, height] of [['desktop', 1360, 1000], ['mobile', 390, 844]]) {
  console.log(`${label}（${width} 像素）`);
  for (const [name, url] of pages) {
    await open(url, width, height);
    check((await overflow()) <= 0, `${url} 没有横向溢出`);
    check((await evaluate(`document.querySelector('meta[name="robots"]')?.content ?? ''`)).includes('noindex'), `${url} 带 noindex`);
    await shot(`${label}-${name}`);
  }
}

console.log('首页的筛选和排序（电脑宽度）');
await open('/', 1360, 1000);
const visibleRows = `[...document.querySelectorAll('tr[data-ticker]')].filter((r) => r.offsetParent).map((r) => r.dataset.ticker)`;
const click = (label) => evaluate(`[...document.querySelectorAll('button')].find((b) => b.textContent.trim().endsWith(${JSON.stringify(label)}))?.click()`);
check((await evaluate(`${visibleRows}.length`)) === (await evaluate(`Number(document.querySelector('[data-testid="count"]').textContent.match(/\\/(\\d+)/)[1])`)), '默认显示全部标的');
await click('回避'); await sleep(200);
const avoided = await evaluate(visibleRows);
check(avoided.length > 0 && avoided.length < 30, `筛选“回避”后剩 ${avoided.length} 个：${avoided.join('、')}`);
await click('全部'); await sleep(100);
await click('按距击球区（近的在前）'); await sleep(200);
const distances = await evaluate(`[...document.querySelectorAll('tr[data-ticker]')].filter((r) => r.offsetParent).map((r) => parseFloat(r.children[6].textContent.replace('−','-').replace(/[^0-9.+-]/g,''))).map((d) => (Number.isNaN(d) ? null : d))`);
check(distances.every((d, i) => i === 0 || d === null || (distances[i - 1] !== null && d >= distances[i - 1])), '按距击球区排序后是从小到大');
await shot('desktop-home-sorted');
await open('/', 390, 844);
check((await evaluate(`[...document.querySelectorAll('[data-ticker-card]')].filter((r) => r.offsetParent).length`)) > 0 && (await evaluate(`${visibleRows}.length`)) === 0, '手机宽度显示卡片、不显示表格');

check(pageErrors.length === 0, `页面没有报错${pageErrors.length ? '：' + pageErrors.join(' | ') : ''}`);
console.log(failures.length === 0 ? `\n全部通过。截图在 ${outDir}` : `\n${failures.length} 项没有通过。截图在 ${outDir}`);
socket.close();
stop(failures.length === 0 ? 0 : 1);

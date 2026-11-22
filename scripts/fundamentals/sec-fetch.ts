// 下载 www.sec.gov 上的文件（10-Q、6-K 附件、委托书等），转成纯文本存到缓存目录，方便查找原文。
//
// 用法：node --env-file-if-exists=.env.local scripts/fundamentals/sec-fetch.ts <SEC 文件网址> [...]
//   必须设置 SEC_USER_AGENT（名称加联系方式，SEC 的要求）；值放在 .env.local，不进仓库。没设置就不下载。
//   SEC_CACHE_DIR：缓存目录（默认 /tmp/sec-docs）。
// 遵守 SEC 的公平访问要求：顺序请求，每次间隔至少 150 毫秒（每秒不超过约 7 次）；同一文件已缓存就不再下载。
// 只访问 sec.gov；这个联系方式不用于任何其他网站。

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const UA = process.env.SEC_USER_AGENT;
if (!UA) {
  console.error('没有设置 SEC_USER_AGENT（见 README“怎么补估值相关信息”）；www.sec.gov 不接受未声明联系方式的请求，不下载。');
  process.exit(2);
}
const dir = process.env.SEC_CACHE_DIR ?? '/tmp/sec-docs';
mkdirSync(dir, { recursive: true });

function toText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|tr|li|h\d|table|br)\s*>|<br\s*\/?>/gi, '\n')
    .replace(/<td[^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/&#8220;|&#8221;|&ldquo;|&rdquo;/g, '"')
    .replace(/&#\d+;|&[a-z]+;/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n');
}

for (const url of process.argv.slice(2)) {
  const u = new URL(url);
  if (!/(^|\.)sec\.gov$/.test(u.hostname)) {
    console.error(`${url}：只下载 sec.gov 的文件`);
    continue;
  }
  const name = u.pathname.replace(/^\/+/, '').replace(/[^A-Za-z0-9._-]+/g, '_');
  const out = path.join(dir, `${name}.txt`);
  if (existsSync(out)) {
    console.log(`已缓存 ${out}`);
    continue;
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Encoding': 'gzip, deflate' } });
  if (!res.ok) {
    console.error(`${url} 返回 ${res.status}（不绕过）`);
    continue;
  }
  const body = await res.text();
  writeFileSync(out, /\.(htm|html)$|\/$/.test(u.pathname) ? toText(body) : body);
  console.log(`${out}（${body.length} 字符）`);
  await new Promise((r) => setTimeout(r, 150));
}

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import { loadDataset } from '../lib/load.ts';

// 核对导入：tests/fixtures/import-snapshot.json 是导入脚本直接从原 Excel 写出的快照（代码、板块、
// 击球价、退出价、原文的 SHA-256）。原 Excel 不在仓库里，所以用快照来核对。
// 以后“更新”会合法地改价和加内容，所以比较的是“导入当天（2026-11-19 这一版）的状态”：
//   - 击球价／退出价：取导入日之后最早一条调价记录的旧价，没有调过就是当前价；
//   - 定价依据／新闻：只取日期不晚于导入日的条目，拼回原文后比 SHA-256。

const root = path.resolve(import.meta.dirname, '..');
const snapshot = JSON.parse(readFileSync(path.join(root, 'tests/fixtures/import-snapshot.json'), 'utf8')) as {
  contentDate: string;
  sectors: { id: string; name: string }[];
  tickers: {
    ticker: string; company: string; sector: string; strikePrice: number; exitPrice: number;
    stanceLabel: string; rationaleSha256: string; newsSha256: string; newsCount: number;
  }[];
  notes: { id: string; source: string; sha256: string }[];
};
const data = loadDataset(path.join(root, 'data'));
const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');
const baseline = snapshot.contentDate;

// 以后按规则移除的标的（记在 meta/removed.json 里）不再核对。
const imported = snapshot.tickers.filter((s) => data.tickers.some((t) => t.ticker === s.ticker) || !data.removed.some((r) => r.name === s.ticker));

function priceAtImport(t: (typeof data.tickers)[number], field: 'strike' | 'exit'): number | null {
  const later = t.priceChanges.filter((c) => c.field === field && c.date > baseline).sort((a, b) => a.date.localeCompare(b.date));
  if (later.length > 0) return later[0]!.from;
  return field === 'strike' ? t.strikePrice : t.exitPrice;
}

test('导入：30 个标的、6 个板块，与原表一致', () => {
  assert.equal(snapshot.tickers.length, 30);
  assert.equal(snapshot.sectors.length, 6);
  assert.deepEqual(data.sectors, snapshot.sectors);
  for (const s of imported) assert.ok(data.tickers.some((t) => t.ticker === s.ticker), `缺少 ${s.ticker}`);
  // 导入时的 30 个都在；以后新增标的不算错，但板块必须在 sectors.json 里（校验已保证）。
  if (data.site.contentUpdatedOn === baseline) {
    assert.equal(data.tickers.length, 30);
    assert.deepEqual(data.tickers.map((t) => t.ticker), snapshot.tickers.map((t) => t.ticker), '顺序应与原表一致');
  }
  assert.equal(readdirSync(path.join(root, 'data/tickers')).length, data.tickers.length);
});

test('导入：每个标的的击球价、退出价、板块、公司名与原表一致', () => {
  for (const s of imported) {
    const t = data.tickers.find((x) => x.ticker === s.ticker)!;
    assert.equal(priceAtImport(t, 'strike'), s.strikePrice, `${s.ticker} 击球价`);
    assert.equal(priceAtImport(t, 'exit'), s.exitPrice, `${s.ticker} 退出价`);
    assert.equal(t.sector, s.sector, `${s.ticker} 板块`);
    assert.equal(t.company, s.company, `${s.ticker} 公司名`);
  }
});

test('导入：定价依据和新闻逐字保留（拼回原单元格文字后哈希一致）', () => {
  for (const s of imported) {
    const t = data.tickers.find((x) => x.ticker === s.ticker)!;
    const start = t.rationale.findIndex((r) => r.date !== null && r.date <= baseline);
    assert.ok(start >= 0, `${s.ticker} 没有导入日的定价依据`);
    const original = t.rationale.slice(start).map((r) => `【${r.label}】${r.text}`).join('\n\n');
    assert.equal(sha(original), s.rationaleSha256, `${s.ticker} 定价依据被改动`);
    const news = t.news.slice(t.news.length - s.newsCount).map((n) => `${n.date} ｜ ${n.title}\n${n.summary}\n${n.url}`).join('\n\n');
    assert.equal(sha(news), s.newsSha256, `${s.ticker} 导入的新闻被改动`);
  }
});

test('导入：表下方的说明逐字保留', (t) => {
  // 宏观环境、状态变化等会在内容更新时换成新的一轮；所以只在还没有做过内容更新时核对。
  if (data.site.contentUpdatedOn !== baseline) return t.skip('已有新的内容更新');
  for (const n of snapshot.notes) {
    const note = data.notes.find((x) => x.id === n.id);
    assert.ok(note, `缺少 ${n.id}`);
    assert.equal(sha(note.text), n.sha256, `${n.id}（${n.source}）被改动`);
  }
});

test('导入：原表写明的历史调价都在改动记录里', () => {
  const find = (code: string, field: string, from: number | null, to: number) =>
    data.tickers.find((t) => t.ticker === code)!.priceChanges.some((c) => c.field === field && c.from === from && c.to === to);
  for (const [code, from, to] of [['GOOGL', 340, 300], ['NVDA', 180, 165], ['TLN', 250, 280], ['BWXT', 155, 125], ['ASTS', 45, 35], ['TWST', 45, 70]] as const)
    assert.ok(find(code, 'strike', from, to), `${code} ${from}→${to}`);
  for (const [code, from, to] of [['GOOGL', 540, 480], ['NVDA', 360, 300], ['BWXT', 260, 220], ['ASTS', 160, 130]] as const)
    assert.ok(find(code, 'exit', from, to), `${code} 退出价 ${from}→${to}`);
  assert.ok(find('VST', 'strike', 190, 185));
});

test('披露：Anthropic 不在清单里，披露文字保留', () => {
  assert.ok(!data.tickers.some((t) => t.ticker === 'ANT' || /anthropic/i.test(t.company)));
  const ant = data.site.excluded.find((e) => e.ticker === 'ANT')!;
  assert.match(ant.text, /利益冲突，因此不纳入清单、不给击球价、不发表买卖观点/);
  assert.match(data.notes.find((n) => n.id === 'self-correction')!.text, /Anthropic是我的开发方/);
  const googl = data.tickers.find((t) => t.ticker === 'GOOGL')!;
  assert.match(googl.rationale.map((r) => r.text).join('\n'), /披露：Alphabet持有Anthropic股权，Anthropic是我的开发方。/);
  assert.equal(data.site.disclaimer, '研究判断，非投资建议。实时价约15-20分钟延迟。英镑本位注意美元汇率敞口。');
});

test('仓库里没有原始 Excel，也没有密钥样的文件', () => {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.name === 'node_modules' || e.name === '.next' || e.name === '.git' ? [] : e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );
  const bad = walk(root).filter((f) => /\.(xlsx|xls|pem|key)$/i.test(f) || /(^|\/)\.env(\.|$)/.test(f));
  assert.deepEqual(bad, []);
});

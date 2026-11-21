import assert from 'node:assert/strict';
import test from 'node:test';

import { marketCap, pct, usd } from '../lib/format.ts';
import { CACHE_MS, activeSources, clearQuoteCache, getQuotes } from '../lib/quotes/index.ts';
import { parseStooqCsv } from '../lib/quotes/stooq.ts';
import type { QuoteSource } from '../lib/quotes/types.ts';
import { parseYahooChart } from '../lib/quotes/yahoo-chart.ts';
import { parseBold, splitNumbered } from '../lib/richtext.ts';
import { distance, zoneOf } from '../lib/zone.ts';

// 这里的上游返回样例是按接口的公开格式手写的虚构数据，不是真实报价；真实接口没有实测过。

test('距击球区 =（现价 − 击球价）÷ 击球价', () => {
  assert.ok(Math.abs(distance(295.8, 300)! - -0.014) < 1e-9);
  assert.equal(distance(330, 300), 0.1);
  assert.equal(distance(null, 300), null);
  assert.equal(zoneOf(-0.014), 'below');
  assert.equal(zoneOf(0), 'below');
  assert.equal(zoneOf(0.02), 'near');
  assert.equal(zoneOf(0.3), 'mid');
  assert.equal(zoneOf(0.65), 'far');
  assert.equal(zoneOf(null), 'unknown');
});

test('格式化', () => {
  assert.equal(usd(300), '$300');
  assert.equal(usd(4.66), '$4.66');
  assert.equal(usd(1234.5), '$1,234.50');
  assert.equal(usd(null), '—');
  assert.equal(pct(-0.014), '−1.4%');
  assert.equal(pct(0.5, 0), '+50%');
  assert.equal(marketCap(3.58e12), '$3.58T');
  assert.equal(marketCap(4.7e9), '$4.7B');
  assert.equal(marketCap(null), '—');
});

test('加粗标记和编号拆分不改文字', () => {
  assert.deepEqual(parseBold('甲**乙**丙'), [{ text: '甲', bold: false }, { text: '乙', bold: true }, { text: '丙', bold: false }]);
  assert.deepEqual(parseBold('甲**乙'), [{ text: '甲**乙', bold: false }]);
  const s = '引子：①一；②二；③三。';
  const parts = splitNumbered(s);
  assert.equal(parts.lead + parts.items.join(''), s);
  assert.equal(parts.items.length, 3);
});

test('Yahoo 图表接口的解析', () => {
  const body = { chart: { result: [{ meta: { regularMarketPrice: 110, chartPreviousClose: 100, regularMarketTime: 1795000000 } }] } };
  const q = parseYahooChart(body)!;
  assert.equal(q.price, 110);
  assert.ok(Math.abs(q.changePct! - 0.1) < 1e-9);
  assert.equal(q.marketCap, null);
  assert.equal(q.asOf, new Date(1795000000 * 1000).toISOString());
  assert.equal(parseYahooChart({ chart: { result: null, error: { code: 'Not Found' } } }), null);
  assert.equal(parseYahooChart('oops'), null);
});

test('Stooq CSV 的解析；查不到的代码返回 null', () => {
  const ok = parseStooqCsv('Symbol,Date,Time,Open,High,Low,Close,Volume\nTEST.US,2026-01-02,22:00:00,10,11,9,10.5,1000\n')!;
  assert.equal(ok.price, 10.5);
  assert.equal(ok.changePct, null);
  assert.equal(parseStooqCsv('Symbol,Date,Time,Open,High,Low,Close,Volume\nXX.US,N/D,N/D,N/D,N/D,N/D,N/D,N/D\n'), null);
  assert.equal(parseStooqCsv(''), null);
});

test('取报价：依次尝试来源、失败不抛出、60 秒内不重复请求上游', async () => {
  clearQuoteCache();
  let calls = 0;
  const failing: QuoteSource = { id: 'a', label: 'a', fetchQuote: async () => { calls += 1; throw new Error('上游失败'); } };
  const partial: QuoteSource = {
    id: 'b', label: 'b',
    fetchQuote: async (symbol) => { calls += 1; return symbol === 'AAA' ? { price: 1, changePct: null, marketCap: null, asOf: null, source: 'b' } : null; },
  };
  let now = 1_000_000;
  const options = { sources: [failing, partial], now: () => now };
  const first = await getQuotes(['AAA', 'NOPE'], options);
  assert.equal(first.AAA?.price, 1);
  assert.equal(first.NOPE, null);
  assert.equal(calls, 4);
  await getQuotes(['AAA', 'NOPE'], options);
  assert.equal(calls, 4, '缓存期内不应再请求');
  now += CACHE_MS + 1;
  await getQuotes(['AAA'], options);
  assert.equal(calls, 6);
  clearQuoteCache();
});

test('QUOTE_SOURCES 的解析', () => {
  assert.deepEqual(activeSources(undefined).map((s) => s.id), ['yahoo-chart', 'stooq']);
  assert.deepEqual(activeSources('stooq').map((s) => s.id), ['stooq']);
  assert.deepEqual(activeSources('nonsense').map((s) => s.id), ['yahoo-chart']);
});

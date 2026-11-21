import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { readRaw } from '../lib/load.ts';
import { validateDataset } from '../lib/validate.ts';

const dir = path.resolve(import.meta.dirname, '..', 'data');
const fresh = () => structuredClone(readRaw(dir));
type Rec = Record<string, any>;
const ticker = (raw: ReturnType<typeof fresh>, code: string) => raw.tickers.find((t) => (t.data as Rec).ticker === code)!.data as Rec;

test('正式数据通过校验', () => {
  assert.deepEqual(validateDataset(fresh()), []);
});

test('改了击球价但没有留调价记录：校验失败', () => {
  const raw = fresh();
  ticker(raw, 'GOOGL').strikePrice = 290;
  assert.ok(validateDataset(raw).some((e) => e.includes('最近一条调价记录的新价')));
});

test('调价没有理由、或当天没有更新记录：校验失败', () => {
  const raw = fresh();
  const t = ticker(raw, 'TSM');
  t.strikePrice = 320;
  t.priceChanges.push({ date: '2026-12-01', field: 'strike', from: 330, to: 320, reason: '', source: 'x' });
  const errors = validateDataset(raw);
  assert.ok(errors.some((e) => e.includes('调价必须写理由')));
  assert.ok(errors.some((e) => e.includes('没有这一天的更新记录')));
});

test('Anthropic 不能加进清单，披露不能删', () => {
  const raw = fresh();
  const copy = structuredClone(ticker(raw, 'TSM'));
  copy.ticker = 'ANT';
  raw.tickers.push({ file: 'ant.json', data: copy });
  assert.ok(validateDataset(raw).some((e) => e.includes('利益冲突')));
  const raw2 = fresh();
  (raw2.site as Rec).excluded = [];
  assert.ok(validateDataset(raw2).some((e) => e.includes('披露')));
});

test('没有价格时必须写原因；新闻链接必须是 https；加粗标记要成对', () => {
  const raw = fresh();
  delete ticker(raw, 'CEG').lastPriceNote;
  ticker(raw, 'GOOGL').news[0].url = 'http://example.com';
  ticker(raw, 'NVDA').rationale[0].text += '**';
  const errors = validateDataset(raw);
  assert.ok(errors.some((e) => e.includes('lastPriceNote')));
  assert.ok(errors.some((e) => e.includes('https')));
  assert.ok(errors.some((e) => e.includes('不成对')));
});

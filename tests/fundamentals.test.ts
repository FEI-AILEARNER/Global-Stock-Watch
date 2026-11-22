import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

import { homeInputs, money, ttm, usdReportedPe, valuation } from '../lib/fundamentals.ts';
import type { Fundamentals } from '../lib/fundamentals.ts';
import { readRaw } from '../lib/load.ts';
import { pickYearAgo } from '../scripts/fundamentals/pick.ts';
import { validateDataset } from '../lib/validate.ts';

const dir = path.resolve(import.meta.dirname, '..', 'data');
type Rec = Record<string, any>;
const fresh = () => structuredClone(readRaw(dir));
const fund = (raw: ReturnType<typeof fresh>, code: string) => raw.fundamentals.find((f) => (f.data as Rec).ticker === code)!.data as Rec;

// 一份虚构的样例，只用于算术测试（单位：美元）。
const sample: Fundamentals = {
  ticker: 'TEST',
  checkedOn: '2026-11-22',
  currency: 'USD',
  sources: [{ id: 's', origin: 'document', form: '10-Q', period: 'x', url: 'https://example.com', checkedOn: '2026-11-22' }],
  periods: {
    fy: { label: 'FY2025', start: '2025-01-01', end: '2025-12-31' },
    fyPrior: { label: 'FY2024', start: '2024-01-01', end: '2024-12-31' },
    q: { label: 'Q3', start: '2026-07-01', end: '2026-09-30' },
    qPrior: { label: 'Q3', start: '2025-07-01', end: '2025-09-30' },
    ytd: { label: '2026 前三季', start: '2026-01-01', end: '2026-09-30' },
    ytdPrior: { label: '2025 前三季', start: '2025-01-01', end: '2025-09-30' },
    balanceDate: '2026-09-30',
  },
  flows: {
    revenue: { fy: { value: 1000, unit: 'USD', src: 's' }, ytd: { value: 900, unit: 'USD', src: 's' }, ytdPrior: { value: 700, unit: 'USD', src: 's' } },
    netIncome: { fy: { value: 100, unit: 'USD', src: 's' }, ytd: { value: 90, unit: 'USD', src: 's' }, ytdPrior: { value: 70, unit: 'USD', src: 's' } },
    operatingIncome: { fy: { value: 150, unit: 'USD', src: 's' }, ytd: { value: 120, unit: 'USD', src: 's' }, ytdPrior: { value: 100, unit: 'USD', src: 's' } },
    da: { fy: { value: 30, unit: 'USD', src: 's' }, ytd: { value: 30, unit: 'USD', src: 's' }, ytdPrior: { value: 20, unit: 'USD', src: 's' } },
    ocf: { fy: { value: 200, unit: 'USD', src: 's' }, ytd: { value: 150, unit: 'USD', src: 's' }, ytdPrior: { value: 150, unit: 'USD', src: 's' } },
    capex: { fy: { value: 50, unit: 'USD', src: 's' }, ytd: { value: 40, unit: 'USD', src: 's' }, ytdPrior: { value: 30, unit: 'USD', src: 's' } },
    sbc: { fy: { value: 10, unit: 'USD', src: 's' }, ytd: { value: 10, unit: 'USD', src: 's' }, ytdPrior: { value: 10, unit: 'USD', src: 's' } },
  },
  balance: { date: '2026-09-30', cash: { value: 300, unit: 'USD', src: 's' }, debt: { value: 100, unit: 'USD', src: 's' } },
  shares: { outstanding: { value: 10, unit: '股', src: 's' } },
  gaps: [],
};

test('正式数据（含估值信息）通过校验', () => {
  assert.deepEqual(validateDataset(fresh()), []);
});

test('近四季 = 全年 + 本年至今 − 上年同期', () => {
  assert.equal(ttm(sample, 'revenue').value, 1200);
  assert.equal(ttm(sample, 'netIncome').value, 120);
  const annual = { ...sample, periods: { ...sample.periods!, ytd: null, ytdPrior: null } };
  assert.equal(ttm(annual, 'revenue').value, 1000);
});

test('估值口径的算术：市值、企业价值、市盈率、EV/EBITDA、自由现金流收益率', () => {
  const { rows } = valuation(sample, 50, '击球价');
  const get = (id: string) => rows.find((r) => r.id === id)!.calc.value;
  assert.equal(get('mcap'), 500);
  assert.equal(get('ev'), 300); // 500 + 100 − 300
  assert.equal(get('pe'), 500 / 120);
  assert.equal(get('ev-ebitda'), 300 / (170 + 40)); // 营业利润 150+120−100，折旧 30+30−20
  assert.equal(get('fcf-yield'), (200 - 60) / 500); // 经营现金流 200，资本开支 50+40−30
  assert.equal(get('fcf-sbc-yield'), (140 - 10) / 500);
});

test('亏损时市盈率不适用；非美元财报不算需要股价的倍数', () => {
  const loss = structuredClone(sample);
  loss.flows!.netIncome = { fy: { value: -100, unit: 'USD', src: 's' }, ytd: { value: -90, unit: 'USD', src: 's' }, ytdPrior: { value: -70, unit: 'USD', src: 's' } };
  const pe = valuation(loss, 50, '击球价').rows.find((r) => r.id === 'pe')!.calc;
  assert.equal(pe.value, null);
  assert.match(pe.note!, /不适用/);
  const twd = { ...sample, currency: 'TWD' };
  assert.ok(valuation(twd, 50, '击球价').blocked);
  assert.equal(homeInputs(twd), null);
});

test('有数字就要有来源；没有数字要写原因；来源要在 sources 里', () => {
  const raw = fresh();
  const f = fund(raw, 'NVDA');
  f.flows.revenue.fy.src = undefined;
  f.flows.netIncome.fy = { value: null, unit: 'USD' };
  f.balance.cash.src = 'no-such-source';
  const errors = validateDataset(raw);
  assert.ok(errors.some((e) => e.includes('flows.revenue.fy 有数字就必须写来源')));
  assert.ok(errors.some((e) => e.includes('flows.netIncome.fy 没有数字时必须在 note 写明原因')));
  assert.ok(errors.some((e) => e.includes('balance.cash 的来源 no-such-source 不在 sources 里')));
});

test('估值信息只能给清单里的标的，Anthropic 不能有', () => {
  const raw = fresh();
  raw.fundamentals.push({ file: 'ant.json', data: { ticker: 'ANT', checkedOn: '2026-11-22', currency: 'USD', sources: [], gaps: [] } });
  const errors = validateDataset(raw);
  assert.ok(errors.some((e) => e.includes('清单里没有 ANT')));
  assert.ok(errors.some((e) => e.includes('利益冲突')));
});

test('金额的写法', () => {
  assert.equal(money(115_844_000_000), '$1,158亿');
  assert.equal(money(3_025_300_000_000), '$3.03万亿');
  assert.equal(money(-66_300_000), '−$66.3百万');
});

test('非美元公司：只用公司自报的单季每 ADR 美元收益，× 4 年化', () => {
  const twd: Fundamentals = { ...sample, currency: 'TWD', usdReported: { quarterEpsPerAdr: { value: 4.6, unit: 'USD/ADR', src: 's', period: 'Q3' } } };
  assert.equal(usdReportedPe(twd, 330)!.value, 330 / 18.4);
  assert.equal(usdReportedPe(sample, 330), null);
});

test('“一年前”的股数只在 300 到 400 天前的窗口里找（审核发现的 LEU、LUNR 错误）', () => {
  const facts = [
    { end: '2022-03-01', val: 13_673_933, accn: 'old' },
    { end: '2025-11-01', val: 17_492_832, accn: 'a' },
    { end: '2025-11-01', val: 719_200, accn: 'a' },
    { end: '2026-08-01', val: 20_000_000, accn: 'b' },
  ];
  const got = pickYearAgo(facts, '2026-11-01');
  assert.deepEqual(got.map((f) => f.val), [17_492_832, 719_200]);
  // 中间断档时不能退回到几年前的数字。
  assert.deepEqual(pickYearAgo([facts[0]!], '2026-11-01'), []);
  // 窗口里有两期时取离 365 天最近的一期。
  assert.equal(pickYearAgo([{ end: '2025-07-31', val: 1, accn: 'x' }, { end: '2025-10-31', val: 2, accn: 'y' }], '2026-10-31')[0]!.val, 2);
});

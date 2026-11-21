import type { Quote, QuoteSource } from './types.ts';

// Stooq 的公开 CSV 报价，不需要密钥。只有当日开高低收，没有前收和市值，所以日内涨跌和市值都是 null。
// 2026-11-21：在搭建用的工作区里连接被重置，没有实测成功过。

export function parseStooqCsv(csv: string): Omit<Quote, 'source'> | null {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return null;
  const head = (lines[0] ?? '').split(',').map((s) => s.trim().toLowerCase());
  const row = (lines[1] ?? '').split(',').map((s) => s.trim());
  const col = (name: string) => row[head.indexOf(name)];
  const price = Number(col('close'));
  if (!Number.isFinite(price) || price <= 0) return null; // 查不到的代码返回 N/D
  const date = col('date');
  const time = col('time');
  // Stooq 的时间是华沙时间，这里不换算时区，只保留日期，避免给出错误的时刻。
  const asOf = date && /^\d{4}-\d{2}-\d{2}$/.test(date) && time ? `${date}` : null;
  return { price, changePct: null, marketCap: null, asOf };
}

export const stooq: QuoteSource = {
  id: 'stooq',
  label: 'Stooq（公开 CSV）',
  async fetchQuote(symbol, signal) {
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(symbol.toLowerCase())}.us&f=sd2t2ohlcv&h&e=csv`;
    const response = await fetch(url, { signal, cache: 'no-store' });
    if (!response.ok) return null;
    const parsed = parseStooqCsv(await response.text());
    return parsed ? { ...parsed, source: 'stooq' } : null;
  },
};

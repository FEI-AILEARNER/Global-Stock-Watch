import type { Quote, QuoteSource } from './types.ts';

// Yahoo Finance 的公开图表接口，不需要密钥。不是官方承诺的 API，可能限流或变更；不提供市值。
// 2026-11-21：本地服务通过这个适配器取到了清单里全部 30 个代码（见 docs/PROGRESS.md）；在 Vercel 上还没有实测。
// 日内涨跌 =（最新价 − chartPreviousClose）÷ chartPreviousClose，没有和第二个来源交叉核对过。

export function parseYahooChart(body: unknown): Omit<Quote, 'source'> | null {
  const meta = (body as { chart?: { result?: { meta?: Record<string, unknown> }[] } })?.chart?.result?.[0]?.meta;
  if (!meta) return null;
  const price = meta.regularMarketPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) return null;
  const prev = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : meta.previousClose;
  const time = meta.regularMarketTime;
  return {
    price,
    changePct: typeof prev === 'number' && prev > 0 ? (price - prev) / prev : null,
    marketCap: null,
    asOf: typeof time === 'number' && time > 0 ? new Date(time * 1000).toISOString() : null,
  };
}

export const yahooChart: QuoteSource = {
  id: 'yahoo-chart',
  label: 'Yahoo Finance（公开图表接口）',
  async fetchQuote(symbol, signal) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1d`;
    const response = await fetch(url, { signal, headers: { accept: 'application/json' }, cache: 'no-store' });
    if (!response.ok) return null;
    const parsed = parseYahooChart(await response.json());
    return parsed ? { ...parsed, source: 'yahoo-chart' } : null;
  },
};

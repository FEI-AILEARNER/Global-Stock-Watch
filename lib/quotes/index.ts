import { fileSource } from './file.ts';
import { stooq } from './stooq.ts';
import type { Quote, QuoteSource } from './types.ts';
import { yahooChart } from './yahoo-chart.ts';

// 登记处。QUOTE_SOURCES（逗号分隔，按顺序尝试）决定用哪些来源；默认先 Yahoo 再 Stooq。
// 以后若要用需要密钥的来源：密钥只由 Fei 在 Vercel 后台设成环境变量，适配器里用 process.env 读，不写进仓库。

export const SOURCES: Record<string, QuoteSource> = {
  [yahooChart.id]: yahooChart,
  [stooq.id]: stooq,
  [fileSource.id]: fileSource,
};

export const DEFAULT_SOURCES = 'yahoo-chart,stooq';
export const CACHE_MS = 60_000;
export const TIMEOUT_MS = 5_000;

export function activeSources(env: string | undefined = process.env.QUOTE_SOURCES): QuoteSource[] {
  const list = (env ?? DEFAULT_SOURCES)
    .split(',')
    .map((s) => SOURCES[s.trim()])
    .filter((s): s is QuoteSource => Boolean(s));
  return list.length > 0 ? list : [yahooChart];
}

type Entry = { at: number; quote: Quote | null };
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Quote | null>>();

async function fetchOne(symbol: string, sources: QuoteSource[]): Promise<Quote | null> {
  for (const source of sources) {
    try {
      const quote = await source.fetchQuote(symbol, AbortSignal.timeout(TIMEOUT_MS));
      if (quote) return quote;
    } catch {
      // 这个来源失败：试下一个。
    }
  }
  return null;
}

/** 取一批代码的报价；每个代码缓存 60 秒（取不到也缓存，避免反复打上游）。永不抛出。 */
export async function getQuotes(
  symbols: string[],
  options: { sources?: QuoteSource[]; now?: () => number } = {},
): Promise<Record<string, Quote | null>> {
  const sources = options.sources ?? activeSources();
  const now = options.now ?? Date.now;
  const out: Record<string, Quote | null> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      const hit = cache.get(symbol);
      if (hit && now() - hit.at < CACHE_MS) {
        out[symbol] = hit.quote;
        return;
      }
      let job = inflight.get(symbol);
      if (!job) {
        job = fetchOne(symbol, sources).finally(() => inflight.delete(symbol));
        inflight.set(symbol, job);
      }
      const quote = await job;
      cache.set(symbol, { at: now(), quote });
      out[symbol] = quote;
    }),
  );
  return out;
}

export function clearQuoteCache(): void {
  cache.clear();
}

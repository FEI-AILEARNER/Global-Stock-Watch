import { loadDataset } from '@/lib/load';
import { CACHE_MS, activeSources, getQuotes } from '@/lib/quotes';

// 报价接口：页面打开时由浏览器请求。只查监控清单里的代码；每个代码缓存 60 秒；
// 取不到的代码返回 null，页面改用 JSON 里最后记录的价格。永远返回 200 和 JSON。

export const dynamic = 'force-dynamic';

const SYMBOL = /^[A-Z][A-Z0-9.]{0,7}$/;
const MAX = 60;

let symbolMap: Map<string, string> | null | undefined;
function watchlist(): Map<string, string> | null {
  if (symbolMap === undefined) {
    try {
      symbolMap = new Map(loadDataset().tickers.map((t) => [t.ticker, t.quoteSymbol ?? t.ticker]));
    } catch {
      symbolMap = null; // 函数包里读不到数据文件时：退回到只按格式检查代码
    }
  }
  return symbolMap;
}

export async function GET(request: Request): Promise<Response> {
  const list = watchlist();
  const asked = (new URL(request.url).searchParams.get('symbols') ?? '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((s) => SYMBOL.test(s));
  const wanted = (asked.length > 0 ? asked : list ? [...list.keys()] : []).filter((s) => !list || list.has(s)).slice(0, MAX);

  const sources = activeSources();
  const upstream = [...new Set(wanted.map((s) => list?.get(s) ?? s))];
  const bySymbol = await getQuotes(upstream, { sources });
  const quotes: Record<string, unknown> = {};
  for (const s of wanted) quotes[s] = bySymbol[list?.get(s) ?? s] ?? null;

  return Response.json(
    { fetchedAt: new Date().toISOString(), sources: sources.map((s) => s.id), cacheSeconds: CACHE_MS / 1000, quotes },
    { headers: { 'Cache-Control': `public, s-maxage=${CACHE_MS / 1000}, stale-while-revalidate=30` } },
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Quote } from '@/lib/quotes/types';
import type { LastPrice } from '@/lib/schema';
import { distance, zoneOf } from '@/lib/zone';
import type { ZoneId } from '@/lib/zone';

export type QuoteState = {
  status: 'loading' | 'ready' | 'failed';
  quotes: Record<string, Quote | null>;
  fetchedAt: string | null;
  refresh: () => void;
};

/** 页面打开时（以及点“刷新”时）向 /api/quotes 取报价。失败不报错，页面改用记录过的价格。 */
export function useQuotes(symbols: string[]): QuoteState {
  const key = symbols.join(',');
  const [state, setState] = useState<Omit<QuoteState, 'refresh'>>({ status: 'loading', quotes: {}, fetchedAt: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState((s) => ({ ...s, status: 'loading' }));
    fetch(`/api/quotes?symbols=${encodeURIComponent(key)}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: { fetchedAt: string; quotes: Record<string, Quote | null> }) =>
        setState({ status: 'ready', quotes: body.quotes ?? {}, fetchedAt: body.fetchedAt ?? null }),
      )
      .catch((error: unknown) => {
        if ((error as Error).name !== 'AbortError') setState({ status: 'failed', quotes: {}, fetchedAt: null });
      });
    return () => controller.abort();
  }, [key, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  return { ...state, refresh };
}

export type PriceView = {
  price: number | null;
  live: boolean;
  changePct: number | null;
  marketCap: number | null;
  asOf: string | null;
  distance: number | null;
  zone: ZoneId;
};

/** 有实时报价用实时的；没有就用 JSON 里最后记录的价格（标明非实时）。 */
export function viewPrice(quote: Quote | null | undefined, last: LastPrice | null, strike: number): PriceView {
  if (quote) {
    const d = distance(quote.price, strike);
    return { price: quote.price, live: true, changePct: quote.changePct, marketCap: quote.marketCap, asOf: quote.asOf, distance: d, zone: zoneOf(d) };
  }
  const d = distance(last?.value ?? null, strike);
  return { price: last?.value ?? null, live: false, changePct: null, marketCap: null, asOf: last?.asOf ?? null, distance: d, zone: zoneOf(d) };
}

export function clock(iso: string | null): string {
  if (!iso) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short' });
}

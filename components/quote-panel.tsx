'use client';

import { useMemo } from 'react';

import { ZoneValue } from '@/components/badges';
import { clock, useQuotes, viewPrice } from '@/components/use-quotes';
import { marketCap, pct, usd, zhDate } from '@/lib/format';
import type { LastPrice } from '@/lib/schema';

export function QuotePanel({ ticker, strikePrice, exitPrice, lastPrice, lastPriceNote }: {
  ticker: string; strikePrice: number; exitPrice: number; lastPrice: LastPrice | null; lastPriceNote?: string;
}) {
  const symbols = useMemo(() => [ticker], [ticker]);
  const { status, quotes, refresh } = useQuotes(symbols);
  const v = viewPrice(status === 'ready' ? quotes[ticker] : null, lastPrice, strikePrice);
  const change = v.changePct;

  return (
    <section aria-label="价格" className="card px-4 py-4 sm:px-5" data-quote-status={status}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="col-span-2 sm:col-span-1">
          <dt className="text-xs text-ink-soft">现价</dt>
          <dd className={`num text-2xl ${v.live ? 'font-semibold' : 'text-ink-soft'}`}>{status === 'loading' ? '…' : usd(v.price)}</dd>
          <dd className="text-xs leading-snug">
            {status === 'loading' && <span className="text-ink-soft">正在取实时价…</span>}
            {status !== 'loading' && v.live && <span className="text-ink-soft">实时报价 · {clock(v.asOf)}</span>}
            {status !== 'loading' && !v.live && lastPrice && (
              <span className="text-amber">
                非实时 · {lastPrice.asOf ? `${zhDate(lastPrice.asOf)}的记录` : `${zhDate(lastPrice.recordedOn)}更新时的记录`}
                {lastPrice.approx && '（约数）'}
              </span>
            )}
            {status !== 'loading' && !v.live && !lastPrice && <span className="text-amber">没有取到实时价，也没有记录过的价格</span>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">日内</dt>
          <dd className={`num text-lg ${change === null ? 'text-ink-soft' : change > 0 ? 'text-up' : change < 0 ? 'text-down' : ''}`}>{pct(change, 2)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">市值</dt>
          <dd className="num text-lg">{marketCap(v.marketCap)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">击球价</dt>
          <dd className="num text-lg font-semibold">{usd(strikePrice)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">距击球区</dt>
          <dd className="text-lg"><ZoneValue zone={v.zone} value={v.distance} stacked={false} /></dd>
        </div>
        <div>
          <dt className="text-xs text-ink-soft">退出价</dt>
          <dd className="num text-lg">{usd(exitPrice)}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule-soft pt-3 text-xs text-ink-soft">
        {!v.live && status !== 'loading' && lastPrice && <span>记录原文：“{lastPrice.quote}”{lastPrice.note ? `（${lastPrice.note}）` : ''}</span>}
        {!v.live && status !== 'loading' && !lastPrice && lastPriceNote && <span>{lastPriceNote}</span>}
        <button type="button" className="btn ml-auto text-ink" onClick={refresh} disabled={status === 'loading'}>刷新价格</button>
      </div>
    </section>
  );
}

'use client';

import { useMemo } from 'react';

import { useQuotes } from '@/components/use-quotes';
import { money, ttm, usdReportedPe, valuation } from '@/lib/fundamentals';
import type { Calc, Fundamentals, ValuationRow } from '@/lib/fundamentals';
import { shortDate, usd } from '@/lib/format';
import type { LastPrice } from '@/lib/schema';

function show(row: ValuationRow, c: Calc) {
  if (c.value === null) return <span className="text-xs text-ink-soft" title={c.note}>{c.note?.includes('不适用') ? '不适用' : '算不出'}</span>;
  if (row.kind === 'usd') return <span className="num">{money(c.value)}</span>;
  if (row.kind === 'x') return <span className="num">{c.value.toFixed(1)}倍</span>;
  return <span className="num">{(c.value * 100).toFixed(1)}%</span>;
}

/** 估值口径：按现价、按记录价、按击球价各算一遍。只是算术，公式和输入都列出来。 */
export function ValuationPanel({ f, ticker, strikePrice, lastPrice }: { f: Fundamentals; ticker: string; strikePrice: number; lastPrice: LastPrice | null }) {
  const symbols = useMemo(() => [ticker], [ticker]);
  const { status, quotes } = useQuotes(symbols);
  const live = status === 'ready' ? quotes[ticker] : null;
  const cols = [
    ...(live ? [{ key: 'live', label: '按现价', price: live.price, sub: `${usd(live.price)} 实时` }] : []),
    ...(lastPrice ? [{ key: 'last', label: '按记录价', price: lastPrice.value, sub: `${usd(lastPrice.value)}，${lastPrice.asOf ? shortDate(lastPrice.asOf) : '日期未记'}` }] : []),
    { key: 'strike', label: '按击球价', price: strikePrice, sub: usd(strikePrice) },
  ];
  const results = cols.map((c) => ({ ...c, v: valuation(f, c.price, c.label.replace('按', '')) }));
  const blocked = results[0]?.v.blocked;
  const p = f.periods;
  const ni = ttm(f, 'netIncome').value;
  const op = ttm(f, 'operatingIncome').value;
  const nonOp = ni !== null && op !== null && ni > 0 && ni > op * 1.2 ? `近四季净利润 ${money(ni)} 比营业利润 ${money(op)} 高出 ${money(ni - op)}，差额来自营业外项目（如投资收益），所以按净利润算的市盈率偏低；可对照 EV/EBITDA 和自由现金流收益率。` : null;

  return (
    <section aria-labelledby="val-h" className="card px-4 py-4 sm:px-6 sm:py-5">
      <h2 id="val-h" className="font-serif text-xl font-semibold">
        估值口径 <span className="ml-1 font-sans text-xs font-normal text-ink-soft">只是算术，不是判断；用的是近四季（TTM）的数字和最近一期的股本、现金、负债</span>
      </h2>
      {blocked ? (
        <>
          <p className="mt-2 text-sm text-ink-soft">{blocked}</p>
          {f.usdReported?.quarterEpsPerAdr && (
            <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0" data-testid="usd-reported">
              <p className="text-xs font-semibold text-navy">公司自报美元口径</p>
              <table className="mt-1 w-full min-w-[20rem] border-collapse text-[0.88rem]">
                <thead>
                  <tr className="border-b border-rule text-left text-xs text-ink-soft">
                    <th scope="col" className="py-1.5 pr-2 font-medium">口径</th>
                    {results.map((c) => (
                      <th key={c.key} scope="col" className="px-2 py-1.5 text-right font-medium">{c.label}<span className="num block font-normal">{c.sub}</span></th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-rule-soft">
                    <th scope="row" className="py-1.5 pr-2 text-left font-normal">市盈率（单季每 ADR 收益 × 4）</th>
                    {results.map((c) => {
                      const pe = usdReportedPe(f, c.price);
                      return <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">{pe?.value == null ? <span className="text-xs text-ink-soft">{pe?.note ?? '—'}</span> : <span className="num">{pe.value.toFixed(1)}倍</span>}</td>;
                    })}
                  </tr>
                </tbody>
              </table>
              <p className="mt-1 text-xs text-ink-soft">
                用的是公司自己公布的 {f.usdReported.quarterEpsPerAdr.period} 每 ADR 稀释收益 US${f.usdReported.quarterEpsPerAdr.value}；“× 4”把一个季度当成全年，是算术假设，不是公司的数字。{usdReportedPe(f, strikePrice)?.formula}
              </p>
            </div>
          )}
          {f.usdReported?.items && f.usdReported.items.length > 0 && (
            <ul className="mt-2 space-y-1 text-[0.88rem]">
              {f.usdReported.items.map((it, i) => (
                <li key={i}><span className="font-semibold">{it.label}</span>（公司自报美元口径）：{it.text}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[20rem] border-collapse text-[0.88rem]">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-soft">
                  <th scope="col" className="py-1.5 pr-2 font-medium">口径</th>
                  {results.map((c) => (
                    <th key={c.key} scope="col" className="px-2 py-1.5 text-right font-medium">
                      {c.label}
                      <span className="num block font-normal">{c.sub}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results[0]!.v.rows.map((row, i) => (
                  <tr key={row.id} className="border-b border-rule-soft">
                    <th scope="row" className="py-1.5 pr-2 text-left font-normal">{row.label}</th>
                    {results.map((c) => (
                      <td key={c.key} className="whitespace-nowrap px-2 py-1.5 text-right">{show(row, c.v.rows[i]!.calc)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {nonOp && <p className="mt-2 text-xs text-amber">注意：{nonOp}</p>}
          <details className="mt-3 text-xs text-ink-soft">
            <summary className="text-navy">公式和输入（按{results.at(-1)!.label.replace('按', '')}）</summary>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {results.at(-1)!.v.rows.map((row) => (
                <li key={row.id}>
                  <span className="text-ink">{row.label}</span> = {row.calc.formula}
                  {row.calc.note ? `（${row.calc.note}）` : ''}
                </li>
              ))}
              {p && <li>近四季 = {p.ytd ? `${p.fy.label}全年 + ${p.ytd.label} − ${p.ytdPrior?.label}` : `${p.fy.label}全年`}；股本、现金、负债截至 {f.balance?.date ?? p.balanceDate}。</li>}
              <li>企业价值 = 市值 + 有息负债 − 现金及短期投资（不含少数股东权益、优先股、租赁负债和权益投资）。EBITDA = 营业利润 + 折旧摊销。</li>
              {f.valuationNote && <li>{f.valuationNote}</li>}
            </ul>
          </details>
        </>
      )}
    </section>
  );
}

'use client';

import Link from 'next/link';
import { Fragment, useMemo, useState } from 'react';

import { StanceBadge, ZoneValue } from '@/components/badges';
import { SourceTag } from '@/components/key-items';
import { clock, useQuotes, viewPrice } from '@/components/use-quotes';
import type { PriceView } from '@/components/use-quotes';
import { marketCap, pct, shortDate, usd } from '@/lib/format';
import { STANCE_GROUPS, STANCE_META } from '@/lib/schema';
import type { LastPrice, Sector, StanceGroup } from '@/lib/schema';
import { ZONE_META } from '@/lib/zone';
import type { ZoneId } from '@/lib/zone';

export type Row = {
  ticker: string;
  company: string;
  sector: string;
  strikePrice: number;
  exitPrice: number;
  stance: { label: string; group: StanceGroup };
  events: string;
  lastPrice: LastPrice | null;
  latestKey: { date: string; title: string; url: string; sourceType: 'official' | 'media' } | null;
  keyCount: number;
};

type Sort = 'sheet' | 'distance';
const ZONES: ZoneId[] = ['below', 'near', 'mid', 'far'];

function PriceNote({ row, view }: { row: Row; view: PriceView }) {
  if (view.live) return null;
  if (view.price === null) return <span className="block text-[0.7rem] leading-tight text-ink-soft">无记录价</span>;
  const when = row.lastPrice?.asOf ? `${shortDate(row.lastPrice.asOf)} 记录` : `${shortDate(row.lastPrice?.recordedOn)} 更新时记录`;
  return (
    <span className="block whitespace-nowrap text-[0.7rem] leading-tight text-amber">
      非实时 · {when}
    </span>
  );
}

function LatestKey({ row }: { row: Row }) {
  if (!row.latestKey) return null;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.82rem] leading-snug">
      <span className="text-xs text-ink-soft">最新</span>
      <span className="num text-xs text-ink-soft">{shortDate(row.latestKey.date)}</span>
      <SourceTag type={row.latestKey.sourceType} />
      <a href={row.latestKey.url} target="_blank" rel="noopener noreferrer nofollow" className="link">{row.latestKey.title} ↗</a>
      {row.keyCount > 1 && <Link href={`/t/${row.ticker}`} className="text-xs text-ink-soft underline underline-offset-2">共 {row.keyCount} 条</Link>}
    </p>
  );
}

function Change({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-soft">—</span>;
  const cls = value > 0 ? 'text-up' : value < 0 ? 'text-down' : 'text-ink-soft';
  return (
    <span className={`num ${cls}`}>
      <span aria-hidden="true" className="mr-0.5 text-[0.7em]">{value > 0 ? '▲' : value < 0 ? '▼' : ''}</span>
      {pct(value, 1)}
    </span>
  );
}

export function Watchlist({ rows, sectors }: { rows: Row[]; sectors: Sector[] }) {
  const symbols = useMemo(() => rows.map((r) => r.ticker), [rows]);
  const { status, quotes, fetchedAt, refresh } = useQuotes(symbols);
  const [sort, setSort] = useState<Sort>('sheet');
  const [stance, setStance] = useState<StanceGroup | 'all'>('all');
  const [zone, setZone] = useState<ZoneId | 'all'>('all');

  const views = useMemo(() => {
    const map = new Map<string, PriceView>();
    for (const r of rows) map.set(r.ticker, viewPrice(status === 'ready' ? quotes[r.ticker] : null, r.lastPrice, r.strikePrice));
    return map;
  }, [rows, quotes, status]);
  const view = (r: Row) => views.get(r.ticker)!;

  const liveCount = rows.filter((r) => view(r).live).length;
  const below = rows.filter((r) => view(r).zone === 'below');
  const near = rows.filter((r) => view(r).zone === 'near');
  const latestAsOf = rows.map((r) => (view(r).live ? view(r).asOf : null)).filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
  const hasCap = rows.some((r) => view(r).marketCap !== null);

  const filtered = rows.filter((r) => (stance === 'all' || r.stance.group === stance) && (zone === 'all' || view(r).zone === zone));
  const sorted = sort === 'distance' ? [...filtered].sort((a, b) => (view(a).distance ?? Infinity) - (view(b).distance ?? Infinity)) : filtered;
  const groups: { sector: Sector | null; rows: Row[] }[] =
    sort === 'distance'
      ? [{ sector: null, rows: sorted }]
      : sectors.map((s) => ({ sector: s, rows: sorted.filter((r) => r.sector === s.id) })).filter((g) => g.rows.length > 0);
  const usedStances = STANCE_GROUPS.filter((g) => rows.some((r) => r.stance.group === g));
  const sectorName = (id: string) => sectors.find((s) => s.id === id)?.name ?? id;

  return (
    <div>
      <section aria-label="报价状态" className="card mb-5 px-4 py-3 text-sm" data-quote-status={status}>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          <p className="font-medium">
            {status === 'loading' && '正在取实时价…'}
            {status === 'ready' && liveCount === rows.length && `实时价已刷新（${liveCount}/${rows.length}）`}
            {status === 'ready' && liveCount > 0 && liveCount < rows.length && `实时价：${liveCount}/${rows.length} 个取到，其余显示记录过的价格（非实时）`}
            {status === 'ready' && liveCount === 0 && '没有取到实时价：下面显示的是记录过的价格（非实时）'}
            {status === 'failed' && '报价接口没有响应：下面显示的是记录过的价格（非实时）'}
          </p>
          {status !== 'loading' && (
            <p className="text-ink-soft">
              {latestAsOf && <>数据时间 <span className="num">{clock(latestAsOf)}</span> · </>}
              {fetchedAt && <>刷新于 <span className="num">{clock(fetchedAt)}</span></>}
            </p>
          )}
          <button type="button" className="btn ml-auto" onClick={refresh} disabled={status === 'loading'}>
            刷新价格
          </button>
        </div>
        {status === 'ready' && liveCount > 0 && !hasCap && <p className="mt-1 text-ink-soft">当前报价来源不提供市值，“市值”一列暂为“—”。</p>}
      </section>

      <section aria-labelledby="below-h" className="mb-6 grid gap-3 md:grid-cols-2">
        <div className="card px-4 py-3">
          <h2 id="below-h" className="text-sm font-semibold">
            <span aria-hidden="true" className="mr-1 text-go">▼</span>现价在击球价下方：{below.length} 家
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm" data-testid="below-list">
            {below.length === 0 && <li className="text-ink-soft">没有</li>}
            {below.map((r) => (
              <li key={r.ticker} className="whitespace-nowrap">
                <Link href={`/t/${r.ticker}`} className="link font-semibold">{r.ticker}</Link>{' '}
                <span className="num text-ink-soft">{usd(view(r).price)}／{usd(r.strikePrice)}{view(r).live ? '' : '＊'}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card px-4 py-3">
          <h2 className="text-sm font-semibold">
            <span aria-hidden="true" className="mr-1 text-amber">◆</span>接近（高于击球价不超过 15%）：{near.length} 家
          </h2>
          <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {near.length === 0 && <li className="text-ink-soft">没有</li>}
            {near.map((r) => (
              <li key={r.ticker} className="whitespace-nowrap">
                <Link href={`/t/${r.ticker}`} className="link font-semibold">{r.ticker}</Link>{' '}
                <span className="num text-ink-soft">{usd(view(r).price)}／{usd(r.strikePrice)}{view(r).live ? '' : '＊'}</span>
              </li>
            ))}
          </ul>
        </div>
        {rows.some((r) => !view(r).live) && status !== 'loading' && (
          <p className="text-xs text-ink-soft md:col-span-2">＊ 按记录过的价格（非实时）计算。价格在击球价下方只是价位，是否动手以各标的的态度和击球区说明为准。</p>
        )}
      </section>

      <section aria-label="筛选和排序" className="mb-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-10 shrink-0 text-ink-soft">态度</span>
          <button type="button" className="btn" aria-pressed={stance === 'all'} onClick={() => setStance('all')}>全部</button>
          {usedStances.map((g) => (
            <button key={g} type="button" className="btn" aria-pressed={stance === g} onClick={() => setStance(g)}>
              <span aria-hidden="true">{STANCE_META[g].symbol}</span> {STANCE_META[g].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-10 shrink-0 text-ink-soft">价位</span>
          <button type="button" className="btn" aria-pressed={zone === 'all'} onClick={() => setZone('all')}>全部</button>
          {ZONES.map((z) => (
            <button key={z} type="button" className="btn" aria-pressed={zone === z} onClick={() => setZone(z)} title={ZONE_META[z].hint}>
              <span aria-hidden="true">{ZONE_META[z].symbol}</span> {ZONE_META[z].name}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 w-10 shrink-0 text-ink-soft">排序</span>
          <button type="button" className="btn" aria-pressed={sort === 'sheet'} onClick={() => setSort('sheet')}>按板块</button>
          <button type="button" className="btn" aria-pressed={sort === 'distance'} onClick={() => setSort('distance')}>按距击球区（近的在前）</button>
          <span className="ml-2 text-ink-soft" data-testid="count">显示 {filtered.length}/{rows.length}</span>
        </div>
      </section>

      {filtered.length === 0 && <p className="card px-4 py-6 text-center text-ink-soft">没有符合筛选条件的标的。</p>}

      {groups.map((group) => (
        <section key={group.sector?.id ?? 'all'} className="mb-7" aria-label={group.sector?.name ?? '按距击球区排序'}>
          {group.sector && (
            <h2 className="mb-2 flex items-baseline gap-2 border-b-2 border-navy pb-1 font-serif text-lg font-semibold text-navy">
              {group.sector.name}
              <span className="font-sans text-xs font-normal text-ink-soft">{group.rows.length} 个</span>
            </h2>
          )}
          {group.sector?.logic && <p className="-mt-1 mb-2 text-sm text-ink-soft">{group.sector.logic}</p>}

          {/* 768 像素以上：表格 */}
          <div className="card hidden overflow-x-auto md:block">
            <table className="w-full min-w-[64rem] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[5.5rem]" /><col className="w-[10.5rem]" /><col className="w-[7rem]" /><col className="w-[5.5rem]" /><col className="w-[5.5rem]" />
                <col className="w-[5.5rem]" /><col className="w-[8.5rem]" /><col className="w-[5.5rem]" /><col className="w-[12rem]" /><col />
              </colgroup>
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-soft">
                  <th scope="col" className="py-2 pl-3 pr-2 font-medium">代码</th>
                  <th scope="col" className="px-2 py-2 font-medium">公司</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">现价</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">日内</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">市值</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">击球价</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">距击球区</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">退出价</th>
                  <th scope="col" className="px-2 py-2 font-medium">态度</th>
                  <th scope="col" className="py-2 pl-2 pr-3 font-medium">下一个事件</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((r) => {
                  const v = view(r);
                  return (
                    <Fragment key={r.ticker}>
                    <tr className={`align-top ${r.latestKey ? '' : 'border-b border-rule-soft'}`} data-ticker={r.ticker}>
                      <th scope="row" className="py-2.5 pl-3 pr-2 text-left">
                        <Link href={`/t/${r.ticker}`} className="link num text-[0.95rem] font-bold">{r.ticker}</Link>
                      </th>
                      <td className="px-2 py-2.5">
                        {r.company}
                        {!group.sector && <span className="block text-[0.7rem] leading-tight text-ink-soft">{sectorName(r.sector).split(' · ')[0]}</span>}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <span className={`num ${v.live ? 'font-semibold' : 'text-ink-soft'}`}>{usd(v.price)}</span>
                        <PriceNote row={r} view={v} />
                      </td>
                      <td className="px-2 py-2.5 text-right"><Change value={v.changePct} /></td>
                      <td className="num px-2 py-2.5 text-right">{marketCap(v.marketCap)}</td>
                      <td className="num px-2 py-2.5 text-right font-semibold">{usd(r.strikePrice)}</td>
                      <td className="px-2 py-2.5 text-right"><ZoneValue zone={v.zone} value={v.distance} /></td>
                      <td className="num px-2 py-2.5 text-right">{usd(r.exitPrice)}</td>
                      <td className="px-2 py-2.5"><StanceBadge label={r.stance.label} group={r.stance.group} /></td>
                      <td className="py-2.5 pl-2 pr-3 text-[0.85rem]">{r.events}</td>
                    </tr>
                    {r.latestKey && (
                      <tr className="border-b border-rule-soft">
                        <td />
                        <td colSpan={9} className="pb-2.5 pl-2 pr-3"><LatestKey row={r} /></td>
                      </tr>
                    )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 768 像素以下：卡片 */}
          <ul className="space-y-3 md:hidden">
            {group.rows.map((r) => {
              const v = view(r);
              return (
                <li key={r.ticker} className="card px-4 py-3" data-ticker-card={r.ticker}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/t/${r.ticker}`} className="link num text-lg font-bold">{r.ticker}</Link>
                      <p className="text-sm text-ink-soft">{r.company}{!group.sector && ` · ${sectorName(r.sector).split(' · ')[0]}`}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p><span className={`num text-lg ${v.live ? 'font-semibold' : 'text-ink-soft'}`}>{usd(v.price)}</span>{v.live && <span className="ml-2 text-sm"><Change value={v.changePct} /></span>}</p>
                      <PriceNote row={r} view={v} />
                    </div>
                  </div>
                  <dl className="mt-2 grid grid-cols-3 gap-x-3 border-t border-rule-soft pt-2 text-sm">
                    <div><dt className="text-xs text-ink-soft">击球价</dt><dd className="num font-semibold">{usd(r.strikePrice)}</dd></div>
                    <div><dt className="text-xs text-ink-soft">距击球区</dt><dd><ZoneValue zone={v.zone} value={v.distance} /></dd></div>
                    <div className="text-right"><dt className="text-xs text-ink-soft">退出价</dt><dd className="num">{usd(r.exitPrice)}</dd></div>
                  </dl>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <StanceBadge label={r.stance.label} group={r.stance.group} />
                    {v.marketCap !== null && <span className="text-ink-soft">市值 <span className="num">{marketCap(v.marketCap)}</span></span>}
                  </div>
                  {r.events !== '—' && <p className="mt-1.5 text-sm"><span className="text-xs text-ink-soft">下一个事件　</span>{r.events}</p>}
                  {r.latestKey && <div className="mt-2 border-t border-rule-soft pt-2"><LatestKey row={r} /></div>}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

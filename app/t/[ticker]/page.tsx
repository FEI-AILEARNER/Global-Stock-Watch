import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { StanceBadge } from '@/components/badges';
import { KeyItems } from '@/components/key-items';
import { QuotePanel } from '@/components/quote-panel';
import { RichText } from '@/components/rich-text';
import { getData, getTicker } from '@/lib/data';
import { usd, zhDate } from '@/lib/format';

type Params = { params: Promise<{ ticker: string }> };

export const dynamicParams = false;

export function generateStaticParams() {
  return getData().tickers.map((t) => ({ ticker: t.ticker }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const t = getTicker((await params).ticker);
  return { title: t ? `${t.ticker} ${t.company}` : '没有这个标的' };
}

export default async function TickerPage({ params }: Params) {
  const t = getTicker((await params).ticker);
  if (!t) notFound();
  const { sectors, exitLogic } = getData();
  const sector = sectors.find((s) => s.id === t.sector);
  const logic = exitLogic.find((e) => e.id === t.exitLogic);
  const [latest, ...older] = t.rationale;
  const changes = [...t.priceChanges].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <article>
      <p className="text-sm"><Link href="/" className="link">← 监控清单</Link></p>
      <header className="mb-5 mt-3">
        <p className="eyebrow">{sector?.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="font-serif text-3xl font-semibold tracking-tight">
            <span className="num mr-3 text-navy">{t.ticker}</span>{t.company}
          </h1>
          <StanceBadge label={t.stance.label} group={t.stance.group} />
        </div>
        <p className="mt-1 text-sm text-ink-soft">内容更新于 {zhDate(t.contentUpdatedOn)}</p>
      </header>

      <QuotePanel ticker={t.ticker} strikePrice={t.strikePrice} exitPrice={t.exitPrice} lastPrice={t.lastPrice} lastPriceNote={t.lastPriceNote} />

      <section aria-labelledby="key-h" className="card mt-6 border-l-4 border-l-navy px-4 py-4 sm:px-6 sm:py-5">
        <h2 id="key-h" className="font-serif text-xl font-semibold">
          关键事项 <span className="ml-1 font-sans text-xs font-normal text-ink-soft">最重要的近期新闻和官方公告；总结是笔记自己的话，以原文为准</span>
        </h2>
        <KeyItems items={t.keyItems} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <section aria-labelledby="rationale-h" className="card px-4 py-4 sm:px-6 sm:py-5">
            <h2 id="rationale-h" className="font-serif text-xl font-semibold">定价依据／要点</h2>
            {latest && (
              <div className="mt-3">
                <p className="text-sm font-semibold text-navy">【{latest.label}】{latest.date && <span className="ml-1 font-normal text-ink-soft">{zhDate(latest.date)}</span>}</p>
                <p className="prose-note mt-1"><RichText text={latest.text} /></p>
              </div>
            )}
            {older.length > 0 && (
              <details className="mt-4 border-t border-rule-soft pt-3">
                <summary className="text-sm font-medium text-navy">更早的判断（{older.length} 条，保留原文）</summary>
                {older.map((r, i) => (
                  <div key={i} className="mt-3">
                    <p className="text-sm font-semibold text-ink-soft">【{r.label}】{r.date && <span className="ml-1 font-normal">{zhDate(r.date)}</span>}</p>
                    <p className="prose-note mt-1 text-ink-soft"><RichText text={r.text} /></p>
                  </div>
                ))}
              </details>
            )}
          </section>

          <section aria-labelledby="news-h" className="card px-4 py-4 sm:px-6 sm:py-5">
            <h2 id="news-h" className="font-serif text-xl font-semibold">新闻时间线 <span className="ml-1 font-sans text-xs font-normal text-ink-soft">此前各轮记录的原文</span></h2>
            {t.news.length === 0 ? (
              <p className="mt-2 text-sm text-ink-soft">本轮未检索到需记录的重大事件。</p>
            ) : (
              <ol className="mt-3 space-y-5 border-l-2 border-rule pl-4">
                {t.news.map((n, i) => (
                  <li key={i} className="relative">
                    <span aria-hidden="true" className="absolute -left-[1.42rem] top-[0.55rem] size-2 rounded-full bg-navy" />
                    <p className="num text-xs text-ink-soft">{n.date}</p>
                    <h3 className="font-semibold leading-snug">{n.title}</h3>
                    <p className="prose-note mt-1"><RichText text={n.summary} /></p>
                    <p className="mt-1 text-sm">
                      <a href={n.url} target="_blank" rel="noopener noreferrer nofollow" className="link break-all">{new URL(n.url).hostname.replace(/^www\./, '')} ↗</a>
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <section className="card px-4 py-4 sm:px-5">
            <h2 className="font-serif text-lg font-semibold">击球区说明</h2>
            <p className="prose-note mt-1">{t.strikeNote}</p>
            <h2 className="mt-4 font-serif text-lg font-semibold">事件</h2>
            <p className="prose-note mt-1">{t.events === '—' ? <span className="text-ink-soft">—（没有记录）</span> : t.events}</p>
            <h2 className="mt-4 font-serif text-lg font-semibold">退出逻辑：{logic?.name}</h2>
            {logic?.text ? (
              <p className="prose-note mt-1"><RichText text={logic.text} /></p>
            ) : (
              <p className="prose-note mt-1 text-ink-soft">没有归入三种退出逻辑。</p>
            )}
            {t.exitLogicNote && <p className="prose-note mt-1 text-[0.88rem] text-ink-soft">归类理由：{t.exitLogicNote}</p>}
            <p className="mt-2 text-sm"><Link href="/discipline" className="link">看纪律页</Link></p>
          </section>

          <section aria-labelledby="changes-h" className="card px-4 py-4 sm:px-5">
            <h2 id="changes-h" className="font-serif text-lg font-semibold">调价记录</h2>
            {changes.length === 0 ? (
              <p className="mt-1 text-sm text-ink-soft">没有记录到调整。</p>
            ) : (
              <ul className="mt-2 space-y-4">
                {changes.map((c, i) => (
                  <li key={i} className="text-sm">
                    <p>
                      <span className="num text-xs text-ink-soft">{c.date}</span>{' '}
                      <strong>{c.field === 'strike' ? '击球价' : '退出价'}</strong>{' '}
                      <span className="num">{c.from === null ? '未记录' : usd(c.from)} → {usd(c.to)}</span>
                    </p>
                    <p className="prose-note mt-0.5 text-[0.85rem] text-ink-soft"><RichText text={c.reason} /></p>
                    <p className="mt-0.5 text-xs text-ink-soft">出处：{c.source}{c.note ? `。${c.note}` : ''}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}

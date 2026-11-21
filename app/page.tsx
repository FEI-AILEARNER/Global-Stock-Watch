import { NoteBody } from '@/components/note-block';
import { Watchlist } from '@/components/watchlist';
import type { Row } from '@/components/watchlist';
import { getData, getNote } from '@/lib/data';
import { zhDate } from '@/lib/format';

export default function HomePage() {
  const { tickers, sectors, site } = getData();
  const macro = getNote('macro');
  const status = getNote('status-change');
  const rows: Row[] = tickers.map((t) => ({
    ticker: t.ticker,
    company: t.company,
    sector: t.sector,
    strikePrice: t.strikePrice,
    exitPrice: t.exitPrice,
    stance: t.stance,
    events: t.events,
    lastPrice: t.lastPrice,
  }));

  return (
    <>
      <div className="mb-6">
        <p className="eyebrow">研究笔记</p>
        <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">前沿板块股票监控清单</h1>
        <p className="mt-2 text-sm text-ink-soft">
          {tickers.length} 个标的 · {sectors.length} 个板块 · 内容最近一次更新：<strong className="text-ink">{zhDate(site.contentUpdatedOn)}</strong>
          　价格每次打开页面刷新；财报、新闻和定价依据只在“更新”时改。
        </p>
      </div>

      <section aria-labelledby="macro-h" className="card mb-5 border-l-4 border-l-navy px-4 py-3 sm:px-5">
        <details open>
          <summary className="font-serif text-base font-semibold" id="macro-h">
            宏观环境 <span className="ml-1 font-sans text-xs font-normal text-ink-soft">{zhDate(site.contentUpdatedOn)} 记录的原文</span>
          </summary>
          <div className="mt-2"><NoteBody text={macro.text} /></div>
        </details>
        <details className="mt-3 border-t border-rule-soft pt-3">
          <summary className="font-serif text-base font-semibold">
            状态变化 <span className="ml-1 font-sans text-xs font-normal text-ink-soft">{zhDate(site.contentUpdatedOn)} 记录的原文，其中的价格是当时的</span>
          </summary>
          <div className="mt-2"><NoteBody text={status.text} list={false} /></div>
        </details>
      </section>

      <Watchlist rows={rows} sectors={sectors} />

      <section className="mt-8 text-xs leading-relaxed text-ink-soft">
        <p>距击球区 =（现价 − 击球价）÷ 击球价。符号：▼ 已在击球价下方　◆ 接近（≤ +15%）　■ 中等（+15% 至 +40%）　▲ 远高于（&gt; +40%）。</p>
        <p>态度一列是笔记里的原文；符号表示分类：● 已进区　◐ 观察　○ 等待　✕ 回避　◇ 投机。</p>
      </section>
    </>
  );
}

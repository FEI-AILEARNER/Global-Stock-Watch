import type { Metadata } from 'next';
import Link from 'next/link';

import { getData } from '@/lib/data';
import { zhDate } from '@/lib/format';

export const metadata: Metadata = { title: '日历' };

export default function CalendarPage() {
  const { calendar, tickers, sectors } = getData();
  const withEvents = tickers.filter((t) => t.events !== '—');
  const without = tickers.filter((t) => t.events === '—');

  return (
    <>
      <p className="eyebrow">日历</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">接下来的财报和事件</h1>
      <p className="mt-2 text-sm text-ink-soft">
        记录于 {zhDate(calendar.asOf)}，按笔记里的先后顺序。日期是当时写下的大致时间（“1月”“2月初”），没有逐一核对公司公告；已经过去的事件要等下一次“更新”才会改。
      </p>

      <section aria-labelledby="cal-h" className="card mt-6 px-4 py-4 sm:px-6">
        <h2 id="cal-h" className="font-serif text-xl font-semibold">重点日历</h2>
        <ol className="mt-3 divide-y divide-rule-soft">
          {calendar.items.map((item, i) => (
            <li key={i} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
              <span>{item.text}</span>
              <span className="flex gap-3 text-sm">
                {item.tickers.map((code) => (
                  <Link key={code} href={`/t/${code}`} className="link num font-semibold">{code}</Link>
                ))}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="ev-h" className="mt-8">
        <h2 id="ev-h" className="font-serif text-xl font-semibold">各标的的下一个事件</h2>
        <div className="mt-3 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {sectors.map((s) => {
            const list = withEvents.filter((t) => t.sector === s.id);
            if (list.length === 0) return null;
            return (
              <div key={s.id} className="card px-4 py-3">
                <h3 className="border-b border-rule pb-1.5 text-sm font-semibold text-navy">{s.name}</h3>
                <ul className="divide-y divide-rule-soft">
                  {list.map((t) => (
                    <li key={t.ticker} className="grid grid-cols-[4.2rem_minmax(0,1fr)] gap-2 py-2 text-sm">
                      <Link href={`/t/${t.ticker}`} className="link num font-semibold">{t.ticker}</Link>
                      <span>{t.events}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        {without.length > 0 && (
          <p className="mt-4 text-sm text-ink-soft">没有记录事件的标的：{without.map((t) => t.ticker).join('、')}。</p>
        )}
      </section>
    </>
  );
}

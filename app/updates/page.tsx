import type { Metadata } from 'next';
import Link from 'next/link';

import { NoteBody } from '@/components/note-block';
import { RichText } from '@/components/rich-text';
import { allPriceChanges, getData } from '@/lib/data';
import { usd, zhDate } from '@/lib/format';

export const metadata: Metadata = { title: '更新记录' };

export default function UpdatesPage() {
  const { updates } = getData();
  const changes = allPriceChanges();

  return (
    <div className="max-w-4xl">
      <p className="eyebrow">更新记录</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">每次更新改了什么，调了哪些价</h1>
      <p className="mt-2 text-sm text-ink-soft">内容只在“更新”时改。每次调整击球价或退出价，都在这里留下旧价、新价、日期和理由。</p>

      <div className="mt-6 space-y-6">
        {updates.map((u) => {
          const list = changes.filter((c) => c.date === u.date);
          return (
            <section key={u.date} className="card px-4 py-4 sm:px-6" aria-labelledby={`u-${u.date}`}>
              <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink-soft">
                <span className="num">{u.date}</span>
                <span className={`chip ${u.kind === 'content' ? 'bg-wait-bg text-wait' : 'bg-spec-bg text-spec'}`}>{u.kind === 'content' ? '内容更新' : '平台'}</span>
                <span>出处：{u.origin}</span>
              </p>
              <h2 id={`u-${u.date}`} className="mt-1 font-serif text-xl font-semibold">{u.title}</h2>
              <div className="mt-2"><NoteBody text={u.text} list={false} /></div>

              {list.length > 0 && (
                <div className="mt-4 border-t border-rule-soft pt-3">
                  <h3 className="text-sm font-semibold">这次调的价（{zhDate(u.date)}）</h3>
                  <ul className="mt-2 divide-y divide-rule-soft">
                    {list.map((c, i) => (
                      <li key={i} className="py-2.5 text-sm">
                        <p className="flex flex-wrap items-baseline gap-x-3">
                          <Link href={`/t/${c.ticker}`} className="link num font-bold">{c.ticker}</Link>
                          <span>{c.field === 'strike' ? '击球价' : '退出价'}</span>
                          <span className="num font-semibold">{c.from === null ? '未记录' : usd(c.from)} → {usd(c.to)}</span>
                          {c.from !== null && <span className="text-xs text-ink-soft">{c.to < c.from ? '下调' : '上调'}</span>}
                        </p>
                        <p className="prose-note mt-0.5 text-[0.85rem] text-ink-soft"><RichText text={c.reason} /></p>
                        {c.note && <p className="mt-0.5 text-xs text-ink-soft">{c.note}</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

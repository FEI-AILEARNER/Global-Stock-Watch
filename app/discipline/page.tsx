import type { Metadata } from 'next';
import Link from 'next/link';

import { NoteBody } from '@/components/note-block';
import { RichText } from '@/components/rich-text';
import { getData, getNote } from '@/lib/data';
import { zhDate } from '@/lib/format';

export const metadata: Metadata = { title: '纪律' };

export default function DisciplinePage() {
  const { exitLogic, tickers, removed, site } = getData();
  const note = (id: string) => getNote(id).text;
  const strip = (text: string, prefix: string) => (text.startsWith(prefix) ? text.slice(prefix.length) : text);

  return (
    <div className="max-w-4xl">
      <p className="eyebrow">纪律</p>
      <h1 className="mt-1 font-serif text-3xl font-semibold tracking-tight">怎么出价，怎么退出</h1>
      <p className="mt-2 text-sm text-ink-soft">以下都是笔记的原文，记录于 {zhDate(site.contentUpdatedOn)}。</p>

      <section className="mt-6 border-l-4 border-navy bg-paper px-5 py-4">
        <h2 className="eyebrow">核心哲学</h2>
        <p className="mt-1 font-serif text-xl leading-relaxed">{strip(note('philosophy'), '核心哲学：')}</p>
      </section>

      <section className="card mt-6 px-4 py-4 sm:px-6">
        <h2 className="font-serif text-xl font-semibold">仓位纪律</h2>
        <p className="prose-note mt-2">{strip(note('position-discipline'), '仓位纪律：')}</p>
      </section>

      <section className="card mt-6 px-4 py-4 sm:px-6">
        <h2 className="font-serif text-xl font-semibold">退出价的三种逻辑</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-3">
          {exitLogic.filter((e) => e.text).map((e) => (
            <div key={e.id} className="border-t-2 border-navy pt-2">
              <h3 className="font-semibold">{e.name}</h3>
              <p className="prose-note mt-1 text-[0.9rem]"><RichText text={e.text ?? ''} /></p>
              <p className="mt-2 flex flex-wrap gap-x-3 text-sm">
                {tickers.filter((t) => t.exitLogic === e.id).map((t) => (
                  <Link key={t.ticker} href={`/t/${t.ticker}`} className="link num font-semibold">{t.ticker}</Link>
                ))}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-4 border-t border-rule-soft pt-3 text-sm text-ink-soft">
          笔记没有点名归类的 {tickers.filter((t) => t.exitLogic === 'other').length} 个标的，平台里记为“其他”：
          {tickers.filter((t) => t.exitLogic === 'other').map((t) => t.ticker).join('、')}。
        </p>
        <details className="mt-3 text-sm">
          <summary className="text-navy">这一段的原文</summary>
          <p className="prose-note mt-2">{note('exit-logic')}</p>
        </details>
      </section>

      <section className="card mt-6 px-4 py-4 sm:px-6">
        <h2 className="font-serif text-xl font-semibold">自我校正与披露</h2>
        <div className="mt-2"><NoteBody text={note('self-correction')} /></div>
        <div className="mt-4 border-t border-rule-soft pt-3">
          <h3 className="text-sm font-semibold">不纳入清单</h3>
          {site.excluded.map((e) => (
            <p key={e.ticker} className="mt-1 text-sm">
              <span className="font-semibold">{e.name}（<span className="num">{e.ticker}</span>）</span>：存在利益冲突，不纳入清单、不给击球价、不发表买卖观点。原文见上面“另：”一段。
            </p>
          ))}
        </div>
        <details className="mt-3 text-sm">
          <summary className="text-navy">更早的一次修正：8/5 VST</summary>
          <p className="prose-note mt-2">{note('vst-correction')}</p>
        </details>
      </section>

      <section className="card mt-6 px-4 py-4 sm:px-6">
        <h2 className="font-serif text-xl font-semibold">已移除的标的</h2>
        <ul className="mt-3 divide-y divide-rule-soft border-t border-rule text-sm">
          {removed.map((r) => (
            <li key={r.name} className="grid gap-x-4 gap-y-0.5 py-2.5 md:grid-cols-[10rem_9rem_minmax(0,1fr)]">
              <span className="font-semibold">{r.name}</span>
              <span className="num text-ink-soft">{r.removedOn ?? '此前（未记日期）'}</span>
              <span>{r.reason}</span>
            </li>
          ))}
        </ul>
        <details className="mt-3 text-sm">
          <summary className="text-navy">结构调整的原文</summary>
          <div className="mt-2"><NoteBody text={note('structure')} list={false} /></div>
        </details>
      </section>

      <section className="mt-6 text-sm text-ink-soft">
        <h2 className="font-semibold text-ink">原表的色标</h2>
        <p className="mt-1">{note('color-legend')}</p>
        <p className="mt-1">平台里每种状态都另配了文字和符号，不只靠颜色；“距击球区”的分界见首页表格下方的说明。</p>
      </section>
    </div>
  );
}

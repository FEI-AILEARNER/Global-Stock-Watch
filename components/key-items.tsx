import { RichText } from '@/components/rich-text';
import type { KeyItem } from '@/lib/schema';

export function SourceTag({ type }: { type: KeyItem['sourceType'] }) {
  return type === 'official' ? (
    <span className="chip bg-navy text-white" title="公司新闻稿、SEC 文件或监管机构公告">官方</span>
  ) : (
    <span className="chip border border-edge text-ink-soft" title="媒体报道或第三方整理">媒体</span>
  );
}

/** 关键事项：最重要的近期新闻／官方公告，每条有总结和原文链接。 */
export function KeyItems({ items }: { items: KeyItem[] }) {
  if (items.length === 0) return <p className="mt-2 text-sm text-ink-soft">本轮未检索到可以列出的关键事项。</p>;
  return (
    <ol className="mt-3 grid gap-x-8 gap-y-4 lg:grid-cols-2">
      {items.map((k, i) => (
        <li key={i} className="border-t border-rule-soft pt-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
            <span className="num">{k.date}</span>
            <SourceTag type={k.sourceType} />
            <span>{k.source}</span>
          </p>
          <h3 className="mt-1 font-semibold leading-snug">{k.title}</h3>
          <p className="prose-note mt-1 text-[0.92rem]"><RichText text={k.summary} /></p>
          <p className="mt-1 text-sm">
            <a href={k.url} target="_blank" rel="noopener noreferrer nofollow" className="link">看原文 ↗</a>
          </p>
        </li>
      ))}
    </ol>
  );
}

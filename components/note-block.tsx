import { RichText } from '@/components/rich-text';
import { splitNumbered } from '@/lib/richtext';

/** 原表的一段说明：有 ①②③ 的拆成“引子 + 列表”，文字不改。 */
export function NoteBody({ text, list = true }: { text: string; list?: boolean }) {
  const { lead, items } = list ? splitNumbered(text) : { lead: text, items: [] };
  if (items.length === 0) return <p className="prose-note"><RichText text={text} /></p>;
  return (
    <div className="prose-note">
      <p><RichText text={lead} /></p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="pl-[1.4em] -indent-[1.4em]"><RichText text={item} /></li>
        ))}
      </ul>
    </div>
  );
}

import { parseBold } from '@/lib/richtext';

/** 原表文字：保留换行，把 **…** 显示成加粗。文字本身不改。 */
export function RichText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {parseBold(text).map((segment, i) => (segment.bold ? <strong key={i}>{segment.text}</strong> : <span key={i}>{segment.text}</span>))}
    </span>
  );
}

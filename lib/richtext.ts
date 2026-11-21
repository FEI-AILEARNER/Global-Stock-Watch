// 原表文字里的 **加粗** 标记 → 片段。只认成对的 **，别的原样保留。

export type Segment = { text: string; bold: boolean };

export function parseBold(source: string): Segment[] {
  const parts = source.split('**');
  if (parts.length % 2 === 0) return [{ text: source, bold: false }]; // 不成对：原样显示
  return parts.map((text, i) => ({ text, bold: i % 2 === 1 })).filter((s) => s.text.length > 0);
}

/** 按 ①②③… 把一段话拆成“引子 + 各条”；没有编号时 items 为空。文字不改。 */
export function splitNumbered(source: string): { lead: string; items: string[] } {
  const parts = source.split(/(?=[①②③④⑤⑥⑦⑧⑨⑩])/);
  if (parts.length < 3) return { lead: source, items: [] };
  return { lead: parts[0] ?? '', items: parts.slice(1) };
}

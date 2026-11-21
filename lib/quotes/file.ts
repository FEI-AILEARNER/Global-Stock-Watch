import { readFileSync } from 'node:fs';

import type { Quote, QuoteSource } from './types.ts';

// 只用于本地预览和页面检查：从 QUOTE_FIXTURE_FILE 指向的 JSON 读“报价”。
// 只有在 QUOTE_SOURCES 里明确写了 file 才会启用；正式环境不要用。

export const fileSource: QuoteSource = {
  id: 'file',
  label: '本地样例文件（仅预览用，不是真实报价）',
  async fetchQuote(symbol) {
    const file = process.env.QUOTE_FIXTURE_FILE;
    if (!file) return null;
    const all = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Omit<Quote, 'source'> | undefined>;
    const q = all[symbol];
    return q ? { ...q, source: 'file' } : null;
  },
};

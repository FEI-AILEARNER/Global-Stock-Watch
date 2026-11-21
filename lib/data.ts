import { loadDataset } from './load.ts';
import type { Dataset, Note, Ticker } from './schema.ts';

// 应用读数据的唯一入口。构建时读取一次。

let cached: Dataset | undefined;

export function getData(): Dataset {
  cached ??= loadDataset();
  return cached;
}

export function getTicker(code: string): Ticker | undefined {
  const upper = code.toUpperCase();
  return getData().tickers.find((t) => t.ticker === upper);
}

export function getNote(id: string): Note {
  const note = getData().notes.find((n) => n.id === id);
  if (!note) throw new Error(`meta/notes.json 里没有 ${id}`);
  return note;
}

/** 全部调价记录，最新在前。 */
export function allPriceChanges() {
  return getData()
    .tickers.flatMap((t) => t.priceChanges.map((c) => ({ ...c, ticker: t.ticker, company: t.company })))
    .sort((a, b) => b.date.localeCompare(a.date) || a.ticker.localeCompare(b.ticker) || (a.field === 'strike' ? -1 : 1));
}

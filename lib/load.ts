import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

import type { Dataset } from './schema.ts';
import { validateDataset } from './validate.ts';

// 读取 data/ 下的全部 JSON 并校验；有错就抛出。目录可用环境变量 DATA_DIR 覆盖（测试用）。

export function dataDir(): string {
  // 写成两个分支：默认路径静态地落在 data/ 下，构建工具才不会把整个项目都算进函数包。
  const override = process.env.DATA_DIR;
  if (override) return path.resolve(/* turbopackIgnore: true */ override);
  return path.join(process.cwd(), 'data');
}

function readJson(file: string): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`无法读取 ${file}：${(error as Error).message}`);
  }
}

function readDir(dir: string): { file: string; data: unknown }[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .sort()
    .map((file) => ({ file, data: readJson(path.join(dir, file)) }));
}

export function readRaw(dir: string = dataDir()) {
  const meta = (name: string) => readJson(path.join(dir, 'meta', name));
  return {
    tickers: readDir(path.join(dir, 'tickers')),
    sectors: meta('sectors.json'),
    notes: meta('notes.json'),
    exitLogic: meta('exit-logic.json'),
    removed: meta('removed.json'),
    calendar: meta('calendar.json'),
    site: meta('site.json'),
    updates: readDir(path.join(dir, 'updates')),
  };
}

export function loadDataset(dir: string = dataDir()): Dataset {
  const raw = readRaw(dir);
  const errors = validateDataset(raw);
  if (errors.length > 0) throw new Error(`数据校验没有通过（${errors.length} 处）：\n${errors.join('\n')}`);
  const data = raw as unknown as {
    tickers: { data: Dataset['tickers'][number] }[];
    updates: { data: Dataset['updates'][number] }[];
  } & Omit<Dataset, 'tickers' | 'updates'>;
  const sectorOrder = new Map(data.sectors.map((s, i) => [s.id, i]));
  return {
    ...data,
    // 板块按 sectors.json 的顺序；板块内按文件读取顺序会是字母序，所以这里保持原表顺序靠 order 文件。
    tickers: orderTickers(
      data.tickers.map((t) => t.data),
      sectorOrder,
      readOrder(dir),
    ),
    updates: data.updates.map((u) => u.data).sort((a, b) => b.date.localeCompare(a.date) || (a.kind === 'content' ? -1 : 1)),
  };
}

function readOrder(dir: string): string[] {
  const file = path.join(dir, 'meta', 'order.json');
  return existsSync(file) ? (readJson(file) as string[]) : [];
}

function orderTickers(tickers: Dataset['tickers'], sectorOrder: Map<string, number>, order: string[]): Dataset['tickers'] {
  const rank = new Map(order.map((code, i) => [code, i]));
  return [...tickers].sort(
    (a, b) =>
      (sectorOrder.get(a.sector) ?? 0) - (sectorOrder.get(b.sector) ?? 0) ||
      (rank.get(a.ticker) ?? 999) - (rank.get(b.ticker) ?? 999) ||
      a.ticker.localeCompare(b.ticker),
  );
}

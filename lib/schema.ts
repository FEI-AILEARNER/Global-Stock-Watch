// 数据类型。lib/、scripts/、tests/ 里的文件要能被 Node 直接运行：只用可擦除的 TypeScript 语法，
// 互相引用写相对路径并带 .ts 后缀。

export const SITE_NAME = 'Global Stock Watch';

export const EXIT_LOGIC_IDS = ['compounder', 'cyclical', 'option', 'other'] as const;
export type ExitLogicId = (typeof EXIT_LOGIC_IDS)[number];

// 态度分类：来自原表“态度”列的底色（原表 A48：深绿已进区·琥珀观察·蓝等待·橙回避·灰投机·浅绿退出）。
export const STANCE_GROUPS = ['in-zone', 'watch', 'wait', 'avoid', 'speculative', 'exit'] as const;
export type StanceGroup = (typeof STANCE_GROUPS)[number];

export const STANCE_META: Record<StanceGroup, { name: string; symbol: string }> = {
  'in-zone': { name: '已进区', symbol: '●' },
  watch: { name: '观察', symbol: '◐' },
  wait: { name: '等待', symbol: '○' },
  avoid: { name: '回避', symbol: '✕' },
  speculative: { name: '投机', symbol: '◇' },
  exit: { name: '退出', symbol: '↗' },
};

export type RationaleEntry = { label: string; date: string | null; text: string };
export type NewsItem = { date: string; title: string; summary: string; url: string };
export type PriceChange = {
  date: string;
  field: 'strike' | 'exit';
  from: number | null;
  to: number;
  reason: string;
  source: string;
  note?: string;
};
export type LastPrice = {
  value: number;
  asOf: string | null;
  approx: boolean;
  quote: string;
  recordedOn: string;
  note?: string;
};

export type Ticker = {
  ticker: string;
  company: string;
  sector: string;
  quoteSymbol?: string;
  strikePrice: number;
  exitPrice: number;
  exitLogic: ExitLogicId;
  stance: { label: string; group: StanceGroup };
  strikeNote: string;
  events: string;
  contentUpdatedOn: string;
  lastPrice: LastPrice | null;
  lastPriceNote?: string;
  priceChanges: PriceChange[];
  rationale: RationaleEntry[];
  news: NewsItem[];
};

export type Sector = { id: string; name: string };
export type Note = { id: string; source: string; title: string; text: string };
export type ExitLogic = { id: ExitLogicId; name: string; text: string | null };
export type RemovedTicker = { name: string; removedOn: string | null; reason: string; source: string };
export type CalendarData = { asOf: string; source: string; items: { text: string; tickers: string[] }[] };
export type SiteMeta = {
  contentUpdatedOn: string;
  disclaimer: string;
  excluded: { name: string; ticker: string; text: string; source: string }[];
};
export type UpdateEntry = {
  date: string;
  kind: 'content' | 'platform';
  title: string;
  origin: string;
  text: string;
  tickers: string[];
};

export type Dataset = {
  tickers: Ticker[];
  sectors: Sector[];
  notes: Note[];
  exitLogic: ExitLogic[];
  removed: RemovedTicker[];
  calendar: CalendarData;
  site: SiteMeta;
  updates: UpdateEntry[];
};

export const REQUIRED_NOTE_IDS = [
  'exit-logic',
  'structure',
  'macro',
  'status-change',
  'self-correction',
  'color-legend',
  'position-discipline',
  'philosophy',
  'calendar',
  'disclaimer',
] as const;

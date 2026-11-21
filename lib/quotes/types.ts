// 报价来源的适配器接口。换来源 = 新写一个实现这个接口的文件，在 lib/quotes/index.ts 登记。

export type Quote = {
  /** 最新价（美元） */
  price: number;
  /** 日内涨跌，小数（0.012 = +1.2%）；来源不给就是 null */
  changePct: number | null;
  /** 市值（美元）；来源不给就是 null */
  marketCap: number | null;
  /** 这个价格的时间（ISO 8601）；来源不给就是 null */
  asOf: string | null;
  /** 适配器 id */
  source: string;
};

export type QuoteSource = {
  id: string;
  label: string;
  /** 取一个代码的报价。取不到（代码不存在、上游失败、格式不对）返回 null 或抛出，都不会让接口报错。 */
  fetchQuote(symbol: string, signal: AbortSignal): Promise<Quote | null>;
};

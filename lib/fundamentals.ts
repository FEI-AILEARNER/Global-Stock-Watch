// 估值相关的结构化信息（2026-11-22 起）：类型和算术。数据在 data/fundamentals/<代码小写>.json，校验在 validate-fundamentals.ts。
// 这里的计算只是算术：每个结果都带公式和输入，页面照原样显示。

export const METRICS = [
  'revenue',
  'grossProfit',
  'operatingIncome',
  'netIncome',
  'ocf',
  'capex',
  'sbc',
  'da',
  'epsDiluted',
  'dilutedShares',
  'buybacks',
  'issuance',
  'dividends',
] as const;
export type MetricId = (typeof METRICS)[number];
export const SLOTS = ['fy', 'fyPrior', 'q', 'qPrior', 'ytd', 'ytdPrior'] as const;
export type Slot = (typeof SLOTS)[number];

export const METRIC_LABEL: Record<MetricId, string> = {
  revenue: '营收',
  grossProfit: '毛利',
  operatingIncome: '营业利润',
  netIncome: '净利润（归属公司）',
  ocf: '经营现金流',
  capex: '资本开支',
  sbc: '股权激励费用',
  da: '折旧与摊销',
  epsDiluted: '稀释每股收益',
  dilutedShares: '稀释加权股数',
  buybacks: '回购股票支出',
  issuance: '发行股票收入',
  dividends: '支付股息',
};

/** 一个数字。value 为 null 时 note 必须写明原因（“本轮未检索到…”）。 */
export type Fig = {
  value: number | null;
  /** USD、TWD、KRW、CAD、股、USD/股 等；百分比写 % */
  unit: string;
  /** 来源 id，对应 sources 里的一条 */
  src?: string;
  /** 不是原文直接给出、而是相减或相加得到的，写明怎么算的 */
  calc?: string;
  note?: string;
  /** XBRL 标签（脚本写入） */
  tag?: string;
  /** 人工从原文录入的；脚本重跑时不覆盖 */
  manual?: boolean;
  /** 所属期间（不在财务快照表格里的数字要写） */
  period?: string;
  parts?: { label: string; value: number; tag?: string }[];
};

export type FSource = {
  id: string;
  /** xbrl = 由脚本从 SEC XBRL 接口取的；document = 人工打开原文录入的 */
  origin: 'xbrl' | 'document';
  form: string;
  title?: string;
  filed?: string;
  period: string;
  url: string;
  xbrlUrl?: string;
  checkedOn: string;
};

export type Span = { label: string; start: string; end: string };
export type Periods = { fy: Span; fyPrior: Span; q: Span; qPrior: Span; ytd: Span | null; ytdPrior: Span | null; balanceDate: string };

/** 一条有来源的文字事实，可带一个数字。 */
export type FItem = { label: string; text: string; src: string; figure?: Fig };

export type GuidanceDirection = 'raised' | 'lowered' | 'maintained' | 'initiated' | 'withdrawn' | 'none' | 'unclear';
export const GUIDANCE_LABEL: Record<GuidanceDirection, string> = {
  raised: '上调',
  lowered: '下调',
  maintained: '维持',
  initiated: '首次给出',
  withdrawn: '撤回',
  none: '公司不给指引',
  unclear: '无法比较',
};

export type Fundamentals = {
  ticker: string;
  checkedOn: string;
  /** 财报币种。不是 USD 时，估值口径里需要股价的倍数不计算（不做汇率换算），除非公司自己给了美元口径（usdPerShare） */
  currency: string;
  xbrl?: { cik: number; note?: string; [k: string]: unknown };
  sources: FSource[];
  periods?: Periods;
  flows?: Partial<Record<MetricId, Partial<Record<Slot, Fig>>>>;
  balance?: { date: string; cash: Fig; debt: Fig; maturities?: FItem[] };
  shares?: { outstanding?: Fig; outstandingYearAgo?: Fig; dilutive?: FItem[] };
  /** 估值口径的补充说明（例如币种、ADR 比例） */
  valuationNote?: string;
  /** 非美元公司的美元口径：每股（或每 ADR）数字由公司自己给出时才写 */
  adr?: { ratio: number; note: string; src: string };
  /** 公司自己公布的美元口径（非美元财报时）。只收公司在财报、20-F／40-F、6-K 里自己写的美元数字，不自己换算 */
  usdReported?: { quarterEpsPerAdr?: Fig; items?: FItem[] };
  segments?: { period: string; src: string; rows: { name: string; revenue: Fig; profit?: Fig; note?: string }[]; note?: string };
  orders?: FItem[];
  customers?: FItem[];
  guidance?: { period: string; text: string; direction: GuidanceDirection; vsText?: string; src: string }[];
  governance?: FItem[];
  risks?: { title: string; text: string; src: string }[];
  prospectus?: { src: string; listedOn?: string; items: { topic: string; text: string; src: string }[] };
  checkpoints?: { metric: string; condition: string; basis: string; latest?: string; src?: string }[];
  /** 本轮没有补到的内容，逐条写明 */
  gaps: string[];
};

export type Calc = { value: number | null; formula: string; note?: string };

const v = (f: Fig | undefined) => (f && typeof f.value === 'number' ? f.value : null);

/** 近四个季度（TTM）= 最近财年 + 本财年至今 − 上年同期；最近一期是年报时就是全年。 */
export function ttm(f: Fundamentals, m: MetricId): Calc {
  const row = f.flows?.[m];
  const p = f.periods;
  if (!row || !p) return { value: null, formula: '—', note: '没有财务数字' };
  if (!p.ytd) return { value: v(row.fy), formula: `${p.fy.label}全年`, note: v(row.fy) === null ? row.fy?.note : undefined };
  const a = v(row.fy), b = v(row.ytd), c = v(row.ytdPrior);
  const formula = `${p.fy.label}全年 + ${p.ytd.label} − ${p.ytdPrior?.label ?? '上年同期'}`;
  if (a === null || b === null || c === null) return { value: null, formula, note: '其中有一项本轮未检索到' };
  return { value: a + b - c, formula };
}

export function growth(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev <= 0) return null;
  return cur / prev - 1;
}

export type ValuationRow = { id: string; label: string; calc: Calc; kind: 'usd' | 'x' | 'pct' };

/** 按某个股价算一遍估值口径。price 是美元（ADR 的价格按 adr.ratio 换算成每股原币之前不能用）。 */
export function valuation(f: Fundamentals, price: number, priceLabel: string): { rows: ValuationRow[]; blocked?: string } {
  if (f.currency !== 'USD') {
    return { rows: [], blocked: f.valuationNote ?? `财报币种是 ${f.currency}，股价是美元；本平台不做汇率换算，需要股价的倍数不计算。` };
  }
  const shares = v(f.shares?.outstanding);
  const cash = v(f.balance?.cash);
  const debt = v(f.balance?.debt);
  const fmtP = `$${price}`;
  const mcap: Calc =
    shares === null
      ? { value: null, formula: `${priceLabel} × 已发行股数`, note: '股数本轮未检索到' }
      : { value: price * shares, formula: `${priceLabel} ${fmtP} × 已发行股数 ${(shares / 1e6).toFixed(1)} 百万股` };
  const ev: Calc =
    mcap.value === null || cash === null || debt === null
      ? { value: null, formula: '市值 + 有息负债 − 现金及短期投资', note: mcap.value === null ? '市值算不出' : '现金或负债本轮未检索到' }
      : { value: mcap.value + debt - cash, formula: `市值 + 有息负债 ${bn(debt)} − 现金及短期投资 ${bn(cash)}` };
  const rev = ttm(f, 'revenue');
  const ni = ttm(f, 'netIncome');
  const op = ttm(f, 'operatingIncome');
  const da = ttm(f, 'da');
  const ocf = ttm(f, 'ocf');
  const capex = ttm(f, 'capex');
  const sbc = ttm(f, 'sbc');
  const ratio = (num: Calc, den: Calc, label: string, kind: 'x' | 'pct', denLabel: string, numLabel: string): Calc => {
    if (num.value === null || den.value === null) return { value: null, formula: `${numLabel} ÷ ${denLabel}`, note: `${num.value === null ? numLabel : denLabel}算不出` };
    if (kind === 'x' && den.value <= 0) return { value: null, formula: `${numLabel} ÷ ${denLabel}`, note: `${denLabel}为负（${bn(den.value)}），${label}不适用` };
    return { value: num.value / den.value, formula: `${numLabel} ${bn(num.value)} ÷ ${denLabel} ${bn(den.value)}` };
  };
  const ebitda: Calc = op.value === null || da.value === null ? { value: null, formula: '营业利润 + 折旧摊销（近四季）', note: '营业利润或折旧摊销本轮未检索到' } : { value: op.value + da.value, formula: `营业利润 ${bn(op.value)} + 折旧摊销 ${bn(da.value)}（近四季）` };
  const fcf: Calc = ocf.value === null || capex.value === null ? { value: null, formula: '经营现金流 − 资本开支（近四季）', note: '经营现金流或资本开支本轮未检索到' } : { value: ocf.value - capex.value, formula: `经营现金流 ${bn(ocf.value)} − 资本开支 ${bn(capex.value)}（近四季）` };
  const fcfSbc: Calc = fcf.value === null || sbc.value === null ? { value: null, formula: '自由现金流 − 股权激励费用', note: '股权激励费用本轮未检索到' } : { value: fcf.value - sbc.value, formula: `自由现金流 ${bn(fcf.value)} − 股权激励 ${bn(sbc.value)}` };
  return {
    rows: [
      { id: 'mcap', label: '市值', calc: mcap, kind: 'usd' },
      { id: 'ev', label: '企业价值', calc: ev, kind: 'usd' },
      { id: 'pe', label: '市盈率（近四季净利润）', calc: ratio(mcap, ni, '市盈率', 'x', '近四季净利润', '市值'), kind: 'x' },
      { id: 'ev-ebitda', label: 'EV/EBITDA', calc: ratio(ev, ebitda, 'EV/EBITDA', 'x', 'EBITDA', '企业价值'), kind: 'x' },
      { id: 'ps', label: '市销率', calc: ratio(mcap, rev, '市销率', 'x', '近四季营收', '市值'), kind: 'x' },
      { id: 'fcf-yield', label: '自由现金流收益率', calc: ratio(fcf, mcap, '', 'pct', '市值', '近四季自由现金流'), kind: 'pct' },
      { id: 'fcf-sbc-yield', label: '扣除股权激励后的自由现金流收益率', calc: ratio(fcfSbc, mcap, '', 'pct', '市值', '自由现金流 − 股权激励'), kind: 'pct' },
    ],
  };
}

/** 非美元公司：用公司自报的单季每 ADR 美元收益，按 × 4 年化算市盈率（算术假设，页面写明）。 */
export function usdReportedPe(f: Fundamentals, price: number): Calc | null {
  const eps = f.usdReported?.quarterEpsPerAdr;
  if (!eps || typeof eps.value !== 'number') return null;
  const annual = eps.value * 4;
  if (annual <= 0) return { value: null, formula: '股价 ÷ (单季每 ADR 收益 × 4)', note: '收益为负，不适用' };
  return { value: price / annual, formula: `股价 $${price} ÷ (单季每 ADR 收益 US$${eps.value} × 4 = US$${annual.toFixed(2)})` };
}

/** 首页用：近四季自由现金流、净利润和股数（只有美元公司）。 */
export function homeInputs(f: Fundamentals | undefined): { shares: number; fcf: number | null; netIncome: number | null; asOf: string } | null {
  if (!f || f.currency !== 'USD') return null;
  const shares = v(f.shares?.outstanding);
  if (shares === null) return null;
  const ocf = ttm(f, 'ocf').value;
  const capex = ttm(f, 'capex').value;
  return { shares, fcf: ocf === null || capex === null ? null : ocf - capex, netIncome: ttm(f, 'netIncome').value, asOf: f.periods?.q.end ?? f.checkedOn };
}

const CUR: Record<string, string> = { USD: '$', TWD: 'NT$', KRW: '₩', CAD: 'C$' };

/** 金额 → “$1,158亿”“$66.3百万”；负数用减号。 */
export function money(x: number, currency = 'USD'): string {
  const a = Math.abs(x);
  const sign = x < 0 ? '−' : '';
  const c = CUR[currency] ?? `${currency} `;
  if (a >= 1e12) return `${sign}${c}${(a / 1e12).toLocaleString('en-US', { maximumFractionDigits: 2 })}万亿`;
  if (a >= 1e8) return `${sign}${c}${(a / 1e8).toLocaleString('en-US', { maximumFractionDigits: a >= 1e10 ? 0 : 1 })}亿`;
  if (a >= 1e6) return `${sign}${c}${(a / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}百万`;
  return `${sign}${c}${a.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}
const bn = (x: number) => money(x);

// 从 SEC 的 XBRL 接口（data.sec.gov）取最近一份 10-K／10-Q 里的财务数字，写进 data/fundamentals/<代码>.json。
//
// 用法：node scripts/fundamentals/sec-xbrl.ts NVDA [VST ...]   （不写代码就是 data/fundamentals/ 里已有 xbrl.cik 的全部）
//   环境变量 SEC_CACHE_DIR：把下载的 JSON 存在这里，同一天再跑不重复下载（默认不缓存）。
//
// 只改文件里由本脚本生成的部分：periods、flows、balance.cash、balance.debt、shares.outstanding、shares.outstandingYearAgo，
// 和 origin 为 "xbrl" 的来源。人工写的部分（业务结构、指引、治理、风险、招股书、检查点等）原样保留。
// 只适用于按美国会计准则提交 10-K／10-Q 的公司；20-F、40-F、6-K 的季度数字不在 XBRL 接口里，要人工从原文录入。
// 不改请求头伪装浏览器：SEC 要求自动化工具声明自己，User-Agent 写的是本项目的名字。

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DIR = path.join(ROOT, 'data', 'fundamentals');
const UA = 'GlobalStockWatch research-notes';
const TODAY = new Date().toISOString().slice(0, 10);

type Fact = { start?: string; end: string; val: number; accn: string; fy: number | null; fp: string | null; form: string; filed: string };
type Facts = Record<string, Record<string, { units: Record<string, Fact[]> }>>;
type Fig = { value: number | null; unit: string; src?: string; calc?: string; note?: string; tag?: string; parts?: { label: string; value: number; tag: string }[] };
type Span = { label: string; start: string; end: string };

async function getJson(url: string, cacheName: string): Promise<any> {
  const cacheDir = process.env.SEC_CACHE_DIR;
  const cacheFile = cacheDir ? path.join(cacheDir, cacheName) : null;
  if (cacheFile && existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8'));
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} 返回 ${res.status}（不绕过）`);
  const text = await res.text();
  if (cacheFile) {
    mkdirSync(cacheDir!, { recursive: true });
    writeFileSync(cacheFile, text);
  }
  return JSON.parse(text);
}

const days = (a: string, b: string) => (Date.parse(b) - Date.parse(a)) / 86400000 + 1;
const cik10 = (cik: number) => String(cik).padStart(10, '0');

// 各项按顺序找第一个在目标期间有数字的标签。
const TAGS: Record<string, string[]> = {
  revenue: ['Revenues', 'RevenueFromContractWithCustomerExcludingAssessedTax', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'RevenuesNetOfInterestExpense'],
  grossProfit: ['GrossProfit'],
  costOfRevenue: ['CostOfRevenue', 'CostOfGoodsAndServicesSold'],
  operatingIncome: ['OperatingIncomeLoss'],
  netIncome: ['NetIncomeLoss', 'NetIncomeLossAvailableToCommonStockholdersBasic', 'ProfitLoss'],
  ocf: ['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations'],
  capex: ['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsForCapitalImprovements'],
  sbc: ['ShareBasedCompensation', 'AllocatedShareBasedCompensationExpense'],
  da: ['DepreciationDepletionAndAmortization', 'DepreciationAmortizationAndAccretionNet', 'DepreciationAndAmortization', 'Depreciation'],
  epsDiluted: ['EarningsPerShareDiluted', 'EarningsPerShareBasicAndDiluted'],
  dilutedShares: ['WeightedAverageNumberOfDilutedSharesOutstanding', 'WeightedAverageNumberOfShareOutstandingBasicAndDiluted'],
  buybacks: ['PaymentsForRepurchaseOfCommonStock'],
  issuance: ['ProceedsFromIssuanceOfCommonStock', 'ProceedsFromIssuanceInitialPublicOffering', 'ProceedsFromIssuanceOrSaleOfEquity'],
  dividends: ['PaymentsOfDividendsCommonStock', 'PaymentsOfDividends'],
};
const UNIT: Record<string, string> = { epsDiluted: 'USD/股', dilutedShares: '股' };
// 现金流量表的数字在 10-Q 里只有年初至今，单季要用两期相减。
const CASH_FLOW = new Set(['ocf', 'capex', 'sbc', 'da', 'buybacks', 'issuance', 'dividends']);

const CASH_DEFAULT = [['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents'], ['ShortTermInvestments', 'MarketableSecuritiesCurrent', 'AvailableForSaleSecuritiesDebtSecuritiesCurrent']];
const DEBT_DEFAULT = [
  ['LongTermDebt', 'LongTermDebtAndCapitalLeaseObligations'],
  ['ShortTermBorrowings'],
  ['CommercialPaper'],
];
const DEBT_FALLBACK = [['LongTermDebtNoncurrent', 'LongTermDebtAndCapitalLeaseObligations'], ['LongTermDebtCurrent', 'LongTermDebtAndCapitalLeaseObligationsCurrent', 'DebtCurrent'], ['ShortTermBorrowings'], ['CommercialPaper']];
const LABEL: Record<string, string> = {
  CashAndCashEquivalentsAtCarryingValue: '现金及现金等价物',
  CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents: '现金及等价物（含受限现金）',
  ShortTermInvestments: '短期投资',
  MarketableSecuritiesCurrent: '流动有价证券',
  AvailableForSaleSecuritiesDebtSecuritiesCurrent: '可供出售债券（流动）',
  LongTermDebt: '长期债务（含一年内到期）',
  LongTermDebtAndCapitalLeaseObligations: '长期债务及融资租赁（非流动）',
  LongTermDebtNoncurrent: '长期债务（非流动）',
  LongTermDebtCurrent: '一年内到期的长期债务',
  LongTermDebtAndCapitalLeaseObligationsCurrent: '一年内到期的债务及融资租赁',
  DebtCurrent: '短期债务（流动）',
  ShortTermBorrowings: '短期借款',
  CommercialPaper: '商业票据',
  ConvertibleNotesPayable: '可转换票据',
  ConvertibleNotesPayableCurrent: '可转换票据（流动）',
  LongTermLineOfCredit: '长期信贷额度借款',
  OtherLongTermDebt: '其他长期债务',
  LongTermDebtNoncurrentAndCurrent: '长期债务',
};

type Config = { cik: number; cashTags?: string[][]; debtTags?: string[][]; capexTags?: string[]; revenueTags?: string[]; debtNote?: string; cashNote?: string };

async function run(code: string) {
  const file = path.join(DIR, `${code.toLowerCase()}.json`);
  if (!existsSync(file)) throw new Error(`${file} 不存在：先建文件并写 xbrl.cik`);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const cfg: Config = doc.xbrl;
  if (!cfg?.cik) throw new Error(`${code}：缺 xbrl.cik`);
  const factsUrl = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik10(cfg.cik)}.json`;
  const subUrl = `https://data.sec.gov/submissions/CIK${cik10(cfg.cik)}.json`;
  const facts: Facts = (await getJson(factsUrl, `facts-${code}.json`)).facts;
  const sub = await getJson(subUrl, `sub-${code}.json`);
  const gaap: any = facts['us-gaap'] ?? {};
  const revTags = revTagsAll(cfg);
  const dei: any = facts.dei ?? {};

  // 最近的 10-K 和 10-Q（不看修订版）。
  const r = sub.filings.recent;
  const filings = r.form.map((form: string, i: number) => ({ form, filed: r.filingDate[i], accn: r.accessionNumber[i], doc: r.primaryDocument[i], report: r.reportDate[i] }));
  const hasFacts = (accn: string) => [...revTagsAll(cfg), 'NetIncomeLoss'].some((t: string) => (gaap[t]?.units?.USD ?? []).some((x: any) => x.accn === accn));
  const newest = filings.find((f: any) => f.form === '10-K' || f.form === '10-Q');
  const latest = filings.find((f: any) => (f.form === '10-K' || f.form === '10-Q') && hasFacts(f.accn));
  const tenK = filings.find((f: any) => f.form === '10-K' && hasFacts(f.accn));
  if (!latest || !tenK) throw new Error(`${code}：没有找到带 XBRL 数字的 10-K／10-Q（新上市、还没有 10-K 的要人工录入）`);
  if (!doc.gaps) doc.gaps = [];
  const stale = newest && newest.accn !== latest.accn ? `最近一份 ${newest.form}（${newest.filed} 提交）的数字还没有进 XBRL 接口，这里用的是 ${latest.form}（${latest.filed}）` : null;
  const priorQ = latest.form === '10-K' ? filings.find((f: any) => f.form === '10-Q' && f.filed < latest.filed) : null;
  const docUrl = (f: any) => `https://www.sec.gov/Archives/edgar/data/${cfg.cik}/${f.accn.replace(/-/g, '')}/${f.doc}`;

  const byAccn = (tag: string, accn: string, unit = 'USD'): Fact[] => {
    const u = gaap[tag]?.units;
    if (!u) return [];
    const list = u[unit] ?? u['USD/shares'] ?? u.shares ?? [];
    return list.filter((f: Fact) => f.accn === accn);
  };
  const unitOf = (m: string) => (m === 'epsDiluted' ? 'USD/shares' : m === 'dilutedShares' ? 'shares' : 'USD');

  // 期间：从最近的 10-K 取财年和上一财年；从最近的 10-Q 取单季、去年同季、年初至今。
  const durations = (accn: string) => {
    const set = new Map<string, Fact>();
    for (const tag of [...revTags, 'NetIncomeLoss', 'OperatingIncomeLoss'])
      for (const f of byAccn(tag, accn)) if (f.start) set.set(`${f.start}|${f.end}`, f);
    return [...set.values()];
  };
  const pick = (list: Fact[], lo: number, hi: number) => list.filter((f) => f.start && days(f.start, f.end) >= lo && days(f.start, f.end) <= hi).sort((a: any, b: any) => b.end.localeCompare(a.end));
  const kDur = pick(durations(tenK.accn), 350, 380);
  if (kDur.length < 2) throw new Error(`${code}：10-K 里找不到两个财年的数字`);
  const fyFact: Fact = kDur.find((f) => f.end === tenK.report) ?? kDur[0]!;
  let fy: Span = { label: `FY${fyFact.fy ?? fyFact.end.slice(0, 4)}`, start: fyFact.start!, end: fyFact.end };
  const fyPriorFact = kDur.find((f) => f.end < fy.end && Math.abs(days(f.end, fy.start)) <= 8)!;
  if (!fyPriorFact) throw new Error(`${code}：10-K 里找不到上一财年`);
  let fyPrior: Span = { label: `FY${(fyFact.fy ?? Number(fy.end.slice(0, 4))) - 1}`, start: fyPriorFact.start!, end: fyPriorFact.end };

  let q: Span, qPrior: Span, ytd: Span | null = null, ytdPrior: Span | null = null;
  let qAccn: string;
  let q4 = false;
  if (latest.form === '10-Q') {
    const d = durations(latest.accn);
    const quarters = pick(d, 80, 100);
    const qf: Fact = quarters.find((f) => f.end === latest.report) ?? quarters[0]!;
    const fp = qf.fp ?? '';
    q = { label: `FY${qf.fy} ${fp}`, start: qf.start!, end: qf.end };
    const qp = quarters.find((f) => f.end < q.start && days(f.end, q.end) > 330)!;
    qPrior = { label: `FY${(qf.fy ?? 0) - 1} ${fp}`, start: qp.start!, end: qp.end };
    const ytds = pick(d, 170, 290);
    const yf = ytds.find((f) => f.end === q.end);
    if (yf) {
      ytd = { label: `FY${qf.fy} 前${fp === 'Q2' ? '两' : '三'}季`, start: yf.start!, end: yf.end };
      const yp = ytds.find((f) => f.end === qPrior.end)!;
      ytdPrior = { label: `FY${(qf.fy ?? 0) - 1} 前${fp === 'Q2' ? '两' : '三'}季`, start: yp.start!, end: yp.end };
    } else {
      // 第一季度：年初至今就是单季。
      ytd = { ...q, label: `FY${qf.fy} Q1` };
      ytdPrior = { ...qPrior, label: `FY${(qf.fy ?? 0) - 1} Q1` };
    }
    qAccn = latest.accn;
  } else {
    // 最近是 10-K：第四季度 = 全年 − 前三季（前三季取自当年的第三季 10-Q）。
    q4 = true;
    q = { label: `${fy.label} Q4`, start: '', end: fy.end };
    qPrior = { label: `${fyPrior.label} Q4`, start: '', end: fyPrior.end };
    qAccn = latest.accn;
  }

  const sources: any[] = [];
  const addSource = (f: any, period: string) => {
    if (!sources.some((s) => s.id === f.accn))
      sources.push({ id: f.accn, origin: 'xbrl', form: f.form, filed: f.filed, period, url: docUrl(f), xbrlUrl: factsUrl, checkedOn: TODAY });
    return f.accn;
  };
  const srcK = addSource(tenK, `${fy.label}（截至 ${fy.end}）`);
  const srcQ = latest.form === '10-Q' ? addSource(latest, `${q.label}（截至 ${q.end}）`) : srcK;
  const srcPQ = priorQ ? addSource(priorQ, `截至 ${priorQ.report} 的季度`) : null;

  // companyfacts 对同一期间同一数字只保留一份，记在最近报告它的文件下（可能是修订版），所以按期间找、不按文件找。
  const findVal = (metric: string, tags: string[], _accn: string, start: string, end: string): { value: number; tag: string; accn: string } | null => {
    for (const tag of tags) {
      const u = gaap[tag]?.units;
      if (!u) continue;
      const list = (u[unitOf(metric)] ?? []).filter((x: any) => x.start === start && x.end === end && /^10-[KQ]/.test(x.form)).sort((a: any, b: any) => b.filed.localeCompare(a.filed));
      if (list[0]) return { value: list[0].val, tag, accn: list[0].accn };
    }
    return null;
  };
  const srcFor = (accn: string, fallback: string) => {
    const f = filings.find((x: any) => x.accn === accn);
    return f ? addSource(f, `截至 ${f.report} 的${f.form.startsWith('10-K') ? '财年' : '季度'}`) : fallback;
  };
  const unit = (m: string) => UNIT[m] ?? 'USD';
  const fig = (metric: string, tags: string[], accn: string, span: Span | null, src: string): Fig => {
    if (!span) return { value: null, unit: unit(metric), note: '本轮未检索到' };
    const v = findVal(metric, tags, accn, span.start, span.end);
    return v ? { value: v.value, unit: unit(metric), src: srcFor(v.accn, src), tag: v.tag } : { value: null, unit: unit(metric), note: '本轮未检索到（XBRL 里没有这一期的这项数字）' };
  };

  const flows: Record<string, any> = {};
  const metrics = Object.keys(TAGS).filter((m) => m !== 'costOfRevenue');
  for (const m of metrics) {
    const tags: string[] = m === 'capex' && cfg.capexTags ? cfg.capexTags : m === 'revenue' ? revTags : TAGS[m]!;
    const row: Record<string, Fig> = {
      fy: fig(m, tags, tenK.accn, fy, srcK),
      fyPrior: fig(m, tags, tenK.accn, fyPrior, srcK),
    };
    if (!q4) {
      row.ytd = fig(m, tags, qAccn, ytd, srcQ);
      row.ytdPrior = fig(m, tags, qAccn, ytdPrior, srcQ);
      const direct = fig(m, tags, qAccn, q, srcQ);
      const directPrior = fig(m, tags, qAccn, qPrior, srcQ);
      row.q = direct;
      row.qPrior = directPrior;
      if (CASH_FLOW.has(m) && direct.value === null && ytd && ytd.start !== q.start) {
        // 单季 = 年初至今 − 上一季的年初至今（取自上一份 10-Q）。
        const prevQ = filings.find((f: any) => f.form === '10-Q' && f.filed < latest.filed);
        const prevYtd = prevQ ? findVal(m, tags, prevQ.accn, ytd.start, prevQ.report) : null;
        if (prevYtd && row.ytd.value !== null) {
          const ps = addSource(prevQ, `截至 ${prevQ.report} 的季度`);
          row.q = { value: row.ytd.value - prevYtd.value, unit: unit(m), src: srcQ, calc: `年初至今 − 截至 ${prevQ.report} 的年初至今（后者见 ${prevQ.form}，${prevQ.filed} 提交）`, tag: row.ytd.tag };
        } else row.q = { value: null, unit: unit(m), note: '本轮未检索到（现金流量表只有年初至今的数字）' };
        row.qPrior = { value: null, unit: unit(m), note: '没有计算（需要去年同期两份季报相减）' };
      }
    } else if (priorQ && srcPQ) {
      // 第四季度：全年 − 前三季。
      const d = durations(priorQ.accn);
      const nine = pick(d, 260, 290);
      const n = nine.find((f) => f.start === fy.start);
      const nPrior = nine.find((f) => f.start === fyPrior.start);
      const q4fig = (span: Span, nineSpan: Fact | undefined, fyFig: Fig): Fig => {
        if (m === 'epsDiluted' || m === 'dilutedShares') return { value: null, unit: unit(m), note: '没有计算（每股数字不能用全年减前三季）' };
        if (!nineSpan || fyFig.value === null) return { value: null, unit: unit(m), note: '本轮未检索到' };
        const nv = findVal(m, tags, priorQ.accn, nineSpan.start!, nineSpan.end);
        if (!nv) return { value: null, unit: unit(m), note: '本轮未检索到' };
        return { value: fyFig.value - nv.value, unit: unit(m), src: srcK, calc: `${span.label.replace(' Q4', '')}全年 − 前三季（前三季见 ${priorQ.form}，${priorQ.filed} 提交）`, tag: fyFig.tag };
      };
      row.q = q4fig(q, n, row.fy!);
      row.qPrior = q4fig(qPrior, nPrior, row.fyPrior!);
    }
    flows[m] = row;
  }
  // 毛利：公司没有直接报告时，用营收 − 营业成本算。
  for (const slot of Object.keys(flows.grossProfit)) {
    const g = flows.grossProfit[slot];
    if (g.value !== null) continue;
    const rev = flows.revenue[slot];
    const accn = slot.startsWith('fy') ? tenK.accn : qAccn;
    const span = { fy, fyPrior, q, qPrior, ytd, ytdPrior }[slot] as Span | null;
    const cost = span && span.start ? findVal('costOfRevenue', TAGS.costOfRevenue!, accn, span.start, span.end) : null;
    if (rev?.value != null && cost) flows.grossProfit[slot] = { value: rev.value - cost.value, unit: 'USD', src: rev.src, calc: `营收 − 营业成本（${cost.tag}）`, tag: cost.tag };
    else if (rev?.calc && flows.grossProfit[slot].note) flows.grossProfit[slot] = { value: null, unit: 'USD', note: '本轮未检索到（公司没有单列毛利）' };
    else flows.grossProfit[slot] = { value: null, unit: 'USD', note: '本轮未检索到（公司没有单列毛利或营业成本）' };
  }

  // 资产负债：最近一期的资产负债表日。
  const balAccn = latest.accn;
  const balDate = latest.report;
  void balAccn;
  const instant = (tag: string, date = balDate, unitName = 'USD') => {
    const f = (gaap[tag]?.units?.[unitName] ?? []).filter((x: any) => !x.start && x.end === date && /^10-[KQ]/.test(x.form)).sort((a: any, b: any) => b.filed.localeCompare(a.filed))[0];
    return f ? f.val : null;
  };
  const sumGroups = (groups: string[][], note: string | undefined): Fig => {
    const parts: { label: string; value: number; tag: string }[] = [];
    for (const g of groups) {
      for (const tag of g) {
        const v = instant(tag);
        if (v !== null) {
          parts.push({ label: LABEL[tag] ?? tag, value: v, tag });
          break;
        }
      }
    }
    if (parts.length === 0) return { value: null, unit: 'USD', note: note ?? '本轮未检索到（XBRL 里没有匹配的标签）' };
    return { value: parts.reduce((s, p) => s + p.value, 0), unit: 'USD', src: srcQ, parts, ...(note ? { note } : {}) };
  };
  const cash = sumGroups(cfg.cashTags ?? CASH_DEFAULT, cfg.cashNote);
  let debt: Fig;
  if (cfg.debtTags) debt = sumGroups(cfg.debtTags, cfg.debtNote);
  else {
    debt = sumGroups(DEBT_DEFAULT, cfg.debtNote);
    if (!debt.parts?.some((p) => p.tag === 'LongTermDebt')) debt = sumGroups(DEBT_FALLBACK, cfg.debtNote);
    if (debt.value === null) debt = { value: null, unit: 'USD', note: cfg.debtNote ?? '本轮未检索到（XBRL 里没有债务标签；可能没有有息负债，须对照原文）' };
  }

  // 股本：封面上的已发行股数（多类股份时 XBRL 接口不给合计，退回到人工录入）。
  const so = dei.EntityCommonStockSharesOutstanding?.units?.shares ?? [];
  const latestShares = so.filter((x: any) => x.accn === latest.accn);
  const yearAgo = so.filter((x: any) => x.end <= addDays(latestShares[0]?.end ?? balDate, -330)).sort((a: any, b: any) => b.end.localeCompare(a.end));
  const shareFig = (list: Fact[], src: string | null, label: string): Fig | null => {
    if (list.length === 0) return null;
    const date = list[0]!.end;
    const same = list.filter((x: any) => x.end === date);
    return { value: same.reduce((s: number, x: any) => s + x.val, 0), unit: '股', src: src ?? undefined, calc: same.length > 1 ? `${same.length} 类股份相加` : undefined, note: `${label}，截至 ${date}` };
  };
  let out = shareFig(latestShares, srcQ, '封面披露的已发行普通股');
  if (!out) {
    // 多类股份时封面数字带维度、不在接口里；退回到资产负债表日的已发行普通股（不带维度的数字通常是各类合计，须对照原文）。
    const v = instant('CommonStockSharesOutstanding', balDate, 'shares');
    if (v !== null) out = { value: v, unit: '股', src: srcQ, note: `资产负债表日（${balDate}）的已发行普通股，XBRL 不带类别的数字；多类股份时须对照原文确认是各类合计` };
  }
  let ago: Fig | null = null;
  if (yearAgo.length) {
    const f = yearAgo[0];
    const fil = filings.find((x: any) => x.accn === f.accn);
    const s = fil ? addSource(fil, `截至 ${fil.report} 的${fil.form === '10-K' ? '财年' : '季度'}`) : null;
    ago = shareFig(yearAgo.filter((x: any) => x.accn === f.accn), s, '一年前封面披露的已发行普通股');
  }

  // 人工录入（manual: true）的数字不覆盖。
  const keep = (oldRow: Record<string, any> | undefined, row: Record<string, Fig>) => {
    for (const [k, v] of Object.entries(oldRow ?? {})) if (v?.manual) row[k] = v;
  };
  for (const m of Object.keys(flows)) keep(doc.flows?.[m], flows[m]);
  if (doc.xbrl?.manualPeriods && doc.periods) {
    const keepP: any = { fy, fyPrior, q, qPrior, ytd, ytdPrior };
    for (const k of doc.xbrl.manualPeriods) if (k in keepP) keepP[k] = doc.periods[k];
    ({ fy, fyPrior, q, qPrior, ytd, ytdPrior } = keepP);
  }
  if (!ytd) for (const m of Object.keys(flows)) { delete flows[m].ytd; delete flows[m].ytdPrior; }
  doc.xbrl.note = stale ?? undefined;
  doc.checkedOn = TODAY;
  doc.currency = 'USD';
  doc.periods = { fy, fyPrior, q, qPrior, ytd, ytdPrior, balanceDate: doc.xbrl?.manualPeriods?.includes('balanceDate') ? doc.periods.balanceDate : balDate };
  doc.flows = flows;
  const bal = doc.balance ?? {};
  doc.balance = { ...bal, date: bal.cash?.manual ? bal.date : balDate, cash: bal.cash?.manual ? bal.cash : cash, debt: bal.debt?.manual ? bal.debt : debt };
  doc.shares = { ...(doc.shares ?? {}) };
  if (doc.shares.outstanding?.manual) {
    /* 人工录入的封面股数保留 */
  } else if (out) doc.shares.outstanding = out;
  else if (!doc.shares.outstanding?.manual) doc.shares.outstanding = { value: null, unit: '股', note: '本轮未检索到（XBRL 接口没有封面股数，多类股份或新上市公司常见；须从原文封面录入）' };
  if (ago) doc.shares.outstandingYearAgo = ago;
  // 只留被引用到的来源。
  const used = new Set<string>();
  const walk = (x: any) => { if (x && typeof x === 'object') { if (typeof x.src === 'string') used.add(x.src); Object.values(x).forEach(walk); } };
  walk({ flows: doc.flows, balance: doc.balance, shares: doc.shares });
  doc.sources = [...sources.filter((s: any) => used.has(s.id)), ...(doc.sources ?? []).filter((s: any) => s.origin !== 'xbrl')];
  writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
  const show = (f: Fig) => (f.value === null ? `— ${f.note}` : `${(f.value / 1e6).toFixed(0)}M${f.calc ? '*' : ''}`);
  console.log(`${code}: ${fy.label} ${fy.end} / ${q.label} ${q.end}  营收 ${show(flows.revenue.q)}  OCF ${show(flows.ocf.q)}  现金 ${show(cash)}  债务 ${show(debt)} [${(debt.parts ?? []).map((p) => p.tag).join('+')}]  股本 ${out ? (out.value! / 1e6).toFixed(1) + 'M' : '—'}`);
}

function revTagsAll(cfg: Config): string[] {
  return cfg.revenueTags ?? TAGS.revenue!;
}

function addDays(date: string, n: number) {
  return new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
}

const args = process.argv.slice(2);
const codes = args.length ? args : readdirSync(DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', '').toUpperCase()).filter((c) => JSON.parse(readFileSync(path.join(DIR, `${c.toLowerCase()}.json`), 'utf8')).xbrl?.cik);
for (const c of codes) {
  try {
    await run(c.toUpperCase());
  } catch (e) {
    console.error(`${c}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
  await new Promise((r) => setTimeout(r, 250));
}

import { METRICS, SLOTS } from './fundamentals.ts';

// data/fundamentals/<代码小写>.json 的校验。规则：每个数字要么有来源，要么写明为什么没有（不留空、不估）；
// 来源要有 https 链接和核对日期；文字事实都要指向一条来源。

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DIRECTIONS = ['raised', 'lowered', 'maintained', 'initiated', 'withdrawn', 'none', 'unclear'];
const obj = (v: unknown): v is Record<string, any> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
function realDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateFundamentals(files: { file: string; data: unknown }[], tickers: Set<string>): string[] {
  const errors: string[] = [];
  for (const { file, data } of files) {
    const w = `fundamentals/${file}`;
    const err = (m: string) => errors.push(`${w}：${m}`);
    if (!obj(data)) {
      err('不是对象');
      continue;
    }
    const f = data;
    if (!text(f.ticker) || file !== `${f.ticker.toLowerCase()}.json`) err('ticker 要和文件名一致');
    else if (!tickers.has(f.ticker)) err(`清单里没有 ${f.ticker}`);
    if (f.ticker === 'ANT') err('Anthropic（ANT）因利益冲突不纳入清单');
    if (!realDate(f.checkedOn)) err('checkedOn 必须是真实日期');
    if (!text(f.currency)) err('缺 currency');
    if (!Array.isArray(f.gaps) || f.gaps.some((g: unknown) => !text(g))) err('gaps 必须是文字数组（没补到的内容逐条写明；都补到了写 []）');

    const ids = new Set<string>();
    if (!Array.isArray(f.sources)) err('sources 必须是数组');
    else
      for (const s of f.sources) {
        if (!obj(s) || !text(s.id) || !text(s.form) || !text(s.period)) {
          err('每条来源要有 id、form、period');
          continue;
        }
        if (ids.has(s.id)) err(`来源 id 重复：${s.id}`);
        ids.add(s.id);
        if (s.origin !== 'xbrl' && s.origin !== 'document') err(`来源 ${s.id} 的 origin 只能是 xbrl 或 document`);
        if (typeof s.url !== 'string' || !/^https:\/\/\S+$/.test(s.url)) err(`来源 ${s.id} 的 url 必须是 https`);
        if (s.xbrlUrl !== undefined && !/^https:\/\/\S+$/.test(String(s.xbrlUrl))) err(`来源 ${s.id} 的 xbrlUrl 必须是 https`);
        if (!realDate(s.checkedOn)) err(`来源 ${s.id} 的 checkedOn 必须是真实日期`);
      }

    const fig = (x: unknown, where: string, needPeriod = false) => {
      if (!obj(x)) return err(`${where} 不是对象`);
      if (!text(x.unit)) err(`${where} 缺 unit`);
      if (x.value === null) {
        if (!text(x.note)) err(`${where} 没有数字时必须在 note 写明原因（如“本轮未检索到”）`);
        return;
      }
      if (typeof x.value !== 'number' || !Number.isFinite(x.value)) return err(`${where}.value 必须是数字或 null`);
      if (!text(x.src)) err(`${where} 有数字就必须写来源 src`);
      else if (!ids.has(x.src)) err(`${where} 的来源 ${x.src} 不在 sources 里`);
      if (needPeriod && !text(x.period)) err(`${where} 要写所属期间 period`);
      if (x.parts !== undefined) {
        if (!Array.isArray(x.parts) || x.parts.some((p: unknown) => !obj(p) || !text(p.label) || typeof p.value !== 'number')) err(`${where}.parts 每项要有 label 和数字`);
        else if (Math.abs(x.parts.reduce((s: number, p: any) => s + p.value, 0) - x.value) > 1) err(`${where} 的 parts 加起来不等于 value`);
      }
    };
    const item = (x: unknown, where: string) => {
      if (!obj(x) || !text(x.label) || !text(x.text)) return err(`${where} 要有 label 和 text`);
      if (!text(x.src) || !ids.has(x.src)) err(`${where} 的来源 ${String(x.src)} 不在 sources 里`);
      if (x.figure !== undefined) fig(x.figure, `${where}.figure`, true);
    };
    const list = (x: unknown, where: string, each: (v: unknown, w: string) => void) => {
      if (x === undefined) return;
      if (!Array.isArray(x)) return err(`${where} 必须是数组`);
      x.forEach((v, i) => each(v, `${where}[${i}]`));
    };

    if (f.periods !== undefined) {
      const p = f.periods;
      if (!obj(p)) err('periods 不是对象');
      else {
        for (const k of ['fy', 'fyPrior', 'q', 'qPrior'])
          if (!obj(p[k]) || !text(p[k].label) || !realDate(p[k].end)) err(`periods.${k} 要有 label 和真实的 end 日期`);
        for (const k of ['ytd', 'ytdPrior']) if (p[k] !== null && (!obj(p[k]) || !realDate(p[k].start) || !realDate(p[k].end))) err(`periods.${k} 要么是 null，要么有 start 和 end`);
        if (!realDate(p.balanceDate)) err('periods.balanceDate 必须是真实日期');
      }
      if (!obj(f.flows)) err('有 periods 就要有 flows');
    }
    if (f.flows !== undefined) {
      if (!obj(f.flows)) err('flows 不是对象');
      else
        for (const [m, row] of Object.entries(f.flows)) {
          if (!(METRICS as readonly string[]).includes(m)) err(`flows 里有未知的项目 ${m}`);
          if (!obj(row)) continue;
          for (const [slot, x] of Object.entries(row)) {
            if (!(SLOTS as readonly string[]).includes(slot)) err(`flows.${m} 里有未知的期间 ${slot}`);
            fig(x, `flows.${m}.${slot}`);
          }
        }
    }
    if (f.balance !== undefined) {
      if (!obj(f.balance) || !realDate(f.balance.date)) err('balance 要有真实的 date');
      else {
        fig(f.balance.cash, 'balance.cash');
        fig(f.balance.debt, 'balance.debt');
        list(f.balance.maturities, 'balance.maturities', item);
      }
    }
    if (f.shares !== undefined) {
      if (!obj(f.shares)) err('shares 不是对象');
      else {
        if (f.shares.outstanding !== undefined) fig(f.shares.outstanding, 'shares.outstanding');
        if (f.shares.outstandingYearAgo !== undefined) fig(f.shares.outstandingYearAgo, 'shares.outstandingYearAgo');
        list(f.shares.dilutive, 'shares.dilutive', item);
      }
    }
    if (f.adr !== undefined && (!obj(f.adr) || typeof f.adr.ratio !== 'number' || !text(f.adr.note) || !ids.has(f.adr.src))) err('adr 要有 ratio、note 和来源');
    if (f.usdReported !== undefined) {
      if (!obj(f.usdReported)) err('usdReported 不是对象');
      else {
        if (f.usdReported.quarterEpsPerAdr !== undefined) {
          fig(f.usdReported.quarterEpsPerAdr, 'usdReported.quarterEpsPerAdr', true);
          if (f.usdReported.quarterEpsPerAdr.unit !== 'USD/ADR') err('usdReported.quarterEpsPerAdr 的 unit 必须是 USD/ADR');
        }
        list(f.usdReported.items, 'usdReported.items', item);
      }
    }
    if (f.segments !== undefined) {
      const s = f.segments;
      if (!obj(s) || !text(s.period) || !ids.has(s.src) || !Array.isArray(s.rows)) err('segments 要有 period、来源和 rows');
      else
        s.rows.forEach((r: unknown, i: number) => {
          if (!obj(r) || !text(r.name)) return err(`segments.rows[${i}] 要有 name`);
          fig(r.revenue, `segments.rows[${i}].revenue`);
          if (r.profit !== undefined) fig(r.profit, `segments.rows[${i}].profit`);
        });
    }
    list(f.orders, 'orders', item);
    list(f.customers, 'customers', item);
    list(f.governance, 'governance', item);
    list(f.guidance, 'guidance', (g, wh) => {
      if (!obj(g) || !text(g.period) || !text(g.text)) return err(`${wh} 要有 period 和 text`);
      if (!DIRECTIONS.includes(g.direction)) err(`${wh}.direction 只能是 ${DIRECTIONS.join(' / ')}`);
      if (!ids.has(g.src)) err(`${wh} 的来源不在 sources 里`);
    });
    list(f.risks, 'risks', (r, wh) => {
      if (!obj(r) || !text(r.title) || !text(r.text)) return err(`${wh} 要有 title 和 text`);
      if (!ids.has(r.src)) err(`${wh} 的来源不在 sources 里`);
    });
    if (Array.isArray(f.risks) && f.risks.length > 6) err('risks 最多 6 条（只列与这家公司特别相关的）');
    if (f.prospectus !== undefined) {
      const p = f.prospectus;
      if (!obj(p) || !ids.has(p.src) || !Array.isArray(p.items) || p.items.length === 0) err('prospectus 要有来源和至少一条 items');
      else
        p.items.forEach((x: unknown, i: number) => {
          if (!obj(x) || !text(x.topic) || !text(x.text)) return err(`prospectus.items[${i}] 要有 topic 和 text`);
          if (!ids.has(x.src)) err(`prospectus.items[${i}] 的来源不在 sources 里`);
        });
    }
    list(f.checkpoints, 'checkpoints', (c, wh) => {
      if (!obj(c) || !text(c.metric) || !text(c.condition) || !text(c.basis)) return err(`${wh} 要有 metric、condition 和 basis（出自哪一条已有判断）`);
      if (c.src !== undefined && !ids.has(c.src)) err(`${wh} 的来源不在 sources 里`);
    });
  }
  return errors;
}

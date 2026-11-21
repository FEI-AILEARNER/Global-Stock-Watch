import { EXIT_LOGIC_IDS, REQUIRED_NOTE_IDS, STANCE_GROUPS } from './schema.ts';
import type { Dataset } from './schema.ts';

// 校验整份数据，返回错误列表（空 = 通过）。prebuild 的脚本和 lib/load.ts 读取时用的是同一个函数。

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NEWS_DATE = /^\d{4}-\d{2}(-\d{2})?$/;
const TICKER = /^[A-Z][A-Z0-9.]{0,7}$/;

function realDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const price = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const obj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function validateDataset(raw: {
  tickers: { file: string; data: unknown }[];
  sectors: unknown;
  notes: unknown;
  exitLogic: unknown;
  removed: unknown;
  calendar: unknown;
  site: unknown;
  updates: { file: string; data: unknown }[];
}): string[] {
  const errors: string[] = [];
  const err = (where: string, message: string) => errors.push(`${where}：${message}`);

  const sectorIds = new Set<string>();
  if (!Array.isArray(raw.sectors) || raw.sectors.length === 0) err('meta/sectors.json', '必须是非空数组');
  else
    for (const s of raw.sectors) {
      if (!obj(s) || !text(s.id) || !text(s.name)) err('meta/sectors.json', '每个板块都要有 id 和 name');
      else if (sectorIds.has(s.id)) err('meta/sectors.json', `板块 id 重复：${s.id}`);
      else sectorIds.add(s.id);
    }

  const seen = new Set<string>();
  const usedSectors = new Set<string>();
  for (const { file, data } of raw.tickers) {
    const w = `tickers/${file}`;
    if (!obj(data)) {
      err(w, '不是对象');
      continue;
    }
    const t = data;
    if (!text(t.ticker) || !TICKER.test(t.ticker)) err(w, 'ticker 必须是大写代码');
    else {
      if (file !== `${t.ticker.toLowerCase()}.json`) err(w, `文件名应为 ${t.ticker.toLowerCase()}.json`);
      if (seen.has(t.ticker)) err(w, `代码重复：${t.ticker}`);
      seen.add(t.ticker);
      // 披露规则：Anthropic 存在利益冲突，不纳入清单。
      if (t.ticker === 'ANT') err(w, 'Anthropic（ANT）因利益冲突不纳入清单，见 data/meta/site.json 的 excluded');
    }
    if (t.quoteSymbol !== undefined && !text(t.quoteSymbol)) err(w, 'quoteSymbol 写了就不能为空');
    if (!text(t.company)) err(w, '缺 company');
    if (!text(t.sector) || !sectorIds.has(t.sector)) err(w, `sector 不在 meta/sectors.json 里：${String(t.sector)}`);
    else usedSectors.add(t.sector);
    if (!price(t.strikePrice)) err(w, 'strikePrice 必须是正数');
    if (!price(t.exitPrice)) err(w, 'exitPrice 必须是正数');
    if (!(EXIT_LOGIC_IDS as readonly unknown[]).includes(t.exitLogic)) err(w, `exitLogic 只能是 ${EXIT_LOGIC_IDS.join(' / ')}`);
    if (!obj(t.stance) || !text(t.stance.label) || !(STANCE_GROUPS as readonly unknown[]).includes(t.stance.group))
      err(w, `stance 要有 label 和 group（${STANCE_GROUPS.join(' / ')}）`);
    if (!text(t.strikeNote)) err(w, '缺 strikeNote');
    if (!text(t.events)) err(w, '缺 events（没有事件写 “—”）');
    if (!realDate(t.contentUpdatedOn)) err(w, 'contentUpdatedOn 必须是真实日期 YYYY-MM-DD');

    if (t.lastPrice === null) {
      if (!text(t.lastPriceNote)) err(w, 'lastPrice 为 null 时必须写 lastPriceNote 说明原因');
    } else if (!obj(t.lastPrice)) err(w, 'lastPrice 必须是对象或 null');
    else {
      const p = t.lastPrice;
      if (!price(p.value)) err(w, 'lastPrice.value 必须是正数');
      if (p.asOf !== null && !realDate(p.asOf)) err(w, 'lastPrice.asOf 必须是真实日期或 null');
      if (typeof p.approx !== 'boolean') err(w, 'lastPrice.approx 必须是 true 或 false');
      if (!text(p.quote)) err(w, 'lastPrice.quote 要写出处原文');
      if (!realDate(p.recordedOn)) err(w, 'lastPrice.recordedOn 必须是真实日期');
    }

    if (!Array.isArray(t.rationale) || t.rationale.length === 0) err(w, 'rationale 至少要有一条');
    else {
      let previous: string | null = null;
      t.rationale.forEach((r: unknown, i: number) => {
        if (!obj(r) || !text(r.label) || !text(r.text)) return err(w, `rationale[${i}] 要有 label 和 text`);
        if (r.date !== null && !realDate(r.date)) return err(w, `rationale[${i}].date 必须是真实日期或 null`);
        if (i === 0 && r.date === null) err(w, '最新一条定价依据必须有日期');
        if (typeof r.date === 'string') {
          if (previous !== null && r.date > previous) err(w, 'rationale 要按日期从新到旧排列');
          previous = r.date;
        }
        if ((r.text.match(/\*\*/g) ?? []).length % 2 !== 0) err(w, `rationale[${i}] 的 ** 加粗标记不成对`);
      });
    }

    if (!Array.isArray(t.news)) err(w, 'news 必须是数组（没有就写 []）');
    else
      t.news.forEach((n: unknown, i: number) => {
        if (!obj(n) || !text(n.title) || !text(n.summary)) return err(w, `news[${i}] 要有 title 和 summary`);
        if (typeof n.date !== 'string' || !NEWS_DATE.test(n.date)) err(w, `news[${i}].date 要写 YYYY-MM-DD 或 YYYY-MM`);
        if (typeof n.url !== 'string' || !/^https:\/\/\S+$/.test(n.url)) err(w, `news[${i}].url 必须是 https 链接`);
      });

    if (!Array.isArray(t.priceChanges)) err(w, 'priceChanges 必须是数组（没有就写 []）');
    else {
      t.priceChanges.forEach((c: unknown, i: number) => {
        if (!obj(c)) return err(w, `priceChanges[${i}] 不是对象`);
        if (!realDate(c.date)) err(w, `priceChanges[${i}].date 必须是真实日期`);
        if (c.field !== 'strike' && c.field !== 'exit') err(w, `priceChanges[${i}].field 只能是 strike 或 exit`);
        if (c.from !== null && !price(c.from)) err(w, `priceChanges[${i}].from 必须是正数或 null`);
        if (c.from === null && !text(c.note)) err(w, `priceChanges[${i}] 旧价未知时必须写 note`);
        if (!price(c.to)) err(w, `priceChanges[${i}].to 必须是正数`);
        if (c.from === c.to) err(w, `priceChanges[${i}] 旧价和新价相同`);
        if (!text(c.reason)) err(w, `priceChanges[${i}] 调价必须写理由`);
        if (!text(c.source)) err(w, `priceChanges[${i}] 要写 source`);
      });
      // 每个字段最近一次调价的新价必须等于当前价：防止“改了价没留记录”或反过来。
      for (const field of ['strike', 'exit'] as const) {
        const list = (t.priceChanges as unknown[]).filter((c): c is Record<string, unknown> => obj(c) && c.field === field && realDate(c.date));
        if (list.length === 0) continue;
        const latest = list.reduce((a, b) => (String(b.date) > String(a.date) ? b : a));
        const current = field === 'strike' ? t.strikePrice : t.exitPrice;
        if (latest.to !== current)
          err(w, `${field === 'strike' ? '击球价' : '退出价'}是 ${String(current)}，但最近一条调价记录的新价是 ${String(latest.to)}`);
      }
    }
  }
  for (const id of sectorIds) if (!usedSectors.has(id)) err('meta/sectors.json', `板块 ${id} 下没有标的`);

  const noteIds = new Set<string>();
  if (!Array.isArray(raw.notes)) err('meta/notes.json', '必须是数组');
  else
    for (const n of raw.notes) {
      if (!obj(n) || !text(n.id) || !text(n.title) || !text(n.text) || !text(n.source)) err('meta/notes.json', '每条都要有 id、source、title、text');
      else noteIds.add(n.id);
    }
  for (const id of REQUIRED_NOTE_IDS) if (!noteIds.has(id)) err('meta/notes.json', `缺少必需的一条：${id}`);

  if (!Array.isArray(raw.exitLogic)) err('meta/exit-logic.json', '必须是数组');
  else {
    const ids = raw.exitLogic.map((e) => (obj(e) ? e.id : undefined));
    for (const id of EXIT_LOGIC_IDS) if (!ids.includes(id)) err('meta/exit-logic.json', `缺少类型 ${id}`);
    for (const e of raw.exitLogic) if (!obj(e) || !text(e.name) || !(e.text === null || text(e.text))) err('meta/exit-logic.json', '每种类型要有 name，text 为文字或 null');
  }

  if (!Array.isArray(raw.removed)) err('meta/removed.json', '必须是数组');
  else
    for (const r of raw.removed) {
      if (!obj(r) || !text(r.name) || !text(r.reason) || !text(r.source)) err('meta/removed.json', '每条都要有 name、reason、source');
      else if (r.removedOn !== null && !realDate(r.removedOn)) err('meta/removed.json', `${r.name} 的 removedOn 必须是真实日期或 null`);
    }

  if (!obj(raw.calendar) || !realDate(raw.calendar.asOf) || !Array.isArray(raw.calendar.items)) err('meta/calendar.json', '要有 asOf 和 items');
  else
    for (const item of raw.calendar.items) {
      if (!obj(item) || !text(item.text) || !Array.isArray(item.tickers)) err('meta/calendar.json', '每项要有 text 和 tickers');
      else for (const c of item.tickers) if (!seen.has(String(c))) err('meta/calendar.json', `“${item.text}” 引用了清单里没有的代码 ${String(c)}`);
    }

  if (!obj(raw.site) || !realDate(raw.site.contentUpdatedOn) || !text(raw.site.disclaimer)) err('meta/site.json', '要有 contentUpdatedOn 和 disclaimer');
  else {
    const excluded = Array.isArray(raw.site.excluded) ? raw.site.excluded : [];
    // 披露必须保留。
    if (!excluded.some((e) => obj(e) && e.ticker === 'ANT' && text(e.text))) err('meta/site.json', 'excluded 里必须保留 Anthropic（ANT）的利益冲突披露');
  }

  const updateDates = new Set<string>();
  for (const { file, data } of raw.updates) {
    const w = `updates/${file}`;
    if (!obj(data)) {
      err(w, '不是对象');
      continue;
    }
    if (!realDate(data.date) || file !== `${data.date}.json`) err(w, '文件名必须是 <date>.json，date 为真实日期');
    else updateDates.add(data.date);
    if (data.kind !== 'content' && data.kind !== 'platform') err(w, 'kind 只能是 content 或 platform');
    if (!text(data.title) || !text(data.text) || !text(data.origin)) err(w, '要有 title、origin、text');
    if (!Array.isArray(data.tickers)) err(w, 'tickers 必须是数组');
    else for (const c of data.tickers) if (!seen.has(String(c))) err(w, `引用了清单里没有的代码 ${String(c)}`);
  }
  // 每一次调价都要能在更新记录里找到同一天的一条。
  for (const { file, data } of raw.tickers) {
    if (!obj(data) || !Array.isArray(data.priceChanges)) continue;
    for (const c of data.priceChanges)
      if (obj(c) && realDate(c.date) && !updateDates.has(c.date)) err(`tickers/${file}`, `${c.date} 有调价，但 data/updates/ 里没有这一天的更新记录`);
  }

  return errors;
}

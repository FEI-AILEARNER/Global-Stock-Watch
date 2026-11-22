import type { ReactNode } from 'react';

import { RichText } from '@/components/rich-text';
import { GUIDANCE_LABEL, METRIC_LABEL, growth, money, ttm } from '@/lib/fundamentals';
import type { FItem, Fig, Fundamentals, MetricId } from '@/lib/fundamentals';
import { pct, zhDate } from '@/lib/format';

// 详情页上“估值相关信息”的各个区块（服务器端渲染）。估值口径要用实时价，在 valuation-panel.tsx。

export function sourceIndex(f: Fundamentals): Map<string, number> {
  return new Map(f.sources.map((s, i) => [s.id, i + 1]));
}

export function Ref({ f, id }: { f: Fundamentals; id?: string }) {
  if (!id) return null;
  const n = sourceIndex(f).get(id);
  if (!n) return null;
  return (
    <a href={`#src-${f.ticker}-${n}`} className="num ml-0.5 align-super text-[0.68rem] text-navy no-underline" title="看来源">
      [{n}]
    </a>
  );
}

export function FigText({ f, x, currency }: { f: Fundamentals; x: Fig | undefined; currency?: string }) {
  if (!x) return <span className="text-ink-soft">—</span>;
  if (x.value === null) return <span className="text-xs text-ink-soft" title={x.note}>未检索到</span>;
  return (
    <span>
      <span className="num">{formatFig(x, currency ?? f.currency)}</span>
      {x.calc && <span className="text-ink-soft" title={`计算：${x.calc}`}>*</span>}
      <Ref f={f} id={x.src} />
    </span>
  );
}

export function formatFig(x: Fig, currency: string): string {
  if (x.value === null) return '—';
  if (x.unit === '股') return `${(x.value / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}百万股`;
  if (x.unit === '%') return `${x.value}%`;
  if (x.unit === 'USD/ADR') return `US$${x.value.toFixed(2)}/ADR`;
  if (x.unit.endsWith('/股')) return `${x.value < 0 ? '−' : ''}${x.unit.startsWith('USD') ? '$' : `${x.unit.replace('/股', '')} `}${Math.abs(x.value).toFixed(2)}`;
  if (['USD', 'TWD', 'KRW', 'CAD'].includes(x.unit)) return money(x.value, x.unit);
  return `${x.value.toLocaleString('en-US')} ${x.unit}`;
}

function Section({ id, title, hint, children }: { id: string; title: string; hint?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="card px-4 py-4 sm:px-6 sm:py-5">
      <h2 id={id} className="font-serif text-xl font-semibold">
        {title} {hint && <span className="ml-1 font-sans text-xs font-normal text-ink-soft">{hint}</span>}
      </h2>
      {children}
    </section>
  );
}

function Items({ f, items }: { f: Fundamentals; items: FItem[] }) {
  return (
    <ul className="mt-2 space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="text-[0.92rem] leading-relaxed">
          <span className="font-semibold">{it.label}</span>
          {it.figure && (
            <>
              ：<FigText f={f} x={it.figure} />
              {it.figure.period && <span className="text-xs text-ink-soft">（{it.figure.period}）</span>}
            </>
          )}
          <span className="text-ink-soft">　</span>
          <RichText text={it.text} />
          <Ref f={f} id={it.src} />
        </li>
      ))}
    </ul>
  );
}

const v = (x: Fig | undefined) => (x && typeof x.value === 'number' ? x.value : null);

/** 财务快照：最近季度、近四季、最近财年，带同比。 */
export function SnapshotSection({ f }: { f: Fundamentals }) {
  const p = f.periods;
  const fl = f.flows;
  if (!p || !fl) {
    return (
      <Section id="snap-h" title="财务快照">
        <p className="mt-2 text-sm text-ink-soft">本轮未检索到结构化的财务数字。</p>
      </Section>
    );
  }
  const rows: { label: string; q: ReactNode; qg: number | null; t: ReactNode; y: ReactNode; yg: number | null; sub?: boolean }[] = [];
  const cur = f.currency;
  const metricRow = (m: MetricId, label = METRIC_LABEL[m]) => {
    const r = fl[m] ?? {};
    const t = ttm(f, m);
    rows.push({
      label,
      q: <FigText f={f} x={r.q} />,
      qg: m === 'epsDiluted' || m === 'dilutedShares' || m === 'capex' ? null : growth(v(r.q), v(r.qPrior)),
      t: m === 'epsDiluted' || m === 'dilutedShares' ? <span className="text-ink-soft">—</span> : t.value === null ? <span className="text-xs text-ink-soft" title={t.note}>算不出</span> : <span className="num" title={t.formula}>{money(t.value, cur)}</span>,
      y: <FigText f={f} x={r.fy} />,
      yg: m === 'epsDiluted' || m === 'dilutedShares' || m === 'capex' ? null : growth(v(r.fy), v(r.fyPrior)),
    });
  };
  const ratioRow = (label: string, num: MetricId, den: MetricId) => {
    const r = (slot: 'q' | 'fy') => {
      const a = v(fl[num]?.[slot]);
      const b = v(fl[den]?.[slot]);
      return a === null || b === null || b === 0 ? null : a / b;
    };
    const tn = ttm(f, num).value, td = ttm(f, den).value;
    const show = (x: number | null) => (x === null ? <span className="text-ink-soft">—</span> : <span className="num">{(x * 100).toFixed(1)}%</span>);
    rows.push({ label, q: show(r('q')), qg: null, t: show(tn === null || td === null || td === 0 ? null : tn / td), y: show(r('fy')), yg: null, sub: true });
  };
  const fcfRow = (label: string, minusSbc: boolean) => {
    const calc = (slot: 'q' | 'fy') => {
      const a = v(fl.ocf?.[slot]), b = v(fl.capex?.[slot]), c = v(fl.sbc?.[slot]);
      if (a === null || b === null || (minusSbc && c === null)) return null;
      return a - b - (minusSbc ? c! : 0);
    };
    const t = ttm(f, 'ocf').value, tc = ttm(f, 'capex').value, ts = ttm(f, 'sbc').value;
    const tv = t === null || tc === null || (minusSbc && ts === null) ? null : t - tc - (minusSbc ? ts! : 0);
    const show = (x: number | null) => (x === null ? <span className="text-xs text-ink-soft">算不出</span> : <span className="num">{money(x, cur)}</span>);
    rows.push({ label, q: show(calc('q')), qg: null, t: show(tv), y: show(calc('fy')), yg: null });
  };
  metricRow('revenue');
  metricRow('grossProfit');
  ratioRow('毛利率', 'grossProfit', 'revenue');
  metricRow('operatingIncome');
  ratioRow('营业利润率', 'operatingIncome', 'revenue');
  metricRow('netIncome');
  metricRow('epsDiluted');
  metricRow('ocf');
  metricRow('capex');
  fcfRow('自由现金流（经营现金流 − 资本开支）', false);
  metricRow('sbc');
  fcfRow('扣除股权激励后的自由现金流', true);
  metricRow('da');

  const g = (x: number | null) => (x === null ? '' : pct(x, 0));
  const ttmLabel = p.ytd ? `近四季` : `近四季（=${p.fy.label}）`;
  return (
    <Section id="snap-h" title="财务快照" hint={`公司财报原文的数字（${cur === 'USD' ? '美元' : cur}）；* 是相减得到的，点来源编号看出处`}>
      <p className="mt-2 text-xs text-ink-soft md:hidden">表格较宽，可左右滑动。</p>
      <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <table className="w-full min-w-[34rem] border-collapse text-[0.85rem]">
          <thead>
            <tr className="border-b border-rule text-left text-xs text-ink-soft">
              <th scope="col" className="py-1.5 pr-2 font-medium">项目</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">{p.q.label}<span className="block font-normal">截至 {p.q.end}</span></th>
              <th scope="col" className="px-1 py-1.5 text-right font-medium">同比</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">{ttmLabel}</th>
              <th scope="col" className="px-2 py-1.5 text-right font-medium">{p.fy.label}<span className="block font-normal">截至 {p.fy.end}</span></th>
              <th scope="col" className="py-1.5 pl-1 text-right font-medium">同比</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-rule-soft align-top">
                <th scope="row" className={`py-1.5 pr-2 text-left font-normal ${r.sub ? 'pl-3 text-ink-soft' : ''}`}>{r.label}</th>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">{r.q}</td>
                <td className="num px-1 py-1.5 text-right text-xs text-ink-soft">{g(r.qg)}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">{r.t}</td>
                <td className="whitespace-nowrap px-2 py-1.5 text-right">{r.y}</td>
                <td className="num py-1.5 pl-1 text-right text-xs text-ink-soft">{g(r.yg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <details className="mt-3 text-xs text-ink-soft">
        <summary className="text-navy">口径说明</summary>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>近四季 = {p.ytd ? `${p.fy.label}全年 + ${p.ytd.label} − ${p.ytdPrior?.label}` : `${p.fy.label}全年（最近一份是年报）`}。每股收益和股数不做这种加减。</li>
          <li>同比 = 本期 ÷ 上年同期 − 1；上年同期为负数或为零时不算。资本开支不算同比。</li>
          <li>自由现金流 = 经营现金流 − 资本开支（购置物业设备；不含收购）。股权激励是不付现金的费用，扣掉它看的是“如果用现金发工资”还剩多少。</li>
          <li>毛利率、营业利润率 = 毛利、营业利润 ÷ 营收。</li>
          {f.xbrl?.note && <li>{f.xbrl.note}</li>}
        </ul>
      </details>
    </Section>
  );
}

export function GuidanceSection({ f }: { f: Fundamentals }) {
  if (!f.guidance?.length) return null;
  return (
    <Section id="guide-h" title="公司指引" hint="公司自己给的；和上一次相比的方向按原文判断">
      <ul className="mt-2 space-y-2.5">
        {f.guidance.map((g, i) => (
          <li key={i} className="text-[0.92rem] leading-relaxed">
            <span className="chip mr-2 border border-edge text-xs">{GUIDANCE_LABEL[g.direction]}</span>
            <span className="font-semibold">{g.period}</span>：<RichText text={g.text} />
            {g.vsText && <span className="text-ink-soft">　{g.vsText}</span>}
            <Ref f={f} id={g.src} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function BusinessSection({ f }: { f: Fundamentals }) {
  const s = f.segments;
  if (!s && !f.orders?.length && !f.customers?.length) return null;
  return (
    <Section id="biz-h" title="业务结构和订单">
      {s && (
        <>
          <h3 className="mt-3 text-sm font-semibold">分部（{s.period}）<Ref f={f} id={s.src} /></h3>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <table className="mt-1 w-full min-w-[22rem] border-collapse text-[0.85rem]">
              <thead>
                <tr className="border-b border-rule text-left text-xs text-ink-soft">
                  <th scope="col" className="py-1.5 pr-2 font-medium">分部</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">收入</th>
                  <th scope="col" className="px-2 py-1.5 text-right font-medium">占比</th>
                  <th scope="col" className="py-1.5 pl-2 text-right font-medium">利润</th>
                </tr>
              </thead>
              <tbody>
                {s.rows.map((r) => {
                  const total = s.rows.reduce((a, x) => a + (v(x.revenue) ?? 0), 0);
                  const share = v(r.revenue) !== null && total > 0 ? v(r.revenue)! / total : null;
                  return (
                    <tr key={r.name} className="border-b border-rule-soft align-top">
                      <th scope="row" className="py-1.5 pr-2 text-left font-normal">{r.name}{r.note && <span className="block text-xs text-ink-soft">{r.note}</span>}</th>
                      <td className="px-2 py-1.5 text-right"><FigText f={f} x={r.revenue} /></td>
                      <td className="num px-2 py-1.5 text-right text-xs text-ink-soft">{share === null ? '' : `${(share * 100).toFixed(0)}%`}</td>
                      <td className="py-1.5 pl-2 text-right">{r.profit ? <FigText f={f} x={r.profit} /> : <span className="text-ink-soft">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {s.note && <p className="mt-1 text-xs text-ink-soft">{s.note}</p>}
        </>
      )}
      {f.orders && f.orders.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">在手订单、长约</h3>
          <Items f={f} items={f.orders} />
        </>
      )}
      {f.customers && f.customers.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">客户集中度</h3>
          <Items f={f} items={f.customers} />
        </>
      )}
    </Section>
  );
}

export function CapitalSection({ f }: { f: Fundamentals }) {
  const b = f.balance;
  const sh = f.shares;
  if (!b && !sh) return null;
  const cash = v(b?.cash), debt = v(b?.debt);
  const net = cash === null || debt === null ? null : debt - cash;
  const now = v(sh?.outstanding), ago = v(sh?.outstandingYearAgo);
  const bb = ttm(f, 'buybacks'), iss = ttm(f, 'issuance');
  return (
    <Section id="cap-h" title="股本和负债" hint={b ? `资产负债表日 ${b.date}` : undefined}>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 text-[0.9rem] sm:grid-cols-2">
        {b && (
          <>
            <Fact label="现金及短期投资" x={<FigText f={f} x={b.cash} />} detail={partsText(b.cash, f.currency)} />
            <Fact label="有息负债" x={<FigText f={f} x={b.debt} />} detail={partsText(b.debt, f.currency)} />
            <Fact
              label="净债务（有息负债 − 现金）"
              x={net === null ? <span className="text-xs text-ink-soft">算不出（现金或负债未检索到）</span> : <span className="num">{money(net, f.currency)}{net < 0 ? '（净现金）' : ''}</span>}
            />
          </>
        )}
        {sh && (
          <>
            <Fact label="已发行普通股" x={<FigText f={f} x={sh.outstanding} />} detail={sh.outstanding?.note} />
            <Fact
              label="一年来股数变化"
              x={now === null || ago === null ? <span className="text-xs text-ink-soft">算不出</span> : <span className="num">{pct(now / ago - 1, 1)}</span>}
              detail={sh.outstandingYearAgo ? (ago !== null ? `对比：${sh.outstandingYearAgo.note ?? ''}` : sh.outstandingYearAgo.note) : undefined}
            />
            {f.flows?.buybacks && (
            <Fact
              label="近四季回购／发行股票"
              x={
                <span className="num">
                  {bb.value === null ? '回购 —' : `回购 ${money(bb.value, f.currency)}`}　{iss.value === null ? '发行 —' : `发行 ${money(iss.value, f.currency)}`}
                </span>
              }
              detail="现金流量表口径；“—”是财报数字里没有这一项（多半是没有发生，未逐一核对原文）"
            />
            )}
          </>
        )}
      </dl>
      {b?.maturities && b.maturities.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">债务到期</h3>
          <Items f={f} items={b.maturities} />
        </>
      )}
      {sh?.dilutive && sh.dilutive.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">潜在稀释（可转债、认股权证、期权等）</h3>
          <Items f={f} items={sh.dilutive} />
        </>
      )}
    </Section>
  );
}

function partsText(x: Fig | undefined, cur: string): string | undefined {
  if (!x || x.value === null) return x?.note;
  const parts = x.parts?.map((p) => `${p.label} ${money(p.value, cur)}`).join(' + ');
  return [parts, x.note].filter(Boolean).join('；') || undefined;
}

function Fact({ label, x, detail }: { label: string; x: ReactNode; detail?: string }) {
  return (
    <div className="border-t border-rule-soft pt-2">
      <dt className="text-xs text-ink-soft">{label}</dt>
      <dd className="text-base">{x}</dd>
      {detail && <dd className="text-xs leading-snug text-ink-soft">{detail}</dd>}
    </div>
  );
}

export function GovernanceSection({ f }: { f: Fundamentals }) {
  if (!f.governance?.length) return null;
  return (
    <Section id="gov-h" title="治理和利益一致性">
      <Items f={f} items={f.governance} />
    </Section>
  );
}

export function RiskSection({ f }: { f: Fundamentals }) {
  if (!f.risks?.length) return null;
  return (
    <Section id="risk-h" title="风险因素" hint="公司自己在年报、季报或招股书里写的，只列与这家公司特别相关的几条；用自己的话概括">
      <ol className="mt-2 list-decimal space-y-2.5 pl-5">
        {f.risks.map((r, i) => (
          <li key={i} className="text-[0.92rem] leading-relaxed">
            <span className="font-semibold">{r.title}</span>　<RichText text={r.text} />
            <Ref f={f} id={r.src} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function ProspectusSection({ f }: { f: Fundamentals }) {
  const p = f.prospectus;
  if (!p) return null;
  const s = f.sources.find((x) => x.id === p.src);
  return (
    <Section id="pro-h" title="招股书研读" hint={`${s?.form ?? ''}${p.listedOn ? ` · 上市 ${zhDate(p.listedOn)}` : ''}；要点摘要，以原文为准`}>
      <dl className="mt-2 space-y-3">
        {p.items.map((x, i) => (
          <div key={i} className="border-t border-rule-soft pt-2">
            <dt className="text-sm font-semibold text-navy">{x.topic}</dt>
            <dd className="prose-note mt-0.5 text-[0.92rem]">
              <RichText text={x.text} />
              <Ref f={f} id={x.src} />
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function CheckpointSection({ f }: { f: Fundamentals }) {
  if (!f.checkpoints?.length) return null;
  return (
    <Section id="chk-h" title="什么情况下判断会变" hint="从已有的投资逻辑里整理出的、可以对着数字检查的条件；不是新的买卖观点">
      <ul className="mt-2 space-y-3">
        {f.checkpoints.map((c, i) => (
          <li key={i} className="border-t border-rule-soft pt-2 text-[0.92rem] leading-relaxed">
            <p><span className="font-semibold">{c.metric}</span>：{c.condition}</p>
            {c.latest && <p className="text-ink-soft">最近的数字：{c.latest}<Ref f={f} id={c.src} /></p>}
            <p className="text-xs text-ink-soft">出自：{c.basis}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function SourcesSection({ f }: { f: Fundamentals }) {
  return (
    <Section id="fsrc-h" title="估值信息的来源" hint={`核对于 ${zhDate(f.checkedOn)}`}>
      <ol className="mt-2 space-y-1.5 text-[0.85rem]">
        {f.sources.map((s, i) => (
          <li key={s.id} id={`src-${f.ticker}-${i + 1}`} className="scroll-mt-4 leading-snug">
            <span className="num mr-1 text-ink-soft">[{i + 1}]</span>
            {s.title ?? `${s.form}`}　<span className="text-ink-soft">{s.period}{s.filed ? `，${s.filed} 提交` : ''}</span>{' '}
            <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="link">原文 ↗</a>
            {s.xbrlUrl && (
              <>
                {' '}
                <a href={s.xbrlUrl} target="_blank" rel="noopener noreferrer nofollow" className="link text-xs">XBRL 数据 ↗</a>
              </>
            )}
            <span className="block text-xs text-ink-soft">
              {s.origin === 'xbrl' ? `数字由脚本从 SEC 的 XBRL 接口读取（${s.checkedOn}），即这份文件随附的结构化财务数据` : `${s.checkedOn} 打开原文录入`}
            </span>
          </li>
        ))}
      </ol>
      {f.gaps.length > 0 && (
        <>
          <h3 className="mt-4 text-sm font-semibold">本轮未检索到</h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-[0.85rem] text-ink-soft">
            {f.gaps.map((g, i) => <li key={i}>{g}</li>)}
          </ul>
        </>
      )}
    </Section>
  );
}

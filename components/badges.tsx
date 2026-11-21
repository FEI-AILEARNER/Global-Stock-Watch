import { pct } from '@/lib/format';
import { STANCE_META } from '@/lib/schema';
import type { StanceGroup } from '@/lib/schema';
import { ZONE_META } from '@/lib/zone';
import type { ZoneId } from '@/lib/zone';

const STANCE_CLASS: Record<StanceGroup, string> = {
  'in-zone': 'bg-go-bg text-go',
  watch: 'bg-amber-bg text-amber',
  wait: 'bg-wait-bg text-wait',
  avoid: 'bg-avoid-bg text-avoid',
  speculative: 'bg-spec-bg text-spec',
  exit: 'bg-go-bg/50 text-go',
};

/** 态度：原表的文字，加分类的符号和底色。 */
export function StanceBadge({ label, group }: { label: string; group: StanceGroup }) {
  const meta = STANCE_META[group];
  return (
    <span className={`chip ${STANCE_CLASS[group]}`} title={`态度分类：${meta.name}`}>
      <span aria-hidden="true">{meta.symbol}</span>
      <span>{label}</span>
      <span className="sr-only">（分类：{meta.name}）</span>
    </span>
  );
}

const ZONE_CLASS: Record<ZoneId, string> = {
  below: 'text-go',
  near: 'text-amber',
  mid: 'text-ink-soft',
  far: 'text-down',
  unknown: 'text-ink-soft',
};

/** 距击球区：符号 + 百分比 + 文字。 */
export function ZoneValue({ zone, value, stacked = true }: { zone: ZoneId; value: number | null; stacked?: boolean }) {
  const meta = ZONE_META[zone];
  return (
    <span className={`${ZONE_CLASS[zone]} ${stacked ? 'inline-flex flex-col items-end leading-tight' : 'inline-flex items-baseline gap-2'}`} title={meta.hint}>
      <span className="num whitespace-nowrap font-semibold">
        {value !== null && <span aria-hidden="true" className="mr-1 text-[0.8em]">{meta.symbol}</span>}
        {value === null ? '—' : pct(value, 1)}
      </span>
      <span className="whitespace-nowrap text-[0.72rem] font-normal">{meta.name}</span>
    </span>
  );
}

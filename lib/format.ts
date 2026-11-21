export function usd(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const digits = Math.abs(value) < 10 || !Number.isInteger(value) ? 2 : 0;
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
}

/** 0.123 → “+12.3%”；用真正的减号。 */
export function pct(value: number | null | undefined, digits = 1): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  const n = value * 100;
  const body = Math.abs(n).toFixed(digits);
  if (Number(body) === 0) return `0${digits ? `.${'0'.repeat(digits)}` : ''}%`;
  return `${n > 0 ? '+' : '−'}${body}%`;
}

/** 市值，单位美元 → “$1.23T / $456.7B / $890M”。 */
export function marketCap(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return '—';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  return `$${(value / 1e6).toFixed(0)}M`;
}

/** “2026-11-19” → “2026年11月19日”；“2026-11” → “2026年11月”。 */
export function zhDate(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value);
  if (!m) return value;
  return `${m[1]}年${Number(m[2])}月${m[3] ? `${Number(m[3])}日` : ''}`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${Number(m[2])}/${Number(m[3])}` : value;
}

// 距击球区 =（现价 − 击球价）÷ 击球价，与原表 G 列一致。
// 原表 G 列是一条绿—黄—红的渐变色，没有写明分界；下面的分界是 Agent 4 定的（待 Fei 认可），
// 参照原表 A46：把 +2%（AVGO）、约+5%（BWXT）、约+15%（XE）都叫“接近”。

export type ZoneId = 'below' | 'near' | 'mid' | 'far' | 'unknown';

export const NEAR_LIMIT = 0.15;
export const MID_LIMIT = 0.4;

export const ZONE_META: Record<ZoneId, { name: string; symbol: string; hint: string }> = {
  below: { name: '已在击球价下方', symbol: '▼', hint: '现价 ≤ 击球价' },
  near: { name: '接近', symbol: '◆', hint: '高于击球价不超过 15%' },
  mid: { name: '中等', symbol: '■', hint: '高于击球价 15% 至 40%' },
  far: { name: '远高于', symbol: '▲', hint: '高于击球价超过 40%' },
  unknown: { name: '没有价格', symbol: '—', hint: '没有实时价，也没有记录过的价格' },
};

export function distance(price: number | null | undefined, strike: number): number | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || !(strike > 0)) return null;
  return (price - strike) / strike;
}

export function zoneOf(d: number | null): ZoneId {
  if (d === null) return 'unknown';
  if (d <= 0) return 'below';
  if (d <= NEAR_LIMIT) return 'near';
  if (d <= MID_LIMIT) return 'mid';
  return 'far';
}

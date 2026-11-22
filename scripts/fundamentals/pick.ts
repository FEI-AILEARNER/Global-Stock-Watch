// sec-xbrl.ts 用到的纯函数，单独放出来以便测试。

export type ShareFact = { end: string; val: number; accn: string };

export function addDays(date: string, n: number): string {
  return new Date(Date.parse(date) + n * 86400000).toISOString().slice(0, 10);
}

/**
 * 找“大约一年前”的封面股数：结束日落在 refDate 之前 300 到 400 天之间、离 365 天最近的一期。
 * 多类股份的公司 XBRL 封面数据常会中断几年；没有下限时会拿到几年前的数字（2026-11-22 审核发现的 LEU、LUNR 错误）。
 * 找不到就返回空数组，由调用方写“本轮未检索到”。同一天、同一文件的多条（多类股份）一起返回。
 */
export function pickYearAgo(facts: ShareFact[], refDate: string): ShareFact[] {
  const lo = addDays(refDate, -400);
  const hi = addDays(refDate, -300);
  const inWindow = facts.filter((f) => f.end >= lo && f.end <= hi);
  if (inWindow.length === 0) return [];
  const target = Date.parse(addDays(refDate, -365));
  const best = inWindow.reduce((a, b) => (Math.abs(Date.parse(b.end) - target) < Math.abs(Date.parse(a.end) - target) ? b : a));
  return inWindow.filter((f) => f.end === best.end && f.accn === best.accn);
}

import type { AppSettings, Trade } from '../db/types';
import { weekdayOf } from './dates';
import { isAgainstBias, isRuleBreak, tradePnl } from './trade';

export interface Stats {
  count: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;
  totalPnl: number;
  avgWin: number;
  avgLoss: number;
  avgR: number | null;
  totalR: number;
  expectancy: number; // $ per trade
  expectancyR: number | null;
  profitFactor: number;
  maxDrawdown: number;
  curStreak: { kind: 'W' | 'L' | null; n: number };
  bestStreak: number;
  worstStreak: number;
}

/** trades must be sorted ascending by date */
export function computeStats(trades: Trade[], accountIds?: string[] | null): Stats {
  const pnls = trades.map((t) => tradePnl(t, accountIds));
  const wins = trades.filter((t) => t.outcome === 'Win').length;
  const losses = trades.filter((t) => t.outcome === 'Loss').length;
  const be = trades.filter((t) => t.outcome === 'BE').length;
  const grossWin = pnls.filter((p) => p > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnls.filter((p) => p < 0).reduce((a, b) => a + b, 0));
  const winPnls = pnls.filter((p) => p > 0);
  const lossPnls = pnls.filter((p) => p < 0);
  const rs = trades.map((t) => t.realizedR).filter((r): r is number => r != null);
  const totalPnl = pnls.reduce((a, b) => a + b, 0);

  let peak = 0, eq = 0, maxDD = 0;
  for (const p of pnls) {
    eq += p;
    peak = Math.max(peak, eq);
    maxDD = Math.max(maxDD, peak - eq);
  }

  let best = 0, worst = 0, run = 0, kind: 'W' | 'L' | null = null;
  for (const t of trades) {
    if (t.outcome === 'BE' || !t.outcome) continue;
    const k = t.outcome === 'Win' ? 'W' : 'L';
    if (k === kind) run++; else { kind = k; run = 1; }
    if (k === 'W') best = Math.max(best, run); else worst = Math.max(worst, run);
  }

  const decided = wins + losses;
  return {
    count: trades.length,
    wins, losses, be,
    winRate: decided ? wins / decided : 0,
    totalPnl,
    avgWin: winPnls.length ? grossWin / winPnls.length : 0,
    avgLoss: lossPnls.length ? -grossLoss / lossPnls.length : 0,
    avgR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    totalR: rs.reduce((a, b) => a + b, 0),
    expectancy: trades.length ? totalPnl / trades.length : 0,
    expectancyR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    profitFactor: grossLoss ? grossWin / grossLoss : grossWin ? Infinity : 0,
    maxDrawdown: maxDD,
    curStreak: { kind, n: kind ? run : 0 },
    bestStreak: best,
    worstStreak: worst,
  };
}

export interface GroupRow {
  key: string;
  label: string;
  count: number;
  winRate: number;
  avgR: number | null;
  pnl: number;
}

export function groupBy(
  trades: Trade[],
  keyFn: (t: Trade) => string | string[],
  accountIds?: string[] | null,
  labelFn: (k: string) => string = (k) => k,
): GroupRow[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const ks = keyFn(t);
    for (const k of Array.isArray(ks) ? ks : [ks]) {
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(t);
    }
  }
  return [...map.entries()].map(([k, ts]) => {
    const s = computeStats(ts, accountIds);
    return { key: k, label: labelFn(k), count: s.count, winRate: s.winRate, avgR: s.avgR, pnl: s.totalPnl };
  });
}

export const comboKey = (t: Trade, s: AppSettings) => {
  const order = s.confluences.map((c) => c.id);
  const ids = [...t.confluences].filter((id) => order.includes(id)).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return ids.length ? ids.join('+') : '(none)';
};

export function breakdowns(trades: Trade[], s: AppSettings, accountIds?: string[] | null) {
  const tagName = (id: string) =>
    s.confluences.find((c) => c.id === id)?.name ?? s.emotionTags.find((c) => c.id === id)?.name ?? id;
  const comboLabel = (k: string) => (k === '(none)' ? 'No confluences' : k.split('+').map(tagName).join(' + '));
  const dayOrder = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return {
    combos: groupBy(trades, (t) => comboKey(t, s), accountIds, comboLabel).sort((a, b) => b.count - a.count || b.pnl - a.pnl),
    confluence: groupBy(trades, (t) => t.confluences, accountIds, tagName).sort((a, b) => b.pnl - a.pnl),
    session: groupBy(trades, (t) => t.session, accountIds),
    weekday: groupBy(trades, (t) => weekdayOf(t.date), accountIds).sort((a, b) => dayOrder.indexOf(a.key) - dayOrder.indexOf(b.key)),
    emotion: groupBy(trades, (t) => (t.emotions.length ? t.emotions : ['(none)']), accountIds, (k) => (k === '(none)' ? 'Untagged' : tagName(k))).sort((a, b) => b.count - a.count),
    bias: groupBy(trades, (t) => (isAgainstBias(t) ? 'Against bias' : 'With bias'), accountIds),
    rules: groupBy(trades, (t) => (isRuleBreak(t, s) ? 'Rule break' : 'Clean'), accountIds),
  };
}

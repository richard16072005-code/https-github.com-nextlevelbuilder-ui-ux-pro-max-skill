import type { Account, Payout, Trade } from '../db/types';

export interface AccountState {
  balance: number;
  pnl: number;
  paidOut: number;
  threshold: number; // liquidation level
  buffer: number; // balance - threshold
  bufferPct: number; // buffer / maxLoss (0..1+)
  peak: number;
  tradeCount: number;
  warning: 'ok' | 'near' | 'breached';
}

export function accountState(a: Account, trades: Trade[], payouts: Payout[]): AccountState {
  const entries = trades
    .flatMap((t) => t.accounts.filter((x) => x.accountId === a.id).map((x) => ({ date: t.date, pnl: Number(x.pnl) || 0 })))
    .sort((x, y) => x.date.localeCompare(y.date));
  const paid = payouts.filter((p) => p.accountId === a.id);
  const paidOut = paid.reduce((s, p) => s + p.amount, 0);

  // Walk day by day; EOD peaks drive trailing drawdown.
  const byDay = new Map<string, number>();
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.pnl);
  for (const p of paid) byDay.set(p.date, (byDay.get(p.date) ?? 0) - p.amount);
  let bal = a.size, peak = a.size;
  for (const d of [...byDay.keys()].sort()) {
    bal += byDay.get(d)!;
    peak = Math.max(peak, bal);
  }
  const pnl = entries.reduce((s, e) => s + e.pnl, 0);
  const balance = a.size + pnl - paidOut;
  const threshold = a.drawdownType === 'Static'
    ? a.size - a.maxLoss
    : Math.min(peak - a.maxLoss, a.size); // trailing locks at starting balance
  const buffer = balance - threshold;
  const bufferPct = a.maxLoss ? buffer / a.maxLoss : 1;
  return {
    balance, pnl, paidOut, threshold, buffer, bufferPct, peak,
    tradeCount: entries.length,
    warning: buffer <= 0 ? 'breached' : bufferPct < 0.3 ? 'near' : 'ok',
  };
}

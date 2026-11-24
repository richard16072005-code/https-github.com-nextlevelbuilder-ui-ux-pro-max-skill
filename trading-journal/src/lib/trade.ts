import type { AppSettings, Trade } from '../db/types';

export const tradePnl = (t: Trade, accountIds?: string[] | null) =>
  t.accounts
    .filter((a) => !accountIds || accountIds.length === 0 || accountIds.includes(a.accountId))
    .reduce((s, a) => s + (Number(a.pnl) || 0), 0);

export const isRuleBreak = (t: Trade, s: AppSettings) =>
  s.checklist.some((c) => !t.checklist?.[c.id]);

export const brokenRules = (t: Trade, s: AppSettings) =>
  s.checklist.filter((c) => !t.checklist?.[c.id]);

export const isAgainstBias = (t: Trade) =>
  t.checklist?.bias === false || t.checklist?.bias === undefined || t.behaviours.includes('b-against-bias');

export const tradeTitle = (t: Trade) =>
  `${t.instrument} ${t.position}`;

/** Plain text of the journal for search. */
export const htmlText = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

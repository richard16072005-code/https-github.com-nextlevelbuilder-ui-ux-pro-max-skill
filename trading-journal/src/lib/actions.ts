import { db, getSettings, JOURNAL_TEMPLATE, patchSettings, uid } from '../db/db';
import type { Outlook, Trade } from '../db/types';
import { todayISO } from './dates';

export async function createTrade(over: Partial<Trade> = {}): Promise<string> {
  const s = await getSettings();
  const accounts = await db.accounts.toArray();
  const active = new Set(accounts.map((a) => a.id));
  const last = s.lastAccounts.filter((id) => active.has(id));
  const now = Date.now();
  const id = uid();
  const t: Trade = {
    id,
    date: todayISO(),
    time: new Date().toTimeString().slice(0, 5),
    session: 'NY AM',
    instrument: s.instruments[0] ?? 'MNQ',
    position: 'Long',
    accounts: last.map((accountId) => ({ accountId, contracts: 1, pnl: 0 })),
    riskPct: 1,
    plannedRR: 2,
    realizedR: null,
    entry: null, stop: null, target: null,
    outcome: null,
    confluences: [],
    checklist: {},
    journal: JOURNAL_TEMPLATE,
    moodPre: null, moodDuring: null, moodPost: null,
    emotions: [], behaviours: [],
    createdAt: now, updatedAt: now,
    ...over,
  };
  await db.trades.add(t);
  if (t.accounts.length) await patchSettings({ lastAccounts: t.accounts.map((a) => a.accountId) });
  return id;
}

export async function updateTrade(id: string, patch: Partial<Trade>) {
  await db.trades.update(id, { ...patch, updatedAt: Date.now() });
  if (patch.accounts) await patchSettings({ lastAccounts: patch.accounts.map((a) => a.accountId) });
}

export function blankOutlook(date: string, instruments: string[]): Outlook {
  return {
    id: date, date,
    biases: instruments.slice(0, 2).map((instrument) => ({ instrument, bias: null, reasoning: '' })),
    keyLevels: '', drawOnLiquidity: '', news: [], notes: '',
    sleep: null, stress: null, mood: null, go: null, goReason: '',
    followedBias: null, learned: '', walkedAway: false,
    updatedAt: Date.now(),
  };
}

export async function ensureOutlook(date: string) {
  const existing = await db.outlooks.get(date);
  if (existing) return existing;
  const s = await getSettings();
  const o = blankOutlook(date, s.instruments.filter((i) => ['NQ', 'ES'].includes(i)).length ? ['NQ', 'ES'] : s.instruments);
  await db.outlooks.put(o);
  return o;
}

import Dexie, { type Table } from 'dexie';
import type {
  Account, AppSettings, Expense, Outlook, Payout, StoredImage, Trade,
} from './types';

export class JournalDB extends Dexie {
  trades!: Table<Trade, string>;
  images!: Table<StoredImage, string>;
  outlooks!: Table<Outlook, string>;
  accounts!: Table<Account, string>;
  expenses!: Table<Expense, string>;
  payouts!: Table<Payout, string>;
  settings!: Table<AppSettings, string>;

  constructor() {
    super('ledger-trading-journal');
    this.version(1).stores({
      trades: 'id, date, instrument, session, outcome, updatedAt',
      images: 'id, [ownerType+ownerId], ownerId, slot',
      outlooks: 'id, date',
      accounts: 'id, firm, status, type',
      expenses: 'id, date, firm',
      payouts: 'id, date, firm, accountId',
      settings: 'id',
    });
  }
}

export const db = new JournalDB();

export const uid = () =>
  (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36));

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  currency: 'USD',
  instruments: ['MNQ', 'NQ', 'ES', 'MES'],
  confluences: [
    { id: 'c-4hfvg', name: '4H FVG', color: 'blue' },
    { id: 'c-1hfvg', name: '1H FVG', color: 'purple' },
    { id: 'c-15fvg', name: '15m FVG', color: 'green' },
    { id: 'c-15smt', name: '15M FVG SMT', color: 'orange' },
    { id: 'c-htfsmt', name: 'HTF SMT', color: 'pink' },
    { id: 'c-cisd', name: 'CISD', color: 'red' },
    { id: 'c-ifvg', name: 'IFVG', color: 'yellow' },
    { id: 'c-amd', name: 'AMD', color: 'brown' },
    { id: 'c-sweep', name: 'Liquidity Sweep', color: 'blue' },
    { id: 'c-pd', name: 'Premium/Discount', color: 'gray' },
    { id: 'c-disp', name: 'Displacement', color: 'purple' },
  ],
  emotionTags: [
    { id: 'e-calm', name: 'Calm', color: 'green' },
    { id: 'e-confident', name: 'Confident', color: 'blue' },
    { id: 'e-anxious', name: 'Anxious', color: 'yellow' },
    { id: 'e-fomo', name: 'FOMO', color: 'orange' },
    { id: 'e-revenge', name: 'Revenge', color: 'red' },
    { id: 'e-impatient', name: 'Impatient', color: 'pink' },
    { id: 'e-bored', name: 'Bored', color: 'gray' },
    { id: 'e-tilted', name: 'Tilted', color: 'purple' },
  ],
  checklist: [
    { id: 'bias', label: 'Daily bias aligned?' },
    { id: 'ifvg', label: '3m/LTF IFVG inverted?' },
    { id: 'displacement', label: 'Displacement confirmed (not entering in consolidation)?' },
    { id: 'htf', label: 'HTF level rejected (closed, not just tagged)?' },
    { id: 'smt', label: 'SMT divergence actually visible?' },
  ],
  behaviours: [
    { id: 'b-be-early', label: 'Moved stop to BE early' },
    { id: 'b-early-exit', label: 'Exited before target' },
    { id: 'b-against-bias', label: 'Took it against bias' },
    { id: 'b-overtraded', label: 'Overtraded' },
    { id: 'b-plan', label: 'Followed plan', positive: true },
  ],
  lastAccounts: [],
  seeded: false,
};

export const JOURNAL_TEMPLATE = [
  'Bias + Reasoning', 'Setup', 'Entry', 'Result', 'What I Did Right', 'Mistake', 'Lesson',
].map((h) => `<h2>${h}</h2><p></p>`).join('');

export async function getSettings(): Promise<AppSettings> {
  const s = await db.settings.get('app');
  return s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
}

export async function patchSettings(patch: Partial<AppSettings>) {
  const s = await getSettings();
  await db.settings.put({ ...s, ...patch, id: 'app' });
}

export async function deleteTrade(id: string) {
  await db.transaction('rw', db.trades, db.images, async () => {
    await db.images.where({ ownerType: 'trade', ownerId: id }).delete();
    await db.trades.delete(id);
  });
}

export async function duplicateTrade(id: string): Promise<string | null> {
  const t = await db.trades.get(id);
  if (!t) return null;
  const nid = uid();
  const now = Date.now();
  await db.trades.add({ ...t, id: nid, isDemo: false, createdAt: now, updatedAt: now });
  return nid;
}

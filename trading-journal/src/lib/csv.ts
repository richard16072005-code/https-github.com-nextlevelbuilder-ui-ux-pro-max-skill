import type { Account, AppSettings, Trade } from '../db/types';
import { htmlText, isRuleBreak, tradePnl } from './trade';

const esc = (v: unknown) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function tradesToCsv(trades: Trade[], s: AppSettings, accounts: Account[]) {
  const name = (id: string, list: { id: string; name: string }[]) => list.find((x) => x.id === id)?.name ?? id;
  const acc = (id: string) => { const a = accounts.find((x) => x.id === id); return a ? `${a.firm} ${a.name}` : id; };
  const header = [
    'Date', 'Time', 'Session', 'Instrument', 'Position', 'Outcome', 'Total PnL', 'Accounts',
    'Risk %', 'Planned RR', 'Realised R', 'Entry', 'Stop', 'Target', 'Confluences', 'Rule break',
    ...s.checklist.map((c) => c.label), 'Mood pre', 'Mood during', 'Mood post', 'Emotions', 'Behaviours', 'Journal',
  ];
  const rows = trades.map((t) => [
    t.date, t.time ?? '', t.session, t.instrument, t.position, t.outcome ?? '', tradePnl(t).toFixed(2),
    t.accounts.map((a) => `${acc(a.accountId)} (${a.contracts}x: ${a.pnl})`).join('; '),
    t.riskPct ?? '', t.plannedRR ?? '', t.realizedR ?? '', t.entry ?? '', t.stop ?? '', t.target ?? '',
    t.confluences.map((id) => name(id, s.confluences)).join('; '),
    isRuleBreak(t, s) ? 'Yes' : 'No',
    ...s.checklist.map((c) => (t.checklist?.[c.id] ? 'Yes' : 'No')),
    t.moodPre ?? '', t.moodDuring ?? '', t.moodPost ?? '',
    t.emotions.map((id) => name(id, s.emotionTags)).join('; '),
    t.behaviours.map((id) => s.behaviours.find((b) => b.id === id)?.label ?? id).join('; '),
    htmlText(t.journal),
  ]);
  return [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
}

export function download(name: string, data: Blob | string, type = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

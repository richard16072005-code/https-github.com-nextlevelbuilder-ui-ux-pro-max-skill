import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import type { Outcome, Position, Session, TradeAccountEntry } from '../db/types';
import { OUTCOMES, SESSIONS } from '../db/types';
import { createTrade } from '../lib/actions';
import { todayISO } from '../lib/dates';
import { useSettings } from '../lib/hooks';
import { Button, Checkbox, cx, inputCls, Kbd, Modal, NumberField, Segmented, useToast } from './ui';

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  const accounts = useLiveQuery(() => db.accounts.toArray(), []) ?? [];
  const nav = useNavigate();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [session, setSession] = useState<Session>('NY AM');
  const [instrument, setInstrument] = useState('');
  const [position, setPosition] = useState<Position>('Long');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [r, setR] = useState<number | null>(null);
  const [entries, setEntries] = useState<TradeAccountEntry[]>([]);

  useEffect(() => {
    if (!open) return;
    setDate(todayISO());
    setSession('NY AM');
    setInstrument(s.instruments[0] ?? 'MNQ');
    setPosition('Long');
    setOutcome(null);
    setR(null);
    const ids = new Set(accounts.map((a) => a.id));
    setEntries(s.lastAccounts.filter((id) => ids.has(id)).map((accountId) => ({ accountId, contracts: 1, pnl: 0 })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const live = accounts.filter((a) => a.status === 'Active' || entries.some((e) => e.accountId === a.id));
  const toggleAcc = (id: string, on: boolean) =>
    setEntries((es) => (on ? [...es, { accountId: id, contracts: es[0]?.contracts ?? 1, pnl: es[0]?.pnl ?? 0 }] : es.filter((e) => e.accountId !== id)));
  const setEntry = (id: string, patch: Partial<TradeAccountEntry>) =>
    setEntries((es) => es.map((e) => (e.accountId === id ? { ...e, ...patch } : e)));

  const submit = async (openAfter: boolean) => {
    const id = await createTrade({ date, session, instrument, position, outcome, realizedR: r, accounts: entries });
    toast(`${instrument} ${position} logged`);
    onClose();
    if (openAfter) nav(`/trades/${id}`);
  };

  return (
    <Modal open={open} onClose={onClose} title={<span className="flex items-center gap-2">Quick add trade <Kbd>N</Kbd></span>} width={600}>
      <div
        className="space-y-4 p-5"
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(true); } }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] text-ink-3">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cx(inputCls, 'num bg-raised')} />
          </label>
          <div>
            <span className="mb-1 block text-[12px] text-ink-3">Session</span>
            <Segmented value={session} options={SESSIONS} onChange={setSession} className="w-full justify-between" />
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="mb-1 block text-[12px] text-ink-3">Instrument</span>
            <Segmented value={instrument} options={s.instruments} onChange={setInstrument} />
          </div>
          <div>
            <span className="mb-1 block text-[12px] text-ink-3">Position</span>
            <Segmented value={position} options={['Long', 'Short'] as const} onChange={setPosition}
              render={(o, a) => <span className={a ? (o === 'Long' ? 'text-[var(--tag-blue-fg)]' : 'text-[var(--tag-orange-fg)]') : ''}>{o}</span>} />
          </div>
          <div>
            <span className="mb-1 block text-[12px] text-ink-3">Outcome</span>
            <Segmented value={outcome} options={OUTCOMES} onChange={setOutcome}
              render={(o, a) => <span className={a ? (o === 'Win' ? 'text-win' : o === 'Loss' ? 'text-loss' : 'text-be') : ''}>{o}</span>} />
          </div>
          <div className="w-24">
            <span className="mb-1 block text-[12px] text-ink-3">Realised R</span>
            <NumberField value={r} onChange={setR} placeholder="0.0" className="[&_input]:bg-raised" />
          </div>
        </div>

        <div>
          <span className="mb-1 block text-[12px] text-ink-3">Accounts (copy the trade across several)</span>
          {live.length === 0 && <div className="rounded-md border border-dashed border-line-2 p-3 text-[13px] text-ink-3">No accounts yet. Add them in Accounts & Spend.</div>}
          <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {live.map((a) => {
              const e = entries.find((x) => x.accountId === a.id);
              return (
                <div key={a.id} className={cx('flex items-center gap-2 pr-2 transition-colors', e ? 'bg-raised' : 'bg-transparent')}>
                  <div className="min-w-0 flex-1"><Checkbox checked={!!e} onChange={(on) => toggleAcc(a.id, on)} label={<span><span className="text-ink-3">{a.firm} ·</span> {a.name}</span>} /></div>
                  {e && (
                    <>
                      <NumberField value={e.contracts} onChange={(v) => setEntry(a.id, { contracts: v ?? 0 })} className="w-16" suffix="ct" />
                      <NumberField value={e.pnl} onChange={(v) => setEntry(a.id, { pnl: v ?? 0 })} className="w-28" placeholder="$ PnL" />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="hidden text-[12px] text-ink-3 sm:block"><Kbd>⌘</Kbd> <Kbd>↵</Kbd> create & open</span>
          <div className="ml-auto flex gap-2">
            <Button onClick={() => submit(false)}>Create</Button>
            <Button variant="primary" onClick={() => submit(true)}>Create & open <ArrowRight size={14} /></Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

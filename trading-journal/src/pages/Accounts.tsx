import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  Button, confirmDialog, cx, Empty, IconButton, inputCls, Modal, NumberField, PageHeader, SectionTitle, Select, StatTile, TagPill, TextField, useToast,
} from '../components/ui';
import { db, uid } from '../db/db';
import type { Account, AccountStatus, AccountType, DrawdownType, Expense, Payout, TagColor } from '../db/types';
import { EXPENSE_CATEGORIES } from '../db/types';
import { accountState } from '../lib/accountState';
import { fmtDate, MONTHS, todayISO } from '../lib/dates';
import { money, pct, pnlClass } from '../lib/format';
import { useAccounts, useTrades } from '../lib/hooks';

const STATUS_COLOR: Record<AccountStatus, TagColor> = { Active: 'blue', Passed: 'green', Failed: 'red', Blown: 'red', 'Paid out': 'yellow' };
const TYPE_COLOR: Record<AccountType, TagColor> = { Eval: 'purple', Funded: 'green', Live: 'orange' };

export default function Accounts() {
  const accounts = useAccounts();
  const trades = useTrades();
  const expenses = useLiveQuery(() => db.expenses.orderBy('date').reverse().toArray(), []) ?? [];
  const payouts = useLiveQuery(() => db.payouts.orderBy('date').reverse().toArray(), []) ?? [];
  const [editing, setEditing] = useState<Account | null>(null);

  const spent = expenses.reduce((a, e) => a + e.amount, 0);
  const paid = payouts.reduce((a, p) => a + p.amount, 0);
  const funded = accounts.filter((a) => a.type === 'Funded' || a.type === 'Live' || a.status === 'Passed').length;
  const concluded = accounts.filter((a) => a.type !== 'Eval' || a.status !== 'Active').length;
  const passRate = concluded ? funded / concluded : null;

  const monthly = useMemo(() => {
    const m = new Map<string, { spent: number; paid: number }>();
    for (const e of expenses) { const k = e.date.slice(0, 7); m.set(k, { spent: (m.get(k)?.spent ?? 0) + e.amount, paid: m.get(k)?.paid ?? 0 }); }
    for (const p of payouts) { const k = p.date.slice(0, 7); m.set(k, { spent: m.get(k)?.spent ?? 0, paid: (m.get(k)?.paid ?? 0) + p.amount }); }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => ({ month: `${MONTHS[+k.slice(5) - 1].slice(0, 3)} ${k.slice(2, 4)}`, ...v }));
  }, [expenses, payouts]);

  const blank: Account = { id: '', firm: '', name: '', size: 50000, type: 'Eval', status: 'Active', startDate: todayISO(), maxLoss: 2000, drawdownType: 'Trailing EOD', dailyLossLimit: null, profitTarget: 3000, notes: '', createdAt: Date.now() };

  return (
    <div>
      <PageHeader eyebrow="Prop firm accounts & eval spend" title="Accounts & Spend" right={<Button variant="primary" onClick={() => setEditing(blank)}><Plus size={14} /> Account</Button>} />

      <section className="mb-10 grid grid-cols-2 gap-y-6 rounded-xl border border-line bg-surface px-5 py-4 md:grid-cols-5">
        <StatTile label="Total spent" value={money(spent)} sub={`${expenses.length} expenses`} tone={spent ? 'loss' : null} />
        <StatTile label="Total paid out" value={money(paid)} sub={`${payouts.length} payouts`} tone={paid ? 'win' : null} />
        <StatTile label="Net prop ROI" value={spent ? pct((paid - spent) / spent) : '—'} sub={money(paid - spent, { sign: true })} tone={paid - spent >= 0 ? 'win' : 'loss'} />
        <StatTile label="Cost / funded" value={funded ? money(spent / funded) : '—'} sub={`${funded} funded account${funded === 1 ? '' : 's'}`} />
        <StatTile label="Pass rate" value={pct(passRate)} sub={`${funded} of ${concluded} concluded`} />
      </section>

      <section>
        <SectionTitle>Accounts</SectionTitle>
        {accounts.length === 0 ? (
          <Empty title="No accounts yet" hint="Add your evals and funded accounts to track drawdown and copy trades across them." action={<Button variant="primary" onClick={() => setEditing(blank)}><Plus size={14} /> Add account</Button>} />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {[...accounts].sort((a, b) => Number(b.status === 'Active') - Number(a.status === 'Active') || a.name.localeCompare(b.name)).map((a) => {
              const st = accountState(a, trades, payouts);
              const fill = Math.max(0, Math.min(1, st.bufferPct));
              const dead = a.status === 'Failed' || a.status === 'Blown';
              return (
                <div key={a.id} className={cx('group rounded-xl border bg-surface p-4 transition-colors', st.warning === 'near' && !dead ? 'border-[#e9b44c55]' : st.warning === 'breached' && !dead ? 'border-[#ef7a6b66]' : 'border-line', dead && 'opacity-60')}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11.5px] uppercase tracking-[0.1em] text-ink-3">{a.firm}</div>
                      <div className="truncate text-[15.5px] font-semibold">{a.name}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        <TagPill name={a.type} color={TYPE_COLOR[a.type]} />
                        <TagPill name={a.status} color={STATUS_COLOR[a.status]} />
                        <TagPill name={`${money(a.size, { compact: true })}`} color="gray" />
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="num text-[20px] font-medium">{money(st.balance)}</div>
                      <div className={cx('num text-[12px]', pnlClass(st.pnl))}>{money(st.pnl, { sign: true })} · {st.tradeCount} trades</div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-[12px]">
                      <span className="text-ink-3">Distance to max loss</span>
                      <span className={cx('num flex items-center gap-1', st.warning === 'ok' ? 'text-ink-2' : st.warning === 'near' ? 'text-accent' : 'text-loss')}>
                        {st.warning !== 'ok' && !dead && <AlertTriangle size={12} />}
                        {money(st.buffer)} of {money(a.maxLoss)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[#1f1f1c]">
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${fill * 100}%`, background: st.warning === 'ok' ? '#45c2b5' : st.warning === 'near' ? '#e9b44c' : '#ef7a6b' }} />
                    </div>
                    <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-3">
                      <span className="num">Liquidation {money(st.threshold)}</span>
                      <span>{a.drawdownType}{a.dailyLossLimit ? ` · DLL ${money(a.dailyLossLimit)}` : ''}{a.profitTarget && a.type === 'Eval' ? ` · Target ${money(a.profitTarget)}` : ''}</span>
                    </div>
                    {st.warning === 'near' && !dead && <div className="mt-2 rounded-md bg-accent-dim px-2.5 py-1.5 text-[12px] text-accent">Within 30% of max loss. Size down or sit out.</div>}
                    {st.warning === 'breached' && !dead && <div className="mt-2 rounded-md bg-loss-dim px-2.5 py-1.5 text-[12px] text-loss">Max loss breached by these numbers. Check the account status.</div>}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-[11.5px] text-ink-3">
                    <span>Started {fmtDate(a.startDate)}{st.paidOut ? ` · ${money(st.paidOut)} paid out` : ''}</span>
                    <IconButton title="Edit account" onClick={() => setEditing(a)}><Pencil size={13} /></IconButton>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-10 rounded-xl border border-line bg-surface p-4 pb-2">
        <h3 className="mb-3 px-1 text-[13px] font-semibold">Spend vs payouts per month</h3>
        {monthly.length === 0 ? <div className="px-1 pb-3 text-[13px] text-ink-3">No ledger entries yet.</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthly} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barGap={2}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => money(v, { compact: true })} />
              <Tooltip cursor={{ fill: '#ffffff06' }} contentStyle={{ background: '#1d1d1b', border: '1px solid #34332e', borderRadius: 8, fontSize: 12.5 }} labelStyle={{ color: '#a9a497' }} formatter={(v: number, n: string) => [money(v), n === 'spent' ? 'Spent' : 'Paid out']} />
              <Legend iconType="circle" iconSize={8} formatter={(v) => <span className="text-[12px] text-ink-2">{v === 'spent' ? 'Spent' : 'Paid out'}</span>} />
              <Bar dataKey="spent" fill="#ef7a6b" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
              <Bar dataKey="paid" fill="#45c2b5" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <div className="mt-10 grid gap-10 xl:grid-cols-2">
        <ExpenseLedger expenses={expenses} firms={[...new Set(accounts.map((a) => a.firm))]} />
        <PayoutLedger payouts={payouts} accounts={accounts} />
      </div>

      {editing && <AccountForm account={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ExpenseLedger({ expenses, firms }: { expenses: Expense[]; firms: string[] }) {
  const total = expenses.reduce((a, e) => a + e.amount, 0);
  const add = () => db.expenses.add({ id: uid(), date: todayISO(), firm: firms[0] ?? '', category: 'Eval purchase', amount: 0, note: '' });
  return (
    <section>
      <SectionTitle right={<div className="flex items-center gap-3"><span className="num text-[12.5px] text-loss">{money(total)}</span><Button size="sm" variant="ghost" onClick={add}><Plus size={13} /> Expense</Button></div>}>Expense ledger</SectionTitle>
      <Ledger
        rows={expenses}
        empty="No expenses yet."
        cols="grid-cols-[132px_minmax(110px,1fr)_124px_80px_28px]"
        head={['Date', 'Firm · note', 'Category', 'Amount', '']}
        render={(e) => (
          <>
            <input type="date" value={e.date} onChange={(x) => x.target.value && db.expenses.update(e.id, { date: x.target.value })} className={cx(inputCls, 'num px-1 text-[12px]')} />
            <div className="min-w-0">
              <TextField value={e.firm} onChange={(firm) => db.expenses.update(e.id, { firm })} placeholder="Firm" className="h-7 font-medium" />
              <TextField value={e.note} onChange={(note) => db.expenses.update(e.id, { note })} placeholder="Note" className="h-6 text-[12px] text-ink-3" />
            </div>
            <Select value={e.category} options={EXPENSE_CATEGORIES} onChange={(category) => category && db.expenses.update(e.id, { category })} render={(v) => <span className="text-[12.5px]">{v}</span>} />
            <NumberField value={e.amount} onChange={(v) => db.expenses.update(e.id, { amount: v ?? 0 })} className="[&_input]:text-right" />
            <IconButton title="Delete" className="opacity-0 group-hover:opacity-100 hover:!text-loss" onClick={() => db.expenses.delete(e.id)}><Trash2 size={13} /></IconButton>
          </>
        )}
      />
    </section>
  );
}

function PayoutLedger({ payouts, accounts }: { payouts: Payout[]; accounts: Account[] }) {
  const total = payouts.reduce((a, e) => a + e.amount, 0);
  const funded = accounts.filter((a) => a.type !== 'Eval');
  const add = () => db.payouts.add({ id: uid(), date: todayISO(), firm: funded[0]?.firm ?? '', accountId: funded[0]?.id ?? null, amount: 0, note: '' });
  const ids = accounts.map((a) => a.id);
  return (
    <section>
      <SectionTitle right={<div className="flex items-center gap-3"><span className="num text-[12.5px] text-win">{money(total)}</span><Button size="sm" variant="ghost" onClick={add}><Plus size={13} /> Payout</Button></div>}>Payout ledger</SectionTitle>
      <Ledger
        rows={payouts}
        empty="No payouts yet. They’ll come."
        cols="grid-cols-[132px_minmax(110px,1fr)_140px_80px_28px]"
        head={['Date', 'Firm · note', 'Account', 'Amount', '']}
        render={(p) => (
          <>
            <input type="date" value={p.date} onChange={(x) => x.target.value && db.payouts.update(p.id, { date: x.target.value })} className={cx(inputCls, 'num px-1 text-[12px]')} />
            <div className="min-w-0">
              <TextField value={p.firm} onChange={(firm) => db.payouts.update(p.id, { firm })} placeholder="Firm" className="h-7 font-medium" />
              <TextField value={p.note} onChange={(note) => db.payouts.update(p.id, { note })} placeholder="Note" className="h-6 text-[12px] text-ink-3" />
            </div>
            <Select value={p.accountId} options={ids} onChange={(accountId) => db.payouts.update(p.id, { accountId, firm: accounts.find((a) => a.id === accountId)?.firm ?? p.firm })}
              render={(id) => <span className="truncate text-[12.5px]">{accounts.find((a) => a.id === id)?.name ?? '—'}</span>} />
            <NumberField value={p.amount} onChange={(v) => db.payouts.update(p.id, { amount: v ?? 0 })} className="[&_input]:text-right" />
            <IconButton title="Delete" className="opacity-0 group-hover:opacity-100 hover:!text-loss" onClick={() => db.payouts.delete(p.id)}><Trash2 size={13} /></IconButton>
          </>
        )}
      />
    </section>
  );
}

function Ledger<T extends { id: string }>({ rows, render, head, cols, empty }: { rows: T[]; render: (r: T) => React.ReactNode; head: string[]; cols: string; empty: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <div className="min-w-[520px]">
        <div className={cx('grid gap-2 border-b border-line bg-surface px-2 py-2 text-[11px] uppercase tracking-[0.08em] text-ink-3', cols)}>
          {head.map((h, i) => <span key={i} className={i === 3 ? 'text-right' : ''}>{h}</span>)}
        </div>
        {rows.length === 0 && <div className="px-3 py-4 text-[13px] text-ink-3">{empty}</div>}
        {rows.map((r) => <div key={r.id} className={cx('group grid items-center gap-2 border-b border-line px-2 py-1 last:border-b-0 hover:bg-[#151514]', cols)}>{render(r)}</div>)}
      </div>
    </div>
  );
}

function AccountForm({ account, onClose }: { account: Account; onClose: () => void }) {
  const [a, setA] = useState<Account>(account);
  const toast = useToast();
  const isNew = !account.id;
  const set = (p: Partial<Account>) => setA((x) => ({ ...x, ...p }));
  const save = async () => {
    if (!a.name.trim()) { toast('Give the account a name', 'err'); return; }
    await db.accounts.put({ ...a, id: a.id || uid() });
    toast(isNew ? 'Account added' : 'Account saved');
    onClose();
  };
  const field = (label: string, el: React.ReactNode) => <label className="block"><span className="mb-1 block text-[12px] text-ink-3">{label}</span>{el}</label>;
  const box = '[&_input]:bg-raised [&_input]:border [&_input]:border-line';
  return (
    <Modal open onClose={onClose} title={isNew ? 'New account' : 'Edit account'}>
      <div className="grid grid-cols-2 gap-3 p-5">
        {field('Prop firm', <input value={a.firm} onChange={(e) => set({ firm: e.target.value })} className={cx(inputCls, 'border border-line bg-raised')} placeholder="Lucid Trading" autoFocus />)}
        {field('Account name', <input value={a.name} onChange={(e) => set({ name: e.target.value })} className={cx(inputCls, 'border border-line bg-raised')} placeholder="Flex 50K #3" />)}
        {field('Size', <NumberField value={a.size} onChange={(v) => set({ size: v ?? 0 })} className={box} />)}
        {field('Start date', <input type="date" value={a.startDate} onChange={(e) => set({ startDate: e.target.value })} className={cx(inputCls, 'num border border-line bg-raised')} />)}
        {field('Type', <div className="rounded-md border border-line bg-raised"><Select value={a.type} options={['Eval', 'Funded', 'Live'] as const} onChange={(v) => v && set({ type: v })} render={(v) => <TagPill name={v} color={TYPE_COLOR[v]} />} /></div>)}
        {field('Status', <div className="rounded-md border border-line bg-raised"><Select value={a.status} options={['Active', 'Passed', 'Failed', 'Blown', 'Paid out'] as const} onChange={(v) => v && set({ status: v })} render={(v) => <TagPill name={v} color={STATUS_COLOR[v]} />} /></div>)}
        {field('Max loss / drawdown ($)', <NumberField value={a.maxLoss} onChange={(v) => set({ maxLoss: v ?? 0 })} className={box} />)}
        {field('Drawdown type', <div className="rounded-md border border-line bg-raised"><Select value={a.drawdownType} options={['Static', 'Trailing EOD', 'Trailing intraday'] as DrawdownType[]} onChange={(v) => v && set({ drawdownType: v })} /></div>)}
        {field('Daily loss limit ($)', <NumberField value={a.dailyLossLimit} onChange={(v) => set({ dailyLossLimit: v })} className={box} placeholder="None" />)}
        {field('Profit target ($)', <NumberField value={a.profitTarget} onChange={(v) => set({ profitTarget: v })} className={box} placeholder="None" />)}
        <div className="col-span-2">{field('Rules & notes', <textarea value={a.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} className={cx(inputCls, 'h-auto border border-line bg-raised py-1.5')} placeholder="Consistency rule, min. days, payout policy…" />)}</div>
      </div>
      <div className="flex items-center justify-between border-t border-line px-5 py-3">
        {!isNew ? (
          <Button variant="danger" size="sm" onClick={async () => { if (await confirmDialog('Delete this account? Trades keep their other accounts.', 'Delete account')) { await db.accounts.delete(a.id); onClose(); } }}><Trash2 size={13} /> Delete</Button>
        ) : <span />}
        <div className="flex gap-2"><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{isNew ? 'Add account' : 'Save'}</Button></div>
      </div>
    </Modal>
  );
}

import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft, Calendar, ChevronLeft, ChevronRight, Clock, Copy, Crosshair, Gauge, Hash, Layers, ListChecks, Percent,
  Plus, Shield, Sun, Target, Trash2, TrendingUp, Trophy, X,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImageSlots } from '../components/ImageSlots';
import { RichText } from '../components/RichText';
import {
  Button, Checkbox, cx, Empty, IconButton, inputCls, nextTagColor, NumberField, OutcomePill, PositionPill, PropRow,
  RuleBreakBadge, Scale, SectionTitle, Select, TagPill, TagSelect, useToast,
} from '../components/ui';
import { db, deleteTrade, duplicateTrade, patchSettings, uid } from '../db/db';
import type { Trade, TradeAccountEntry } from '../db/types';
import { OUTCOMES, SESSIONS } from '../db/types';
import { updateTrade } from '../lib/actions';
import { fmtDateLong } from '../lib/dates';
import { money, pnlClass, rr } from '../lib/format';
import { useAccounts, useSettings } from '../lib/hooks';
import { brokenRules, tradePnl } from '../lib/trade';

export default function TradePage() {
  const { id = '' } = useParams();
  const trade = useLiveQuery(() => db.trades.get(id), [id]);
  const neighbours = useLiveQuery(async () => {
    const all = await db.trades.orderBy('date').toArray();
    const i = all.findIndex((t) => t.id === id);
    return { prev: all[i - 1]?.id, next: all[i + 1]?.id };
  }, [id]);
  if (trade === undefined) return null;
  if (!trade) return <Empty title="Trade not found" hint="It may have been deleted." action={<Link to="/trades"><Button>Back to trades</Button></Link>} />;
  return <TradeDoc key={trade.id} trade={trade} prev={neighbours?.prev} next={neighbours?.next} />;
}

function TradeDoc({ trade: t, prev, next }: { trade: Trade; prev?: string; next?: string }) {
  const s = useSettings();
  const accounts = useAccounts();
  const nav = useNavigate();
  const toast = useToast();
  const set = (patch: Partial<Trade>) => updateTrade(t.id, patch);
  const pnl = tradePnl(t);
  const broken = brokenRules(t, s);
  const computedRR = useMemo(() => {
    if (t.entry == null || t.stop == null || t.target == null) return null;
    const risk = Math.abs(t.entry - t.stop);
    return risk ? Math.abs(t.target - t.entry) / risk : null;
  }, [t.entry, t.stop, t.target]);

  const createTag = (kind: 'confluences' | 'emotionTags') => async (name: string) => {
    const id = uid();
    await patchSettings({ [kind]: [...s[kind], { id, name, color: nextTagColor(s[kind]) }] });
    return id;
  };

  const setEntry = (accountId: string, patch: Partial<TradeAccountEntry>) =>
    set({ accounts: t.accounts.map((a) => (a.accountId === accountId ? { ...a, ...patch } : a)) });
  const unused = accounts.filter((a) => !t.accounts.some((x) => x.accountId === a.id));

  return (
    <article className="animate-fade-up">
      {/* top bar */}
      <div className="mb-8 flex items-center justify-between gap-2 text-[13px]">
        <div className="flex min-w-0 items-center gap-1.5 text-ink-3">
          <Link to="/trades" className="flex items-center gap-1 rounded-md px-1.5 py-1 hover:bg-hover hover:text-ink"><ArrowLeft size={14} /> Trades</Link>
          <span>/</span>
          <span className="truncate text-ink-2">{t.instrument} {t.position}</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton title="Previous trade" disabled={!prev} onClick={() => prev && nav(`/trades/${prev}`)} className="disabled:opacity-30"><ChevronLeft size={16} /></IconButton>
          <IconButton title="Next trade" disabled={!next} onClick={() => next && nav(`/trades/${next}`)} className="disabled:opacity-30"><ChevronRight size={16} /></IconButton>
          <span className="mx-1 h-4 w-px bg-line" />
          <IconButton title="Duplicate" onClick={async () => { const nid = await duplicateTrade(t.id); toast('Trade duplicated'); nid && nav(`/trades/${nid}`); }}><Copy size={15} /></IconButton>
          <IconButton title="Delete" className="hover:!text-loss" onClick={async () => { if (confirm('Delete this trade and its screenshots?')) { await deleteTrade(t.id); toast('Trade deleted'); nav('/trades'); } }}><Trash2 size={15} /></IconButton>
        </div>
      </div>

      {/* title */}
      <header className="mb-8">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <OutcomePill outcome={t.outcome} />
          {broken.length > 0 ? <RuleBreakBadge /> : t.outcome && <TagPill name="Clean execution" color="green" />}
          {t.isDemo && <TagPill name="Demo" color="gray" />}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h1 className="display text-[48px] leading-[0.95] sm:text-[60px]">
            {t.instrument} <span className={t.position === 'Long' ? 'text-[var(--tag-blue-fg)]' : 'text-[var(--tag-orange-fg)]'}>{t.position}</span>
          </h1>
          <div className="text-right">
            <div className={cx('num text-[34px] font-medium leading-none', pnlClass(pnl))}>{money(pnl, { sign: true })}</div>
            <div className="num mt-1.5 text-[13px] text-ink-3">{rr(t.realizedR)} · {t.accounts.length} account{t.accounts.length === 1 ? '' : 's'}</div>
          </div>
        </div>
        <div className="mt-3 text-[14px] text-ink-3">
          {fmtDateLong(t.date)} · {t.session}
          {' · '}
          <Link to={`/outlook/${t.date}`} className="inline-flex items-center gap-1 text-ink-2 underline decoration-line-2 underline-offset-4 hover:text-accent hover:decoration-accent"><Sun size={13} /> Day outlook</Link>
        </div>
      </header>

      {/* properties */}
      <section className="grid gap-x-10 gap-y-0.5 border-y border-line py-4 lg:grid-cols-2">
        <div className="space-y-0.5">
          <PropRow icon={<Calendar size={14} />} label="Date">
            <input type="date" value={t.date} onChange={(e) => e.target.value && set({ date: e.target.value })} className={cx(inputCls, 'num w-auto')} />
          </PropRow>
          <PropRow icon={<Clock size={14} />} label="Time">
            <input type="time" value={t.time ?? ''} onChange={(e) => set({ time: e.target.value })} className={cx(inputCls, 'num w-auto')} />
          </PropRow>
          <PropRow icon={<Sun size={14} />} label="Session">
            <Select value={t.session} options={SESSIONS} onChange={(v) => v && set({ session: v })} render={(v) => <TagPill name={v} color={v === 'NY AM' ? 'yellow' : v === 'NY PM' ? 'orange' : v === 'London' ? 'blue' : 'purple'} />} />
          </PropRow>
          <PropRow icon={<Hash size={14} />} label="Instrument">
            <Select value={t.instrument} options={s.instruments.includes(t.instrument) ? s.instruments : [...s.instruments, t.instrument]} onChange={(v) => v && set({ instrument: v })} render={(v) => <span className="num font-medium">{v}</span>} />
          </PropRow>
          <PropRow icon={<TrendingUp size={14} />} label="Position">
            <Select value={t.position} options={['Long', 'Short'] as const} onChange={(v) => v && set({ position: v })} render={(v) => <PositionPill position={v} />} />
          </PropRow>
          <PropRow icon={<Trophy size={14} />} label="Outcome">
            <Select value={t.outcome} options={OUTCOMES} onChange={(v) => set({ outcome: v })} render={(v) => <OutcomePill outcome={v} />} />
          </PropRow>
        </div>
        <div className="space-y-0.5">
          <PropRow icon={<Percent size={14} />} label="Risk %"><NumberField value={t.riskPct} onChange={(v) => set({ riskPct: v })} suffix="%" /></PropRow>
          <PropRow icon={<Gauge size={14} />} label="Planned R:R">
            <div className="flex items-center">
              <NumberField value={t.plannedRR} onChange={(v) => set({ plannedRR: v })} suffix="R" className="flex-1" />
              {computedRR != null && Math.abs(computedRR - (t.plannedRR ?? 0)) > 0.05 && (
                <button onClick={() => set({ plannedRR: +computedRR.toFixed(2) })} className="num ml-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11.5px] text-accent hover:bg-accent-dim" title="Use R:R computed from entry/stop/target">
                  use {computedRR.toFixed(2)}R
                </button>
              )}
            </div>
          </PropRow>
          <PropRow icon={<Target size={14} />} label="Realised R"><NumberField value={t.realizedR} onChange={(v) => set({ realizedR: v })} suffix="R" /></PropRow>
          <PropRow icon={<Crosshair size={14} />} label="Entry"><NumberField value={t.entry} onChange={(v) => set({ entry: v })} /></PropRow>
          <PropRow icon={<Shield size={14} />} label="Stop"><NumberField value={t.stop} onChange={(v) => set({ stop: v })} /></PropRow>
          <PropRow icon={<Target size={14} />} label="Target"><NumberField value={t.target} onChange={(v) => set({ target: v })} /></PropRow>
        </div>
        <PropRow icon={<Layers size={14} />} label="Entry confluences" className="lg:col-span-2">
          <TagSelect value={t.confluences} tags={s.confluences} onChange={(confluences) => set({ confluences })} onCreate={createTag('confluences')} />
        </PropRow>
      </section>

      {/* accounts */}
      <section className="mt-10">
        <SectionTitle right={<span className={cx('num text-[13px]', pnlClass(pnl))}>Total {money(pnl, { sign: true })}</span>}>Accounts</SectionTitle>
        <div className="overflow-hidden rounded-lg border border-line">
          <div className="grid grid-cols-[1fr_90px_130px_36px] gap-2 border-b border-line bg-surface px-3 py-2 text-[11.5px] uppercase tracking-[0.08em] text-ink-3">
            <span>Account</span><span>Contracts</span><span>PnL</span><span />
          </div>
          {t.accounts.length === 0 && <div className="px-3 py-4 text-[13px] text-ink-3">Not linked to any account yet.</div>}
          {t.accounts.map((e) => {
            const a = accounts.find((x) => x.id === e.accountId);
            return (
              <div key={e.accountId} className="grid grid-cols-[1fr_90px_130px_36px] items-center gap-2 border-b border-line px-3 py-1 last:border-b-0 hover:bg-[#151514]">
                <span className="min-w-0 truncate text-[13.5px]">
                  {a ? <><span className="text-ink-3">{a.firm} · </span>{a.name} <span className="ml-1 text-[11px] text-ink-3">{a.type}</span></> : <span className="text-ink-3">Deleted account</span>}
                </span>
                <NumberField value={e.contracts} onChange={(v) => setEntry(e.accountId, { contracts: v ?? 0 })} />
                <NumberField value={e.pnl} onChange={(v) => setEntry(e.accountId, { pnl: v ?? 0 })} className={cx('[&_input]:font-medium', e.pnl > 0 ? '[&_input]:text-win' : e.pnl < 0 ? '[&_input]:text-loss' : '')} />
                <IconButton title="Unlink account" onClick={() => set({ accounts: t.accounts.filter((x) => x.accountId !== e.accountId) })}><X size={14} /></IconButton>
              </div>
            );
          })}
        </div>
        {unused.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unused.map((a) => (
              <button key={a.id} onClick={() => set({ accounts: [...t.accounts, { accountId: a.id, contracts: t.accounts[0]?.contracts ?? 1, pnl: t.accounts[0]?.pnl ?? 0 }] })}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-dashed border-line-2 px-2 text-[12.5px] text-ink-3 transition-colors hover:border-ink-3 hover:text-ink">
                <Plus size={12} /> {a.name}
              </button>
            ))}
            {t.accounts.length > 1 && (
              <button onClick={() => set({ accounts: t.accounts.map((x) => ({ ...x, pnl: t.accounts[0].pnl, contracts: t.accounts[0].contracts })) })}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-ink-3 hover:bg-hover hover:text-ink">
                <Copy size={12} /> Copy first row to all
              </button>
            )}
          </div>
        )}
      </section>

      {/* checklist */}
      <section className="mt-10">
        <SectionTitle right={broken.length ? <span className="text-[12.5px] text-loss">{broken.length} of {s.checklist.length} unchecked</span> : <span className="text-[12.5px] text-win">All rules met</span>}>
          <span className="inline-flex items-center gap-2"><ListChecks size={13} /> Model checklist</span>
        </SectionTitle>
        <div className={cx('rounded-lg border p-1.5 transition-colors', broken.length ? 'border-[#ef7a6b33] bg-[#ef7a6b08]' : 'border-[#45c2b52e] bg-[#45c2b508]')}>
          {s.checklist.map((c) => (
            <Checkbox key={c.id} checked={!!t.checklist?.[c.id]} danger onChange={(v) => set({ checklist: { ...t.checklist, [c.id]: v } })} label={c.label} />
          ))}
        </div>
      </section>

      {/* screenshots */}
      <section className="mt-10">
        <SectionTitle right={<span className="text-[12px] text-ink-3">Hover a slot and paste · click to view full screen</span>}>Screenshots</SectionTitle>
        <ImageSlots ownerType="trade" ownerId={t.id} />
      </section>

      {/* journal */}
      <section className="mt-10">
        <SectionTitle>Journal</SectionTitle>
        <RichText value={t.journal} onChange={(journal) => journal !== t.journal && set({ journal })} />
      </section>

      {/* psychology */}
      <section className="mt-12">
        <SectionTitle>Psychology</SectionTitle>
        <div className="grid gap-x-10 lg:grid-cols-2">
          <div className="space-y-0.5">
            <PropRow label="Pre-trade mood"><Scale value={t.moodPre} onChange={(v) => set({ moodPre: v })} /></PropRow>
            <PropRow label="During trade"><Scale value={t.moodDuring} onChange={(v) => set({ moodDuring: v })} /></PropRow>
            <PropRow label="Post-trade"><Scale value={t.moodPost} onChange={(v) => set({ moodPost: v })} /></PropRow>
            <PropRow label="Emotions"><TagSelect value={t.emotions} tags={s.emotionTags} onChange={(emotions) => set({ emotions })} onCreate={createTag('emotionTags')} /></PropRow>
          </div>
          <div className="mt-4 lg:mt-0">
            <div className="mb-1 px-1 text-[13px] text-ink-3">Behaviour flags</div>
            {s.behaviours.map((b) => (
              <Checkbox key={b.id} checked={t.behaviours.includes(b.id)}
                onChange={(on) => set({ behaviours: on ? [...t.behaviours, b.id] : t.behaviours.filter((x) => x !== b.id) })}
                label={<span className={cx(t.behaviours.includes(b.id) && (b.positive ? 'text-win' : 'text-[var(--tag-orange-fg)]'))}>{b.label}</span>} />
            ))}
          </div>
        </div>
      </section>
    </article>
  );
}

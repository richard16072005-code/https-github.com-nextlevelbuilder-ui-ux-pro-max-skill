import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ImageSlots } from '../components/ImageSlots';
import { RichText } from '../components/RichText';
import { useApp } from '../components/Shell';
import {
  Button, Checkbox, confirmDialog, cx, IconButton, OutcomePill, PositionPill, PropRow, RuleBreakBadge, Scale, SectionTitle, Segmented, Select, TagPill, TextField,
} from '../components/ui';
import { db, uid } from '../db/db';
import type { Bias, NewsEvent, Outlook } from '../db/types';
import { blankOutlook } from '../lib/actions';
import { addDays, fmtDateLong, todayISO } from '../lib/dates';
import { money, pnlClass, rr } from '../lib/format';
import { useAccounts, useSettings } from '../lib/hooks';
import { isRuleBreak, tradePnl } from '../lib/trade';

const BIAS_COLOR = { Bullish: 'green', Bearish: 'red', Neutral: 'gray' } as const;
const IMPACT_COLOR = { High: 'red', Medium: 'orange', Low: 'yellow' } as const;

export default function OutlookDay() {
  const { date = todayISO() } = useParams();
  const nav = useNavigate();
  const s = useSettings();
  const accounts = useAccounts();
  const { openQuickAdd } = useApp();
  const res = useLiveQuery(async () => ({ v: await db.outlooks.get(date) }), [date]);
  const loaded = res !== undefined;
  const stored = res?.v;
  const o: Outlook = useMemo(() => stored ?? blankOutlook(date, ['NQ', 'ES'].filter((i) => s.instruments.includes(i)).length ? ['NQ', 'ES'] : s.instruments), [stored, date, s.instruments]);
  const trades = useLiveQuery(() => db.trades.where('date').equals(date).toArray(), [date]) ?? [];
  const imageCount = useLiveQuery(() => db.images.where({ ownerType: 'outlook', ownerId: date }).count(), [date]) ?? 0;
  const dayPnl = trades.reduce((a, t) => a + tradePnl(t), 0);

  const set = async (patch: Partial<Outlook>) => {
    const cur = (await db.outlooks.get(date)) ?? o;
    await db.outlooks.put({ ...cur, ...patch, id: date, date, updatedAt: Date.now() });
  };
  // Persist a page as soon as it gets screenshots so it shows up in the outlook list.
  useEffect(() => { if (loaded && imageCount > 0 && !stored) set({}); }, [imageCount, stored, loaded]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ['INPUT', 'TEXTAREA'].includes(t.tagName) || document.querySelector('[role="dialog"]')) return;
      if (e.key === 'ArrowLeft' && e.altKey) nav(`/outlook/${addDays(date, -1)}`);
      if (e.key === 'ArrowRight' && e.altKey) nav(`/outlook/${addDays(date, 1)}`);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [date, nav]);

  const setBias = (i: number, patch: Partial<Outlook['biases'][number]>) => set({ biases: o.biases.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const setNews = (id: string, patch: Partial<NewsEvent>) => set({ news: o.news.map((n) => (n.id === id ? { ...n, ...patch } : n)) });

  if (!loaded) return null;
  return (
    <article key={date} className="animate-fade-up">
      <div className="mb-8 flex items-center justify-between text-[13px]">
        <Link to="/outlook" className="flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-3 hover:bg-hover hover:text-ink"><ArrowLeft size={14} /> Daily Outlook</Link>
        <div className="flex items-center gap-1">
          <IconButton title="Previous day (⌥←)" onClick={() => nav(`/outlook/${addDays(date, -1)}`)}><ChevronLeft size={16} /></IconButton>
          {date !== todayISO() && <Button size="sm" variant="ghost" onClick={() => nav(`/outlook/${todayISO()}`)}>Today</Button>}
          <IconButton title="Next day (⌥→)" onClick={() => nav(`/outlook/${addDays(date, 1)}`)}><ChevronRight size={16} /></IconButton>
          {stored && (
            <IconButton title="Delete outlook" className="hover:!text-loss" onClick={async () => { if (await confirmDialog('Delete this outlook page and its screenshots?', 'Delete outlook')) { await db.outlooks.delete(date); await db.images.where({ ownerType: 'outlook', ownerId: date }).delete(); } }}>
              <Trash2 size={15} />
            </IconButton>
          )}
        </div>
      </div>

      <header className="mb-8">
        <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">Daily outlook {date === todayISO() && <span className="ml-1 text-accent">· Today</span>}</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="display text-[44px] leading-[1] sm:text-[54px]">{fmtDateLong(date)}</h1>
          <div className="flex items-center gap-2">
            {o.go != null && <TagPill name={o.go ? 'GO' : 'NO-GO'} color={o.go ? 'green' : 'red'} className="h-7 px-2.5 text-[13px] tracking-wider" />}
            {trades.length > 0 && <span className={cx('num text-[22px] font-medium', pnlClass(dayPnl))}>{money(dayPnl, { sign: true })}</span>}
          </div>
        </div>
      </header>

      {/* mindset */}
      <section>
        <SectionTitle>Pre-session mindset</SectionTitle>
        <div className="grid gap-x-10 lg:grid-cols-2">
          <div className="space-y-0.5">
            <PropRow label="Sleep"><Scale value={o.sleep} onChange={(sleep) => set({ sleep })} labels={['Terrible', 'Poor', 'OK', 'Good', 'Great']} /></PropRow>
            <PropRow label="Stress"><Scale value={o.stress} onChange={(stress) => set({ stress })} labels={['None', 'Low', 'Some', 'High', 'Very high']} invert /></PropRow>
            <PropRow label="Mood"><Scale value={o.mood} onChange={(mood) => set({ mood })} /></PropRow>
          </div>
          <div className="mt-4 space-y-2 lg:mt-0">
            <div className={cx('rounded-xl border p-4 transition-colors', o.go === true ? 'border-[#45c2b540] bg-win-dim' : o.go === false ? 'border-[#ef7a6b40] bg-loss-dim' : 'border-line bg-surface')}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-semibold">Go / No-go</div>
                  <div className="text-[12px] text-ink-3">Am I fit to trade today?</div>
                </div>
                <Segmented
                  value={o.go == null ? null : o.go ? 'Go' : 'No-go'}
                  options={['Go', 'No-go'] as const}
                  onChange={(v) => set({ go: v === 'Go' })}
                  render={(v, a) => <span className={a ? (v === 'Go' ? 'text-win' : 'text-loss') : ''}>{v}</span>}
                />
              </div>
              <TextField value={o.goReason} onChange={(goReason) => set({ goReason })} placeholder="Reason…" className="mt-2 bg-black/10" />
            </div>
          </div>
        </div>
      </section>

      {/* bias */}
      <section className="mt-10">
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => set({ biases: [...o.biases, { instrument: s.instruments.find((i) => !o.biases.some((b) => b.instrument === i)) ?? s.instruments[0], bias: null, reasoning: '' }] })}><Plus size={13} /> Instrument</Button>}>
          Bias
        </SectionTitle>
        <div className="space-y-2">
          {o.biases.map((b, i) => (
            <div key={i} className="group grid items-start gap-2 rounded-lg border border-line bg-surface p-2 sm:grid-cols-[110px_auto_1fr_28px]">
              <Select value={b.instrument} options={s.instruments} onChange={(v) => v && setBias(i, { instrument: v })} render={(v) => <span className="num font-semibold">{v}</span>} />
              <Segmented value={b.bias} options={['Bullish', 'Bearish', 'Neutral'] as const} onChange={(v: Bias) => setBias(i, { bias: v })}
                render={(v, a) => <span style={a ? { color: `var(--tag-${BIAS_COLOR[v]}-fg)` } : undefined}>{v}</span>} />
              <TextField value={b.reasoning} onChange={(reasoning) => setBias(i, { reasoning })} placeholder="Reasoning…" multiline />
              <IconButton title="Remove" className="opacity-0 group-hover:opacity-100" onClick={() => set({ biases: o.biases.filter((_, j) => j !== i) })}><X size={14} /></IconButton>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-0.5">
          <PropRow label="HTF key levels"><TextField value={o.keyLevels} onChange={(keyLevels) => set({ keyLevels })} multiline placeholder="PDH, PDL, 4H FVGs, NWOG…" className="num text-[13px]" /></PropRow>
          <PropRow label="Draw on liquidity"><TextField value={o.drawOnLiquidity} onChange={(drawOnLiquidity) => set({ drawOnLiquidity })} placeholder="Where is price likely going?" /></PropRow>
        </div>
      </section>

      {/* news */}
      <section className="mt-10">
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={() => set({ news: [...o.news, { id: uid(), time: '08:30', title: '', impact: 'High' }] })}><Plus size={13} /> Event</Button>}>
          News · red folder
        </SectionTitle>
        {o.news.length === 0 ? <div className="text-[13px] text-ink-3">No events. Add CPI, FOMC, NFP and so on.</div> : (
          <div className="divide-y divide-line rounded-lg border border-line">
            {o.news.map((n) => (
              <div key={n.id} className="group grid grid-cols-[104px_1fr_auto_28px] items-center gap-2 px-2 py-1">
                <input type="time" value={n.time} onChange={(e) => setNews(n.id, { time: e.target.value })} className="num h-8 rounded-md bg-transparent px-1 text-[13px] outline-none hover:bg-hover" />
                <TextField value={n.title} onChange={(title) => setNews(n.id, { title })} placeholder="Event" />
                <Select value={n.impact} options={['High', 'Medium', 'Low'] as const} onChange={(v) => v && setNews(n.id, { impact: v })} render={(v) => <TagPill name={v} color={IMPACT_COLOR[v]} />} className="w-auto" />
                <IconButton title="Remove" className="opacity-0 group-hover:opacity-100" onClick={() => set({ news: o.news.filter((x) => x.id !== n.id) })}><X size={14} /></IconButton>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>Outlook screenshots</SectionTitle>
        <ImageSlots ownerType="outlook" ownerId={date} />
      </section>

      <section className="mt-10">
        <SectionTitle>Notes & plan</SectionTitle>
        <RichText key={`n-${date}`} value={o.notes} onChange={(notes) => notes !== o.notes && set({ notes })} placeholder="What am I waiting for today?" />
      </section>

      {/* trades */}
      <section className="mt-12">
        <SectionTitle right={<span className={cx('num text-[13px]', pnlClass(dayPnl))}>{trades.length} trade{trades.length === 1 ? '' : 's'} · {money(dayPnl, { sign: true })}</span>}>Trades taken</SectionTitle>
        {trades.length === 0 ? (
          <div className="flex items-center justify-between rounded-lg border border-dashed border-line-2 px-4 py-4 text-[13px] text-ink-3">
            No trades logged for this day.
            <Button size="sm" onClick={openQuickAdd}><Plus size={13} /> Log trade</Button>
          </div>
        ) : (
          <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
            {trades.map((t) => (
              <Link key={t.id} to={`/trades/${t.id}`} className="flex flex-wrap items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[#161615]">
                <span className="num w-12 text-[12.5px] text-ink-3">{t.time}</span>
                <span className="num font-semibold">{t.instrument}</span>
                <PositionPill position={t.position} />
                <OutcomePill outcome={t.outcome} />
                {isRuleBreak(t, s) && <RuleBreakBadge compact />}
                <span className="truncate text-[12.5px] text-ink-3">{t.accounts.map((a) => accounts.find((x) => x.id === a.accountId)?.name).filter(Boolean).join(', ')}</span>
                <span className={cx('num ml-auto text-[12.5px]', pnlClass(t.realizedR))}>{rr(t.realizedR)}</span>
                <span className={cx('num w-24 text-right font-medium', pnlClass(tradePnl(t)))}>{money(tradePnl(t), { sign: true })}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* review */}
      <section className="mt-12">
        <SectionTitle>End-of-day review</SectionTitle>
        <div className="space-y-1">
          <PropRow label="Price followed bias?">
            <div className="px-2 py-0.5">
              <Segmented value={o.followedBias} options={['Yes', 'Partly', 'No'] as const} onChange={(followedBias) => set({ followedBias })}
                render={(v, a) => <span className={a ? (v === 'Yes' ? 'text-win' : v === 'No' ? 'text-loss' : 'text-[var(--tag-yellow-fg)]') : ''}>{v}</span>} />
            </div>
          </PropRow>
          <Checkbox checked={o.walkedAway} onChange={(walkedAway) => set({ walkedAway })} label="Walked away when conditions were bad" />
        </div>
        <div className="mt-4 rounded-lg border border-line bg-surface p-4">
          <div className="mb-2 text-[12px] uppercase tracking-[0.1em] text-ink-3">What I learned</div>
          <RichText key={`l-${date}`} value={o.learned} onChange={(learned) => learned !== o.learned && set({ learned })} placeholder="One thing to remember tomorrow…" minimal />
        </div>
      </section>
    </article>
  );
}

import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../components/Shell';
import { Button, cx, Empty, PageHeader, SectionTitle, Segmented, StatTile } from '../components/ui';
import { SESSIONS } from '../db/types';
import { addDays, fmtDate, monthGrid, MONTHS, todayISO } from '../lib/dates';
import { money, num, pct, pnlClass, rr } from '../lib/format';
import { useAccounts, useSettings, useTrades } from '../lib/hooks';
import { breakdowns, computeStats, type GroupRow } from '../lib/metrics';
import { tradePnl } from '../lib/trade';
import { FilterMenu } from './Trades';

const RANGES = ['30D', '90D', 'YTD', 'All', 'Custom'] as const;
type Range = (typeof RANGES)[number];
const WIN = '#45c2b5';
const LOSS = '#ef7a6b';
const ACCENT = '#e9b44c';

export default function Dashboard() {
  const all = useTrades();
  const s = useSettings();
  const accounts = useAccounts();
  const { openQuickAdd } = useApp();
  const [range, setRange] = useState<Range>('All');
  const [from, setFrom] = useState(addDays(todayISO(), -60));
  const [to, setTo] = useState(todayISO());
  const [accountIds, setAccountIds] = useState<string[]>([]);
  const [instruments, setInstruments] = useState<string[]>([]);
  const [sessions, setSessions] = useState<string[]>([]);
  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>) => (v: string) => set((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

  const [start, end] = useMemo(() => {
    const t = todayISO();
    if (range === '30D') return [addDays(t, -30), t];
    if (range === '90D') return [addDays(t, -90), t];
    if (range === 'YTD') return [`${t.slice(0, 4)}-01-01`, t];
    if (range === 'Custom') return [from, to];
    return ['0000', '9999'];
  }, [range, from, to]);

  const trades = useMemo(() => all
    .filter((t) => t.date >= start && t.date <= end)
    .filter((t) => !accountIds.length || t.accounts.some((a) => accountIds.includes(a.accountId)))
    .filter((t) => !instruments.length || instruments.includes(t.instrument))
    .filter((t) => !sessions.length || sessions.includes(t.session))
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? ''))), [all, start, end, accountIds, instruments, sessions]);

  const acc = accountIds.length ? accountIds : null;
  const stats = useMemo(() => computeStats(trades, acc), [trades, acc]);
  const bd = useMemo(() => breakdowns(trades, s, acc), [trades, s, acc]);

  const equity = useMemo(() => {
    let e = 0, r = 0;
    return trades.map((t, i) => {
      e += tradePnl(t, acc);
      r += t.realizedR ?? 0;
      return { n: i + 1, date: t.date, label: `${t.instrument} ${t.position}`, equity: Math.round(e * 100) / 100, r: Math.round(r * 100) / 100 };
    });
  }, [trades, acc]);
  const daily = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) m.set(t.date, (m.get(t.date) ?? 0) + tradePnl(t, acc));
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, pnl]) => ({ date, pnl: Math.round(pnl) }));
  }, [trades, acc]);

  const filtersActive = accountIds.length + instruments.length + sessions.length + (range !== 'All' ? 1 : 0);

  return (
    <div>
      <PageHeader
        eyebrow={<>Profit tracker · {range === 'All' ? 'All time' : `${fmtDate(start)} → ${fmtDate(end)}`}</>}
        title="Dashboard"
        right={<Button variant="primary" onClick={openQuickAdd}><Plus size={14} /> New trade</Button>}
      />

      <div className="-mx-2 mb-8 flex flex-wrap items-center gap-2 px-2">
        <Segmented value={range} options={RANGES} onChange={setRange} />
        {range === 'Custom' && (
          <div className="flex items-center gap-1 text-[12.5px] text-ink-3">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="num h-8 rounded-md border border-line bg-surface px-2 text-ink outline-none" />
            →
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="num h-8 rounded-md border border-line bg-surface px-2 text-ink outline-none" />
          </div>
        )}
        <FilterMenu label="Account" options={accounts.map((a) => ({ id: a.id, name: `${a.name}` }))} value={accountIds} onToggle={toggle(setAccountIds)} hint="PnL counts only the selected accounts" />
        <FilterMenu label="Instrument" options={s.instruments.map((i) => ({ id: i, name: i }))} value={instruments} onToggle={toggle(setInstruments)} />
        <FilterMenu label="Session" options={SESSIONS.map((i) => ({ id: i, name: i }))} value={sessions} onToggle={toggle(setSessions)} />
        {filtersActive > 0 && (
          <button onClick={() => { setRange('All'); setAccountIds([]); setInstruments([]); setSessions([]); }} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-accent hover:bg-accent-dim">
            <X size={13} /> Reset
          </button>
        )}
      </div>

      {trades.length === 0 ? (
        <Empty title="No trades in this view" hint="Log a trade or widen the filters to see your stats." action={<Button variant="primary" onClick={openQuickAdd}><Plus size={14} /> New trade</Button>} />
      ) : (
        <>
          {/* hero */}
          <section className="mb-10 grid gap-8 lg:grid-cols-[minmax(260px,auto)_1fr] lg:items-end">
            <div className="animate-fade-up">
              <div className="text-[12px] uppercase tracking-[0.12em] text-ink-3">Net PnL</div>
              <div className={cx('num mt-2 text-[56px] font-medium leading-none tracking-tight sm:text-[64px]', pnlClass(stats.totalPnl))}>{money(stats.totalPnl, { sign: true })}</div>
              <div className="num mt-3 text-[13px] text-ink-3">
                <span className={pnlClass(stats.totalR)}>{rr(stats.totalR)}</span> across {stats.count} trades · {stats.wins}W {stats.losses}L {stats.be}BE
              </div>
            </div>
            <div className="grid grid-cols-2 gap-y-6 rounded-xl border border-line bg-surface px-5 py-4 sm:grid-cols-4">
              <StatTile label="Win rate" value={pct(stats.winRate)} sub={`${stats.wins} of ${stats.wins + stats.losses} decided`} />
              <StatTile label="Avg R" value={rr(stats.avgR)} tone={stats.avgR == null ? null : stats.avgR >= 0 ? 'win' : 'loss'} sub={`Avg win ${money(stats.avgWin)}`} />
              <StatTile label="Expectancy" value={money(stats.expectancy, { sign: true })} sub="per trade" tone={stats.expectancy >= 0 ? 'win' : 'loss'} />
              <StatTile label="Profit factor" value={Number.isFinite(stats.profitFactor) ? num(stats.profitFactor) : '∞'} sub={`Avg loss ${money(stats.avgLoss)}`} />
              <StatTile label="Max drawdown" value={money(-stats.maxDrawdown)} tone={stats.maxDrawdown ? 'loss' : null} sub="peak to trough" />
              <StatTile
                label="Current streak"
                value={stats.curStreak.kind ? `${stats.curStreak.n}${stats.curStreak.kind}` : '—'}
                tone={stats.curStreak.kind === 'W' ? 'win' : stats.curStreak.kind === 'L' ? 'loss' : null}
                sub={stats.curStreak.kind === 'W' ? 'wins in a row' : stats.curStreak.kind === 'L' ? 'losses in a row' : ''}
              />
              <StatTile label="Best / worst" value={<><span className="text-win">{stats.bestStreak}W</span> <span className="text-ink-3">/</span> <span className="text-loss">{stats.worstStreak}L</span></>} sub="longest streaks" />
              <StatTile label="Total trades" value={stats.count} sub={`${new Set(trades.map((t) => t.date)).size} trading days`} />
            </div>
          </section>

          {/* equity */}
          <ChartCard title="Equity curve" note={<span className={cx('num', pnlClass(stats.totalPnl))}>{money(stats.totalPnl, { sign: true })}</span>}>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={equity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="n" tickLine={false} axisLine={false} minTickGap={30} />
                <YAxis tickLine={false} axisLine={false} width={64} tickFormatter={(v) => money(v, { compact: true })} />
                <ReferenceLine y={0} stroke="#3a3934" />
                <Tooltip cursor={{ stroke: '#4a4842' }} content={<Tip render={(p) => <><TipHead>#{p.n} · {fmtDate(p.date)}</TipHead><div className="text-ink-2">{p.label}</div><TipVal v={p.equity} /></>} />} />
                <Area type="monotone" dataKey="equity" stroke={ACCENT} strokeWidth={2} fill="url(#eq)" activeDot={{ r: 4, stroke: '#141413', strokeWidth: 2 }} isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <ChartCard title="Daily PnL" note={<span className="text-ink-3">{daily.filter((d) => d.pnl > 0).length} green / {daily.filter((d) => d.pnl < 0).length} red days</span>}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(d) => fmtDate(d, { day: 'numeric', month: 'short' })} />
                  <YAxis tickLine={false} axisLine={false} width={56} tickFormatter={(v) => money(v, { compact: true })} />
                  <ReferenceLine y={0} stroke="#3a3934" />
                  <Tooltip content={<Tip render={(p) => <><TipHead>{fmtDate(p.date, { weekday: 'short', day: 'numeric', month: 'short' })}</TipHead><TipVal v={p.pnl} /></>} />} />
                  <Bar dataKey="pnl" radius={[3, 3, 3, 3]} maxBarSize={14} isAnimationActive={false}>
                    {daily.map((d) => <Cell key={d.date} fill={d.pnl >= 0 ? WIN : LOSS} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="R-trajectory" note={<span className={cx('num', pnlClass(stats.totalR))}>{rr(stats.totalR)}</span>}>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={equity} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="n" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis tickLine={false} axisLine={false} width={40} tickFormatter={(v) => `${v}R`} />
                  <ReferenceLine y={0} stroke="#3a3934" />
                  <Tooltip cursor={{ stroke: '#4a4842' }} content={<Tip render={(p) => <><TipHead>Trade #{p.n} · {fmtDate(p.date)}</TipHead><div className="num text-[15px] font-medium">{rr(p.r)}</div></>} />} />
                  <Line type="linear" dataKey="r" stroke="#c8c4bb" strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#141413', strokeWidth: 2 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <Heatmap daily={daily} />

          {/* breakdowns */}
          <section className="mt-12">
            <SectionTitle>Confluence combinations</SectionTitle>
            <BreakdownTable rows={bd.combos.slice(0, 12)} wide />
          </section>
          <div className="mt-10 grid gap-10 lg:grid-cols-2">
            <section><SectionTitle>By single confluence</SectionTitle><BreakdownTable rows={bd.confluence} /></section>
            <section><SectionTitle>By emotion tag</SectionTitle><BreakdownTable rows={bd.emotion} /></section>
            <section><SectionTitle>By session</SectionTitle><BreakdownTable rows={bd.session} /></section>
            <section><SectionTitle>By day of week</SectionTitle><BreakdownTable rows={bd.weekday} /></section>
          </div>
          <div className="mt-10 grid gap-6 lg:grid-cols-2">
            <Versus title="With vs against bias" rows={bd.bias} good="With bias" />
            <Versus title="Clean vs rule-break" rows={bd.rules} good="Clean" />
          </div>
        </>
      )}
    </div>
  );
}

function ChartCard({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 pb-2 animate-fade-up">
      <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
        <h3 className="text-[13px] font-semibold">{title}</h3>
        <div className="text-[12.5px]">{note}</div>
      </div>
      {children}
    </section>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Tip({ active, payload, render }: { active?: boolean; payload?: any[]; render: (p: any) => ReactNode }) {
  if (!active || !payload?.length) return null;
  return <div className="min-w-[140px] rounded-lg border border-line-2 bg-[#1d1d1b] px-3 py-2 text-[12.5px] shadow-xl">{render(payload[0].payload)}</div>;
}
const TipHead = ({ children }: { children: ReactNode }) => <div className="mb-0.5 text-[11.5px] text-ink-3">{children}</div>;
const TipVal = ({ v }: { v: number }) => <div className={cx('num text-[15px] font-medium', pnlClass(v))}>{money(v, { sign: true })}</div>;

function Heatmap({ daily }: { daily: { date: string; pnl: number }[] }) {
  const last = daily[daily.length - 1]?.date ?? todayISO();
  const [anchor, setAnchor] = useState({ y: +last.slice(0, 4), m: +last.slice(5, 7) - 1 });
  const map = new Map(daily.map((d) => [d.date, d.pnl]));
  const max = Math.max(1, ...daily.map((d) => Math.abs(d.pnl)));
  const months = [-1, 0].map((o) => { const d = new Date(anchor.y, anchor.m + o, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const shift = (n: number) => setAnchor(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold">PnL calendar</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={15} /></Button>
          <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={15} /></Button>
        </div>
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        {months.map(({ y, m }) => {
          const weeks = monthGrid(y, m);
          const total = [...map.entries()].filter(([d]) => d.startsWith(`${y}-${String(m + 1).padStart(2, '0')}`)).reduce((a, [, v]) => a + v, 0);
          return (
            <div key={`${y}-${m}`}>
              <div className="mb-2 flex items-baseline justify-between">
                <span className="display text-[22px]">{MONTHS[m]} <span className="text-ink-3">{y}</span></span>
                <span className={cx('num text-[13px]', pnlClass(total))}>{money(total, { sign: true })}</span>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] uppercase tracking-wider text-ink-3">
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i}>{d}</div>)}
              </div>
              <div className="mt-1 space-y-1">
                {weeks.map((w, i) => (
                  <div key={i} className="grid grid-cols-7 gap-1">
                    {w.map((d, j) => {
                      const v = d ? map.get(d) : undefined;
                      const a = v != null ? 0.18 + 0.62 * Math.min(1, Math.abs(v) / max) : 0;
                      return (
                        <Link
                          key={j}
                          to={d ? `/outlook/${d}` : '#'}
                          title={d ? `${fmtDate(d)}${v != null ? ` · ${money(v, { sign: true })}` : ''}` : ''}
                          className={cx('flex aspect-[1.15] flex-col justify-between rounded-md p-1 text-left transition-transform', d ? 'hover:scale-[1.06] hover:ring-1 hover:ring-line-2' : 'pointer-events-none', !d && 'opacity-0', v == null && d && 'bg-[#181816]')}
                          style={v != null ? { background: `color-mix(in oklab, ${v >= 0 ? WIN : LOSS} ${Math.round(a * 100)}%, #141413)` } : undefined}
                        >
                          <span className={cx('num text-[10px]', v != null ? 'text-ink/80' : 'text-ink-3')}>{d ? +d.slice(8) : ''}</span>
                          {v != null && <span className="num truncate text-[10.5px] font-semibold text-ink">{v >= 0 ? '+' : '−'}{Math.abs(v) >= 1000 ? `${(Math.abs(v) / 1000).toFixed(1)}k` : Math.abs(v)}</span>}
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function BreakdownTable({ rows, wide }: { rows: GroupRow[]; wide?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.pnl)));
  if (!rows.length) return <div className="text-[13px] text-ink-3">No data.</div>;
  return (
    <div className="overflow-x-auto">
      <table className={cx('w-full text-[13px]', wide && 'min-w-[620px]')}>
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-ink-3 [&>th]:pb-2 [&>th]:font-medium">
            <th>{wide ? 'Combination' : 'Group'}</th>
            <th className="w-14 text-right">Trades</th>
            <th className="w-16 text-right">Win %</th>
            <th className="w-16 text-right">Avg R</th>
            <th className={cx('text-right', wide ? 'w-[260px]' : 'w-[170px]')}>PnL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-line [&>td]:py-2">
              <td className="pr-3 text-ink">{r.label}</td>
              <td className="num text-right text-ink-2">{r.count}</td>
              <td className="num text-right text-ink-2">{pct(r.winRate)}</td>
              <td className={cx('num text-right', pnlClass(r.avgR))}>{rr(r.avgR)}</td>
              <td>
                <div className="flex items-center justify-end gap-2">
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-[#1d1d1b]">
                    <div className="absolute inset-y-0 left-1/2 w-px bg-line-2" />
                    <div
                      className="absolute inset-y-0 rounded-full"
                      style={{
                        background: r.pnl >= 0 ? WIN : LOSS,
                        width: `${(Math.abs(r.pnl) / max) * 50}%`,
                        left: r.pnl >= 0 ? '50%' : undefined,
                        right: r.pnl < 0 ? '50%' : undefined,
                      }}
                    />
                  </div>
                  <span className={cx('num w-20 text-right font-medium', pnlClass(r.pnl))}>{money(r.pnl, { sign: true })}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Versus({ title, rows, good }: { title: string; rows: GroupRow[]; good: string }) {
  const sorted = [...rows].sort((a, b) => (a.key === good ? -1 : b.key === good ? 1 : 0));
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h3 className="mb-4 text-[13px] font-semibold">{title}</h3>
      <div className="grid grid-cols-2 divide-x divide-line">
        {sorted.map((r) => (
          <div key={r.key} className="px-4 first:pl-0">
            <div className={cx('text-[12px] uppercase tracking-[0.1em]', r.key === good ? 'text-win' : 'text-loss')}>{r.label}</div>
            <div className={cx('num mt-2 text-[26px] font-medium leading-none', pnlClass(r.pnl))}>{money(r.pnl, { sign: true })}</div>
            <div className="num mt-2 text-[12.5px] text-ink-3">{r.count} trades · {pct(r.winRate)} win · {rr(r.avgR)}</div>
          </div>
        ))}
        {sorted.length < 2 && <div className="px-4 text-[13px] text-ink-3">No trades on the other side yet.</div>}
      </div>
    </section>
  );
}

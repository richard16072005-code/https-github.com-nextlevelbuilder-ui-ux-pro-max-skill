import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowDown, ArrowUp, CalendarDays, ChevronLeft, ChevronRight, Download, Filter, ImageOff, LayoutGrid, Plus, Search, Table2, X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../components/Shell';
import {
  Button, Checkbox, cx, DropdownButton, Empty, OutcomePill, PageHeader, PositionPill, RuleBreakBadge, Segmented, TagPill,
} from '../components/ui';
import { db } from '../db/db';
import type { AppSettings, StoredImage, Trade } from '../db/types';
import { OUTCOMES, SESSIONS } from '../db/types';
import { download, tradesToCsv } from '../lib/csv';
import { fmtDate, monthGrid, MONTHS, todayISO } from '../lib/dates';
import { money, pnlClass, rr } from '../lib/format';
import { useAccounts, useBlobUrl, useSettings, useTrades } from '../lib/hooks';
import { htmlText, isRuleBreak, tradePnl } from '../lib/trade';

type View = 'Table' | 'Gallery' | 'Calendar';
type SortKey = 'date' | 'pnl' | 'r' | 'instrument';
interface Filters {
  outcome: string[];
  instrument: string[];
  session: string[];
  account: string[];
  confluence: string[];
  rules: 'all' | 'break' | 'clean';
}
const EMPTY: Filters = { outcome: [], instrument: [], session: [], account: [], confluence: [], rules: 'all' };

function usePersisted<T>(key: string, init: T) {
  const [v, setV] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? { ...init, ...JSON.parse(raw) } : init; } catch { return init; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }, [key, v]);
  return [v, setV] as const;
}

export default function Trades() {
  const trades = useTrades();
  const s = useSettings();
  const accounts = useAccounts();
  const { openQuickAdd } = useApp();
  const [prefs, setPrefs] = usePersisted('ledger.trades.view', { view: 'Table' as View, sort: 'date' as SortKey, dir: -1 as 1 | -1 });
  const [filters, setFilters] = usePersisted<Filters>('ledger.trades.filters', EMPTY);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = trades.filter((t) => {
      if (filters.outcome.length && !filters.outcome.includes(t.outcome ?? '')) return false;
      if (filters.instrument.length && !filters.instrument.includes(t.instrument)) return false;
      if (filters.session.length && !filters.session.includes(t.session)) return false;
      if (filters.account.length && !t.accounts.some((a) => filters.account.includes(a.accountId))) return false;
      if (filters.confluence.length && !filters.confluence.every((c) => t.confluences.includes(c))) return false;
      if (filters.rules !== 'all' && (filters.rules === 'break') !== isRuleBreak(t, s)) return false;
      if (needle) {
        const hay = [
          t.instrument, t.position, t.session, t.outcome, t.date, fmtDate(t.date),
          ...t.confluences.map((id) => s.confluences.find((c) => c.id === id)?.name),
          ...t.emotions.map((id) => s.emotionTags.find((c) => c.id === id)?.name),
          htmlText(t.journal),
        ].join(' ').toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    const key = (t: Trade) => prefs.sort === 'pnl' ? tradePnl(t) : prefs.sort === 'r' ? (t.realizedR ?? -999) : prefs.sort === 'instrument' ? t.instrument : `${t.date} ${t.time ?? ''}`;
    return [...list].sort((a, b) => { const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : 0) * prefs.dir; });
  }, [trades, filters, q, prefs.sort, prefs.dir, s]);

  const active = (Object.keys(EMPTY) as (keyof Filters)[]).reduce((n, k) => n + (k === 'rules' ? (filters.rules !== 'all' ? 1 : 0) : (filters[k] as string[]).length), 0);
  const totalPnl = filtered.reduce((a, t) => a + tradePnl(t), 0);
  const sortBy = (k: SortKey) => setPrefs((p) => ({ ...p, sort: k, dir: p.sort === k ? (p.dir === 1 ? -1 : 1) : -1 }));

  const toggle = (k: Exclude<keyof Filters, 'rules'>, v: string) =>
    setFilters((f) => ({ ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v] }));

  return (
    <div>
      <PageHeader
        eyebrow={<>Database · <span className="num">{trades.length}</span> trades</>}
        title="Trades"
        right={
          <>
            <Button onClick={() => download(`trades-${todayISO()}.csv`, tradesToCsv(filtered, s, accounts), 'text/csv')}><Download size={14} /> CSV</Button>
            <Button variant="primary" onClick={openQuickAdd}><Plus size={14} /> New trade</Button>
          </>
        }
      />

      {/* toolbar */}
      <div className="sticky top-12 z-10 -mx-2 mb-4 flex flex-wrap items-center gap-2 bg-canvas/90 px-2 py-2 backdrop-blur lg:top-0">
        <Segmented
          value={prefs.view}
          options={['Table', 'Gallery', 'Calendar'] as const}
          onChange={(view) => setPrefs((p) => ({ ...p, view }))}
          render={(o) => (
            <span className="flex items-center gap-1.5">
              {o === 'Table' ? <Table2 size={13} /> : o === 'Gallery' ? <LayoutGrid size={13} /> : <CalendarDays size={13} />}
              <span className="hidden sm:inline">{o}</span>
            </span>
          )}
        />
        <div className="relative min-w-[160px] flex-1 sm:max-w-[280px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-3" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notes, tags…" className="h-8 w-full rounded-md border border-line bg-surface pl-8 pr-2 text-[13px] outline-none transition-colors placeholder:text-ink-3 focus:border-line-2" />
        </div>
        <FilterMenu label="Outcome" options={OUTCOMES.map((o) => ({ id: o, name: o }))} value={filters.outcome} onToggle={(v) => toggle('outcome', v)} />
        <FilterMenu label="Instrument" options={s.instruments.map((o) => ({ id: o, name: o }))} value={filters.instrument} onToggle={(v) => toggle('instrument', v)} />
        <FilterMenu label="Session" options={SESSIONS.map((o) => ({ id: o, name: o }))} value={filters.session} onToggle={(v) => toggle('session', v)} />
        <FilterMenu label="Account" options={accounts.map((a) => ({ id: a.id, name: a.name }))} value={filters.account} onToggle={(v) => toggle('account', v)} />
        <FilterMenu label="Confluence" options={s.confluences} value={filters.confluence} onToggle={(v) => toggle('confluence', v)} hint="Trades must have all selected" />
        <DropdownButton label={filters.rules === 'all' ? 'Rules' : filters.rules === 'break' ? 'Rule breaks' : 'Clean only'}>
          {(close) => (
            <div className="p-1">
              {(['all', 'break', 'clean'] as const).map((r) => (
                <button key={r} onClick={() => { setFilters((f) => ({ ...f, rules: r })); close(); }} className={cx('w-full rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-hover', filters.rules === r && 'text-accent')}>
                  {r === 'all' ? 'All trades' : r === 'break' ? 'Rule breaks only' : 'Clean trades only'}
                </button>
              ))}
            </div>
          )}
        </DropdownButton>
        {active > 0 && (
          <button onClick={() => setFilters(EMPTY)} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-accent hover:bg-accent-dim">
            <X size={13} /> Clear {active}
          </button>
        )}
        <div className="num ml-auto text-[12.5px] text-ink-3">
          {filtered.length} · <span className={pnlClass(totalPnl)}>{money(totalPnl, { sign: true })}</span>
        </div>
      </div>

      {trades.length === 0 ? (
        <Empty icon={<Filter size={22} />} title="No trades yet" hint="Press N anywhere to log your first trade." action={<Button variant="primary" onClick={openQuickAdd}><Plus size={14} /> New trade</Button>} />
      ) : filtered.length === 0 && prefs.view !== 'Calendar' ? (
        <Empty title="No trades match" hint="Try removing a filter or clearing the search." action={<Button onClick={() => { setFilters(EMPTY); setQ(''); }}>Reset filters</Button>} />
      ) : prefs.view === 'Table' ? (
        <TableView trades={filtered} s={s} sort={prefs.sort} dir={prefs.dir} onSort={sortBy} accountsById={new Map(accounts.map((a) => [a.id, a.name]))} />
      ) : prefs.view === 'Gallery' ? (
        <GalleryView trades={filtered} s={s} />
      ) : (
        <CalendarView trades={filtered} />
      )}
    </div>
  );
}

export function FilterMenu({ label, options, value, onToggle, hint }: { label: string; options: { id: string; name: string; color?: string }[]; value: string[]; onToggle: (v: string) => void; hint?: string }) {
  return (
    <DropdownButton label={<span className={cx(value.length && 'text-accent')}>{label}{value.length ? ` · ${value.length}` : ''}</span>}>
      {() => (
        <div className="max-h-[320px] overflow-auto p-1">
          {hint && <div className="px-2 py-1 text-[11px] text-ink-3">{hint}</div>}
          {options.length === 0 && <div className="px-2 py-2 text-[12.5px] text-ink-3">Nothing to filter by yet</div>}
          {options.map((o) => (
            <Checkbox key={o.id} checked={value.includes(o.id)} onChange={() => onToggle(o.id)}
              label={o.color ? <TagPill name={o.name} color={o.color as never} /> : o.name} />
          ))}
        </div>
      )}
    </DropdownButton>
  );
}

function SortHead({ k, label, sort, dir, onSort, className }: { k: SortKey; label: string; sort: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void; className?: string }) {
  return (
    <button onClick={() => onSort(k)} className={cx('inline-flex items-center gap-1 hover:text-ink', sort === k && 'text-ink-2', className)}>
      {label}
      {sort === k && (dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
    </button>
  );
}

function TableView({ trades, s, sort, dir, onSort, accountsById }: { trades: Trade[]; s: AppSettings; sort: SortKey; dir: 1 | -1; onSort: (k: SortKey) => void; accountsById: Map<string, string> }) {
  const nav = useNavigate();
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[920px] border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-line bg-surface text-left text-[11.5px] uppercase tracking-[0.08em] text-ink-3 [&>th]:px-3 [&>th]:py-2 [&>th]:font-medium">
            <th className="w-[118px]"><SortHead k="date" label="Date" sort={sort} dir={dir} onSort={onSort} /></th>
            <th><SortHead k="instrument" label="Trade" sort={sort} dir={dir} onSort={onSort} /></th>
            <th>Session</th>
            <th>Outcome</th>
            <th className="text-right"><SortHead k="pnl" label="PnL" sort={sort} dir={dir} onSort={onSort} className="justify-end" /></th>
            <th className="text-right"><SortHead k="r" label="R" sort={sort} dir={dir} onSort={onSort} className="justify-end" /></th>
            <th>Confluences</th>
            <th>Accounts</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {trades.map((t) => {
            const pnl = tradePnl(t);
            const tags = t.confluences.map((id) => s.confluences.find((c) => c.id === id)).filter(Boolean);
            return (
              <tr
                key={t.id}
                tabIndex={0}
                onClick={() => nav(`/trades/${t.id}`)}
                onKeyDown={(e) => e.key === 'Enter' && nav(`/trades/${t.id}`)}
                className="group cursor-pointer border-b border-line transition-colors last:border-b-0 hover:bg-[#161615] focus:bg-[#161615] focus:outline-none [&>td]:px-3 [&>td]:py-2"
              >
                <td className="num whitespace-nowrap text-[12.5px] text-ink-2">{fmtDate(t.date, { day: '2-digit', month: 'short', year: '2-digit' })}</td>
                <td className="whitespace-nowrap"><span className="num mr-2 font-semibold">{t.instrument}</span><PositionPill position={t.position} /></td>
                <td className="whitespace-nowrap text-ink-2">{t.session}</td>
                <td><OutcomePill outcome={t.outcome} /></td>
                <td className={cx('num whitespace-nowrap text-right font-medium', pnlClass(pnl))}>{money(pnl, { sign: true })}</td>
                <td className={cx('num whitespace-nowrap text-right', pnlClass(t.realizedR))}>{rr(t.realizedR)}</td>
                <td className="max-w-[280px]">
                  <div className="flex gap-1 overflow-hidden">
                    {tags.slice(0, 3).map((c) => <TagPill key={c!.id} name={c!.name} color={c!.color} />)}
                    {tags.length > 3 && <span className="text-[12px] text-ink-3">+{tags.length - 3}</span>}
                  </div>
                </td>
                <td className="max-w-[160px] truncate text-[12.5px] text-ink-3" title={t.accounts.map((a) => accountsById.get(a.accountId)).join(', ')}>
                  {t.accounts.length === 1 ? accountsById.get(t.accounts[0].accountId) : t.accounts.length ? `${t.accounts.length} accounts` : '—'}
                </td>
                <td className="w-[90px] text-right">{isRuleBreak(t, s) && <RuleBreakBadge compact />}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const PREFERRED = ['15m', '5m', '1H', '1m', '4H', '2H'];
function GalleryView({ trades, s }: { trades: Trade[]; s: AppSettings }) {
  const images = useLiveQuery(() => db.images.where('ownerId').anyOf(trades.map((t) => t.id)).toArray(), [trades.map((t) => t.id).join()]) ?? [];
  const cover = useMemo(() => {
    const m = new Map<string, StoredImage>();
    for (const t of trades) {
      const own = images.filter((i) => i.ownerType === 'trade' && i.ownerId === t.id);
      const c = PREFERRED.map((p) => own.find((i) => i.slot === p)).find(Boolean);
      if (c) m.set(t.id, c);
    }
    return m;
  }, [images, trades]);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of images) m.set(i.ownerId, (m.get(i.ownerId) ?? 0) + 1);
    return m;
  }, [images]);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {trades.map((t, i) => <GalleryCard key={t.id} t={t} s={s} cover={cover.get(t.id)} shots={counts.get(t.id) ?? 0} index={i} />)}
    </div>
  );
}

function GalleryCard({ t, s, cover, shots, index }: { t: Trade; s: AppSettings; cover?: StoredImage; shots: number; index: number }) {
  const url = useBlobUrl(cover?.thumb);
  const pnl = tradePnl(t);
  const tags = t.confluences.map((id) => s.confluences.find((c) => c.id === id)).filter(Boolean);
  return (
    <Link
      to={`/trades/${t.id}`}
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
      className="group animate-fade-up overflow-hidden rounded-xl border border-line bg-surface transition-all duration-200 [animation-fill-mode:backwards] hover:-translate-y-0.5 hover:border-line-2 hover:shadow-[0_20px_40px_-24px_#000]"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-[#10100f]">
        {url ? (
          <img src={url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" loading="lazy" />
        ) : (
          <div className="grid size-full place-items-center text-ink-3"><ImageOff size={20} /></div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#141413] to-transparent" />
        {cover && <span className="num absolute left-2.5 top-2.5 rounded bg-black/60 px-1.5 py-0.5 text-[10.5px] font-semibold backdrop-blur">{cover.slot}{shots > 1 ? ` +${shots - 1}` : ''}</span>}
        {isRuleBreak(t, s) && <span className="absolute right-2.5 top-2.5"><RuleBreakBadge compact /></span>}
      </div>
      <div className="p-3.5 pt-2.5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[15px] font-semibold"><span className="num">{t.instrument}</span> <span className="font-normal text-ink-2">{t.position}</span></div>
            <div className="mt-0.5 text-[12px] text-ink-3">{fmtDate(t.date)} · {t.session}</div>
          </div>
          <div className="text-right">
            <div className={cx('num text-[15px] font-medium', pnlClass(pnl))}>{money(pnl, { sign: true })}</div>
            <div className={cx('num text-[11.5px]', pnlClass(t.realizedR))}>{rr(t.realizedR)}</div>
          </div>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1">
          <OutcomePill outcome={t.outcome} />
          {tags.slice(0, 3).map((c) => <TagPill key={c!.id} name={c!.name} color={c!.color} />)}
          {tags.length > 3 && <span className="self-center text-[11.5px] text-ink-3">+{tags.length - 3}</span>}
        </div>
      </div>
    </Link>
  );
}

function CalendarView({ trades }: { trades: Trade[] }) {
  const latest = trades.reduce((m, t) => (t.date > m ? t.date : m), '') || todayISO();
  const [ym, setYm] = useState(() => ({ y: +latest.slice(0, 4), m: +latest.slice(5, 7) - 1 }));
  const weeks = monthGrid(ym.y, ym.m);
  const byDay = useMemo(() => {
    const m = new Map<string, Trade[]>();
    for (const t of trades) { if (!m.has(t.date)) m.set(t.date, []); m.get(t.date)!.push(t); }
    return m;
  }, [trades]);
  const shift = (d: number) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });
  const monthPnl = [...byDay.entries()].filter(([d]) => d.startsWith(`${ym.y}-${String(ym.m + 1).padStart(2, '0')}`)).flatMap(([, ts]) => ts).reduce((a, t) => a + tradePnl(t), 0);
  const today = todayISO();
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="display text-[28px]">{MONTHS[ym.m]} <span className="text-ink-3">{ym.y}</span></h2>
        <span className={cx('num ml-2 text-[14px]', pnlClass(monthPnl))}>{money(monthPnl, { sign: true })}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={15} /></Button>
          <Button size="sm" onClick={() => { const d = new Date(); setYm({ y: d.getFullYear(), m: d.getMonth() }); }}>Today</Button>
          <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={15} /></Button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="grid grid-cols-7 border-b border-line bg-surface text-[11px] uppercase tracking-[0.1em] text-ink-3">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <div key={d} className="px-2 py-1.5">{d}</div>)}
        </div>
        {weeks.map((w, i) => (
          <div key={i} className="grid grid-cols-7 border-b border-line last:border-b-0">
            {w.map((d, j) => {
              const ts = d ? byDay.get(d) ?? [] : [];
              const pnl = ts.reduce((a, t) => a + tradePnl(t), 0);
              return (
                <div key={j} className={cx('min-h-[104px] border-l border-line p-1.5 first:border-l-0', !d && 'bg-[#0f0f0e]', ts.length && (pnl > 0 ? 'bg-win-dim' : pnl < 0 ? 'bg-loss-dim' : ''))}>
                  {d && (
                    <>
                      <div className="flex items-center justify-between">
                        <Link to={`/outlook/${d}`} title="Open day outlook" className={cx('num grid size-6 place-items-center rounded-full text-[12px] hover:bg-hover', d === today ? 'bg-accent font-semibold text-[#1b1406] hover:bg-accent' : 'text-ink-3')}>{+d.slice(8)}</Link>
                        {ts.length > 0 && <span className={cx('num text-[11.5px] font-medium', pnlClass(pnl))}>{money(pnl, { sign: true, compact: Math.abs(pnl) >= 10000 })}</span>}
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {ts.slice(0, 3).map((t) => (
                          <Link key={t.id} to={`/trades/${t.id}`} className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-[11.5px] hover:bg-black/30">
                            <span className={cx('size-1.5 flex-none rounded-full', t.outcome === 'Win' ? 'bg-win' : t.outcome === 'Loss' ? 'bg-loss' : 'bg-be')} />
                            <span className="num truncate">{t.instrument} {t.position[0]}</span>
                          </Link>
                        ))}
                        {ts.length > 3 && <div className="px-1 text-[11px] text-ink-3">+{ts.length - 3} more</div>}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}


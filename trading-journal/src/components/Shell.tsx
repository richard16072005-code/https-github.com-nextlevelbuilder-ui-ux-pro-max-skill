import { Command } from 'cmdk';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpenText, CalendarDays, CandlestickChart, FileDown, LayoutDashboard, Menu, Plus, Search, Settings, Sun, Wallet, X,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import { createTrade } from '../lib/actions';
import { addDays, fmtDate, todayISO } from '../lib/dates';
import { money, pnlClass } from '../lib/format';
import { useMediaQuery } from '../lib/hooks';
import { tradePnl } from '../lib/trade';
import { QuickAdd } from './QuickAdd';
import { cx, Kbd } from './ui';

const AppCtx = createContext({ openQuickAdd: () => {}, openPalette: () => {} });
export const useApp = () => useContext(AppCtx);

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, key: '1' },
  { to: '/outlook', label: 'Daily Outlook', icon: Sun, key: '2' },
  { to: '/trades', label: 'Trades', icon: CandlestickChart, key: '3' },
  { to: '/accounts', label: 'Accounts & Spend', icon: Wallet, key: '4' },
  { to: '/settings', label: 'Settings', icon: Settings, key: '5' },
];

const typing = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
};

export function Shell({ children }: { children: ReactNode }) {
  const [palette, setPalette] = useState(false);
  const [quick, setQuick] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const nav = useNavigate();
  const loc = useLocation();
  useEffect(() => setDrawer(false), [loc.pathname]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette((p) => !p); return; }
      if (typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[role="dialog"]')) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setQuick(true); }
      if (e.key === 't' || e.key === 'T') { e.preventDefault(); nav(`/outlook/${todayISO()}`); }
      const item = NAV.find((n) => n.key === e.key);
      if (item) { e.preventDefault(); nav(item.to); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [nav]);

  const ctx = useMemo(() => ({ openQuickAdd: () => setQuick(true), openPalette: () => setPalette(true) }), []);

  return (
    <AppCtx.Provider value={ctx}>
      <div className="grain relative flex min-h-full">
        {(desktop || drawer) && (
          <>
            {!desktop && <div className="fixed inset-0 z-30 bg-black/60 animate-fade" onClick={() => setDrawer(false)} />}
            <Sidebar onPalette={() => setPalette(true)} onQuick={() => setQuick(true)} floating={!desktop} onClose={() => setDrawer(false)} />
          </>
        )}
        <div className="relative z-[1] min-w-0 flex-1">
          {!desktop && (
            <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-line bg-canvas/85 px-3 backdrop-blur">
              <button onClick={() => setDrawer(true)} className="grid size-9 place-items-center rounded-md text-ink-2 hover:bg-hover" aria-label="Open menu"><Menu size={18} /></button>
              <span className="display text-[22px]">Ledger</span>
              <button onClick={() => setQuick(true)} className="grid size-9 place-items-center rounded-md text-accent hover:bg-hover" aria-label="Quick add trade"><Plus size={18} /></button>
            </div>
          )}
          <main className="mx-auto w-full max-w-[1180px] px-4 pb-24 pt-8 sm:px-8 lg:px-12 lg:pt-12">{children}</main>
        </div>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} onQuick={() => { setPalette(false); setQuick(true); }} />
      <QuickAdd open={quick} onClose={() => setQuick(false)} />
    </AppCtx.Provider>
  );
}

function Sidebar({ onPalette, onQuick, floating, onClose }: { onPalette: () => void; onQuick: () => void; floating: boolean; onClose: () => void }) {
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = (d.getDay() + 6) % 7;
    return addDays(todayISO(), -day);
  }, []);
  const week = useLiveQuery(() => db.trades.where('date').aboveOrEqual(weekStart).toArray(), [weekStart]) ?? [];
  const today = todayISO();
  const weekPnl = week.reduce((s, t) => s + tradePnl(t), 0);
  const todayPnl = week.filter((t) => t.date === today).reduce((s, t) => s + tradePnl(t), 0);

  return (
    <aside
      className={cx(
        'z-40 flex w-[248px] flex-none flex-col border-r border-line bg-[#0f0f0e]',
        floating ? 'fixed inset-y-0 left-0 animate-[fade-up_160ms_ease-out] shadow-2xl' : 'sticky top-0 h-screen',
      )}
    >
      <div className="flex items-center justify-between px-4 pb-3 pt-5">
        <div className="flex items-center gap-2.5">
          <div className="grid size-7 place-items-center rounded-lg bg-accent-dim text-accent shadow-[inset_0_0_0_1px_#e9b44c40]">
            <svg viewBox="0 0 32 32" className="size-4"><path d="M6 22l6-7 5 4 9-11" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span className="display text-[24px] leading-none">Ledger</span>
        </div>
        {floating && <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-ink-3 hover:bg-hover" aria-label="Close menu"><X size={16} /></button>}
      </div>

      <div className="space-y-1.5 px-3">
        <button onClick={onPalette} className="flex h-8 w-full items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-[13px] text-ink-3 transition-colors hover:border-line-2 hover:text-ink-2">
          <Search size={14} /> Search & commands <span className="ml-auto"><Kbd>⌘K</Kbd></span>
        </button>
        <button onClick={onQuick} className="group flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[13px] font-medium text-accent transition-colors hover:bg-accent-dim">
          <Plus size={15} className="transition-transform group-hover:rotate-90" /> New trade <span className="ml-auto"><Kbd>N</Kbd></span>
        </button>
      </div>

      <nav className="mt-5 flex-1 space-y-0.5 px-3">
        <div className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-ink-3">Workspace</div>
        {NAV.map(({ to, label, icon: Icon, key }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => cx(
              'group relative flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13.5px] transition-colors',
              isActive ? 'bg-hover text-ink' : 'text-ink-2 hover:bg-[#191917] hover:text-ink',
            )}
          >
            {({ isActive }) => (
              <>
                {isActive && <span className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r bg-accent" />}
                <Icon size={15} className={isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'} />
                {label}
                <span className="num ml-auto text-[10.5px] text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">{key}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="m-3 rounded-lg border border-line bg-surface p-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-ink-3">
          <span>Today</span><span>This week</span>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className={cx('num text-[15px] font-medium', pnlClass(todayPnl))}>{money(todayPnl, { sign: true })}</span>
          <span className={cx('num text-[13px]', pnlClass(weekPnl))}>{money(weekPnl, { sign: true })}</span>
        </div>
        <div className="mt-2 text-[11.5px] text-ink-3">{week.length} trade{week.length === 1 ? '' : 's'} since {fmtDate(weekStart, { day: 'numeric', month: 'short' })}</div>
      </div>
    </aside>
  );
}

function Palette({ open, onClose, onQuick }: { open: boolean; onClose: () => void; onQuick: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const trades = useLiveQuery(() => (open ? db.trades.orderBy('date').reverse().limit(200).toArray() : []), [open]) ?? [];
  const go = useCallback((to: string) => { onClose(); nav(to); }, [nav, onClose]);
  useEffect(() => { if (!open) setQ(''); }, [open]);

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      label="Command palette"
      overlayClassName="fixed inset-0 z-[55] bg-black/55 backdrop-blur-[2px] animate-fade"
      contentClassName="fixed left-1/2 top-[14vh] z-[56] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line-2 bg-[#171716] shadow-[0_40px_100px_-20px_#000] animate-pop"
    >
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search size={16} className="text-ink-3" />
        <Command.Input value={q} onValueChange={setQ} autoFocus placeholder="Type a command or search trades…" className="h-12 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3" />
        <Kbd>Esc</Kbd>
      </div>
      <Command.List className="max-h-[420px] overflow-auto p-1.5 [&_[cmdk-item]]:flex [&_[cmdk-item]]:h-9 [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-2.5 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:text-[13.5px]">
        <Command.Empty className="px-3 py-6 text-center text-[13px] text-ink-3">Nothing found.</Command.Empty>
        <Command.Group heading="Actions">
          <Command.Item onSelect={onQuick}><Plus size={15} className="text-accent" /> New trade <span className="ml-auto"><Kbd>N</Kbd></span></Command.Item>
          <Command.Item onSelect={async () => { const id = await createTrade(); go(`/trades/${id}`); }}><BookOpenText size={15} className="text-ink-3" /> New trade page (full form)</Command.Item>
          <Command.Item onSelect={() => go(`/outlook/${todayISO()}`)}><Sun size={15} className="text-ink-3" /> Today’s outlook <span className="ml-auto"><Kbd>T</Kbd></span></Command.Item>
          <Command.Item onSelect={() => go(`/outlook/${addDays(todayISO(), 1)}`)}><CalendarDays size={15} className="text-ink-3" /> Tomorrow’s outlook</Command.Item>
          <Command.Item onSelect={() => go('/settings#backup')}><FileDown size={15} className="text-ink-3" /> Export backup</Command.Item>
        </Command.Group>
        <Command.Group heading="Go to">
          {NAV.map((n) => (
            <Command.Item key={n.to} value={`go ${n.label}`} onSelect={() => go(n.to)}>
              <n.icon size={15} className="text-ink-3" /> {n.label} <span className="ml-auto"><Kbd>{n.key}</Kbd></span>
            </Command.Item>
          ))}
        </Command.Group>
        {q.length > 0 && (
          <Command.Group heading="Trades">
            {trades.slice(0, 200).map((t) => (
              <Command.Item key={t.id} value={`${t.instrument} ${t.position} ${t.date} ${fmtDate(t.date)} ${t.outcome ?? ''} ${t.session}`} onSelect={() => go(`/trades/${t.id}`)}>
                <span className={cx('size-1.5 rounded-full', t.outcome === 'Win' ? 'bg-win' : t.outcome === 'Loss' ? 'bg-loss' : 'bg-be')} />
                <span className="font-medium">{t.instrument} {t.position}</span>
                <span className="text-ink-3">{fmtDate(t.date)} · {t.session}</span>
                <span className={cx('num ml-auto text-[12.5px]', pnlClass(tradePnl(t)))}>{money(tradePnl(t), { sign: true })}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

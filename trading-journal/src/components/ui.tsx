import clsx from 'clsx';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { Tag, TagColor } from '../db/types';
import { TAG_COLORS } from '../db/types';

export const cx = clsx;

/* ---------- Buttons ---------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'subtle' | 'danger'; size?: 'sm' | 'md' };
export function Button({ variant = 'subtle', size = 'md', className, ...p }: BtnProps) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-[background,color,transform,border] duration-150 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none select-none whitespace-nowrap',
        size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-3 text-[13px]',
        variant === 'primary' && 'bg-accent text-[#1b1406] hover:bg-[#f2c262] shadow-[0_0_0_1px_#e9b44c,0_6px_20px_-8px_#e9b44c80]',
        variant === 'subtle' && 'bg-raised text-ink border border-line hover:bg-hover hover:border-line-2',
        variant === 'ghost' && 'text-ink-2 hover:text-ink hover:bg-hover',
        variant === 'danger' && 'bg-loss-dim text-loss border border-[#ef7a6b33] hover:bg-[#ef7a6b2e]',
        className,
      )}
    />
  );
}

export function IconButton({ className, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...p}
      className={cx('inline-grid place-items-center size-7 rounded-md text-ink-3 hover:text-ink hover:bg-hover transition-colors active:scale-95', className)}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="num inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-2 bg-raised px-1 text-[10.5px] text-ink-3">{children}</kbd>;
}

/* ---------- Pills / tags ---------- */
export function TagPill({ name, color, onRemove, className }: { name: string; color: TagColor; onRemove?: () => void; className?: string }) {
  return (
    <span
      className={cx('inline-flex items-center gap-1 rounded-[5px] px-1.5 h-[22px] text-[12.5px] font-medium leading-none whitespace-nowrap', className)}
      style={{ background: `var(--tag-${color}-bg)`, color: `var(--tag-${color}-fg)` }}
    >
      {name}
      {onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="opacity-60 hover:opacity-100 -mr-0.5" aria-label={`Remove ${name}`}>
          <X size={12} />
        </button>
      )}
    </span>
  );
}

const OUTCOME_COLOR: Record<string, TagColor> = { Win: 'green', Loss: 'red', BE: 'gray' };
export function OutcomePill({ outcome }: { outcome: string | null }) {
  if (!outcome) return <span className="text-ink-3 text-[13px]">—</span>;
  return (
    <TagPill
      name={outcome}
      color={OUTCOME_COLOR[outcome]}
      className="before:content-[''] before:size-1.5 before:rounded-full before:bg-current before:mr-0.5"
    />
  );
}

export function PositionPill({ position }: { position: string }) {
  return <TagPill name={position} color={position === 'Long' ? 'blue' : 'orange'} />;
}

export function RuleBreakBadge({ compact }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-[5px] border border-[#ef7a6b40] bg-loss-dim px-1.5 h-[22px] text-[11.5px] font-semibold uppercase tracking-wide text-loss whitespace-nowrap" title="One or more model checklist items unchecked">
      <span className="size-1.5 rounded-full bg-loss animate-pulse" />
      {compact ? 'Rule' : 'Rule break'}
    </span>
  );
}

/* ---------- Popover ---------- */
export function Popover({
  open, onClose, anchor, children, width = 260, align = 'start',
}: { open: boolean; onClose: () => void; anchor: React.RefObject<HTMLElement | null>; children: ReactNode; width?: number; align?: 'start' | 'end' }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor.current) return;
    const place = () => {
      const r = anchor.current!.getBoundingClientRect();
      let left = align === 'end' ? r.right - width : r.left;
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      let top = r.bottom + 6;
      const h = ref.current?.offsetHeight ?? 280;
      if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
      setPos({ top, left });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, anchor, width, align]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node) || anchor.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey, true); };
  }, [open, onClose, anchor]);
  if (!open) return null;
  return createPortal(
    <div
      ref={ref}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width }}
      className="fixed z-[60] rounded-lg border border-line-2 bg-[#1c1c1a] shadow-[0_20px_50px_-12px_#000000cc] animate-pop overflow-hidden"
    >
      {children}
    </div>,
    document.body,
  );
}

/* ---------- Single select (Notion-like) ---------- */
export function Select<T extends string>({
  value, options, onChange, render, placeholder = 'Empty', className,
}: { value: T | null; options: readonly T[]; onChange: (v: T | null) => void; render?: (v: T) => ReactNode; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  const [hi, setHi] = useState(0);
  return (
    <>
      <button
        ref={ref}
        onClick={() => { setOpen((o) => !o); setHi(Math.max(0, value ? options.indexOf(value) : 0)); }}
        onKeyDown={(e) => {
          if (!open) return;
          if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => (h + 1) % options.length); }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => (h - 1 + options.length) % options.length); }
          if (e.key === 'Enter') { e.preventDefault(); onChange(options[hi]); setOpen(false); }
        }}
        className={cx('flex min-h-8 w-full items-center rounded-md px-2 text-left text-[13.5px] hover:bg-hover transition-colors', className)}
      >
        {value ? (render ? render(value) : value) : <span className="text-ink-3">{placeholder}</span>}
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} width={220}>
        <div className="p-1">
          {options.map((o, i) => (
            <button
              key={o}
              onMouseEnter={() => setHi(i)}
              onClick={() => { onChange(o); setOpen(false); }}
              className={cx('flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[13px]', i === hi && 'bg-hover')}
            >
              {render ? render(o) : o}
              {o === value && <Check size={14} className="text-ink-2" />}
            </button>
          ))}
          {value && (
            <button onClick={() => { onChange(null); setOpen(false); }} className="mt-1 w-full rounded-md border-t border-line px-2 py-1.5 text-left text-[12.5px] text-ink-3 hover:bg-hover">
              Clear
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}

/* ---------- Tag multi select with inline create ---------- */
export function TagSelect({
  value, tags, onChange, onCreate, placeholder = 'Empty', emptyHint,
}: {
  value: string[];
  tags: Tag[];
  onChange: (ids: string[]) => void;
  onCreate?: (name: string) => Promise<string>;
  placeholder?: string;
  emptyHint?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hi, setHi] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value.map((id) => tags.find((t) => t.id === id)).filter(Boolean) as Tag[];
  const filtered = tags.filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));
  const canCreate = !!onCreate && q.trim() && !tags.some((t) => t.name.toLowerCase() === q.trim().toLowerCase());
  const rows = filtered.length + (canCreate ? 1 : 0);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  const choose = async (i: number) => {
    if (i < filtered.length) toggle(filtered[i].id);
    else if (canCreate && onCreate) { const id = await onCreate(q.trim()); onChange([...value, id]); }
    setQ('');
  };
  return (
    <>
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); } }}
        onClick={() => setOpen(true)}
        className="flex min-h-8 w-full cursor-pointer flex-wrap items-center gap-1 rounded-md px-2 py-1 hover:bg-hover transition-colors"
      >
        {selected.length ? selected.map((t) => <TagPill key={t.id} name={t.name} color={t.color} />) : <span className="text-[13.5px] text-ink-3">{placeholder}</span>}
      </div>
      <Popover open={open} onClose={() => { setOpen(false); setQ(''); }} anchor={ref} width={300}>
        <div className="flex flex-wrap items-center gap-1 border-b border-line bg-[#171715] p-2">
          {selected.map((t) => <TagPill key={t.id} name={t.name} color={t.color} onRemove={() => toggle(t.id)} />)}
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, rows - 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              if (e.key === 'Enter') { e.preventDefault(); if (rows) choose(hi); }
              if (e.key === 'Backspace' && !q && value.length) onChange(value.slice(0, -1));
            }}
            placeholder={onCreate ? 'Search or create…' : 'Search…'}
            className="min-w-[80px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-3"
          />
        </div>
        <div className="max-h-[280px] overflow-auto p-1">
          <div className="px-2 pb-1 pt-1.5 text-[11px] text-ink-3">{emptyHint ?? 'Select an option or create one'}</div>
          {filtered.map((t, i) => (
            <button
              key={t.id}
              onMouseEnter={() => setHi(i)}
              onClick={() => choose(i)}
              className={cx('flex w-full items-center justify-between rounded-md px-2 py-1 text-left', i === hi && 'bg-hover')}
            >
              <TagPill name={t.name} color={t.color} />
              {value.includes(t.id) && <Check size={14} className="text-ink-2" />}
            </button>
          ))}
          {canCreate && (
            <button
              onMouseEnter={() => setHi(filtered.length)}
              onClick={() => choose(filtered.length)}
              className={cx('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-ink-2', hi === filtered.length && 'bg-hover')}
            >
              <Plus size={14} /> Create <TagPill name={q.trim()} color="gray" />
            </button>
          )}
        </div>
      </Popover>
    </>
  );
}

export const nextTagColor = (existing: Tag[]): TagColor => TAG_COLORS[(existing.length * 3 + 1) % TAG_COLORS.length];

/* ---------- Inputs ---------- */
export const inputCls =
  'h-8 w-full rounded-md bg-transparent px-2 text-[13.5px] text-ink outline-none transition-colors hover:bg-hover focus:bg-raised focus:shadow-[inset_0_0_0_1px_var(--color-line-2)] placeholder:text-ink-3';

export function NumberField({
  value, onChange, placeholder = 'Empty', step = 'any', suffix, className,
}: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; step?: string; suffix?: string; className?: string }) {
  const [draft, setDraft] = useState<string>(value == null ? '' : String(value));
  useEffect(() => { setDraft(value == null ? '' : String(value)); }, [value]);
  const commit = () => {
    const t = draft.trim().replace(/,/g, '').replace('−', '-');
    if (t === '') { if (value !== null) onChange(null); return; }
    const n = Number(t);
    if (!Number.isNaN(n) && n !== value) onChange(n);
    else setDraft(value == null ? '' : String(value));
  };
  return (
    <div className={cx('relative flex items-center', className)}>
      <input
        inputMode="decimal"
        step={step}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        placeholder={placeholder}
        className={cx(inputCls, 'num', suffix && 'pr-7')}
      />
      {suffix && draft !== '' && <span className="pointer-events-none absolute right-2 text-[12px] text-ink-3">{suffix}</span>}
    </div>
  );
}

export function TextField({ value, onChange, placeholder = 'Empty', className, multiline }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; multiline?: boolean }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  if (multiline) {
    return (
      <textarea
        value={draft}
        rows={2}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== value && onChange(draft)}
        placeholder={placeholder}
        className={cx(inputCls, 'h-auto min-h-8 resize-y py-1.5 leading-relaxed', className)}
      />
    );
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onChange(draft)}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      placeholder={placeholder}
      className={cx(inputCls, className)}
    />
  );
}

export function Checkbox({ checked, onChange, label, danger }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; danger?: boolean }) {
  return (
    <label className="group flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 hover:bg-hover transition-colors">
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cx(
          'mt-[1px] grid size-[18px] flex-none place-items-center rounded-[5px] border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-accent/60',
          checked ? 'border-accent bg-accent text-[#1b1406] scale-100' : cx('border-line-2 bg-transparent', danger && 'border-[#ef7a6b66]'),
        )}
      >
        <Check size={13} strokeWidth={3} className={cx('transition-transform duration-150', checked ? 'scale-100' : 'scale-0')} />
      </span>
      {label && <span className={cx('text-[13.5px] leading-snug transition-colors', checked ? 'text-ink' : 'text-ink-2')}>{label}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-5 w-9 flex-none rounded-full transition-colors duration-200', checked ? 'bg-accent' : 'bg-line-2')}
    >
      <span className={cx('absolute top-0.5 size-4 rounded-full bg-ink shadow transition-transform duration-200', checked ? 'translate-x-[18px]' : 'translate-x-0.5')} />
    </button>
  );
}

export function Segmented<T extends string>({ value, options, onChange, render, className }: { value: T | null; options: readonly T[]; onChange: (v: T) => void; render?: (v: T, active: boolean) => ReactNode; className?: string }) {
  return (
    <div className={cx('inline-flex rounded-lg border border-line bg-surface p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={cx(
            'h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-all duration-150',
            value === o ? 'bg-hover text-ink shadow-[inset_0_0_0_1px_var(--color-line-2)]' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          {render ? render(o, value === o) : o}
        </button>
      ))}
    </div>
  );
}

const MOOD_LABELS = ['Awful', 'Low', 'Neutral', 'Good', 'Great'];
const MOOD_COLORS = ['#ef7a6b', '#f0a36b', '#c8c4bb', '#7fb5ec', '#45c2b5'];
export function Scale({ value, onChange, labels = MOOD_LABELS, invert }: { value: number | null; onChange: (v: number | null) => void; labels?: string[]; invert?: boolean }) {
  return (
    <div className="flex items-center gap-1 px-2 py-1">
      {[1, 2, 3, 4, 5].map((n) => {
        const c = MOOD_COLORS[invert ? 5 - n : n - 1];
        const active = value != null && n <= value;
        return (
          <button
            key={n}
            title={`${n} · ${labels[n - 1]}`}
            onClick={() => onChange(value === n ? null : n)}
            className="group grid size-7 place-items-center rounded-md transition-transform hover:bg-hover active:scale-90"
          >
            <span
              className="size-3 rounded-full transition-all duration-200"
              style={{ background: active ? c : 'transparent', boxShadow: `inset 0 0 0 1.5px ${active ? c : '#4a4842'}`, transform: value === n ? 'scale(1.25)' : undefined }}
            />
          </button>
        );
      })}
      <span className="ml-1.5 w-16 text-[12px] text-ink-3">{value ? labels[value - 1] : ''}</span>
    </div>
  );
}

/* ---------- Layout helpers ---------- */
export function PropRow({ icon, label, children, className }: { icon?: ReactNode; label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cx('grid grid-cols-[minmax(120px,160px)_1fr] items-start gap-1 sm:grid-cols-[170px_1fr]', className)}>
      <div className="flex h-8 items-center gap-2 px-1 text-[13px] text-ink-3 select-none">
        <span className="flex-none opacity-80">{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SectionTitle({ children, right, className }: { children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={cx('mb-3 flex items-end justify-between gap-3 border-b border-line pb-2', className)}>
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-3">{children}</h3>
      {right}
    </div>
  );
}

export function PageHeader({ eyebrow, title, right, children }: { eyebrow?: ReactNode; title: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="mb-8 animate-fade-up">
      {eyebrow && <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">{eyebrow}</div>}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display text-[44px] leading-[1] text-ink sm:text-[52px]">{title}</h1>
        {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
      </div>
      {children}
    </header>
  );
}

export function Empty({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-line-2 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-ink-3">{icon}</div>}
      <div className="text-[15px] font-medium">{title}</div>
      {hint && <div className="mt-1 max-w-sm text-[13px] text-ink-3">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ open, onClose, children, width = 560, title }: { open: boolean; onClose: () => void; children: ReactNode; width?: number; title?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[10vh] backdrop-blur-[2px] animate-fade" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ maxWidth: width }} className="w-full rounded-xl border border-line-2 bg-[#171716] shadow-[0_30px_80px_-20px_#000] animate-pop">
        {title && (
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div className="text-[14px] font-semibold">{title}</div>
            <IconButton onClick={onClose} aria-label="Close"><X size={16} /></IconButton>
          </div>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function DropdownButton({ label, children, align = 'start' }: { label: ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button
        ref={ref}
        onClick={() => setOpen((o) => !o)}
        className={cx('inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-ink-2 transition-colors hover:bg-hover hover:text-ink', open && 'bg-hover text-ink')}
      >
        {label} <ChevronDown size={13} className="opacity-60" />
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} width={260} align={align}>
        {children(() => setOpen(false))}
      </Popover>
    </>
  );
}

/* ---------- Toasts ---------- */
type Toast = { id: number; text: string; tone?: 'ok' | 'err' };
const ToastCtx = createContext<(text: string, tone?: 'ok' | 'err') => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="animate-fade-up rounded-lg border border-line-2 bg-[#1f1f1c] px-4 py-2 text-[13px] shadow-xl">
            <span className={cx('mr-2 inline-block size-1.5 rounded-full align-middle', t.tone === 'err' ? 'bg-loss' : 'bg-win')} />
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function StatTile({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'win' | 'loss' | null }) {
  return (
    <div className="min-w-0 border-l border-line py-1 pl-4">
      <div className="text-[11.5px] uppercase tracking-[0.1em] text-ink-3">{label}</div>
      <div className={cx('num mt-1.5 truncate text-[22px] font-medium leading-none', tone === 'win' && 'text-win', tone === 'loss' && 'text-loss')}>{value}</div>
      {sub && <div className="mt-1.5 truncate text-[12px] text-ink-3">{sub}</div>}
    </div>
  );
}

/* ---------- In-app confirm (window.confirm is blocked in sandboxed frames) ---------- */
type ConfirmReq = { message: string; confirmLabel: string; resolve: (ok: boolean) => void };
let pushConfirm: ((r: ConfirmReq) => void) | null = null;

export function confirmDialog(message: string, confirmLabel = 'Confirm'): Promise<boolean> {
  return new Promise((resolve) => {
    if (!pushConfirm) { resolve(false); return; }
    pushConfirm({ message, confirmLabel, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<ConfirmReq | null>(null);
  useEffect(() => { pushConfirm = setReq; return () => { pushConfirm = null; }; }, []);
  const close = (ok: boolean) => { req?.resolve(ok); setReq(null); };
  return (
    <Modal open={!!req} onClose={() => close(false)} width={420}>
      <div className="p-5">
        <p className="text-[14px] leading-relaxed text-ink">{req?.message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button variant="danger" autoFocus onClick={() => close(true)}>{req?.confirmLabel}</Button>
        </div>
      </div>
    </Modal>
  );
}

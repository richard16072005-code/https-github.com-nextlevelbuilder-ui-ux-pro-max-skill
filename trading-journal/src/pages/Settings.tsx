import { ArrowDown, ArrowUp, Database, Download, FileUp, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button, cx, IconButton, Kbd, PageHeader, Popover, SectionTitle, Select, TagPill, TextField, useToast } from '../components/ui';
import { db, DEFAULT_SETTINGS, patchSettings, uid } from '../db/db';
import { clearDemo, seedDemo } from '../db/seed';
import type { ChecklistItem, Tag } from '../db/types';
import { TAG_COLORS } from '../db/types';
import { exportBackup, importBackup } from '../lib/backup';
import { download, tradesToCsv } from '../lib/csv';
import { todayISO } from '../lib/dates';
import { useSettings } from '../lib/hooks';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'JPY', 'ZAR', 'INR'] as const;

export default function SettingsPage() {
  const s = useSettings();
  const toast = useToast();
  const loc = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (loc.hash) document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [loc.hash]);

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try { await fn(); } catch (e) { console.error(e); toast(e instanceof Error ? e.message : 'Something went wrong', 'err'); } finally { setBusy(null); }
  };

  return (
    <div className="max-w-[860px]">
      <PageHeader eyebrow="Workspace" title="Settings" />

      <Block title="General">
        <Row label="Currency" hint="Used for every $ figure">
          <div className="w-40 rounded-md border border-line bg-surface"><Select value={s.currency} options={CURRENCIES} onChange={(currency) => currency && patchSettings({ currency })} render={(v) => <span className="num">{v}</span>} /></div>
        </Row>
        <Row label="Instruments" hint="First one is the default for new trades">
          <StringList values={s.instruments} onChange={(instruments) => patchSettings({ instruments })} placeholder="Add symbol…" upper />
        </Row>
        <Row label="Accounts" hint="Manage prop firm accounts and ledgers">
          <Link to="/accounts"><Button size="sm">Open Accounts & Spend →</Button></Link>
        </Row>
      </Block>

      <Block title="Entry confluences">
        <TagEditor tags={s.confluences} onChange={(confluences) => patchSettings({ confluences })} />
      </Block>

      <Block title="Emotion tags">
        <TagEditor tags={s.emotionTags} onChange={(emotionTags) => patchSettings({ emotionTags })} />
      </Block>

      <Block title="Model checklist" right={<span className="text-[12px] text-ink-3">Any unchecked item flags a trade as a rule break</span>}>
        <ChecklistEditor items={s.checklist} onChange={(checklist) => patchSettings({ checklist })} />
      </Block>

      <Block title="Behaviour flags">
        <ChecklistEditor
          items={s.behaviours}
          onChange={(b) => patchSettings({ behaviours: b.map((x) => ({ ...x, positive: s.behaviours.find((y) => y.id === x.id)?.positive })) })}
        />
      </Block>

      <Block title="Backup & export" id="backup">
        <p className="mb-4 text-[13px] leading-relaxed text-ink-2">
          Everything lives in this browser’s IndexedDB. A backup is a <span className="num text-ink">.zip</span> holding <span className="num text-ink">data.json</span> plus every screenshot as an image file. Importing a backup <strong className="text-ink">replaces</strong> all current data.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!!busy} onClick={() => run('export', async () => {
            const blob = await exportBackup();
            download(`ledger-backup-${todayISO()}.zip`, blob);
            toast(`Backup exported (${(blob.size / 1024 / 1024).toFixed(1)} MB)`);
          })}>
            <Download size={14} /> {busy === 'export' ? 'Exporting…' : 'Export backup (.zip)'}
          </Button>
          <Button disabled={!!busy} onClick={() => fileRef.current?.click()}><FileUp size={14} /> {busy === 'import' ? 'Importing…' : 'Import backup'}</Button>
          <Button disabled={!!busy} onClick={() => run('csv', async () => {
            const [trades, accounts] = await Promise.all([db.trades.orderBy('date').toArray(), db.accounts.toArray()]);
            download(`trades-${todayISO()}.csv`, tradesToCsv(trades, s, accounts), 'text/csv');
            toast(`${trades.length} trades exported to CSV`);
          })}><Download size={14} /> Trades CSV</Button>
          <input ref={fileRef} type="file" accept=".zip,application/zip" className="hidden" data-testid="import-input" onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!confirm('Importing replaces ALL current data with the backup. Continue?')) return;
            run('import', async () => { const r = await importBackup(f); toast(`Imported ${r.trades} trades and ${r.images} screenshots`); });
          }} />
        </div>
      </Block>

      <Block title="Demo data">
        <p className="mb-4 text-[13px] text-ink-2">The example NQ short (22 Sep 2026) plus dummy trades, accounts, ledgers and outlooks are flagged as demo. Clearing them leaves everything you created yourself.</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="danger" disabled={!!busy} onClick={() => confirm('Remove all demo trades, accounts, ledgers, outlooks and screenshots?') && run('clear', async () => { await clearDemo(); toast('Demo data cleared'); })}>
            <Sparkles size={14} /> {busy === 'clear' ? 'Clearing…' : 'Clear demo data'}
          </Button>
          <Button disabled={!!busy} onClick={() => run('seed', async () => { await seedDemo(); toast('Demo data loaded'); })}><Database size={14} /> {busy === 'seed' ? 'Loading…' : 'Load demo data'}</Button>
        </div>
      </Block>

      <Block title="Danger zone">
        <Button variant="danger" onClick={() => {
          if (!confirm('Erase EVERYTHING in this browser? Export a backup first.')) return;
          run('wipe', async () => {
            await Promise.all([db.trades.clear(), db.images.clear(), db.outlooks.clear(), db.accounts.clear(), db.expenses.clear(), db.payouts.clear()]);
            await db.settings.put({ ...DEFAULT_SETTINGS, seeded: true });
            toast('All data erased');
          });
        }}><Trash2 size={14} /> Erase all data</Button>
      </Block>

      <Block title="Keyboard">
        <div className="grid gap-2 text-[13px] text-ink-2 sm:grid-cols-2">
          {[['⌘K', 'Command palette'], ['N', 'Quick-add trade'], ['T', 'Today’s outlook'], ['1–5', 'Jump to a page'], ['⌥ ← / →', 'Previous/next day in outlook'], ['← / →', 'Switch timeframe in lightbox'], ['⌘ ↵', 'Create & open (quick add)'], ['⌘V', 'Paste into the hovered screenshot slot']].map(([k, l]) => (
            <div key={k} className="flex items-center justify-between rounded-md border border-line px-3 py-2"><span>{l}</span><Kbd>{k}</Kbd></div>
          ))}
        </div>
      </Block>
    </div>
  );
}

function Block({ title, children, right, id }: { title: string; children: React.ReactNode; right?: React.ReactNode; id?: string }) {
  return <section id={id} className="mb-12 scroll-mt-8"><SectionTitle right={right}>{title}</SectionTitle>{children}</section>;
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-line py-3 last:border-b-0 sm:grid-cols-[220px_1fr] sm:items-center">
      <div><div className="text-[13.5px]">{label}</div>{hint && <div className="text-[12px] text-ink-3">{hint}</div>}</div>
      <div>{children}</div>
    </div>
  );
}

function StringList({ values, onChange, placeholder, upper }: { values: string[]; onChange: (v: string[]) => void; placeholder: string; upper?: boolean }) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = upper ? draft.trim().toUpperCase() : draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {values.map((v, i) => (
        <span key={v} className="num inline-flex h-7 items-center gap-1 rounded-md border border-line bg-surface pl-2 pr-1 text-[12.5px] font-medium">
          {i === 0 && <span className="mr-0.5 size-1.5 rounded-full bg-accent" title="Default" />}
          <button onClick={() => onChange([v, ...values.filter((x) => x !== v)])} title="Make default">{v}</button>
          <button onClick={() => onChange(values.filter((x) => x !== v))} className="text-ink-3 hover:text-loss" aria-label={`Remove ${v}`}><X size={12} /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} onBlur={add} placeholder={placeholder} className="h-7 w-28 rounded-md bg-transparent px-2 text-[12.5px] outline-none placeholder:text-ink-3 hover:bg-hover focus:bg-raised" />
    </div>
  );
}

function TagEditor({ tags, onChange }: { tags: Tag[]; onChange: (t: Tag[]) => void }) {
  const [draft, setDraft] = useState('');
  const update = (id: string, p: Partial<Tag>) => onChange(tags.map((t) => (t.id === id ? { ...t, ...p } : t)));
  return (
    <div>
      <div className="divide-y divide-line rounded-lg border border-line">
        {tags.map((t) => (
          <div key={t.id} className="group flex items-center gap-2 px-2 py-1">
            <ColorPicker tag={t} onPick={(color) => update(t.id, { color })} />
            <TextField value={t.name} onChange={(name) => name.trim() && update(t.id, { name: name.trim() })} className="flex-1" />
            <IconButton title="Delete tag" className="opacity-0 group-hover:opacity-100 hover:!text-loss" onClick={() => confirm(`Delete “${t.name}”? Trades using it will lose the tag.`) && onChange(tags.filter((x) => x.id !== t.id))}><Trash2 size={13} /></IconButton>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="New tag…"
          onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onChange([...tags, { id: uid(), name: draft.trim(), color: TAG_COLORS[tags.length % TAG_COLORS.length] }]); setDraft(''); } }}
          className="h-8 w-56 rounded-md border border-line bg-surface px-2 text-[13px] outline-none placeholder:text-ink-3 focus:border-line-2" />
        <span className="text-[12px] text-ink-3">Enter to add</span>
      </div>
    </div>
  );
}

function ColorPicker({ tag, onPick }: { tag: Tag; onPick: (c: Tag['color']) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref} onClick={() => setOpen(true)} className="rounded-md p-1 hover:bg-hover" title="Change colour"><TagPill name={tag.name} color={tag.color} /></button>
      <Popover open={open} onClose={() => setOpen(false)} anchor={ref} width={200}>
        <div className="p-1">
          <div className="px-2 py-1 text-[11px] uppercase tracking-wider text-ink-3">Colour</div>
          {TAG_COLORS.map((c) => (
            <button key={c} onClick={() => { onPick(c); setOpen(false); }} className={cx('flex w-full items-center gap-2 rounded-md px-2 py-1 text-[13px] capitalize hover:bg-hover', c === tag.color && 'text-accent')}>
              <span className="size-4 rounded" style={{ background: `var(--tag-${c}-bg)`, boxShadow: `inset 0 0 0 1px var(--tag-${c}-fg)` }} /> {c}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

function ChecklistEditor<T extends ChecklistItem>({ items, onChange }: { items: T[]; onChange: (i: ChecklistItem[]) => void }) {
  const [draft, setDraft] = useState('');
  const move = (i: number, d: number) => { const n = [...items]; const [x] = n.splice(i, 1); n.splice(i + d, 0, x); onChange(n); };
  return (
    <div>
      <div className="divide-y divide-line rounded-lg border border-line">
        {items.map((c, i) => (
          <div key={c.id} className="group flex items-center gap-1 px-2 py-1">
            <span className="num w-6 text-center text-[11.5px] text-ink-3">{i + 1}</span>
            <TextField value={c.label} onChange={(label) => label.trim() && onChange(items.map((x) => (x.id === c.id ? { ...x, label } : x)))} className="flex-1" />
            <div className="flex opacity-0 transition-opacity group-hover:opacity-100">
              <IconButton title="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="disabled:opacity-30"><ArrowUp size={13} /></IconButton>
              <IconButton title="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="disabled:opacity-30"><ArrowDown size={13} /></IconButton>
              <IconButton title="Delete" className="hover:!text-loss" onClick={() => onChange(items.filter((x) => x.id !== c.id))}><Trash2 size={13} /></IconButton>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Plus size={14} className="text-ink-3" />
        <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add item…"
          onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) { onChange([...items, { id: uid(), label: draft.trim() }]); setDraft(''); } }}
          className="h-8 flex-1 rounded-md bg-transparent px-2 text-[13px] outline-none placeholder:text-ink-3 hover:bg-hover focus:bg-raised" />
      </div>
    </div>
  );
}


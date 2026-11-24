import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRight, ChevronLeft, ChevronRight, Sun } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, cx, Empty, PageHeader, SectionTitle, TagPill } from '../components/ui';
import { db } from '../db/db';
import { fmtDate, monthGrid, MONTHS, todayISO } from '../lib/dates';
import { money, pnlClass } from '../lib/format';
import { useTrades } from '../lib/hooks';
import { tradePnl } from '../lib/trade';

const BIAS = { Bullish: 'green', Bearish: 'red', Neutral: 'gray' } as const;

export default function Outlooks() {
  const outlooks = useLiveQuery(() => db.outlooks.orderBy('date').reverse().toArray(), []) ?? [];
  const trades = useTrades();
  const today = todayISO();
  const [ym, setYm] = useState({ y: +today.slice(0, 4), m: +today.slice(5, 7) - 1 });
  const pnlByDay = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of trades) m.set(t.date, (m.get(t.date) ?? 0) + tradePnl(t));
    return m;
  }, [trades]);
  const has = new Set(outlooks.map((o) => o.date));
  const shift = (d: number) => setYm(({ y, m }) => { const n = new Date(y, m + d, 1); return { y: n.getFullYear(), m: n.getMonth() }; });

  return (
    <div>
      <PageHeader
        eyebrow="One page per trading day"
        title="Daily Outlook"
        right={<Link to={`/outlook/${today}`}><Button variant="primary"><Sun size={14} /> Today’s outlook</Button></Link>}
      />

      <div className="grid gap-10 lg:grid-cols-[380px_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="display text-[26px]">{MONTHS[ym.m]} <span className="text-ink-3">{ym.y}</span></h2>
            <div className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Previous month"><ChevronLeft size={15} /></Button>
              <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Next month"><ChevronRight size={15} /></Button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] uppercase tracking-wider text-ink-3">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <div key={i} className="pb-1">{d}</div>)}
          </div>
          {monthGrid(ym.y, ym.m).map((w, i) => (
            <div key={i} className="mb-1 grid grid-cols-7 gap-1">
              {w.map((d, j) => {
                const p = d ? pnlByDay.get(d) : undefined;
                return d ? (
                  <Link key={j} to={`/outlook/${d}`}
                    className={cx('relative flex aspect-square flex-col items-center justify-center rounded-lg border text-[13px] transition-all hover:border-ink-3',
                      d === today ? 'border-accent text-accent' : has.has(d) ? 'border-line-2 bg-surface' : 'border-transparent text-ink-3 hover:bg-surface')}>
                    <span className="num">{+d.slice(8)}</span>
                    {p != null && <span className={cx('num text-[9.5px]', pnlClass(p))}>{p >= 0 ? '+' : '−'}{Math.abs(p) >= 1000 ? `${(Math.abs(p) / 1000).toFixed(1)}k` : Math.round(Math.abs(p))}</span>}
                    {has.has(d) && <span className="absolute right-1 top-1 size-1 rounded-full bg-accent" />}
                  </Link>
                ) : <div key={j} />;
              })}
            </div>
          ))}
          <div className="mt-3 flex items-center gap-3 text-[11.5px] text-ink-3">
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-accent" /> outlook written</span>
            <span>numbers = day PnL</span>
          </div>
        </section>

        <section>
          <SectionTitle>Recent outlooks</SectionTitle>
          {outlooks.length === 0 ? (
            <Empty title="No outlooks yet" hint="Start the day by writing your bias, levels and mindset check." action={<Link to={`/outlook/${today}`}><Button variant="primary">Write today’s outlook</Button></Link>} />
          ) : (
            <div className="space-y-2">
              {outlooks.slice(0, 30).map((o) => {
                const p = pnlByDay.get(o.date);
                return (
                  <Link key={o.id} to={`/outlook/${o.date}`} className="group flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 transition-all hover:border-line-2 hover:bg-[#171716]">
                    <div className="w-[120px]">
                      <div className="text-[14px] font-medium">{fmtDate(o.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div>
                      <div className="text-[11.5px] text-ink-3">{o.date.slice(0, 4)}</div>
                    </div>
                    <div className="flex flex-1 flex-wrap gap-1.5">
                      {o.biases.filter((b) => b.bias).map((b, i) => <TagPill key={i} name={`${b.instrument} ${b.bias}`} color={BIAS[b.bias!]} />)}
                      {o.go != null && <TagPill name={o.go ? 'Go' : 'No-go'} color={o.go ? 'green' : 'red'} />}
                      {o.followedBias && <TagPill name={`Followed: ${o.followedBias}`} color="gray" />}
                    </div>
                    {p != null && <span className={cx('num text-[13.5px] font-medium', pnlClass(p))}>{money(p, { sign: true })}</span>}
                    <ArrowRight size={15} className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

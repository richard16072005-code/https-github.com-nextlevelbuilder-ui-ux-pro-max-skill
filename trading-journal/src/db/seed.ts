import { db, DEFAULT_SETTINGS, getSettings, JOURNAL_TEMPLATE } from './db';
import type { Account, Expense, Outlook, Payout, Session, Timeframe, Trade } from './types';
import { putSlotImage } from '../lib/images';
import { addDays, parseISO, todayISO } from '../lib/dates';

// Deterministic PRNG so demo data looks the same on every fresh install.
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Draws a fake candlestick chart so the gallery and lightbox have something real to show. */
export async function demoChart(seed: number, tf: string, label: string, trend: 1 | -1): Promise<Blob> {
  const rnd = mulberry32(seed);
  const W = 1280, H = 720;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#121211';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,0.04)';
  g.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  for (let y = 0; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }

  const n = 70;
  let p = 100;
  const candles: { o: number; h: number; l: number; c: number }[] = [];
  for (let i = 0; i < n; i++) {
    const drift = (i > n * 0.45 ? trend : -trend * 0.35) * 0.6;
    const o = p;
    const cl = o + drift + (rnd() - 0.5) * 3.2;
    candles.push({ o, c: cl, h: Math.max(o, cl) + rnd() * 1.6, l: Math.min(o, cl) - rnd() * 1.6 });
    p = cl;
  }
  const hi = Math.max(...candles.map((k) => k.h)), lo = Math.min(...candles.map((k) => k.l));
  const y = (v: number) => 70 + ((hi - v) / (hi - lo)) * (H - 140);
  const cw = (W - 120) / n;

  // FVG box
  const fi = Math.floor(n * 0.5);
  g.fillStyle = 'rgba(233,180,76,0.10)';
  g.strokeStyle = 'rgba(233,180,76,0.45)';
  const fy1 = y(candles[fi].h), fy2 = y(candles[fi + 2].l);
  g.fillRect(60 + fi * cw, Math.min(fy1, fy2), W - 120 - fi * cw, Math.abs(fy2 - fy1) + 6);
  g.strokeRect(60 + fi * cw, Math.min(fy1, fy2), W - 120 - fi * cw, Math.abs(fy2 - fy1) + 6);

  candles.forEach((k, i) => {
    const x = 60 + i * cw + cw / 2;
    const up = k.c >= k.o;
    g.strokeStyle = g.fillStyle = up ? '#5fcf9b' : '#ef7a6b';
    g.beginPath(); g.moveTo(x, y(k.h)); g.lineTo(x, y(k.l)); g.stroke();
    const top = y(Math.max(k.o, k.c)), bot = y(Math.min(k.o, k.c));
    g.fillRect(x - cw * 0.32, top, cw * 0.64, Math.max(1.5, bot - top));
  });

  // liquidity line
  g.setLineDash([6, 6]);
  g.strokeStyle = 'rgba(160,160,255,0.55)';
  const ly = y(trend > 0 ? lo + (hi - lo) * 0.08 : hi - (hi - lo) * 0.08);
  g.beginPath(); g.moveTo(60, ly); g.lineTo(W - 60, ly); g.stroke();
  g.setLineDash([]);

  g.fillStyle = 'rgba(236,232,224,0.9)';
  g.font = '600 26px Inter, system-ui, sans-serif';
  g.fillText(`${label} · ${tf}`, 60, H - 28);
  g.fillStyle = 'rgba(236,232,224,0.35)';
  g.font = '18px Inter, system-ui, sans-serif';
  g.fillText('demo screenshot', W - 220, H - 28);
  return new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
}

const journal = (parts: string[]) =>
  ['Bias + Reasoning', 'Setup', 'Entry', 'Result', 'What I Did Right', 'Mistake', 'Lesson']
    .map((h, i) => `<h2>${h}</h2><p>${parts[i] ?? ''}</p>`).join('');

export async function seedIfNeeded() {
  const s = await db.settings.get('app');
  if (s?.seeded) return;
  await seedDemo();
}

export async function seedDemo() {
  const now = Date.now();
  const accounts: Account[] = [
    { id: 'acc-lucid-1', firm: 'Lucid Trading', name: 'Lucid Flex 50K · #1', size: 50000, type: 'Funded', status: 'Active', startDate: '2026-08-18', maxLoss: 2000, drawdownType: 'Trailing EOD', dailyLossLimit: null, profitTarget: null, notes: '', isDemo: true, createdAt: now },
    { id: 'acc-lucid-2', firm: 'Lucid Trading', name: 'Lucid Flex 50K · #2', size: 50000, type: 'Funded', status: 'Active', startDate: '2026-09-08', maxLoss: 2000, drawdownType: 'Trailing EOD', dailyLossLimit: null, profitTarget: null, notes: '', isDemo: true, createdAt: now },
    { id: 'acc-lucid-eval', firm: 'Lucid Trading', name: 'Lucid Flex 50K · Eval', size: 50000, type: 'Eval', status: 'Active', startDate: '2026-10-20', maxLoss: 2000, drawdownType: 'Trailing EOD', dailyLossLimit: null, profitTarget: 3000, notes: '', isDemo: true, createdAt: now },
    { id: 'acc-other-100', firm: 'Topstep', name: '100K Combine', size: 100000, type: 'Eval', status: 'Failed', startDate: '2026-08-04', maxLoss: 3000, drawdownType: 'Trailing EOD', dailyLossLimit: 2000, profitTarget: 6000, notes: 'Blew it on revenge trades after CPI.', isDemo: true, createdAt: now },
  ];

  const S = DEFAULT_SETTINGS;
  const allChecked = Object.fromEntries(S.checklist.map((c) => [c.id, true]));

  const example: Trade = {
    id: 'trade-example-2026-09-22',
    date: '2026-09-22', time: '09:52', session: 'NY AM', instrument: 'NQ', position: 'Short',
    accounts: [{ accountId: 'acc-lucid-1', contracts: 1, pnl: -500 }],
    riskPct: 1, plannedRR: 2, realizedR: -1, entry: 24718.5, stop: 24743.5, target: 24668.5,
    outcome: 'Loss',
    confluences: ['c-4hfvg', 'c-15smt', 'c-cisd', 'c-htfsmt', 'c-amd', 'c-15fvg'],
    checklist: { ...allChecked, bias: false, ifvg: false },
    journal: journal([
      'Daily bias was <strong>bullish</strong>: price had displaced through the 4H FVG and was drawing toward the old highs. I shorted anyway off the 15M FVG SMT.',
      '4H FVG overhead, HTF SMT between NQ and ES at the London high, then CISD on the 15m. Textbook AMD shape: Asia accumulation, London manipulation.',
      'Entered on the CISD candle close, without waiting for the 3m IFVG to invert.',
      'Stopped out for −1R. Price ran the stop and then continued to the bullish draw.',
      'Sized correctly at 1% and respected the stop. No moving it.',
      'Took a counter-bias trade and skipped the LTF IFVG confirmation.',
      'If the bias box is unchecked, there is no trade. The IFVG inversion is the trigger, not the CISD alone.',
    ]),
    moodPre: 3, moodDuring: 2, moodPost: 2,
    emotions: ['e-impatient', 'e-fomo'],
    behaviours: ['b-against-bias'],
    isDemo: true, createdAt: now, updatedAt: now,
  };

  const rnd = mulberry32(42);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const trades: Trade[] = [example];
  const combos = [
    ['c-cisd', 'c-ifvg'], ['c-cisd'], ['c-cisd', 'c-ifvg', 'c-sweep'], ['c-15fvg', 'c-htfsmt', 'c-cisd'],
    ['c-4hfvg', 'c-ifvg', 'c-disp'], ['c-sweep', 'c-pd'], ['c-1hfvg', 'c-cisd', 'c-ifvg'], ['c-amd', 'c-sweep', 'c-cisd'],
  ];
  const sessions: Session[] = ['NY AM', 'NY AM', 'NY AM', 'NY AM', 'NY AM', 'London', 'NY PM', 'Asia'];
  const end = todayISO() > '2026-11-21' ? '2026-11-21' : addDays(todayISO(), -1);
  let d = '2026-09-01';
  while (d <= end) {
    const wd = parseISO(d).getDay();
    if (wd !== 0 && wd !== 6 && d !== '2026-09-22' && rnd() < 0.62) {
      const combo = pick(combos);
      const strong = combo.includes('c-ifvg') && combo.length >= 2;
      const checklist = { ...allChecked };
      if (rnd() < 0.28) checklist[pick(S.checklist).id] = false;
      const ruleBreak = Object.values(checklist).some((v) => !v);
      const pWin = 0.52 + (strong ? 0.2 : 0) - (ruleBreak ? 0.22 : 0);
      const r = rnd();
      const outcome = r < pWin ? 'Win' : r < pWin + 0.1 ? 'BE' : 'Loss';
      const plannedRR = pick([2, 2, 2.5, 3]);
      const realizedR = outcome === 'Win' ? +(plannedRR * (0.7 + rnd() * 0.3)).toFixed(2) : outcome === 'BE' ? 0 : -1;
      const instrument = pick(['MNQ', 'MNQ', 'NQ', 'ES', 'MES']);
      const accIds = d >= '2026-10-20'
        ? (rnd() < 0.7 ? ['acc-lucid-1', 'acc-lucid-2', 'acc-lucid-eval'] : ['acc-lucid-1', 'acc-lucid-2'])
        : d >= '2026-09-08' ? (rnd() < 0.75 ? ['acc-lucid-1', 'acc-lucid-2'] : ['acc-lucid-1'])
        : d <= '2026-09-12' && rnd() < 0.5 ? ['acc-other-100'] : ['acc-lucid-1'];
      const contracts = instrument === 'MNQ' ? 5 : instrument === 'MES' ? 4 : 1;
      const riskDollars = 250 + Math.round(rnd() * 3) * 50;
      const emotions = outcome === 'Loss' && ruleBreak ? [pick(['e-fomo', 'e-revenge', 'e-impatient', 'e-anxious'])] : [pick(['e-calm', 'e-confident', 'e-calm', 'e-bored'])];
      const behaviours = ruleBreak ? [pick(['b-early-exit', 'b-be-early', 'b-overtraded'])] : ['b-plan'];
      if (!checklist.bias) behaviours.push('b-against-bias');
      const position = rnd() < 0.5 ? 'Long' : 'Short';
      const entry = instrument.includes('NQ') ? 24000 + Math.round(rnd() * 1500) : 6500 + Math.round(rnd() * 400);
      const pts = instrument.includes('NQ') ? 20 + Math.round(rnd() * 15) : 5 + Math.round(rnd() * 4);
      const dir = position === 'Long' ? 1 : -1;
      trades.push({
        id: `demo-${d}`, date: d, time: `09:${String(35 + Math.floor(rnd() * 25)).padStart(2, '0')}`,
        session: pick(sessions), instrument, position,
        accounts: accIds.map((accountId) => ({ accountId, contracts, pnl: Math.round(realizedR * riskDollars) })),
        riskPct: +(riskDollars / 500).toFixed(1), plannedRR, realizedR,
        entry, stop: entry - dir * pts, target: entry + dir * pts * plannedRR,
        outcome, confluences: combo, checklist,
        journal: JOURNAL_TEMPLATE,
        moodPre: 2 + Math.floor(rnd() * 4), moodDuring: 2 + Math.floor(rnd() * 4), moodPost: outcome === 'Win' ? 4 : 2 + Math.floor(rnd() * 2),
        emotions, behaviours,
        isDemo: true, createdAt: now, updatedAt: now,
      });
    }
    d = addDays(d, 1);
  }

  const expenses: Expense[] = [
    { id: 'ex1', date: '2026-08-04', firm: 'Topstep', category: 'Eval purchase', amount: 149, note: '100K Combine', isDemo: true },
    { id: 'ex2', date: '2026-08-12', firm: 'Topstep', category: 'Reset', amount: 99, note: '', isDemo: true },
    { id: 'ex3', date: '2026-08-10', firm: 'Lucid Trading', category: 'Eval purchase', amount: 110, note: 'Flex 50K', isDemo: true },
    { id: 'ex4', date: '2026-08-18', firm: 'Lucid Trading', category: 'Activation fee', amount: 0, note: 'No activation on Flex', isDemo: true },
    { id: 'ex5', date: '2026-09-01', firm: 'Lucid Trading', category: 'Eval purchase', amount: 110, note: 'Flex 50K #2', isDemo: true },
    { id: 'ex6', date: '2026-09-03', firm: 'TradingView', category: 'Subscription', amount: 30, note: 'Premium', isDemo: true },
    { id: 'ex7', date: '2026-10-03', firm: 'TradingView', category: 'Subscription', amount: 30, note: 'Premium', isDemo: true },
    { id: 'ex8', date: '2026-11-03', firm: 'TradingView', category: 'Subscription', amount: 30, note: 'Premium', isDemo: true },
    { id: 'ex9', date: '2026-10-15', firm: 'Lucid Trading', category: 'Eval purchase', amount: 110, note: 'Flex 50K eval #3', isDemo: true },
    { id: 'ex10', date: '2026-09-05', firm: 'CME', category: 'Data fee', amount: 12, note: 'Non-pro bundle', isDemo: true },
    { id: 'ex11', date: '2026-10-05', firm: 'CME', category: 'Data fee', amount: 12, note: '', isDemo: true },
    { id: 'ex12', date: '2026-11-05', firm: 'CME', category: 'Data fee', amount: 12, note: '', isDemo: true },
  ];
  const payouts: Payout[] = [
    { id: 'po1', date: '2026-10-09', firm: 'Lucid Trading', accountId: 'acc-lucid-1', amount: 800, note: 'First payout', isDemo: true },
    { id: 'po2', date: '2026-11-06', firm: 'Lucid Trading', accountId: 'acc-lucid-1', amount: 1000, note: '', isDemo: true },
    { id: 'po3', date: '2026-11-13', firm: 'Lucid Trading', accountId: 'acc-lucid-2', amount: 600, note: '', isDemo: true },
  ];

  const outlooks: Outlook[] = trades.slice(-8).concat(example).map((t, i) => ({
    id: t.date, date: t.date,
    biases: [
      { instrument: 'NQ', bias: t.id === example.id ? 'Bullish' : i % 3 === 0 ? 'Bearish' : 'Bullish', reasoning: 'Displacement through 4H FVG; drawing on PDH.' },
      { instrument: 'ES', bias: i % 4 === 0 ? 'Neutral' : 'Bullish', reasoning: 'Following NQ, watching SMT at London high.' },
    ],
    keyLevels: 'PDH 24,812 · PDL 24,590 · 4H FVG 24,700–24,735 · NWOG 24,655',
    drawOnLiquidity: 'Buy-side above PDH (equal highs from Friday).',
    news: [{ id: 'n1', time: '08:30', title: i % 2 ? 'Initial Jobless Claims' : 'CPI m/m', impact: i % 2 ? 'Medium' : 'High' }],
    notes: '<p>Wait for London to complete the manipulation leg before looking for a model entry.</p>',
    sleep: 3 + (i % 3), stress: 2 + (i % 2), mood: 3 + (i % 2),
    go: i % 5 !== 4, goReason: i % 5 === 4 ? 'Slept badly, FOMC tomorrow.' : 'Rested, clear on levels.',
    followedBias: t.outcome === 'Win' ? 'Yes' : i % 2 ? 'Partly' : 'No',
    learned: '<p>Patience at the open paid off. Let the first 15 minutes print.</p>',
    walkedAway: i % 3 === 0,
    isDemo: true, updatedAt: now,
  }));

  const current = await getSettings();
  await db.transaction('rw', [db.accounts, db.trades, db.expenses, db.payouts, db.outlooks, db.settings], async () => {
    await db.accounts.bulkPut(accounts);
    await db.trades.bulkPut(trades);
    await db.expenses.bulkPut(expenses);
    await db.payouts.bulkPut(payouts);
    await db.outlooks.bulkPut(outlooks);
    await db.settings.put({ ...current, seeded: true, lastAccounts: ['acc-lucid-1', 'acc-lucid-2'] });
  });

  // Screenshots: the full set for the example trade, a few slots on recent demo trades.
  const tfs: Timeframe[] = ['1m', '5m', '15m', '1H', '2H', '4H'];
  for (const [j, tf] of tfs.entries()) {
    await putSlotImage('trade', example.id, tf, await demoChart(900 + j, tf, 'NQ Short · 22 Sep', -1), true);
  }
  const withShots = trades.slice(1).filter((_, i) => i % 3 === 0).slice(-14);
  for (const [i, t] of withShots.entries()) {
    for (const tf of ['15m', '5m', '1H'] as Timeframe[]) {
      await putSlotImage('trade', t.id, tf, await demoChart(i * 7 + tf.length, tf, `${t.instrument} ${t.position}`, t.position === 'Long' ? 1 : -1), true);
    }
  }
  const lastOutlook = outlooks[outlooks.length - 2];
  if (lastOutlook) {
    for (const tf of ['4H', '1H', '15m'] as Timeframe[]) {
      await putSlotImage('outlook', lastOutlook.id, tf, await demoChart(500 + tf.length, tf, 'NQ Outlook', 1), true);
    }
  }
}

export async function clearDemo() {
  await db.transaction('rw', [db.accounts, db.trades, db.expenses, db.payouts, db.outlooks, db.images, db.settings], async () => {
    await db.trades.filter((t) => !!t.isDemo).delete();
    await db.accounts.filter((t) => !!t.isDemo).delete();
    await db.expenses.filter((t) => !!t.isDemo).delete();
    await db.payouts.filter((t) => !!t.isDemo).delete();
    await db.outlooks.filter((t) => !!t.isDemo).delete();
    const tradeIds = new Set(await db.trades.toCollection().primaryKeys());
    const outlookIds = new Set(await db.outlooks.toCollection().primaryKeys());
    await db.images
      .filter((i) => !!i.isDemo || (i.ownerType === 'trade' ? !tradeIds.has(i.ownerId) : !outlookIds.has(i.ownerId)))
      .delete();
    const s = await getSettings();
    const ids = new Set((await db.accounts.toArray()).map((a) => a.id));
    await db.settings.put({ ...s, lastAccounts: s.lastAccounts.filter((id) => ids.has(id)), seeded: true });
  });
}

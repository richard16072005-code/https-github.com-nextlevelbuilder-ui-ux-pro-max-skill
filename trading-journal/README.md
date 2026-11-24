# Ledger: trading journal

A local-first trading journal for index-futures prop traders (MNQ / NQ / ES / MES, ICT/SMC). It has a dark, Notion-style workspace, needs no login and no backend, and stores everything in your browser's IndexedDB.

```bash
npm install
npm run dev     # http://localhost:5173
```

## What's inside
- **Trades**: Table / Gallery / Calendar views, filters, sort, search and CSV export. Each trade page has its properties, per-account contracts and $ PnL, coloured confluence tags, a model checklist (any unchecked item means a **Rule break**), 1m–4H screenshot slots (paste / drop / click, lightbox with ← →, captions), a rich-text journal and psychology fields.
- **Daily Outlook**: one page per day with bias per instrument, levels, DOL, news, screenshots, a mindset Go/No-go check, the EOD review, and the day's trades with their PnL.
- **Dashboard**: equity curve, daily PnL, PnL heatmap, R-trajectory, the core stats and streaks, and breakdowns by confluence combo, session, weekday, emotion, bias and rule breaks.
- **Accounts & Spend**: balances from linked trades, distance to max loss (static or trailing EOD), and expense/payout ledgers with ROI, cost per funded account and pass rate.
- **Settings**: tags, instruments, checklist, behaviours, currency, a backup `.zip` (data.json plus image files) with export/import, and clearing or reloading demo data.

## Keyboard
`⌘/Ctrl K` palette · `N` quick-add · `T` today's outlook · `1–5` pages · `⌘V` over a slot pastes a screenshot.

## Stack
Vite, React 18, TypeScript, Tailwind v4, Dexie, Recharts, TipTap, cmdk and JSZip. Fonts are bundled, so the app works offline.

import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Shell } from './components/Shell';
import { ConfirmHost, ToastProvider } from './components/ui';
import { seedIfNeeded } from './db/seed';
import Accounts from './pages/Accounts';
import Dashboard from './pages/Dashboard';
import OutlookDay from './pages/OutlookDay';
import Outlooks from './pages/Outlooks';
import SettingsPage from './pages/Settings';
import TradePage from './pages/TradePage';
import Trades from './pages/Trades';

let seeding: Promise<void> | null = null;

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    seeding ??= seedIfNeeded().catch((e) => console.error('Seed failed', e));
    seeding.then(() => setReady(true));
  }, []);
  if (!ready) {
    return (
      <div className="grid h-full place-items-center">
        <div className="flex items-center gap-3 text-ink-3">
          <span className="size-2 animate-pulse rounded-full bg-accent" />
          <span className="display text-2xl text-ink-2">Ledger</span>
        </div>
      </div>
    );
  }
  return (
    <ToastProvider>
      <Shell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/outlook" element={<Outlooks />} />
          <Route path="/outlook/:date" element={<OutlookDay />} />
          <Route path="/trades" element={<Trades />} />
          <Route path="/trades/:id" element={<TradePage />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </Shell>
      <ConfirmHost />
    </ToastProvider>
  );
}

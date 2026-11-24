let currency = 'USD';
export const setCurrency = (c: string) => { currency = c || 'USD'; };

export const money = (n: number | null | undefined, opts: { sign?: boolean; compact?: boolean } = {}) => {
  if (n == null || Number.isNaN(n)) return '—';
  const f = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: opts.compact ? 1 : Math.abs(n) >= 1000 ? 0 : 2,
    minimumFractionDigits: 0,
    notation: opts.compact ? 'compact' : 'standard',
  });
  const s = f.format(Math.abs(n));
  if (n < 0) return `−${s}`;
  return opts.sign && n > 0 ? `+${s}` : s;
};

export const num = (n: number | null | undefined, d = 2) =>
  n == null || Number.isNaN(n) ? '—' : n.toLocaleString('en-US', { maximumFractionDigits: d });

export const rr = (n: number | null | undefined, sign = true) =>
  n == null || Number.isNaN(n) ? '—' : `${sign && n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(2)}R`;

export const pct = (n: number | null | undefined, d = 0) =>
  n == null || Number.isNaN(n) || !Number.isFinite(n) ? '—' : `${(n * 100).toFixed(d)}%`;

export const pnlClass = (n: number | null | undefined) =>
  n == null || n === 0 ? 'text-ink-2' : n > 0 ? 'text-win' : 'text-loss';

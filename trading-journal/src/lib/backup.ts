import JSZip from 'jszip';
import { db } from '../db/db';
import type { StoredImage } from '../db/types';
import { extFor } from './images';

const FORMAT = 'ledger-backup';
const VERSION = 1;

export async function exportBackup(): Promise<Blob> {
  const zip = new JSZip();
  const [trades, outlooks, accounts, expenses, payouts, settings, images] = await Promise.all([
    db.trades.toArray(), db.outlooks.toArray(), db.accounts.toArray(), db.expenses.toArray(),
    db.payouts.toArray(), db.settings.toArray(), db.images.toArray(),
  ]);
  const imageMeta = images.map(({ blob, thumb, ...meta }) => {
    const file = `images/${meta.id}.${extFor(blob.type)}`;
    const thumbFile = `images/${meta.id}.thumb.${extFor(thumb.type)}`;
    zip.file(file, blob);
    zip.file(thumbFile, thumb);
    return { ...meta, file, thumbFile, type: blob.type, thumbType: thumb.type };
  });
  zip.file('data.json', JSON.stringify({
    format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(),
    trades, outlooks, accounts, expenses, payouts, settings, images: imageMeta,
  }, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export async function importBackup(file: Blob) {
  const zip = await JSZip.loadAsync(file);
  const raw = await zip.file('data.json')?.async('string');
  if (!raw) throw new Error('data.json missing from backup');
  const data = JSON.parse(raw);
  if (data.format !== FORMAT) throw new Error('Not a Ledger backup file');

  const images: StoredImage[] = [];
  for (const m of data.images ?? []) {
    const bytes = await zip.file(m.file)?.async('arraybuffer');
    if (!bytes) continue;
    const tBytes = await zip.file(m.thumbFile)?.async('arraybuffer');
    const { file: _f, thumbFile: _tf, type, thumbType, ...meta } = m;
    const blob = new Blob([bytes], { type });
    images.push({ ...meta, blob, thumb: tBytes ? new Blob([tBytes], { type: thumbType }) : blob });
  }

  await db.transaction('rw', [db.trades, db.outlooks, db.accounts, db.expenses, db.payouts, db.settings, db.images], async () => {
    await Promise.all([db.trades.clear(), db.outlooks.clear(), db.accounts.clear(), db.expenses.clear(), db.payouts.clear(), db.settings.clear(), db.images.clear()]);
    await db.trades.bulkAdd(data.trades ?? []);
    await db.outlooks.bulkAdd(data.outlooks ?? []);
    await db.accounts.bulkAdd(data.accounts ?? []);
    await db.expenses.bulkAdd(data.expenses ?? []);
    await db.payouts.bulkAdd(data.payouts ?? []);
    await db.settings.bulkAdd((data.settings ?? []).map((s: object) => ({ ...s, seeded: true })));
    await db.images.bulkAdd(images);
  });
  return { trades: data.trades?.length ?? 0, images: images.length };
}

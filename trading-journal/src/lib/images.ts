import { db, uid } from '../db/db';
import type { OwnerType, Timeframe } from '../db/types';

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(blob); } catch { /* fall through */ }
  }
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(blob);
  });
}

export async function makeThumb(blob: Blob, max = 720) {
  const bmp = await loadBitmap(blob);
  const w = bmp.width, h = bmp.height;
  const scale = Math.min(1, max / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const thumb: Blob = await new Promise((r) => canvas.toBlob((b) => r(b!), 'image/webp', 0.82));
  return { thumb, width: w, height: h };
}

/** Store (or replace) the image in a slot. */
export async function putSlotImage(ownerType: OwnerType, ownerId: string, slot: Timeframe, blob: Blob, isDemo = false) {
  const { thumb, width, height } = await makeThumb(blob);
  const existing = await db.images.where({ ownerType, ownerId }).filter((i) => i.slot === slot).first();
  await db.images.put({
    id: existing?.id ?? uid(),
    ownerType, ownerId, slot, blob, thumb, width, height,
    caption: existing?.caption ?? '',
    isDemo,
    createdAt: Date.now(),
  });
}

export const imageFromClipboard = (dt: DataTransfer | null): File | null => {
  if (!dt) return null;
  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file' && item.type.startsWith('image/')) return item.getAsFile();
  }
  const f = Array.from(dt.files ?? []).find((f) => f.type.startsWith('image/'));
  return f ?? null;
};

export const extFor = (type: string) =>
  ({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' } as Record<string, string>)[type] ?? 'bin';

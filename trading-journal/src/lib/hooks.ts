import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, db } from '../db/db';
import type { AppSettings, StoredImage } from '../db/types';
import { setCurrency } from './format';

export function useSettings(): AppSettings {
  const s = useLiveQuery(() => db.settings.get('app'), []);
  const merged = s ? { ...DEFAULT_SETTINGS, ...s } : DEFAULT_SETTINGS;
  setCurrency(merged.currency);
  return merged;
}

export const useTrades = () => useLiveQuery(() => db.trades.orderBy('date').reverse().toArray(), []) ?? [];
export const useAccounts = () => useLiveQuery(() => db.accounts.toArray(), []) ?? [];

/** Object URL for a blob, revoked on change/unmount. */
export function useBlobUrl(blob?: Blob | null) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) { setUrl(null); return; }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

export const useOwnerImages = (ownerType: 'trade' | 'outlook', ownerId: string) =>
  useLiveQuery(() => db.images.where({ ownerType, ownerId }).toArray(), [ownerType, ownerId]) ?? ([] as StoredImage[]);

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const h = () => setM(mq.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

import { ChevronLeft, ChevronRight, ClipboardPaste, ImagePlus, RefreshCw, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../db/db';
import type { OwnerType, StoredImage, Timeframe } from '../db/types';
import { TIMEFRAMES } from '../db/types';
import { useBlobUrl, useOwnerImages } from '../lib/hooks';
import { imageFromClipboard, putSlotImage } from '../lib/images';
import { cx, IconButton, useToast } from './ui';

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

export function ImageSlots({ ownerType, ownerId }: { ownerType: OwnerType; ownerId: string }) {
  const images = useOwnerImages(ownerType, ownerId);
  const bySlot = new Map(images.map((i) => [i.slot, i]));
  const [hovered, setHovered] = useState<Timeframe | null>(null);
  const [lightbox, setLightbox] = useState<Timeframe | null>(null);
  const toast = useToast();

  const ingest = useCallback(async (slot: Timeframe, file: Blob | null) => {
    if (!file) { toast('No image found on the clipboard', 'err'); return; }
    if (!file.type.startsWith('image/')) { toast('That file is not an image', 'err'); return; }
    await putSlotImage(ownerType, ownerId, slot, file);
    toast(`${slot} screenshot saved`);
  }, [ownerType, ownerId, toast]);

  // Paste while hovering a slot (without focusing it first) also works.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!hovered || isEditable(e.target) || e.defaultPrevented) return;
      const f = imageFromClipboard(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      ingest(hovered, f);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [hovered, ingest]);

  const filled = TIMEFRAMES.filter((t) => bySlot.has(t));

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {TIMEFRAMES.map((tf) => (
          <Slot
            key={tf}
            tf={tf}
            image={bySlot.get(tf)}
            onHover={(h) => setHovered((cur) => (h ? tf : cur === tf ? null : cur))}
            onFile={(f) => ingest(tf, f)}
            onOpen={() => setLightbox(tf)}
          />
        ))}
      </div>
      {lightbox && (
        <Lightbox
          images={filled.map((t) => bySlot.get(t)!)}
          start={filled.indexOf(lightbox)}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function Slot({ tf, image, onHover, onFile, onOpen }: {
  tf: Timeframe;
  image?: StoredImage;
  onHover: (h: boolean) => void;
  onFile: (f: File | null) => void;
  onOpen: () => void;
}) {
  const url = useBlobUrl(image?.thumb);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [caption, setCaption] = useState(image?.caption ?? '');
  useEffect(() => setCaption(image?.caption ?? ''), [image?.caption]);

  return (
    <div className="min-w-0">
      <div
        tabIndex={0}
        data-slot={tf}
        aria-label={`${tf} screenshot slot. Paste, drop or press Enter to upload.`}
        onMouseEnter={() => onHover(true)}
        onMouseLeave={() => onHover(false)}
        onFocus={() => onHover(true)}
        onBlur={() => onHover(false)}
        onPaste={(e) => {
          const f = imageFromClipboard(e.clipboardData);
          e.preventDefault();
          onFile(f);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); image ? onOpen() : fileRef.current?.click(); }
          if ((e.key === 'Delete' || e.key === 'Backspace') && image) db.images.delete(image.id);
        }}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          onFile(Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/')) ?? null);
        }}
        onClick={() => (image ? onOpen() : fileRef.current?.click())}
        className={cx(
          'group relative aspect-[16/10] cursor-pointer overflow-hidden rounded-lg border transition-all duration-200 outline-none',
          'focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_#e9b44c26]',
          image ? 'border-line bg-surface hover:border-line-2' : 'border-dashed border-line-2 bg-[#11110f] hover:border-ink-3 hover:bg-surface',
          drag && '!border-accent !bg-accent-dim scale-[1.01]',
        )}
      >
        <span className="num absolute left-2 top-2 z-10 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-semibold text-ink backdrop-blur">{tf}</span>
        {image && url ? (
          <>
            <img src={url} alt={`${tf} chart`} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" draggable={false} />
            <div className="absolute right-1.5 top-1.5 z-10 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
              <IconButton title="Replace" className="bg-black/60 text-ink backdrop-blur hover:bg-black/80" onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}><RefreshCw size={13} /></IconButton>
              <IconButton title="Remove" className="bg-black/60 text-ink backdrop-blur hover:bg-black/80 hover:text-loss" onClick={(e) => { e.stopPropagation(); db.images.delete(image.id); }}><Trash2 size={13} /></IconButton>
            </div>
          </>
        ) : (
          <div className="grid size-full place-items-center text-center">
            <div className="flex flex-col items-center gap-1.5 text-ink-3 transition-colors group-hover:text-ink-2 group-focus-visible:text-ink-2">
              {drag ? <ImagePlus size={20} /> : <ClipboardPaste size={18} />}
              <span className="text-[12px]">{drag ? 'Drop to add' : 'Paste, drop or click'}</span>
              <span className="hidden text-[10.5px] opacity-70 group-hover:block group-focus-visible:block">
                <span className="num">⌘V</span> while hovering
              </span>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
        />
      </div>
      {image && (
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => caption !== image.caption && db.images.update(image.id, { caption })}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          placeholder="Add a caption…"
          className="mt-1 h-7 w-full rounded-md bg-transparent px-1.5 text-[12.5px] text-ink-2 outline-none placeholder:text-ink-3 hover:bg-hover focus:bg-raised"
        />
      )}
    </div>
  );
}

export function Lightbox({ images, start, onClose }: { images: StoredImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(Math.max(0, start));
  const img = images[i];
  const url = useBlobUrl(img?.blob);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setI((x) => (x + 1) % images.length);
      if (e.key === 'ArrowLeft') setI((x) => (x - 1 + images.length) % images.length);
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [images.length, onClose]);
  if (!img) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex flex-col bg-black/92 backdrop-blur-sm animate-fade" onClick={onClose} role="dialog" aria-label="Screenshot viewer">
      <div className="flex items-center justify-between px-5 py-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          {images.map((m, j) => (
            <button key={m.id} onClick={() => setI(j)} className={cx('num h-7 rounded-md px-2.5 text-[12px] font-semibold transition-colors', j === i ? 'bg-ink text-canvas' : 'text-ink-3 hover:text-ink')}>{m.slot}</button>
          ))}
        </div>
        <IconButton onClick={onClose} aria-label="Close viewer"><X size={18} /></IconButton>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
        {url && <img key={img.id} src={url} alt={`${img.slot} chart`} className="max-h-full max-w-full rounded-md object-contain shadow-2xl animate-fade" onClick={(e) => e.stopPropagation()} />}
        {images.length > 1 && (
          <>
            <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); setI((x) => (x - 1 + images.length) % images.length); }} className="absolute left-3 grid size-10 place-items-center rounded-full bg-white/5 text-ink hover:bg-white/10"><ChevronLeft /></button>
            <button aria-label="Next" onClick={(e) => { e.stopPropagation(); setI((x) => (x + 1) % images.length); }} className="absolute right-3 grid size-10 place-items-center rounded-full bg-white/5 text-ink hover:bg-white/10"><ChevronRight /></button>
          </>
        )}
      </div>
      <div className="px-5 py-4 text-center text-[14px] text-ink-2" onClick={(e) => e.stopPropagation()}>
        {img.caption || <span className="text-ink-3">No caption</span>}
        <div className="mt-1 text-[11px] text-ink-3">← → to switch timeframe · Esc to close</div>
      </div>
    </div>,
    document.body,
  );
}

"use client";
/* eslint-disable @next/next/no-img-element */
import { useRef } from "react";

/** Circular photo picker: tap the circle to choose or take a photo. */
export function PhotoPicker({ preview, onPick, required }: {
  preview: string | null; onPick: (f: File) => void; required?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" onClick={() => ref.current?.click()}
        className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-line bg-card">
        {preview ? (
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-9 w-9 text-muted" fill="none" stroke="currentColor" strokeWidth={1.6}>
            <path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" />
          </svg>
        )}
      </button>
      <span className="text-xs text-muted">{preview ? "Mudar foto" : `Foto${required ? " (obrigatória)" : ""}`}</span>
      <input ref={ref} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); }} />
    </div>
  );
}

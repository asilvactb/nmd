import type { ReactNode } from "react";

/** Infinite horizontal ticker (content duplicated for a seamless loop). */
export function Ticker({ items }: { items: ReactNode[] }) {
  if (!items.length) return null;
  const row = (
    <div className="flex shrink-0 items-center">
      {items.map((it, i) => (
        <span key={i} className="flex items-center whitespace-nowrap px-5 text-sm">
          {it}<span className="ml-10 h-1 w-1 rounded-full bg-muted/50" />
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative -mx-4 overflow-hidden border-y border-line py-3 lg:mx-0 lg:rounded-2xl lg:border">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-bg to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg to-transparent" />
      <div className="marquee">{row}{row}</div>
    </div>
  );
}

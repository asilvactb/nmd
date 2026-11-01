import type { ReactNode } from "react";

export function Page({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <main className="mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+16px)]">
      <header className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {action}
      </header>
      {children}
    </main>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl bg-card p-4 ${className}`}>{children}</section>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 mt-6 text-xs font-medium uppercase tracking-wider text-muted">{children}</h2>;
}

export const btn =
  "inline-flex items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-medium text-bg active:opacity-80 disabled:opacity-40";
export const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-line px-4 py-2.5 text-sm active:opacity-70";
export const input =
  "w-full rounded-xl border border-line bg-bg px-3 py-3 text-base outline-none focus:border-fg";

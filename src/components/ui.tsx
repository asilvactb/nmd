import type { CSSProperties, ReactNode } from "react";

export function Page({ title, eyebrow, action, children }: {
  title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode;
}) {
  return (
    <main className="mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+20px)]">
      {(title || action) && (
        <header className="rise mb-6 flex items-end justify-between gap-4">
          <div>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            {title && <h1 className="display text-[34px]">{title}</h1>}
          </div>
          {action}
        </header>
      )}
      {children}
    </main>
  );
}

export function Card({ children, className = "", i, style }: {
  children: ReactNode; className?: string; i?: number; style?: CSSProperties;
}) {
  return (
    <section className={`rise rounded-3xl border border-line bg-card p-5 ${className}`}
      style={{ ...(i !== undefined ? ({ "--i": i } as CSSProperties) : {}), ...style }}>
      {children}
    </section>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-9 flex items-center justify-between">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 text-[15px] font-semibold text-accent-ink transition active:scale-[0.97] disabled:opacity-40";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card-2 px-4 py-2.5 text-sm font-medium transition active:scale-[0.97]";
export const input =
  "w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base text-fg outline-none transition placeholder:text-muted focus:border-accent";

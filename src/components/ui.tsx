import type { CSSProperties, ReactNode } from "react";

/** Page shell: phone-width on mobile, wide on desktop (pages opt into desktop grids with lg:). */
export function Page({ title, eyebrow, action, wide = true, children }: {
  title?: string; eyebrow?: string; action?: ReactNode; wide?: boolean; children: ReactNode;
}) {
  return (
    <main className={`mx-auto max-w-lg px-4 pt-[calc(env(safe-area-inset-top)+20px)] lg:px-10 lg:pt-10 ${wide ? "lg:max-w-6xl" : "lg:max-w-3xl"}`}>
      {(title || action) && (
        <header className="rise mb-6 flex items-end justify-between gap-4 lg:mb-10">
          <div>
            {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
            {title && <h1 className="display text-[34px] lg:text-[56px]">{title}</h1>}
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

/** Primary: white pill. Accent is reserved for highlights, not buttons. */
export const btn =
  "inline-flex items-center justify-center gap-2 rounded-full bg-fg px-6 py-3.5 text-[15px] font-semibold text-bg transition hover:bg-white active:scale-[0.97] disabled:opacity-40";
export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-line bg-card-2 px-4 py-2.5 text-sm font-medium transition hover:border-accent/50 active:scale-[0.97]";
export const input =
  "w-full rounded-2xl border border-line bg-card px-4 py-3.5 text-base text-fg outline-none transition placeholder:text-muted focus:border-accent";

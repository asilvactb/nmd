import type { CSSProperties } from "react";
import { Page, SectionTitle } from "@/components/ui";
import { FinoPlus } from "@/components/FinoPlus";
import { formatDate, getMe } from "@/lib/db";

/** A fino is 20cl. The glass fills up towards the next 100 L milestone. */
const LITRES_PER_FINO = 0.2;

export default async function FinosPage() {
  const { supabase } = await getMe();
  const { data: finos } = await supabase.from("finos").select("quantity, events(date)");
  const total = (finos ?? []).reduce((s, f) => s + f.quantity, 0);
  const litres = total * LITRES_PER_FINO;
  const milestone = Math.max(100, Math.ceil((litres + 0.01) / 100) * 100);
  const fill = Math.min(100, (litres / milestone) * 100);

  const byDate = new Map<string, number>();
  for (const f of finos ?? []) {
    const d = (f.events as unknown as { date: string } | null)?.date;
    if (d) byDate.set(d, (byDate.get(d) ?? 0) + f.quantity);
  }
  const history = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const best = Math.max(1, ...history.map(([, n]) => n));

  return (
    <Page eyebrow="Contador oficial do NMD" title="Finos">
      <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6">
        <div className="absolute inset-x-0 bottom-0 bg-accent/25 transition-[height] duration-[1500ms] ease-out" style={{ height: `${fill}%` }}>
          <div className="absolute inset-x-0 top-0 h-px bg-accent" />
        </div>
        <div className="relative">
          <p className="eyebrow">Total do grupo · próximo marco {milestone} L</p>
          <div className="mt-3"><FinoPlus total={total} variant="hero" /></div>
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-muted">Cada um carrega no +1 por cada fino que bebe.</p>

      <SectionTitle>Por domingo</SectionTitle>
      <ol className="flex flex-col gap-1.5">
        {history.map(([date, n], i) => (
          <li key={date} className="rise relative flex items-center overflow-hidden rounded-2xl border border-line bg-card px-4 py-3"
            style={{ "--i": Math.min(i, 12) } as CSSProperties}>
            <span className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${(n / best) * 100}%` }} />
            <span className="relative flex-1 font-medium capitalize">{formatDate(date)}</span>
            <span className="display-num relative text-xl">{n}</span>
          </li>
        ))}
        {history.length === 0 && <li className="text-muted">Ainda não há finos registados.</li>}
      </ol>
    </Page>
  );
}

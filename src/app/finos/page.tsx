import Link from "next/link";
import type { CSSProperties } from "react";
import { Page, SectionTitle } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { FinoPlus } from "@/components/FinoPlus";
import { formatDate, getMe } from "@/lib/db";

/** A fino is 20cl. The glass fills up towards the next 100 L milestone. */
const LITRES_PER_FINO = 0.2;

export default async function FinosPage() {
  const { supabase, player } = await getMe();
  const [{ data: finos }, { data: people }] = await Promise.all([
    supabase.from("finos").select("player_id, quantity, events(date)"),
    supabase.from("players").select("id, name, avatar_path"),
  ]);
  const personById = new Map(((people ?? []) as { id: string; name: string; avatar_path: string | null }[]).map((p) => [p.id, p]));
  const total = (finos ?? []).reduce((s, f) => s + f.quantity, 0);
  const mine = (finos ?? []).filter((f) => f.player_id === player?.id).reduce((s, f) => s + f.quantity, 0);
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

  // Individual ranking (ties share the position)
  const byPlayer = new Map<string, number>();
  for (const f of finos ?? []) byPlayer.set(f.player_id, (byPlayer.get(f.player_id) ?? 0) + f.quantity);
  const drinkers = [...byPlayer.entries()]
    .filter(([id]) => personById.has(id))
    .sort((a, b) => b[1] - a[1] || personById.get(a[0])!.name.localeCompare(personById.get(b[0])!.name, "pt"));
  const topCount = Math.max(1, drinkers[0]?.[1] ?? 1);
  const posOf = (i: number) => drinkers.findIndex(([, n]) => n === drinkers[i]![1]) + 1;

  return (
    <Page eyebrow="Contador oficial do NMD" title="Finos">
      <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6">
        <div className="absolute inset-x-0 bottom-0 bg-accent/25 transition-[height] duration-[1500ms] ease-out" style={{ height: `${fill}%` }}>
          <div className="absolute inset-x-0 top-0 h-px bg-accent" />
        </div>
        <div className="relative">
          <p className="eyebrow">Total do grupo · próximo marco {milestone} L</p>
          <div className="mt-3"><FinoPlus total={total} mine={mine} variant="hero" /></div>
        </div>
      </section>
      <p className="mt-3 text-center text-xs text-muted">Cada um carrega no +1 por cada fino que bebe. Enganaste-te? O −1 retira o teu último.</p>

      <div className="lg:grid lg:grid-cols-2 lg:gap-8">
        <div>
      <SectionTitle>Ranking de finos</SectionTitle>
      <ol className="flex flex-col gap-1.5">
        {drinkers.map(([id, n], i) => {
          const p = personById.get(id)!;
          const pos = posOf(i);
          const me = id === player?.id;
          return (
            <li key={id} className="rise" style={{ "--i": Math.min(i, 12) } as CSSProperties}>
              <Link href={`/jogadores/${id}`}
                className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border px-4 py-2.5 transition hover:bg-card-2 ${me ? "border-accent/50 bg-accent/10" : "border-line bg-card"}`}>
                <span className="absolute inset-y-0 left-0 bg-accent/10" style={{ width: `${(n / topCount) * 100}%` }} />
                <span className={`display-num relative w-7 text-lg ${pos <= 3 ? "" : "text-muted"}`}>{pos <= 3 ? ["🥇", "🥈", "🥉"][pos - 1] : pos}</span>
                <Avatar name={p.name} path={p.avatar_path} size={34} className="relative" />
                <span className="relative min-w-0 flex-1 truncate font-medium">{p.name}{me && <span className="text-xs text-muted"> · tu</span>}</span>
                <span className="relative text-right">
                  <span className="display-num text-xl">{n}</span>
                  <span className="block text-[10px] text-muted tabular">{(n * LITRES_PER_FINO).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} L</span>
                </span>
              </Link>
            </li>
          );
        })}
        {drinkers.length === 0 && <li className="text-muted">Ainda ninguém registou finos.</li>}
      </ol>
        </div>
        <div>
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
        </div>
      </div>
    </Page>
  );
}

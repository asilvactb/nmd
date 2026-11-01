import Link from "next/link";
import { Page } from "@/components/ui";
import { PairAvatars } from "@/components/Avatar";
import { Reveal } from "@/components/Reveal";
import { getMe, type EventRow, type PairRow, type PlayerRow } from "@/lib/db";

const STATUS: Record<EventRow["status"], string> = {
  registration: "A preparar",
  pairs_published: "Duplas sorteadas",
  live: "Ao vivo",
  finished: "Terminado",
};

export default async function EncontrosPage() {
  const { supabase } = await getMe();
  const { data } = await supabase.from("events").select("*").order("date", { ascending: false }).limit(40);
  const events = (data ?? []) as EventRow[];
  const ids = events.map((e) => e.id);
  const [{ data: winners }, { data: people }, { data: sizes }] = await Promise.all([
    supabase.from("pairs").select("*").in("event_id", ids).eq("final_position", 1),
    supabase.from("players").select("id, name, avatar_path"),
    supabase.from("pairs").select("event_id").in("event_id", ids),
  ]);
  const byId = new Map(((people ?? []) as Pick<PlayerRow, "id" | "name" | "avatar_path">[]).map((p) => [p.id, p]));
  const winnerOf = new Map(((winners ?? []) as PairRow[]).map((p) => [p.event_id, p]));
  const pairsIn = new Map<string, number>();
  for (const s of sizes ?? []) pairsIn.set(s.event_id, (pairsIn.get(s.event_id) ?? 0) + 1);
  const person = (id: string) => ({ name: byId.get(id)?.name ?? "?", path: byId.get(id)?.avatar_path ?? null });

  return (
    <Page eyebrow="Resultados e duplas" title="Encontros">
      <div className="grid gap-2 lg:grid-cols-2 lg:gap-3">
        {events.map((e, i) => {
          const d = new Date(e.date + "T12:00:00");
          const active = e.status !== "finished";
          const w = winnerOf.get(e.id);
          return (
            <Reveal key={e.id} i={Math.min(i, 8)}>
              <Link href={`/encontros/${e.id}`}
                className={`lift flex items-center gap-4 rounded-3xl border p-4 active:scale-[0.98] ${active ? "border-accent/50 bg-accent/10" : "border-line bg-card"}`}>
                <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${active ? "bg-accent text-white" : "bg-card-2"}`}>
                  <span className="display-num text-2xl leading-none">{d.getDate()}</span>
                  <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold capitalize">{d.toLocaleDateString("pt-PT", { weekday: "long" })}</p>
                  <p className="flex items-center gap-2 text-sm text-muted">
                    {e.status === "live" && <span className="live-dot" />}{STATUS[e.status]}
                    {pairsIn.get(e.id) ? ` · ${pairsIn.get(e.id)} duplas` : ""}
                  </p>
                </div>
                {w ? (
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🏆</span>
                    <PairAvatars a={person(w.left_player)} b={person(w.right_player)} size={30} />
                  </div>
                ) : <span className="text-muted">→</span>}
              </Link>
            </Reveal>
          );
        })}
      </div>
    </Page>
  );
}

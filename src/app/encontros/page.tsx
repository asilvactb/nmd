import Link from "next/link";
import type { CSSProperties } from "react";
import { Page } from "@/components/ui";
import { getMe, type EventRow } from "@/lib/db";

const STATUS: Record<EventRow["status"], string> = {
  registration: "Inscrições abertas",
  pairs_published: "Duplas sorteadas",
  live: "Ao vivo",
  finished: "Terminado",
};

export default async function EncontrosPage() {
  const { supabase } = await getMe();
  const { data } = await supabase.from("events").select("*").order("date", { ascending: false }).limit(40);
  const events = (data ?? []) as EventRow[];
  return (
    <Page eyebrow="Temporada" title="Encontros">
      <div className="flex flex-col gap-2">
        {events.map((e, i) => {
          const d = new Date(e.date + "T12:00:00");
          const active = e.status !== "finished";
          return (
            <Link key={e.id} href={`/encontros/${e.id}`}
              className={`rise flex items-center gap-4 rounded-3xl border p-4 transition active:scale-[0.98] ${active ? "border-accent/50 bg-accent/10" : "border-line bg-card"}`}
              style={{ "--i": Math.min(i, 10) } as CSSProperties}>
              <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl ${active ? "bg-accent text-accent-ink" : "bg-card-2"}`}>
                <span className="display-num text-2xl leading-none">{d.getDate()}</span>
                <span className="text-[10px] font-semibold uppercase">{d.toLocaleDateString("pt-PT", { month: "short" }).replace(".", "")}</span>
              </div>
              <div className="flex-1">
                <p className="font-semibold capitalize">{d.toLocaleDateString("pt-PT", { weekday: "long" })}</p>
                <p className={`flex items-center gap-2 text-sm ${e.status === "live" ? "text-accent" : "text-muted"}`}>
                  {e.status === "live" && <span className="live-dot" />}{STATUS[e.status]}
                </p>
              </div>
              <span className="text-muted">→</span>
            </Link>
          );
        })}
      </div>
    </Page>
  );
}

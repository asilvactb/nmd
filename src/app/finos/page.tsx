import type { CSSProperties } from "react";
import { Card, Page, SectionTitle, btn, input } from "@/components/ui";
import { CountUp } from "@/components/CountUp";
import { formatDate, getMe, type EventRow } from "@/lib/db";
import { setEventFinos } from "../actions";

/** A fino is 20cl. The glass fills up towards the next 100 L milestone. */
const LITRES_PER_FINO = 0.2;

export default async function FinosPage() {
  const { supabase, player } = await getMe();
  const [{ data: finos }, { data: events }] = await Promise.all([
    supabase.from("finos").select("event_id, quantity, events(date)"),
    supabase.from("events").select("id, date, status").order("date", { ascending: false }).limit(12),
  ]);
  const total = (finos ?? []).reduce((s, f) => s + f.quantity, 0);
  const litres = total * LITRES_PER_FINO;
  const milestone = Math.max(100, Math.ceil((litres + 0.01) / 100) * 100);
  const fill = Math.min(100, (litres / milestone) * 100);
  const perEvent = new Map((finos ?? []).filter((f) => f.event_id).map((f) => [f.event_id as string, f.quantity]));
  const history = (finos ?? [])
    .filter((f) => f.events)
    .map((f) => ({ date: (f.events as unknown as { date: string }).date, n: f.quantity }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const best = Math.max(1, ...history.map((h) => h.n));

  return (
    <Page eyebrow="Contador oficial do NMD" title="Finos">
      <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6">
        <div className="absolute inset-x-0 bottom-0 bg-accent/90 transition-[height] duration-[1500ms] ease-out" style={{ height: `${fill}%` }}>
          <div className="absolute inset-x-0 top-0 h-3 -translate-y-1/2 rounded-[50%] bg-[#f6ffd6]" />
        </div>
        <div className="relative">
          <p className="eyebrow">Total bebido</p>
          <CountUp value={total} className="display-num mt-2 block text-[88px] leading-none" />
          <p className="mt-2 text-sm font-medium"><CountUp value={litres} decimals={1} /> litros · próximo marco {milestone} L</p>
        </div>
      </section>

      {player?.is_admin && (
        <Card className="mt-3" i={1}>
          <p className="eyebrow mb-3">Registar finos do domingo</p>
          <form action={setEventFinos} className="flex gap-2">
            <select name="event_id" className={input} required defaultValue={(events ?? [])[0]?.id}>
              {((events ?? []) as Pick<EventRow, "id" | "date">[]).map((e) => (
                <option key={e.id} value={e.id}>
                  {formatDate(e.date)}{perEvent.has(e.id) ? ` · ${perEvent.get(e.id)}` : ""}
                </option>
              ))}
            </select>
            <input name="quantity" type="number" min={0} inputMode="numeric" required placeholder="0" className={`${input} !w-24 text-center`} />
            <button className={`${btn} !px-5`}>OK</button>
          </form>
          <p className="mt-2 text-xs text-muted">Se o domingo já tiver valor, é substituído.</p>
        </Card>
      )}

      <SectionTitle>Por domingo</SectionTitle>
      <ol className="flex flex-col gap-1.5">
        {history.map((h, i) => (
          <li key={h.date} className="rise relative flex items-center overflow-hidden rounded-2xl border border-line bg-card px-4 py-3"
            style={{ "--i": Math.min(i, 12) } as CSSProperties}>
            <span className="absolute inset-y-0 left-0 bg-accent/15" style={{ width: `${(h.n / best) * 100}%` }} />
            <span className="relative flex-1 font-medium capitalize">{formatDate(h.date)}</span>
            <span className="display-num relative text-xl">{h.n}</span>
          </li>
        ))}
        {history.length === 0 && <li className="text-muted">Ainda não há finos registados.</li>}
      </ol>
    </Page>
  );
}

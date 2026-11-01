import Link from "next/link";
import type { CSSProperties } from "react";
import { Page, SectionTitle, btnGhost, input } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Reveal } from "@/components/Reveal";
import { formatDate, getCurrentSeason, getMe, type EventRow, type PlayerRow, type RankingRow } from "@/lib/db";
import { adminSetMorfes } from "../actions";
import { VolunteerButton } from "./VolunteerButton";

type Mini = Pick<PlayerRow, "id" | "name" | "avatar_path">;

/**
 * Morfes (Regulamento ponto 7): two people bring the food each Sunday, once per season each,
 * until everyone has done it and the cycle starts again.
 */
export default async function MorfesPage() {
  const { supabase, player } = await getMe();
  const season = await getCurrentSeason();
  const [{ data: next }, { data: people }, { data: repasto }, { data: ranking }] = await Promise.all([
    supabase.from("events").select("*").neq("status", "finished").order("date").limit(1).maybeSingle<EventRow>(),
    supabase.from("players").select("id, name, avatar_path").eq("active", true).order("name"),
    supabase.from("repasto").select("player_id, event_id, events!inner(date, season_id)"),
    season ? supabase.from("season_ranking").select("player_id").eq("season_id", season.id) : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map(((people ?? []) as Mini[]).map((p) => [p.id, p]));

  const rows = (repasto ?? []) as unknown as { player_id: string; event_id: string; events: { date: string; season_id: string } }[];
  const nextCrew = next ? rows.filter((r) => r.event_id === next.id).map((r) => byId.get(r.player_id)).filter((p): p is Mini => !!p) : [];
  const amIn = !!player && nextCrew.some((p) => p.id === player.id);

  // This season: who already brought the food, and who still owes it (players who have played)
  const seasonRows = rows.filter((r) => r.events.season_id === season?.id && r.event_id !== next?.id);
  const done = new Map<string, string[]>();
  for (const r of seasonRows) done.set(r.player_id, [...(done.get(r.player_id) ?? []), r.events.date]);
  const players = ((ranking ?? []) as Pick<RankingRow, "player_id">[]).map((r) => byId.get(r.player_id)).filter((p): p is Mini => !!p);
  const owe = players.filter((p) => !done.has(p.id)).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const history = [...new Set(seasonRows.map((r) => r.event_id))]
    .map((eid) => ({ date: seasonRows.find((r) => r.event_id === eid)!.events.date, eid, crew: seasonRows.filter((r) => r.event_id === eid).map((r) => byId.get(r.player_id)).filter((p): p is Mini => !!p) }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <Page eyebrow="Quem leva a comida" title="Morfes">
      <div className="lg:grid lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-start lg:gap-8">
        <div>
          {next ? (
            <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6">
              <div className="aurora !opacity-40" />
              <div className="relative">
                <p className="eyebrow">Próximo domingo</p>
                <p className="display mt-2 text-[40px] capitalize">{formatDate(next.date).replace(".", "")}</p>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[0, 1].map((k) => {
                    const p = nextCrew[k];
                    return p ? (
                      <Link key={k} href={`/jogadores/${p.id}`} className="pop flex flex-col items-center gap-2 rounded-3xl border border-accent/40 bg-accent/10 p-4 text-center">
                        <Avatar name={p.name} path={p.avatar_path} size={64} />
                        <span className="text-sm font-semibold">{p.name}</span>
                        <span className="text-[11px] text-muted">leva os morfes 🍽️</span>
                      </Link>
                    ) : (
                      <div key={k} className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line p-4 text-center">
                        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-card-2 text-2xl">?</span>
                        <span className="text-sm text-muted">Lugar livre</span>
                      </div>
                    );
                  })}
                </div>
                {player && <div className="mt-5"><VolunteerButton eventId={next.id} amIn={amIn} full={nextCrew.length >= 2} /></div>}

                {player?.is_admin && (
                  <form action={adminSetMorfes} className="mt-4 flex gap-2">
                    <input type="hidden" name="event_id" value={next.id} />
                    <select name="player_id" className={input} defaultValue="">
                      <option value="" disabled>Admin: nomear alguém…</option>
                      {owe.concat(players.filter((p) => done.has(p.id))).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}{done.has(p.id) ? " (já levou)" : ""}</option>
                      ))}
                    </select>
                    <button className={btnGhost}>Nomear</button>
                  </form>
                )}
                {player?.is_admin && nextCrew.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {nextCrew.map((p) => (
                      <form key={p.id} action={adminSetMorfes}>
                        <input type="hidden" name="event_id" value={next.id} />
                        <input type="hidden" name="player_id" value={p.id} />
                        <input type="hidden" name="remove" value="1" />
                        <button className="text-xs text-muted hover:text-fg">✕ tirar {p.name}</button>
                      </form>
                    ))}
                  </div>
                )}
              </div>
            </section>
          ) : (
            <section className="rise rounded-[28px] border border-line bg-card p-6">
              <p className="display text-2xl">Sem domingo marcado</p>
              <p className="mt-2 text-sm text-muted">Quando houver encontro, os voluntários aparecem aqui.</p>
            </section>
          )}
          <p className="mt-3 text-center text-xs text-muted">Dois por domingo · cada um uma vez por temporada · quando todos tiverem levado, o ciclo recomeça.</p>
        </div>

        <div>
          {owe.length > 0 && (
            <Reveal>
              <SectionTitle>Ainda não levaram esta temporada · {owe.length}</SectionTitle>
              <div className="flex flex-wrap gap-1.5">
                {owe.map((p) => (
                  <Link key={p.id} href={`/jogadores/${p.id}`} className="flex items-center gap-1.5 rounded-full border border-line bg-card py-0.5 pl-0.5 pr-3 text-xs transition hover:border-accent/50">
                    <Avatar name={p.name} path={p.avatar_path} size={24} />{p.name}
                  </Link>
                ))}
              </div>
            </Reveal>
          )}

          <Reveal>
            <SectionTitle>Histórico da temporada</SectionTitle>
            <ol className="flex flex-col gap-1.5">
              {history.map((h, i) => (
                <li key={h.eid} className="rise flex items-center gap-3 rounded-2xl border border-line bg-card px-4 py-3" style={{ "--i": Math.min(i, 10) } as CSSProperties}>
                  <span className="w-24 shrink-0 text-sm font-medium capitalize">{formatDate(h.date)}</span>
                  <span className="flex -space-x-2">{h.crew.map((p) => <Avatar key={p.id} name={p.name} path={p.avatar_path} size={28} />)}</span>
                  <span className="truncate text-sm text-muted">{h.crew.map((p) => p.name).join(" + ")}</span>
                </li>
              ))}
              {history.length === 0 && <li className="text-sm text-muted">Ainda sem morfes registados.</li>}
            </ol>
          </Reveal>
        </div>
      </div>
    </Page>
  );
}

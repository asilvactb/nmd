import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Page, SectionTitle } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { CountUp } from "@/components/CountUp";
import { Medal, medalFor } from "@/components/Medal";
import { Reveal } from "@/components/Reveal";
import { formatDate, getCurrentSeason, getMe, type PairRow, type PlayerRow, type RankingRow } from "@/lib/db";

interface AwardRow { season_name: string; award: string }

export default async function PlayerProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, player: me } = await getMe();
  const season = await getCurrentSeason();

  const [{ data: p }, { data: awardsData }, { data: pairsData }, { data: people }, { data: ranking }, { data: pts }] = await Promise.all([
    supabase.from("players").select("*").eq("id", id).maybeSingle<PlayerRow>(),
    supabase.from("awards").select("season_name, award").eq("player_id", id),
    supabase.from("pairs").select("*, events!inner(id, date, status)").or(`left_player.eq.${id},right_player.eq.${id}`),
    supabase.from("players").select("id, name, avatar_path"),
    season ? supabase.from("season_ranking").select("*").eq("season_id", season.id).order("points", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("event_points").select("event_id, points, joker").eq("player_id", id),
  ]);
  if (!p) notFound();

  const byId = new Map(((people ?? []) as Pick<PlayerRow, "id" | "name" | "avatar_path">[]).map((x) => [x.id, x]));
  const rows = (ranking ?? []) as RankingRow[];
  const idx = rows.findIndex((r) => r.player_id === id);
  const mine = rows[idx];
  const ptsBy = new Map((pts ?? []).map((x) => [x.event_id as string, x]));

  // Medals grouped by award
  const awards = (awardsData ?? []) as AwardRow[];
  const grouped = new Map<string, string[]>();
  for (const a of awards) {
    const k = medalFor(a.award).short;
    grouped.set(k, [...(grouped.get(k) ?? []), a.season_name]);
  }

  // Encounter history with partner and place
  const history = ((pairsData ?? []) as (PairRow & { events: { id: string; date: string; status: string } })[])
    .filter((x) => x.events.status === "finished")
    .sort((a, b) => b.events.date.localeCompare(a.events.date));
  const { data: sizes } = await supabase.from("pairs").select("event_id").in("event_id", history.map((h) => h.event_id));
  const pairsIn = new Map<string, number>();
  for (const s of sizes ?? []) pairsIn.set(s.event_id, (pairsIn.get(s.event_id) ?? 0) + 1);

  // Favourite partner
  const partnerCount = new Map<string, number>();
  for (const h of history) {
    const partner = h.left_player === id ? h.right_player : h.left_player;
    partnerCount.set(partner, (partnerCount.get(partner) ?? 0) + 1);
  }
  const fav = [...partnerCount.entries()].sort((a, b) => b[1] - a[1])[0];

  return (
    <Page wide>
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-10">
        {/* Identity card */}
        <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6 text-center lg:sticky lg:top-10">
          <div className="aurora" />
          <div className="relative">
            <div className="mx-auto w-fit rounded-full p-1" style={{ background: "conic-gradient(from 180deg, var(--accent), var(--accent-2), var(--accent))" }}>
              <Avatar name={p.name} path={p.avatar_path} size={124} />
            </div>
            <h1 className="display mt-5 text-[38px]">{p.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {p.side === "L" ? "Esquerda" : "Direita"}{p.is_wild_card ? " · Wild card" : ""}{p.is_admin ? " · Admin" : ""}
            </p>
            {grouped.size > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2.5">
                {[...grouped.entries()].map(([k, seasons]) => <Medal key={k} award={k} size={46} count={seasons.length} />)}
              </div>
            )}
            {me?.id === p.id && <Link href="/conta" className="mt-5 inline-block text-xs text-muted underline-offset-4 hover:underline">Editar foto e password</Link>}
          </div>
        </section>

        <div>
          {/* Season numbers */}
          <SectionTitle>{season?.name}</SectionTitle>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-5">
            {[
              ["Posição", mine ? idx + 1 : 0, mine ? "º" : ""],
              ["Pontos", mine ? Number(mine.points) : 0, ""],
              ["Presenças", mine?.events_played ?? 0, ""],
              ["Vitórias", mine?.wins ?? 0, ""],
              ["Bombos", mine?.bombos ?? 0, ""],
            ].map(([label, value, suffix], i) => (
              <div key={label as string} className="rise rounded-2xl border border-line bg-card p-4" style={{ "--i": i + 1 } as CSSProperties}>
                <p className="eyebrow !text-[10px]">{label}</p>
                <p className="mt-2 text-3xl leading-none">
                  <CountUp value={value as number} decimals={(value as number) % 1 ? 1 : 0} className="display-num" />
                  <span className="display-num">{suffix}</span>
                </p>
              </div>
            ))}
            <div className="rise col-span-3 rounded-2xl border border-line bg-card p-4 lg:col-span-5" style={{ "--i": 6 } as CSSProperties}>
              <p className="eyebrow !text-[10px]">Joker</p>
              <p className="mt-1 text-sm">{mine?.joker_used ? "🤡 Já usado esta temporada" : "Ainda por usar esta temporada"}</p>
            </div>
          </div>

          {/* Medals */}
          {grouped.size > 0 && (
            <Reveal>
              <SectionTitle>Medalhas</SectionTitle>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
                {[...grouped.entries()].map(([k, seasons]) => (
                  <div key={k} className="lift flex items-center gap-3 rounded-3xl border border-line bg-card p-3">
                    <Medal award={k} size={52} count={seasons.length} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{k}</p>
                      <p className="truncate text-[11px] text-muted">{seasons.join(" · ")}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Reveal>
          )}

          {/* Favourite partner */}
          {fav && byId.get(fav[0]) && (
            <Reveal>
              <SectionTitle>Parceiro mais frequente</SectionTitle>
              <Link href={`/jogadores/${fav[0]}`} className="lift flex items-center gap-3 rounded-3xl border border-line bg-card p-4">
                <Avatar name={byId.get(fav[0])!.name} path={byId.get(fav[0])!.avatar_path} size={44} />
                <span className="flex-1 font-semibold">{byId.get(fav[0])!.name}</span>
                <span className="text-sm text-muted">{fav[1]}× juntos</span>
              </Link>
            </Reveal>
          )}

          {/* History */}
          <Reveal>
            <SectionTitle>Encontros</SectionTitle>
            <ol className="flex flex-col gap-1.5">
              {history.map((h) => {
                const partner = byId.get(h.left_player === id ? h.right_player : h.left_player);
                const n = pairsIn.get(h.event_id) ?? 0;
                const pt = ptsBy.get(h.event_id);
                const top = h.final_position === 1;
                const bombo = h.final_position === n;
                return (
                  <li key={h.id}>
                    <Link href={`/encontros/${h.event_id}`} className="lift flex items-center gap-3 rounded-2xl border border-line bg-card px-3 py-2.5">
                      <span className={`display-num w-10 text-center text-xl ${top ? "text-accent" : "text-muted"}`}>{h.final_position ?? "–"}º</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium capitalize">{formatDate(h.events.date)} <span className="text-muted">· {n} duplas</span></p>
                        <p className="flex items-center gap-1.5 text-xs text-muted">
                          com {partner && <Avatar name={partner.name} path={partner.avatar_path} size={16} />} {partner?.name}
                        </p>
                      </div>
                      {top && <span>🏆</span>}{bombo && <span>🥁</span>}
                      {pt && <span className="display-num w-12 text-right text-lg">{Number(pt.points).toLocaleString("pt-PT")}{pt.joker && <span className="text-xs" title="Joker"> 🤡</span>}</span>}
                    </Link>
                  </li>
                );
              })}
              {history.length === 0 && <li className="text-sm text-muted">Ainda sem encontros registados.</li>}
            </ol>
          </Reveal>
        </div>
      </div>
    </Page>
  );
}

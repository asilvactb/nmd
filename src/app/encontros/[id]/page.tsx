import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { Card, Page, SectionTitle, btn, btnGhost } from "@/components/ui";
import { PairAvatars } from "@/components/Avatar";
import { Tabs } from "@/components/Tabs";
import { formatDate, getMe, pairName, type EventRow, type MatchRow, type PairRow, type PlayerRow } from "@/lib/db";
import { eventFormat, tournamentState } from "@/lib/event-flow";
import { closeEvent, useDirectCross } from "../../actions";
import { LiveRefresh } from "./LiveRefresh";
import { MatchCard } from "./MatchCard";

export default async function EncontroPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, player } = await getMe();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).maybeSingle<EventRow>();
  if (!event) notFound();

  const [{ data: pairsData }, { data: matchesData }, { data: playersData }] = await Promise.all([
    supabase.from("pairs").select("*").eq("event_id", id),
    supabase.from("matches").select("*").eq("event_id", id),
    supabase.from("players").select("*"),
  ]);
  const pairs = (pairsData ?? []) as PairRow[];
  const matches = (matchesData ?? []) as MatchRow[];
  const players = new Map(((playersData ?? []) as PlayerRow[]).map((p) => [p.id, p]));
  const pairById = new Map(pairs.map((p) => [p.id, p]));
  const name = (pid: string | null) => (pid ? pairName(pairById.get(pid), players) : "A definir");
  const short = (pid: string | null) => {
    const pr = pid ? pairById.get(pid) : undefined;
    if (!pr) return "A definir";
    const first = (x: string) => (players.get(x)?.name ?? "?").split(" ")[0];
    return `${first(pr.left_player)} / ${first(pr.right_player)}`;
  };
  const person = (pid: string) => ({ name: players.get(pid)?.name ?? "?", path: players.get(pid)?.avatar_path ?? null });
  const people = (pid: string | null): [ReturnType<typeof person>, ReturnType<typeof person>] | undefined => {
    const pr = pid ? pairById.get(pid) : undefined;
    return pr ? [person(pr.left_player), person(pr.right_player)] : undefined;
  };
  const isAdmin = !!player?.is_admin;
  const statusLabel = { registration: "Inscrições abertas", pairs_published: "Duplas sorteadas", live: "Ao vivo", finished: "Terminado" }[event.status];

  const header = (
    <div className="rise mb-2">
      <p className="eyebrow flex items-center gap-2">
        {event.status === "live" && <span className="live-dot" />}
        <span className={event.status === "live" ? "text-accent" : ""}>{statusLabel}</span>
      </p>
      <h1 className="display mt-2 text-[40px] capitalize">{formatDate(event.date).replace(".", "")}</h1>
    </div>
  );

  if (!pairs.length) {
    return (
      <Page>
        {header}
        <Card className="mt-6"><p className="text-muted">As duplas ainda não foram sorteadas.</p></Card>
      </Page>
    );
  }

  const format = eventFormat(event, pairs.length);
  const { tables } = tournamentState(format, pairs, matches);
  const groups = Object.keys(format.groups);
  const rounds = [...new Set(matches.filter((m) => m.stage === "group").map((m) => m.round!))].sort((a, b) => a - b);
  const knockout = format.knockout
    .map((k) => matches.find((m) => m.knockout_id === k.id))
    .filter((m): m is MatchRow => !!m);
  const played = matches.filter((m) => m.score_a != null).length;
  const allPlayed = played === matches.length;
  const bombosPlace = pairs.length;
  const finalOrder = [...pairs].sort((a, b) => (a.final_position ?? 99) - (b.final_position ?? 99));

  const card = (m: MatchRow, tag?: string) => (
    <MatchCard key={m.id} match={m} eventId={id} nameA={short(m.pair_a)} nameB={short(m.pair_b)}
      peopleA={people(m.pair_a)} peopleB={people(m.pair_b)} tag={tag} canEdit={isAdmin} />
  );

  const jogos = (
    <div>
      {rounds.map((r) => (
        <div key={r}>
          <SectionTitle>Ronda {r}</SectionTitle>
          <div className="flex flex-col gap-2">
            {matches.filter((m) => m.stage === "group" && m.round === r)
              .sort((a, b) => (a.group_name ?? "").localeCompare(b.group_name ?? ""))
              .map((m) => card(m, groups.length > 1 ? `Grupo ${m.group_name}` : undefined))}
          </div>
        </div>
      ))}
    </div>
  );

  const grupos = (
    <div>
      {groups.map((g) => (
        <div key={g}>
          <SectionTitle>{groups.length > 1 ? `Grupo ${g}` : "Classificação"}</SectionTitle>
          <div className="overflow-hidden rounded-3xl border border-line bg-card">
            {tables[g]!.map((t, i) => (
              <div key={t.pairId} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <span className={`display-num w-5 text-lg ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                {people(t.pairId) && <PairAvatars a={people(t.pairId)![0]} b={people(t.pairId)![1]} size={30} />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{short(t.pairId)}{t.unresolvedTie && " ⚠︎"}</span>
                <span className="display-num w-6 text-center text-lg">{t.wins}</span>
                <span className="w-9 text-right text-sm text-muted tabular">{t.delta > 0 ? `+${t.delta}` : t.delta}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="mt-3 text-center text-xs text-muted">Vitórias · diferença de jogos</p>
    </div>
  );

  const finais = (
    <div className="flex flex-col gap-2 pt-4">
      {knockout.map((m) => card(m, m.label ?? undefined))}
      {!knockout.length && <p className="text-muted">Este formato não tem eliminatórias.</p>}
    </div>
  );

  return (
    <Page>
      <LiveRefresh eventId={id} />
      {header}
      <div className="rise mb-2 flex items-center gap-3 text-sm text-muted" style={{ "--i": 1 } as CSSProperties}>
        <span>{format.label}</span>
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-card-2">
          <span className="block h-full rounded-full bg-accent transition-all" style={{ width: `${(played / matches.length) * 100}%` }} />
        </span>
        <span className="tabular">{played}/{matches.length}</span>
      </div>

      {event.status === "finished" && (
        <section className="rise court mt-4 rounded-[28px] border border-line bg-card p-5">
          <p className="eyebrow !text-accent">Classificação final</p>
          <ol className="mt-3 flex flex-col gap-2.5">
            {finalOrder.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className={`display-num w-6 text-xl ${p.final_position === 1 ? "text-accent" : "text-muted"}`}>{p.final_position}</span>
                <PairAvatars a={person(p.left_player)} b={person(p.right_player)} size={30} />
                <span className="flex-1 text-sm font-medium">{name(p.id)}</span>
                {p.final_position === 1 && <span>🏆</span>}
                {p.final_position === bombosPlace && <span>🥁</span>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {matches.length > 0 && (
        <Tabs tabs={[
          { id: "jogos", label: "Jogos", content: jogos },
          { id: "grupos", label: groups.length > 1 ? "Grupos" : "Tabela", content: grupos },
          ...(knockout.length ? [{ id: "finais", label: "Finais", content: finais }] : []),
        ]} />
      )}

      {isAdmin && event.status !== "finished" && (
        <div className="mt-10 flex flex-col gap-2">
          {groups.length === 2 && !format.id.endsWith("-direct") && (
            <form action={useDirectCross.bind(null, id)}>
              <button className={`${btnGhost} w-full`}>Sem tempo: cruzamento direto</button>
            </form>
          )}
          <form action={closeEvent.bind(null, id)}>
            <button className={`${btn} w-full`} disabled={!allPlayed}>Fechar encontro e atribuir pontos</button>
          </form>
        </div>
      )}
    </Page>
  );
}

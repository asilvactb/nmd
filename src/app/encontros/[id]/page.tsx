import { notFound } from "next/navigation";
import { Card, Page, SectionTitle, btnGhost } from "@/components/ui";
import { formatDate, getMe, pairName, type EventRow, type MatchRow, type PairRow, type PlayerRow } from "@/lib/db";
import { eventFormat, tournamentState } from "@/lib/event-flow";
import { closeEvent, useDirectCross } from "../../actions";
import { LiveRefresh } from "./LiveRefresh";
import { MatchCard } from "./MatchCard";
import { PairAvatars } from "@/components/Avatar";

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
  const isAdmin = !!player?.is_admin;
  const person = (id: string) => {
    const p = players.get(id);
    return { name: p?.name ?? "?", path: p?.avatar_path ?? null };
  };
  const people = (pid: string | null): [ReturnType<typeof person>, ReturnType<typeof person>] | undefined => {
    const pr = pid ? pairById.get(pid) : undefined;
    return pr ? [person(pr.left_player), person(pr.right_player)] : undefined;
  };

  if (!pairs.length) {
    return (
      <Page title={formatDate(event.date)}>
        <Card><p className="text-muted">As duplas ainda não foram publicadas.</p></Card>
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
  const allPlayed = matches.every((m) => m.score_a != null);
  const bombosPlace = pairs.length;

  return (
    <Page title={formatDate(event.date)}>
      <LiveRefresh eventId={id} />
      <p className="-mt-3 mb-4 text-sm text-muted">{format.label}</p>

      {event.status === "finished" && (
        <Card className="mb-2">
          <p className="text-xs uppercase tracking-wider text-muted">Classificação final</p>
          <ol className="mt-2 space-y-1">
            {[...pairs].sort((a, b) => (a.final_position ?? 99) - (b.final_position ?? 99)).map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span className="tabular w-6 text-muted">{p.final_position}</span>
                <PairAvatars a={person(p.left_player)} b={person(p.right_player)} size={26} />
                <span>{name(p.id)}</span>
                {p.final_position === 1 && <span>🏆</span>}
                {p.final_position === bombosPlace && <span>🥁</span>}
              </li>
            ))}
          </ol>
        </Card>
      )}

      {rounds.map((r) => (
        <div key={r}>
          <SectionTitle>Jogo {r}</SectionTitle>
          <div className="flex flex-col gap-2">
            {matches.filter((m) => m.stage === "group" && m.round === r)
              .sort((a, b) => (a.group_name ?? "").localeCompare(b.group_name ?? ""))
              .map((m) => (
                <MatchCard key={m.id} match={m} eventId={id} nameA={name(m.pair_a)} nameB={name(m.pair_b)}
                  peopleA={people(m.pair_a)} peopleB={people(m.pair_b)}
                  tag={groups.length > 1 ? `Grupo ${m.group_name}` : undefined} canEdit={isAdmin} />
              ))}
          </div>
        </div>
      ))}

      {groups.map((g) => (
        <div key={g}>
          <SectionTitle>Classificação {groups.length > 1 ? `Grupo ${g}` : ""}</SectionTitle>
          <Card className="!p-0">
            <table className="tabular w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-muted">
                <tr><th className="py-2 pl-4 text-left font-medium">Dupla</th><th className="font-medium">V</th><th className="pr-4 font-medium">+/−</th></tr>
              </thead>
              <tbody>
                {tables[g]!.map((t, i) => (
                  <tr key={t.pairId} className="border-t border-line">
                    <td className="py-2 pl-4">
                      <span className="flex items-center gap-2">
                        <span className="w-4 text-muted">{i + 1}</span>
                        {people(t.pairId) && <PairAvatars a={people(t.pairId)![0]} b={people(t.pairId)![1]} size={24} />}
                        <span>{name(t.pairId)}{t.unresolvedTie && " ⚠︎"}</span>
                      </span>
                    </td>
                    <td className="text-center">{t.wins}</td>
                    <td className="pr-4 text-center">{t.delta > 0 ? `+${t.delta}` : t.delta}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      ))}

      {knockout.length > 0 && (
        <>
          <SectionTitle>Eliminatórias</SectionTitle>
          <div className="flex flex-col gap-2">
            {knockout.map((m) => (
              <MatchCard key={m.id} match={m} eventId={id} nameA={name(m.pair_a)} nameB={name(m.pair_b)}
                peopleA={people(m.pair_a)} peopleB={people(m.pair_b)}
                tag={m.label ?? undefined} canEdit={isAdmin && !!m.pair_a && !!m.pair_b} />
            ))}
          </div>
        </>
      )}

      {isAdmin && event.status !== "finished" && (
        <div className="mt-8 flex flex-col gap-2">
          {groups.length === 2 && !format.id.endsWith("-direct") && (
            <form action={useDirectCross.bind(null, id)}>
              <button className={`${btnGhost} w-full`}>Sem tempo: cruzamento direto</button>
            </form>
          )}
          <form action={closeEvent.bind(null, id)}>
            <button className={`${btnGhost} w-full`} disabled={!allPlayed}>Fechar encontro e atribuir pontos</button>
          </form>
        </div>
      )}
    </Page>
  );
}

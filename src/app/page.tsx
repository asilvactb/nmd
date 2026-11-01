import Link from "next/link";
import { Card, Page, SectionTitle, btn, btnGhost } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { formatDate, getCurrentSeason, getMe, type EventRow, type PlayerRow, type RankingRow } from "@/lib/db";
import { register, setJoker, signOut, unregister } from "./actions";

export default async function Home() {
  const { supabase, player } = await getMe();
  if (!player) {
    return (
      <Page title="NMD">
        <Card>
          <p>O teu email ainda não está associado a nenhum jogador. Pede a um admin para te adicionar.</p>
          <form action={signOut} className="mt-4"><button className={btnGhost}>Sair</button></form>
        </Card>
      </Page>
    );
  }

  const season = await getCurrentSeason();
  const { data: next } = await supabase
    .from("events").select("*").neq("status", "finished")
    .order("date", { ascending: true }).limit(1).maybeSingle<EventRow>();

  const { data: regs } = next
    ? await supabase.from("registrations").select("player_id, joker, players(name, side, is_wild_card)").eq("event_id", next.id)
    : { data: [] };
  const mine = regs?.find((r) => r.player_id === player.id);

  const { data: ranking } = season
    ? await supabase.from("season_ranking").select("*").eq("season_id", season.id).order("points", { ascending: false })
    : { data: [] };
  const rows = (ranking ?? []) as RankingRow[];
  const myIdx = rows.findIndex((r) => r.player_id === player.id);
  const me = rows[myIdx];

  const { data: finos } = await supabase.from("finos").select("quantity");
  const totalFinos = (finos ?? []).reduce((s, f) => s + f.quantity, 0);

  return (
    <Page title="" action={<Logo className="h-7" />}>
      <p className="-mt-4 mb-6 text-muted">Olá, {player.name.split(" ")[0]}.</p>

      {next ? (
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted">Próximo encontro</p>
              <p className="mt-1 text-xl font-semibold capitalize">{formatDate(next.date)}</p>
              <p className="text-sm text-muted">{regs?.length ?? 0} inscritos</p>
            </div>
            {next.status !== "registration" && (
              <Link href={`/encontros/${next.id}`} className={btnGhost}>Ver jogos</Link>
            )}
          </div>
          {next.status === "registration" && (
            <div className="mt-4 flex flex-wrap gap-2">
              {mine ? (
                <>
                  <form action={unregister.bind(null, next.id)}><button className={btnGhost}>Cancelar inscrição</button></form>
                  <form action={setJoker.bind(null, next.id, !mine.joker)}>
                    <button className={mine.joker ? btn : btnGhost}>{mine.joker ? "Joker ativo ★" : "Usar Joker"}</button>
                  </form>
                </>
              ) : (
                <form action={register.bind(null, next.id)}><button className={btn}>Inscrever-me</button></form>
              )}
            </div>
          )}
          {regs && regs.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5 text-xs">
              {regs.map((r) => {
                const p = r.players as unknown as Pick<PlayerRow, "name" | "side" | "is_wild_card">;
                return (
                  <li key={r.player_id} className="rounded-full border border-line px-2.5 py-1">
                    {p.name}{p.is_wild_card ? " (wc)" : ""} <span className="text-muted">{p.side === "L" ? "E" : "D"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : (
        <Card><p className="text-muted">Ainda não há encontro marcado.</p></Card>
      )}

      <SectionTitle>{season?.name ?? "Temporada"}</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Posição" value={me ? `${myIdx + 1}.º` : "—"} />
        <Stat label="Pontos" value={me ? String(Number(me.points)) : "0"} />
        <Stat label="Finos NMD" value={String(totalFinos)} />
      </div>

      <form action={signOut} className="mt-10 text-center"><button className="text-sm text-muted">Sair</button></form>
    </Page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="!p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>
      <p className="tabular mt-1 text-2xl font-semibold">{value}</p>
    </Card>
  );
}

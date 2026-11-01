import { Page } from "@/components/ui";
import { getCurrentSeason, getMe, type RankingRow } from "@/lib/db";

export default async function RankingPage() {
  const { supabase, player } = await getMe();
  const season = await getCurrentSeason();
  const { data } = season
    ? await supabase.from("season_ranking").select("*").eq("season_id", season.id).order("points", { ascending: false })
    : { data: [] };
  const rows = (data ?? []) as RankingRow[];

  // Ties share the same rank (RANK.EQ, as in the spreadsheet)
  const ranks = rows.map((r) => rows.findIndex((x) => Number(x.points) === Number(r.points)) + 1);

  return (
    <Page title="Ranking">
      <p className="-mt-3 mb-4 text-sm text-muted">{season?.name}</p>
      <div className="overflow-hidden rounded-2xl bg-card">
        <table className="tabular w-full text-sm">
          <thead className="text-left text-[11px] uppercase tracking-wider text-muted">
            <tr>
              <th className="py-2.5 pl-4 pr-2 font-medium">#</th>
              <th className="py-2.5 font-medium">Jogador</th>
              <th className="px-1 py-2.5 text-center font-medium">J</th>
              <th className="px-1 py-2.5 text-center font-medium">V</th>
              <th className="px-1 py-2.5 text-center font-medium">B</th>
              <th className="py-2.5 pl-1 pr-4 text-right font-medium">Pts</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.player_id} className={`border-t border-line ${r.player_id === player?.id ? "font-semibold" : ""}`}>
                <td className="py-2.5 pl-4 pr-2 text-muted">{ranks[i]}</td>
                <td className="py-2.5">
                  {r.name}{r.is_wild_card && <span className="text-muted"> (wc)</span>}
                  {r.joker_used && <span title="Joker usado"> ★</span>}
                  <span className="ml-1.5 text-xs text-muted">{r.side === "L" ? "E" : "D"}</span>
                </td>
                <td className="px-1 py-2.5 text-center">{r.events_played}</td>
                <td className="px-1 py-2.5 text-center">{r.wins}</td>
                <td className="px-1 py-2.5 text-center">{r.bombos}</td>
                <td className="py-2.5 pl-1 pr-4 text-right">{Number(r.points).toLocaleString("pt-PT")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">J encontros · V vitórias · B bombos · ★ Joker usado</p>
    </Page>
  );
}

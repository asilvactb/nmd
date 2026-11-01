import { Card, Page } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { getMe, type PlayerRow } from "@/lib/db";

interface AwardRow { season_name: string; award: string; winner: string | null }

/** Hall of Fame: season awards ("Prémios NMD"), most recent season first. */
export default async function HallPage() {
  const { supabase } = await getMe();
  const [{ data: awards }, { data: players }] = await Promise.all([
    supabase.from("awards").select("season_name, award, winner"),
    supabase.from("players").select("name, aliases, avatar_path"),
  ]);

  // Award winners were typed by hand: match them to players by name, surname or alias
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const lookup = new Map<string, Pick<PlayerRow, "name" | "avatar_path">>();
  for (const p of (players ?? []) as Array<Pick<PlayerRow, "name" | "avatar_path"> & { aliases: string[] }>) {
    lookup.set(norm(p.name), p);
    for (const a of p.aliases ?? []) lookup.set(norm(a), p);
  }
  const find = (w: string) =>
    lookup.get(norm(w)) ??
    [...lookup.entries()].find(([k]) => norm(w).startsWith(k + " ") || norm(w).endsWith(" " + k))?.[1];

  const bySeason = new Map<string, AwardRow[]>();
  for (const a of (awards ?? []) as AwardRow[]) {
    bySeason.set(a.season_name, [...(bySeason.get(a.season_name) ?? []), a]);
  }
  // "Inverno 2024/2025" starts in Sept 2024, "Verão 2025" in March 2025
  const order = (name: string) => Number(name.match(/\d{4}/)?.[0] ?? 0) + (/inverno/i.test(name) ? 0.5 : 0);
  const seasons = [...bySeason.keys()].sort((a, b) => order(b) - order(a));

  return (
    <Page title="Hall of Fame">
      <div className="flex flex-col gap-6">
        {seasons.map((s) => (
          <section key={s}>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">{s}</h2>
            <Card className="!p-0">
              {bySeason.get(s)!.map((a) => {
                const p = a.winner ? find(a.winner) : undefined;
                return (
                  <div key={a.award} className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                    <Avatar name={a.winner ?? "?"} path={p?.avatar_path} size={40} />
                    <div className="min-w-0">
                      <p className="text-xs text-muted">{a.award}</p>
                      <p className="truncate font-medium">{a.winner}</p>
                    </div>
                  </div>
                );
              })}
            </Card>
          </section>
        ))}
      </div>
    </Page>
  );
}

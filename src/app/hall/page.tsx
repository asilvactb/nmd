import Link from "next/link";
import type { CSSProperties } from "react";
import { Page } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { Medal } from "@/components/Medal";
import { Reveal } from "@/components/Reveal";
import { getMe, type PlayerRow } from "@/lib/db";

interface AwardRow { season_name: string; award: string; winner: string | null; player_id: string | null }

/** Hall of Fame: season awards ("Prémios NMD"), each with its medal, most recent season first. */
export default async function HallPage() {
  const { supabase } = await getMe();
  const [{ data: awards }, { data: players }] = await Promise.all([
    supabase.from("awards").select("season_name, award, winner, player_id"),
    supabase.from("players").select("id, name, avatar_path"),
  ]);
  const byId = new Map(((players ?? []) as Pick<PlayerRow, "id" | "name" | "avatar_path">[]).map((p) => [p.id, p]));

  const bySeason = new Map<string, AwardRow[]>();
  for (const a of (awards ?? []) as AwardRow[]) bySeason.set(a.season_name, [...(bySeason.get(a.season_name) ?? []), a]);
  // "Inverno 2024/2025" starts in Sept 2024, "Verão 2025" in March 2025
  const order = (name: string) => Number(name.match(/\d{4}/)?.[0] ?? 0) + (/inverno/i.test(name) ? 0.5 : 0);
  const seasons = [...bySeason.keys()].sort((a, b) => order(b) - order(a));

  // Most decorated
  const tally = new Map<string, number>();
  for (const a of (awards ?? []) as AwardRow[]) if (a.player_id) tally.set(a.player_id, (tally.get(a.player_id) ?? 0) + 1);
  const legends = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <Page eyebrow="Prémios NMD" title="Hall of Fame">
      {legends.length > 0 && (
        <section className="rise court relative mb-8 overflow-hidden rounded-[28px] border border-line bg-card p-5 lg:p-7">
          <div className="aurora !opacity-40" />
          <p className="eyebrow relative">Os mais condecorados</p>
          <div className="relative mt-4 flex gap-4 overflow-x-auto pb-1">
            {legends.map(([id, n], i) => {
              const p = byId.get(id);
              return p ? (
                <Link key={id} href={`/jogadores/${id}`} className="flex w-20 shrink-0 flex-col items-center text-center">
                  <Avatar name={p.name} path={p.avatar_path} size={i === 0 ? 68 : 56} className={i === 0 ? "!ring-accent" : ""} />
                  <span className="mt-2 w-full truncate text-xs font-semibold">{p.name}</span>
                  <span className="text-[11px] text-muted">{n} prémio{n > 1 ? "s" : ""}</span>
                </Link>
              ) : null;
            })}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        {seasons.map((s, si) => (
          <Reveal key={s} i={si % 2}>
            <h2 className="display mb-3 text-2xl">{s}</h2>
            <div className="overflow-hidden rounded-3xl border border-line bg-card">
              {bySeason.get(s)!.map((a, i) => {
                const p = a.player_id ? byId.get(a.player_id) : undefined;
                const row = (
                  <>
                    <Medal award={a.award} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] uppercase tracking-wider text-muted">{a.award}</p>
                      <p className="truncate font-semibold">{a.winner}</p>
                    </div>
                    <Avatar name={a.winner ?? "?"} path={p?.avatar_path} size={36} />
                  </>
                );
                const cls = "rise flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0";
                const style = { "--i": Math.min(i, 10) } as CSSProperties;
                return p ? (
                  <Link key={a.award} href={`/jogadores/${a.player_id}`} className={`${cls} transition hover:bg-card-2`} style={style}>{row}</Link>
                ) : (
                  <div key={a.award} className={cls} style={style}>{row}</div>
                );
              })}
            </div>
          </Reveal>
        ))}
      </div>
    </Page>
  );
}

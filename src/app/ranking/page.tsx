import Link from "next/link";
import type { CSSProperties } from "react";
import { Page, btnGhost } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { CountUp } from "@/components/CountUp";
import { getCurrentSeason, getMe, type RankingRow } from "@/lib/db";

/** Competition ranking (1,2,2,4) as in the spreadsheet's RANK.EQ. */
function ranks(points: number[]) {
  return points.map((p) => points.findIndex((x) => x === p) + 1);
}

export default async function RankingPage() {
  const { supabase, player } = await getMe();
  const season = await getCurrentSeason();
  if (!season) return <Page title="Ranking"><p className="text-muted">Sem temporada ativa.</p></Page>;

  const [{ data }, { data: pts }] = await Promise.all([
    supabase.from("season_ranking").select("*").eq("season_id", season.id).order("points", { ascending: false }),
    supabase.from("event_points").select("player_id, points, events!inner(date, season_id, status)")
      .eq("events.season_id", season.id).eq("events.status", "finished"),
  ]);
  const rows = (data ?? []) as RankingRow[];
  const pos = ranks(rows.map((r) => Number(r.points)));

  // Movement since the previous encounter
  const dates = [...new Set((pts ?? []).map((p) => (p.events as unknown as { date: string }).date))].sort();
  const lastDate = dates.at(-1);
  const before = new Map<string, number>();
  for (const p of pts ?? []) {
    if ((p.events as unknown as { date: string }).date === lastDate) continue;
    before.set(p.player_id, (before.get(p.player_id) ?? 0) + Number(p.points));
  }
  const prevOrder = [...before.entries()].sort((a, b) => b[1] - a[1]);
  const prevRank = new Map(prevOrder.map(([id, v]) => [id, prevOrder.findIndex(([, x]) => x === v) + 1]));

  const podium = rows.slice(0, 3);
  const order = [1, 0, 2]; // 2nd, 1st, 3rd

  return (
    <Page eyebrow={season.name} title="Ranking" action={<Link href="/hall" className={btnGhost}>Hall of Fame</Link>}>
      {podium.length === 3 && (
        <div className="mb-8 grid grid-cols-3 items-end gap-2">
          {order.map((idx, k) => {
            const r = podium[idx]!;
            const h = idx === 0 ? "h-28" : idx === 1 ? "h-20" : "h-14";
            return (
              <div key={r.player_id} className="rise flex flex-col items-center" style={{ "--i": k + 1 } as CSSProperties}>
                <div className="relative">
                  <Avatar name={r.name} path={r.avatar_path} size={idx === 0 ? 84 : 64}
                    className={idx === 0 ? "!ring-accent !ring-[3px]" : ""} />
                  {idx === 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl">👑</span>}
                </div>
                <p className="mt-2 max-w-full truncate text-center text-sm font-semibold">{r.name}</p>
                <p className="display-num text-lg text-muted">{Number(r.points).toLocaleString("pt-PT")}</p>
                <div className={`mt-2 flex w-full items-start justify-center rounded-t-2xl ${idx === 0 ? "bg-accent text-accent-ink" : "bg-card-2"} ${h}`}>
                  <span className="display-num mt-2 text-3xl">{idx + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {rows.slice(3).map((r, k) => {
          const i = k + 3;
          const now = pos[i]!;
          const prev = prevRank.get(r.player_id);
          const delta = prev ? prev - now : 0;
          const isMe = r.player_id === player?.id;
          return (
            <li key={r.player_id} className={`rise flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${isMe ? "border-accent/60 bg-accent/10" : "border-line bg-card"}`}
              style={{ "--i": Math.min(k + 4, 14) } as CSSProperties}>
              <span className="display-num w-7 text-center text-lg text-muted">{now}</span>
              <Avatar name={r.name} path={r.avatar_path} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {r.name}{r.is_wild_card && <span className="text-muted"> · wc</span>}{r.joker_used && <span className="text-accent"> ★</span>}
                </p>
                <p className="text-xs text-muted">
                  {r.side === "L" ? "Esquerda" : "Direita"} · {r.events_played} enc. · {r.wins}V · {r.bombos}B
                </p>
              </div>
              <span className={`w-8 text-right text-xs font-semibold ${delta > 0 ? "text-accent" : delta < 0 ? "text-danger" : "text-muted"}`}>
                {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${-delta}` : "–"}
              </span>
              <span className="display-num w-12 text-right text-xl">
                {isMe ? <CountUp value={Number(r.points)} decimals={Number(r.points) % 1 ? 1 : 0} /> : Number(r.points).toLocaleString("pt-PT")}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-center text-xs text-muted">▲▼ desde o último encontro · ★ Joker usado · V vitórias · B bombos</p>
    </Page>
  );
}

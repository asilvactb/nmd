/**
 * Event lifecycle on top of the rules engine:
 * registration -> pairs (preview/save) -> publish (groups + fixtures) -> live scores -> finish (points)
 */
import { randomInt } from "node:crypto";
import { generatePairs, type PairingResult } from "@/lib/engine/pairing";
import { eventPoints } from "@/lib/engine/scoring";
import {
  directCrossFormat,
  finalsOnlyFormat,
  finalPlaces,
  formatFor,
  groupFixtures,
  groupStandings,
  resolveSlot,
  type FormatDef,
} from "@/lib/engine/tournament";
import type { FixedPair, Player } from "@/lib/engine/types";
import { scheduleMatches } from "@/lib/engine/schedule";
import type { EventRow, MatchRow, PairRow, PlayerRow } from "@/lib/db";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Cryptographically random number in [0, 1) for draws. */
const secureRng = () => randomInt(0, 2 ** 31) / 2 ** 31;

export function eventFormat(event: Pick<EventRow, "format_id">, numPairs: number): FormatDef {
  const id = event.format_id ?? "";
  const base = formatFor(numPairs);
  if (id.endsWith("-finals")) return finalsOnlyFormat(base);
  return id.endsWith("-direct") ? directCrossFormat(base) : base;
}

async function loadEvent(db: SupabaseClient, eventId: string) {
  const { data: event, error } = await db.from("events").select("*").eq("id", eventId).single<EventRow>();
  if (error || !event) throw new Error("Encontro não encontrado.");
  return event;
}

/** Strength per player: season points (ranking) or points per event without joker (weighted). */
async function strengths(db: SupabaseClient, event: EventRow): Promise<Map<string, number>> {
  const { data } = await db
    .from("event_points")
    .select("player_id, base, points, kind, events!inner(season_id, date, counts_for_ranking)")
    .eq("events.season_id", event.season_id)
    .eq("events.counts_for_ranking", true)
    .lt("events.date", event.date);
  const total = new Map<string, number>();
  const base = new Map<string, number>();
  const played = new Map<string, number>();
  for (const r of data ?? []) {
    total.set(r.player_id, (total.get(r.player_id) ?? 0) + Number(r.points));
    base.set(r.player_id, (base.get(r.player_id) ?? 0) + Number(r.base));
    if (r.kind === "placement") played.set(r.player_id, (played.get(r.player_id) ?? 0) + 1);
  }
  if (event.pairing_mode !== "weighted") return total;
  const weighted = new Map<string, number>();
  for (const [id, b] of base) weighted.set(id, b / Math.max(1, played.get(id) ?? 1));
  return weighted;
}

/** Pairs of the last 4 encounters before this one (any season). */
async function recentPairs(db: SupabaseClient, event: EventRow): Promise<Array<[string, string]>> {
  const { data: prev } = await db
    .from("events")
    .select("id")
    .lt("date", event.date)
    .eq("counts_for_ranking", true)
    .order("date", { ascending: false })
    .limit(4);
  const ids = (prev ?? []).map((e) => e.id);
  if (!ids.length) return [];
  const { data } = await db.from("pairs").select("left_player, right_player").in("event_id", ids);
  return (data ?? []).map((p) => [p.left_player, p.right_player]);
}

export async function computePairs(db: SupabaseClient, eventId: string): Promise<PairingResult> {
  const event = await loadEvent(db, eventId);
  const { data: regs } = await db
    .from("registrations")
    .select("side, volunteer_switch, players(*)")
    .eq("event_id", eventId);
  // The side picked by the admin for this Sunday wins over the player's usual side
  const registered = (regs ?? []).map((r) => {
    const p = r.players as unknown as PlayerRow;
    return { ...p, side: (r.side as PlayerRow["side"] | null) ?? p.side };
  });
  const str = await strengths(db, event);

  // First encounter of the season is always a draw (Regulamento 5.c)
  const { count: previousInSeason } = await db
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("season_id", event.season_id)
    .eq("counts_for_ranking", true)
    .lt("date", event.date);

  const { data: fixed } = await db.from("fixed_pair_requests").select("*").eq("event_id", eventId);

  const players: Player[] = registered.map((p) => ({
    id: p.id,
    name: p.name,
    side: p.side,
    strength: str.get(p.id) ?? 0,
    isWildCard: p.is_wild_card,
  }));

  const mode = previousInSeason === 0 ? "draw" : event.pairing_mode;
  return generatePairs({
    players,
    mode,
    rng: secureRng,
    fixedPairs: (fixed ?? []).map<FixedPair>((f) => ({ a: f.player_a, b: f.player_b, reason: f.reason })),
    recentPairs: await recentPairs(db, event),
    volunteers: (regs ?? []).filter((r) => r.volunteer_switch).map((r) => (r.players as unknown as PlayerRow).id),
  });
}

/**
 * Pairs as reviewed by the admin (the preview, possibly with players dragged between pairs).
 * Every player called up for the Sunday must appear exactly once.
 */
export async function reviewedPairs(
  db: SupabaseClient,
  eventId: string,
  pairs: { leftId: string; rightId: string; reason: string }[],
  log: string[],
  warnings: string[],
): Promise<PairingResult> {
  const event = await loadEvent(db, eventId);
  const { data: regs } = await db.from("registrations").select("players(*)").eq("event_id", eventId);
  const byId = new Map((regs ?? []).map((r) => {
    const p = r.players as unknown as PlayerRow;
    return [p.id, p] as const;
  }));
  const ids = pairs.flatMap((p) => [p.leftId, p.rightId]);
  if (new Set(ids).size !== ids.length || ids.length !== byId.size || ids.some((id) => !byId.has(id))) {
    throw new Error("As duplas não batem certo com os convocados. Volta a pré-visualizar.");
  }
  const str = await strengths(db, event);
  const toPlayer = (id: string, side: "L" | "R"): Player => {
    const p = byId.get(id)!;
    return { id, name: p.name, side, strength: str.get(id) ?? 0, isWildCard: p.is_wild_card };
  };
  return {
    pairs: pairs.map((p) => ({
      left: toPlayer(p.leftId, "L"),
      right: toPlayer(p.rightId, "R"),
      reason: p.reason as PairingResult["pairs"][number]["reason"],
    })),
    sideSwitches: [],
    log,
    warnings,
  };
}

/** Save pairs, split them into groups (snake by strength) and create every match. */
export async function savePairsAndFixtures(db: SupabaseClient, eventId: string, result: PairingResult) {
  const event = await loadEvent(db, eventId);
  const format = eventFormat(event, result.pairs.length);

  await db.from("matches").delete().eq("event_id", eventId);
  await db.from("pairs").delete().eq("event_id", eventId);

  // Snake distribution by combined strength keeps the groups balanced
  const ordered = [...result.pairs].sort(
    (a, b) => b.left.strength + b.right.strength - (a.left.strength + a.right.strength),
  );
  const groupNames = Object.keys(format.groups);
  const groups: Record<string, typeof ordered> = Object.fromEntries(groupNames.map((g) => [g, []]));
  ordered.forEach((p, i) => {
    const lap = Math.floor(i / groupNames.length);
    const idx = i % groupNames.length;
    const g = groupNames[lap % 2 === 0 ? idx : groupNames.length - 1 - idx]!;
    groups[g]!.push(p);
  });

  const pairRows = groupNames.flatMap((g) =>
    groups[g]!.map((p, i) => ({
      event_id: eventId,
      left_player: p.left.id,
      right_player: p.right.id,
      reason: p.reason,
      group_name: g,
      seed: i + 1,
    })),
  );
  const { data: inserted, error } = await db.from("pairs").insert(pairRows).select("*");
  if (error) throw error;
  const saved = inserted as PairRow[];

  const matchRows: Partial<MatchRow>[] = [];
  for (const g of groupNames) {
    const ids = saved.filter((p) => p.group_name === g).sort((a, b) => a.seed! - b.seed!).map((p) => p.id);
    groupFixtures(ids).forEach((round, r) =>
      round.forEach(([a, b]) =>
        matchRows.push({ event_id: eventId, stage: "group", group_name: g, round: r + 1, pair_a: a, pair_b: b }),
      ),
    );
  }
  for (const k of format.knockout) {
    matchRows.push({ event_id: eventId, stage: "knockout", knockout_id: k.id, label: k.label });
  }
  const { error: mErr } = await db.from("matches").insert(matchRows);
  if (mErr) throw mErr;
  await rescheduleEvent(db, eventId);

  await db
    .from("events")
    .update({
      status: "pairs_published",
      format_id: format.id,
      pairing_log: { log: [...(event.notes ? [event.notes] : []), ...result.log], warnings: result.warnings },
    })
    .eq("id", eventId);
}

/** Group order (only for groups with every match played) and knockout winners. */
export function tournamentState(format: FormatDef, pairs: PairRow[], matches: MatchRow[]) {
  const groupOrder: Record<string, string[]> = {};
  const tables: Record<string, ReturnType<typeof groupStandings>> = {};
  for (const g of Object.keys(format.groups)) {
    const ids = pairs.filter((p) => p.group_name === g).sort((a, b) => a.seed! - b.seed!).map((p) => p.id);
    const gm = matches.filter((m) => m.stage === "group" && m.group_name === g);
    const table = groupStandings(
      ids,
      gm.map((m) => ({
        a: m.pair_a!,
        b: m.pair_b!,
        score: m.score_a != null && m.score_b != null ? { a: m.score_a, b: m.score_b } : undefined,
      })),
    );
    tables[g] = table;
    if (gm.every((m) => m.score_a != null && m.score_b != null)) groupOrder[g] = table.map((t) => t.pairId);
  }
  const knockoutResults: Record<string, { winner: string; loser: string }> = {};
  for (const m of matches) {
    if (m.stage !== "knockout" || m.score_a == null || m.score_b == null || !m.pair_a || !m.pair_b) continue;
    const aWon = m.score_a > m.score_b;
    knockoutResults[m.knockout_id!] = { winner: aWon ? m.pair_a : m.pair_b, loser: aWon ? m.pair_b : m.pair_a };
  }
  return { groupOrder, tables, knockoutResults };
}

/** After every score: fill knockout slots that became known. */
export async function advanceKnockout(db: SupabaseClient, eventId: string) {
  const event = await loadEvent(db, eventId);
  const { data: pairs } = await db.from("pairs").select("*").eq("event_id", eventId);
  const { data: matches } = await db.from("matches").select("*").eq("event_id", eventId);
  const format = eventFormat(event, pairs!.length);
  const { groupOrder, knockoutResults } = tournamentState(format, pairs as PairRow[], matches as MatchRow[]);

  for (const k of format.knockout) {
    const row = (matches as MatchRow[]).find((m) => m.knockout_id === k.id);
    if (!row) continue;
    const a = resolveSlot(k.a, groupOrder, knockoutResults) ?? null;
    const b = resolveSlot(k.b, groupOrder, knockoutResults) ?? null;
    if (a !== row.pair_a || b !== row.pair_b) {
      await db.from("matches").update({ pair_a: a, pair_b: b }).eq("id", row.id);
    }
  }
  if (event.status === "pairs_published") await db.from("events").update({ status: "live" }).eq("id", eventId);
}

/** Final places + ranking points (Joker applied). */
export async function finishEvent(db: SupabaseClient, eventId: string) {
  const event = await loadEvent(db, eventId);
  const { data: pairs } = await db.from("pairs").select("*").eq("event_id", eventId);
  const { data: matches } = await db.from("matches").select("*").eq("event_id", eventId);
  const ps = pairs as PairRow[];
  const format = eventFormat(event, ps.length);
  const { groupOrder, knockoutResults } = tournamentState(format, ps, matches as MatchRow[]);
  const places = finalPlaces(format, groupOrder, knockoutResults);
  if (places.size !== ps.length) throw new Error("Ainda há jogos por jogar.");

  const { data: regs } = await db.from("registrations").select("player_id, joker").eq("event_id", eventId);
  const jokers = new Set((regs ?? []).filter((r) => r.joker).map((r) => r.player_id));

  const placements = ps.map((p) => ({
    players: [p.left_player, p.right_player] as [string, string],
    position: places.get(p.id)!,
  }));
  for (const p of ps) await db.from("pairs").update({ final_position: places.get(p.id) }).eq("id", p.id);

  const rows = eventPoints(ps.length, placements, jokers).map((r) => ({
    event_id: eventId,
    player_id: r.playerId,
    kind: "placement",
    base: r.base,
    points: r.final,
    joker: r.jokerUsed,
  }));
  await db.from("event_points").delete().eq("event_id", eventId).eq("kind", "placement");
  const { error } = await db.from("event_points").insert(rows);
  if (error) throw error;
  await db.from("events").update({ status: "finished" }).eq("id", eventId);
}

/** Assign every match of the encounter to a jornada and a court (event.courts). */
export async function rescheduleEvent(db: SupabaseClient, eventId: string) {
  const event = await loadEvent(db, eventId);
  const [{ data: pairs }, { data: matches }] = await Promise.all([
    db.from("pairs").select("id").eq("event_id", eventId),
    db.from("matches").select("*").eq("event_id", eventId),
  ]);
  if (!pairs?.length || !matches?.length) return;
  const format = eventFormat(event, pairs.length);
  const ms = matches as MatchRow[];
  // Within a round, alternate groups so every group plays at the same time
  const ordered = [...ms].sort((a, b) =>
    (a.round ?? 0) - (b.round ?? 0) || (a.group_name ?? "").localeCompare(b.group_name ?? "") || a.id.localeCompare(b.id));
  const plan = scheduleMatches(
    ordered.map((m) => ({ key: m.id, round: m.stage === "group" ? m.round ?? undefined : undefined, group: m.group_name ?? undefined, knockoutId: m.knockout_id ?? undefined })),
    format,
    event.courts || 4,
  );
  for (const p of plan) await db.from("matches").update({ slot: p.slot, court: p.court }).eq("id", p.key);
}

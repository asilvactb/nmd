import { createClient } from "@/lib/supabase/server";
import type { Side } from "@/lib/engine/types";

export interface PlayerRow {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string;
  side: Side;
  is_wild_card: boolean;
  is_admin: boolean;
  birth_date: string | null;
  active: boolean;
  avatar_path: string | null;
  side_confirmed: boolean;
}

export interface SeasonRow {
  id: string;
  name: string;
  kind: "inverno" | "verao" | "ferias";
  starts_on: string;
  is_current: boolean;
}

export type EventStatus = "registration" | "pairs_published" | "live" | "finished";

export interface EventRow {
  id: string;
  season_id: string;
  date: string;
  status: EventStatus;
  format_id: string | null;
  pairing_mode: "ranking" | "weighted" | "draw";
  courts: number;
  expected_players: number | null;
  counts_for_ranking: boolean;
  notes: string | null;
  pairing_log: { log: string[]; warnings: string[] } | null;
}

export interface PairRow {
  id: string;
  event_id: string;
  left_player: string;
  right_player: string;
  reason: string;
  group_name: string | null;
  seed: number | null;
  final_position: number | null;
}

export interface MatchRow {
  id: string;
  event_id: string;
  stage: "group" | "knockout";
  group_name: string | null;
  round: number | null;
  knockout_id: string | null;
  label: string | null;
  pair_a: string | null;
  pair_b: string | null;
  score_a: number | null;
  score_b: number | null;
  slot: number | null;
  court: number | null;
}

export interface RankingRow {
  season_id: string;
  player_id: string;
  name: string;
  side: Side;
  is_wild_card: boolean;
  points: number;
  events_played: number;
  wins: number;
  bombos: number;
  joker_used: boolean | null;
  avatar_path: string | null;
}

export async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, player: null };
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<PlayerRow>();
  return { supabase, user, player };
}

export async function requireAdmin() {
  const me = await getMe();
  if (!me.player?.is_admin) throw new Error("Só para admins.");
  return me as typeof me & { player: PlayerRow };
}

export async function getCurrentSeason() {
  const supabase = await createClient();
  const { data } = await supabase.from("seasons").select("*").eq("is_current", true).maybeSingle<SeasonRow>();
  return data;
}

export const SIDE_LABEL: Record<Side, string> = { L: "Esquerda", R: "Direita" };

export function formatDate(iso: string) {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-PT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function pairName(pair: PairRow | undefined, players: Map<string, PlayerRow>) {
  if (!pair) return "—";
  const n = (id: string) => {
    const p = players.get(id);
    return p ? p.name + (p.is_wild_card ? " (wc)" : "") : "?";
  };
  return `${n(pair.left_player)} / ${n(pair.right_player)}`;
}

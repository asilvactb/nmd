"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe, requireAdmin } from "@/lib/db";
import { validateScore } from "@/lib/engine/tournament";
import { advanceKnockout, computePairs, finishEvent, rescheduleEvent, reviewedPairs, savePairsAndFixtures } from "@/lib/event-flow";

// ---------------------------------------------------------------- members

export async function register(eventId: string) {
  const { supabase, player } = await getMe();
  if (!player) throw new Error("Sem jogador associado.");
  await supabase.from("registrations").insert({ event_id: eventId, player_id: player.id });
  revalidatePath("/");
}

export async function unregister(eventId: string) {
  const { supabase, player } = await getMe();
  if (!player) throw new Error("Sem jogador associado.");
  await supabase.from("registrations").delete().eq("event_id", eventId).eq("player_id", player.id);
  revalidatePath("/");
}

export async function setJoker(eventId: string, on: boolean) {
  const { supabase, player } = await getMe();
  if (!player) throw new Error("Sem jogador associado.");
  if (on) {
    // One joker per season (Regulamento 6.h.i)
    const { data: ev } = await supabase.from("events").select("season_id").eq("id", eventId).single();
    const { count } = await supabase
      .from("registrations")
      .select("event_id, events!inner(season_id)", { count: "exact", head: true })
      .eq("player_id", player.id)
      .eq("joker", true)
      .eq("events.season_id", ev!.season_id)
      .neq("event_id", eventId);
    if ((count ?? 0) > 0) throw new Error("Já usaste o Joker esta temporada.");
  }
  await supabase.from("registrations").update({ joker: on }).eq("event_id", eventId).eq("player_id", player.id);
  revalidatePath("/");
}

/** Each player logs their own fino; it counts towards the group total and today's encounter. */
export async function addFinos() {
  const { supabase, player } = await getMe();
  if (!player) throw new Error("Sem jogador associado.");
  const today = new Date().toISOString().slice(0, 10);
  const { data: ev } = await supabase
    .from("events").select("id").lte("date", today).eq("counts_for_ranking", true).order("date", { ascending: false }).limit(1).maybeSingle();
  await supabase.from("finos").insert({
    player_id: player.id, event_id: ev?.id ?? null, quantity: 1, kind: "drink", created_by: player.id,
  });
  revalidatePath("/finos");
  revalidatePath("/");
}

/** Undo: removes the player's own most recent fino. */
export async function removeFino() {
  const { supabase, player } = await getMe();
  if (!player) throw new Error("Sem jogador associado.");
  const { data: lastFino } = await supabase
    .from("finos").select("id").eq("player_id", player.id)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (lastFino) await supabase.from("finos").delete().eq("id", lastFino.id);
  revalidatePath("/finos");
  revalidatePath("/");
}

// ---------------------------------------------------------------- morfes

const MORFES_PER_SUNDAY = 2;

export async function volunteerMorfes(eventId: string) {
  const { supabase, player } = await getMe();
  if (!player) return { error: "Sem jogador associado." };
  const { count } = await supabase.from("repasto").select("player_id", { count: "exact", head: true }).eq("event_id", eventId);
  if ((count ?? 0) >= MORFES_PER_SUNDAY) return { error: "Já há 2 voluntários para este domingo." };
  const { error } = await supabase.from("repasto").insert({ event_id: eventId, player_id: player.id });
  revalidatePath("/morfes");
  revalidatePath("/");
  return { error: error ? "Não foi possível." : null };
}

export async function leaveMorfes(eventId: string) {
  const { supabase, player } = await getMe();
  if (!player) return;
  await supabase.from("repasto").delete().eq("event_id", eventId).eq("player_id", player.id);
  revalidatePath("/morfes");
  revalidatePath("/");
}

export async function adminSetMorfes(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  const playerId = String(formData.get("player_id"));
  if (formData.get("remove")) await supabase.from("repasto").delete().eq("event_id", eventId).eq("player_id", playerId);
  else if (playerId) await supabase.from("repasto").upsert({ event_id: eventId, player_id: playerId });
  revalidatePath("/morfes");
  revalidatePath("/");
}

// ---------------------------------------------------------------- tesouraria (admins)

/** Amount accepts "9", "+9", "-49,92", "−12.5"; positive adds to the cash, negative takes from it. */
export async function addMovement(formData: FormData) {
  const { supabase, player } = await requireAdmin();
  const raw = String(formData.get("amount") ?? "").replace(/\s|€/g, "").replace("−", "-").replace(",", ".");
  const amount = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(amount) || amount === 0) return { error: "Valor inválido (ex.: 9 ou -49,92)." };
  const playerId = String(formData.get("player_id") ?? "") || null;
  const who = String(formData.get("counterparty") ?? "").trim() || null;
  const { error } = await supabase.from("ledger").insert({
    date: String(formData.get("date") || new Date().toISOString().slice(0, 10)),
    kind: amount > 0 ? "credit" : "debit",
    amount,
    player_id: playerId,
    counterparty: who,
    reason: String(formData.get("reason") ?? "").trim() || null,
    pending: formData.get("pending") === "on",
    created_by: player.id,
  });
  revalidatePath("/tesouraria");
  revalidatePath("/");
  return { error: error ? "Não foi possível guardar." : null };
}

export async function setMovementPending(id: string, pending: boolean) {
  const { supabase } = await requireAdmin();
  await supabase.from("ledger").update({ pending }).eq("id", id);
  revalidatePath("/tesouraria");
  revalidatePath("/");
}

export async function deleteMovement(id: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("ledger").delete().eq("id", id);
  revalidatePath("/tesouraria");
  revalidatePath("/");
}

export async function signOut() {
  const { supabase } = await getMe();
  await supabase.auth.signOut();
  redirect("/login");
}

// ---------------------------------------------------------------- scores (admins)

export async function saveScore(matchId: string, eventId: string, a: number, b: number) {
  const { supabase, player } = await requireAdmin();
  const err = validateScore({ a, b });
  if (err) return { error: err };
  await supabase
    .from("matches")
    .update({ score_a: a, score_b: b, updated_by: player.id, updated_at: new Date().toISOString() })
    .eq("id", matchId);
  await advanceKnockout(supabase, eventId);
  revalidatePath(`/encontros/${eventId}`);
  return { error: null };
}

// ---------------------------------------------------------------- admin

export async function createEvent(formData: FormData) {
  const { supabase } = await requireAdmin();
  const { data: season } = await supabase.from("seasons").select("id").eq("is_current", true).single();
  if (!season) throw new Error("Não há temporada ativa.");
  const { data, error } = await supabase
    .from("events")
    .insert({
      season_id: season.id,
      date: String(formData.get("date")),
      expected_players: Number(formData.get("expected_players") ?? 20),
      courts: Number(formData.get("courts") ?? 4),
      pairing_mode: String(formData.get("pairing_mode") ?? "ranking"),
      counts_for_ranking: formData.get("test") !== "on",
    })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/admin/encontros/${data.id}`);
}

/** Deletes a test encounter and everything in it (pairs, games, points, morfes, finos). */
export async function deleteTestEvent(eventId: string) {
  const { supabase } = await requireAdmin();
  const { data: ev } = await supabase.from("events").select("counts_for_ranking").eq("id", eventId).single();
  if (!ev || ev.counts_for_ranking) throw new Error("Só se podem apagar encontros de teste.");
  await supabase.from("finos").delete().eq("event_id", eventId);
  await supabase.from("events").delete().eq("id", eventId);
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/encontros");
  redirect("/admin");
}

export async function adminRegister(eventId: string, playerId: string, on: boolean) {
  const { supabase } = await requireAdmin();
  if (on) await supabase.from("registrations").upsert({ event_id: eventId, player_id: playerId });
  else await supabase.from("registrations").delete().eq("event_id", eventId).eq("player_id", playerId);
  revalidatePath(`/admin/encontros/${eventId}`);
}

/** Draw setup: put a player on the left/right for this Sunday, or take them out (null). */
export async function adminSetSide(eventId: string, playerId: string, side: "L" | "R" | null) {
  const { supabase } = await requireAdmin();
  if (side) await supabase.from("registrations").upsert({ event_id: eventId, player_id: playerId, side });
  else await supabase.from("registrations").delete().eq("event_id", eventId).eq("player_id", playerId);
  revalidatePath(`/admin/encontros/${eventId}`);
}

/**
 * Side balance by draw (Regulamento 5.e, as the group does it): when one side has more
 * players, draw at random who from the bigger side moves to the other one.
 * Uses crypto randomness and records the result on the event for transparency.
 */
export async function adminDrawSides(eventId: string) {
  const { supabase } = await requireAdmin();
  const { randomInt } = await import("node:crypto");
  const { data: regs } = await supabase.from("registrations").select("player_id, side, players(name, side)").eq("event_id", eventId);
  const rows = (regs ?? []).map((r) => {
    const p = r.players as unknown as { name: string; side: "L" | "R" };
    return { id: r.player_id as string, name: p.name, side: ((r.side as "L" | "R" | null) ?? p.side) };
  });
  const L = rows.filter((r) => r.side === "L");
  const R = rows.filter((r) => r.side === "R");
  const diff = Math.abs(L.length - R.length);
  if (diff === 0) return { error: "Os lados já estão equilibrados.", moved: [] as { id: string; name: string }[] };
  if (diff % 2) return { error: "Número ímpar de jogadores: falta um para equilibrar.", moved: [] as { id: string; name: string }[] };
  const [big, to] = L.length > R.length ? [L, "R" as const] : [R, "L" as const];
  const pool = [...big];
  const moved: { id: string; name: string }[] = [];
  for (let k = 0; k < diff / 2; k++) moved.push(pool.splice(randomInt(0, pool.length), 1)[0]!);
  for (const m of moved) {
    await supabase.from("registrations").update({ side: to }).eq("event_id", eventId).eq("player_id", m.id);
  }
  const note = `Sorteio de lados: ${moved.map((m) => m.name).join(", ")} ${moved.length > 1 ? "passaram" : "passou"} para a ${to === "L" ? "esquerda" : "direita"} (sorteados entre ${big.length} ${to === "L" ? "direitas" : "esquerdas"}).`;
  await supabase.from("events").update({ notes: note }).eq("id", eventId);
  revalidatePath(`/admin/encontros/${eventId}`);
  return { error: null, moved, to, note };
}

/** Draw setup: create a new player (or wild card) on the spot and put them in this Sunday. */
export async function adminQuickPlayer(eventId: string, name: string, side: "L" | "R", isWildCard: boolean) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("players").insert({ name: name.trim(), side, is_wild_card: isWildCard })
    .select("id, name, side, avatar_path, is_wild_card").single();
  if (error || !data) return { error: error?.message.includes("duplicate") ? "Já existe um jogador com esse nome." : "Não foi possível criar.", player: null };
  await supabase.from("registrations").upsert({ event_id: eventId, player_id: data.id, side });
  revalidatePath(`/admin/encontros/${eventId}`);
  return { error: null, player: data as { id: string; name: string; side: "L" | "R"; avatar_path: string | null; is_wild_card: boolean } };
}

/** After the draw: mark who played the Joker (once per season). */
export async function adminSetJoker(eventId: string, playerId: string, on: boolean) {
  const { supabase } = await requireAdmin();
  const { data: ev } = await supabase.from("events").select("season_id, status").eq("id", eventId).single();
  if (ev?.status === "finished") return { error: "O encontro já foi fechado." };
  if (on) {
    const { count } = await supabase
      .from("registrations")
      .select("event_id, events!inner(season_id)", { count: "exact", head: true })
      .eq("player_id", playerId).eq("joker", true)
      .eq("events.season_id", ev!.season_id).neq("event_id", eventId);
    const { count: imported } = await supabase
      .from("event_points")
      .select("event_id, events!inner(season_id)", { count: "exact", head: true })
      .eq("player_id", playerId).eq("joker", true).eq("events.season_id", ev!.season_id);
    if ((count ?? 0) + (imported ?? 0) > 0) return { error: "Este jogador já usou o Joker esta temporada." };
  }
  await supabase.from("registrations").update({ joker: on }).eq("event_id", eventId).eq("player_id", playerId);
  revalidatePath(`/admin/encontros/${eventId}`);
  return { error: null };
}

export async function adminSetRegistrationFlag(
  eventId: string,
  playerId: string,
  flag: "joker" | "volunteer_switch",
  on: boolean,
) {
  const { supabase } = await requireAdmin();
  await supabase.from("registrations").update({ [flag]: on }).eq("event_id", eventId).eq("player_id", playerId);
  revalidatePath(`/admin/encontros/${eventId}`);
}

export async function addFixedPair(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  await supabase.from("fixed_pair_requests").insert({
    event_id: eventId,
    player_a: String(formData.get("player_a")),
    player_b: String(formData.get("player_b")),
    reason: String(formData.get("reason")),
  });
  revalidatePath(`/admin/encontros/${eventId}`);
}

export async function removeFixedPair(id: string, eventId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("fixed_pair_requests").delete().eq("id", id);
  revalidatePath(`/admin/encontros/${eventId}`);
}

export async function setEventCourts(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  await supabase.from("events").update({ courts: Number(formData.get("courts")) }).eq("id", eventId);
  await rescheduleEvent(supabase, eventId);
  revalidatePath(`/admin/encontros/${eventId}`);
  revalidatePath(`/encontros/${eventId}`);
}

export async function updateEventSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  await supabase
    .from("events")
    .update({
      pairing_mode: String(formData.get("pairing_mode")),
      expected_players: Number(formData.get("expected_players")),
      courts: Number(formData.get("courts") ?? 4),
    })
    .eq("id", eventId);
  revalidatePath(`/admin/encontros/${eventId}`);
}

/** Preview: run the engine without saving. */
export async function previewPairs(eventId: string) {
  const { supabase } = await requireAdmin();
  try {
    const r = await computePairs(supabase, eventId);
    const { data: av } = await supabase.from("players").select("id, avatar_path");
    const path = new Map((av ?? []).map((x) => [x.id as string, x.avatar_path as string | null]));
    return {
      pairs: r.pairs.map((p) => ({
        left: p.left.name, right: p.right.name, reason: p.reason,
        leftId: p.left.id, rightId: p.right.id,
        leftPath: path.get(p.left.id) ?? null, rightPath: path.get(p.right.id) ?? null,
      })),
      log: r.log,
      warnings: r.warnings,
      error: null as string | null,
    };
  } catch (e) {
    return { pairs: [], log: [], warnings: [], error: (e as Error).message };
  }
}

/** Run the engine again and publish pairs + fixtures. */
/** Publishes exactly the pairs the admin reviewed (and possibly rearranged) in the preview. */
export async function publishPairs(
  eventId: string,
  reviewed: { pairs: { leftId: string; rightId: string; reason: string }[]; log: string[]; warnings: string[] },
) {
  const { supabase } = await requireAdmin();
  const r = await reviewedPairs(supabase, eventId, reviewed.pairs, reviewed.log, reviewed.warnings);
  await savePairsAndFixtures(supabase, eventId, r);
  revalidatePath(`/admin/encontros/${eventId}`);
  redirect(`/encontros/${eventId}`);
}

export async function useDirectCross(eventId: string) {
  const { supabase } = await requireAdmin();
  const { data: ev } = await supabase.from("events").select("format_id").eq("id", eventId).single();
  const { count: koPlayed } = await supabase.from("matches").select("id", { count: "exact", head: true })
    .eq("event_id", eventId).eq("stage", "knockout").not("score_a", "is", null);
  if (koPlayed) throw new Error("Já há eliminatórias jogadas.");
  if (ev?.format_id && !ev.format_id.endsWith("-finals")) {
    // Replace the knockout matches by the direct-cross ones
    const { data: pairs } = await supabase.from("pairs").select("id").eq("event_id", eventId);
    const { finalsOnlyFormat, formatFor } = await import("@/lib/engine/tournament");
    const f = finalsOnlyFormat(formatFor(pairs!.length));
    await supabase.from("matches").delete().eq("event_id", eventId).eq("stage", "knockout");
    await supabase.from("matches").insert(
      f.knockout.map((k) => ({ event_id: eventId, stage: "knockout", knockout_id: k.id, label: k.label })),
    );
    await supabase.from("events").update({ format_id: f.id }).eq("id", eventId);
    await advanceKnockout(supabase, eventId);
    await rescheduleEvent(supabase, eventId);
  }
  revalidatePath(`/encontros/${eventId}`);
}

export async function closeEvent(eventId: string) {
  const { supabase } = await requireAdmin();
  await finishEvent(supabase, eventId);
  revalidatePath("/ranking");
  redirect(`/encontros/${eventId}`);
}

export async function upsertPlayer(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = formData.get("id") ? String(formData.get("id")) : undefined;
  const row = {
    name: String(formData.get("name")).trim(),
    email: String(formData.get("email") ?? "").trim().toLowerCase() || null,
    side: String(formData.get("side")),
    is_wild_card: formData.get("is_wild_card") === "on",
    is_admin: formData.get("is_admin") === "on",
  };
  if (id) await supabase.from("players").update(row).eq("id", id);
  else await supabase.from("players").insert(row);
  revalidatePath("/admin/jogadores");
}

// ---------------------------------------------------------------- sign-up validation (admins)

export async function approveSignup(userId: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.rpc("approve_signup", { req: userId });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function rejectSignup(userId: string) {
  const { supabase } = await requireAdmin();
  await supabase.from("signup_requests").update({ status: "rejected" }).eq("user_id", userId);
  revalidatePath("/admin");
}

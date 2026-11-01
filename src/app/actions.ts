"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMe, requireAdmin } from "@/lib/db";
import { validateScore } from "@/lib/engine/tournament";
import { advanceKnockout, computePairs, finishEvent, savePairsAndFixtures } from "@/lib/event-flow";

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
    .from("events").select("id").lte("date", today).order("date", { ascending: false }).limit(1).maybeSingle();
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
      courts: Number(formData.get("courts") ?? 2),
      pairing_mode: String(formData.get("pairing_mode") ?? "ranking"),
    })
    .select("id")
    .single();
  if (error) throw error;
  redirect(`/admin/encontros/${data.id}`);
}

export async function adminRegister(eventId: string, playerId: string, on: boolean) {
  const { supabase } = await requireAdmin();
  if (on) await supabase.from("registrations").upsert({ event_id: eventId, player_id: playerId });
  else await supabase.from("registrations").delete().eq("event_id", eventId).eq("player_id", playerId);
  revalidatePath(`/admin/encontros/${eventId}`);
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

export async function updateEventSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const eventId = String(formData.get("event_id"));
  await supabase
    .from("events")
    .update({
      pairing_mode: String(formData.get("pairing_mode")),
      courts: Number(formData.get("courts")),
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
export async function publishPairs(eventId: string) {
  const { supabase } = await requireAdmin();
  const r = await computePairs(supabase, eventId);
  await savePairsAndFixtures(supabase, eventId, r);
  revalidatePath(`/admin/encontros/${eventId}`);
  redirect(`/encontros/${eventId}`);
}

export async function useDirectCross(eventId: string) {
  const { supabase } = await requireAdmin();
  const { data: ev } = await supabase.from("events").select("format_id").eq("id", eventId).single();
  if (ev?.format_id && !ev.format_id.endsWith("-direct")) {
    // Replace the knockout matches by the direct-cross ones
    const { data: pairs } = await supabase.from("pairs").select("id").eq("event_id", eventId);
    const { directCrossFormat, formatFor } = await import("@/lib/engine/tournament");
    const f = directCrossFormat(formatFor(pairs!.length));
    await supabase.from("matches").delete().eq("event_id", eventId).eq("stage", "knockout");
    await supabase.from("matches").insert(
      f.knockout.map((k) => ({ event_id: eventId, stage: "knockout", knockout_id: k.id, label: k.label })),
    );
    await supabase.from("events").update({ format_id: f.id }).eq("id", eventId);
    await advanceKnockout(supabase, eventId);
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

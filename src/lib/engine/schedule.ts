/**
 * Court schedule: turns the fixtures into "jornadas" (time slots) with a court each.
 *
 * - Group games keep the round order; a round with more games than courts spills
 *   into the next jornada.
 * - Knockout games are placed in the earliest jornada after every game they depend on
 *   (a final waits for its semi-finals), filling the free courts.
 */
import type { FormatDef, SlotRef } from "./tournament";

export interface ScheduleItem {
  key: string;            // match identifier (caller-defined)
  round?: number;         // group round (1..n), for group games
  knockoutId?: string;    // knockout id, for knockout games
}

export interface Scheduled { key: string; slot: number; court: number }

export function scheduleMatches(items: ScheduleItem[], format: FormatDef, courts: number): Scheduled[] {
  const c = Math.max(1, Math.floor(courts));
  const out: Scheduled[] = [];
  const slotOf = new Map<string, number>(); // knockout id -> slot
  const used = new Map<number, number>();   // slot -> courts used
  let slot = 0;

  const place = (key: string, minSlot: number) => {
    let s = Math.max(minSlot, 1);
    while ((used.get(s) ?? 0) >= c) s++;
    const court = (used.get(s) ?? 0) + 1;
    used.set(s, court);
    out.push({ key, slot: s, court });
    return s;
  };

  // Group stage, round by round
  const rounds = [...new Set(items.filter((i) => i.round).map((i) => i.round!))].sort((a, b) => a - b);
  for (const r of rounds) {
    const games = items.filter((i) => i.round === r);
    slot = Math.max(slot, ...[...used.keys()], 0) + 1;
    for (const g of games) slot = Math.max(slot, place(g.key, slot));
  }
  const groupEnd = Math.max(0, ...[...used.keys()]);

  // Knockouts, respecting dependencies
  const deps = (ref: SlotRef) => ("match" in ref ? [ref.match] : []);
  for (const k of format.knockout) {
    const item = items.find((i) => i.knockoutId === k.id);
    if (!item) continue;
    const after = [...deps(k.a), ...deps(k.b)].map((d) => slotOf.get(d) ?? groupEnd);
    const s = place(item.key, Math.max(groupEnd, ...after) + 1);
    slotOf.set(k.id, s);
  }
  return out;
}

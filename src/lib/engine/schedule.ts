/**
 * Court schedule: turns the fixtures into "jornadas" (time slots) with a court each.
 *
 * - Each group plays on its own courts (2 groups on 4 courts: A on 1-2, B on 3-4),
 *   as the group does on Sundays. With fewer courts than groups, courts are shared.
 * - Group games keep the round order; when a round has more games than the group's
 *   courts, the rest spill into the next jornada.
 * - Knockout games go to the earliest jornada after every game they depend on
 *   (a final waits for its semi-finals), on any free court.
 */
import type { FormatDef, SlotRef } from "./tournament";

export interface ScheduleItem {
  key: string;            // match identifier (caller-defined)
  round?: number;         // group round (1..n), for group games
  group?: string;         // group name, for group games
  knockoutId?: string;    // knockout id, for knockout games
}

export interface Scheduled { key: string; slot: number; court: number }

export function scheduleMatches(items: ScheduleItem[], format: FormatDef, courts: number): Scheduled[] {
  const c = Math.max(1, Math.floor(courts));
  const all = Array.from({ length: c }, (_, i) => i + 1);
  const taken = new Set<string>(); // "slot:court"
  const out: Scheduled[] = [];

  // Courts for each group
  const groups = Object.keys(format.groups);
  const per = groups.length > 1 && c >= groups.length ? Math.floor(c / groups.length) : 0;
  const courtsOf = (g?: string) => {
    const i = g ? groups.indexOf(g) : -1;
    return per && i >= 0 ? all.slice(i * per, (i + 1) * per) : all;
  };

  const place = (key: string, minSlot: number, options: number[]) => {
    for (let s = Math.max(1, minSlot); ; s++) {
      const court = options.find((ct) => !taken.has(`${s}:${ct}`));
      if (court) {
        taken.add(`${s}:${court}`);
        out.push({ key, slot: s, court });
        return s;
      }
    }
  };
  const lastSlot = () => Math.max(0, ...out.map((o) => o.slot));

  // Group stage: every round starts after the previous one, each group on its courts
  const rounds = [...new Set(items.filter((i) => i.round).map((i) => i.round!))].sort((a, b) => a - b);
  for (const r of rounds) {
    const start = lastSlot() + 1;
    for (const g of items.filter((i) => i.round === r)) place(g.key, start, courtsOf(g.group));
  }
  const groupEnd = lastSlot();

  // Knockouts, respecting dependencies
  const slotOf = new Map<string, number>();
  const deps = (ref: SlotRef) => ("match" in ref ? [ref.match] : []);
  for (const k of format.knockout) {
    const item = items.find((i) => i.knockoutId === k.id);
    if (!item) continue;
    const after = [...deps(k.a), ...deps(k.b)].map((d) => slotOf.get(d) ?? groupEnd);
    slotOf.set(k.id, place(item.key, Math.max(groupEnd, ...after) + 1, all));
  }
  return out;
}

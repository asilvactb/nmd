/**
 * Tournament formats, taken from the "Mod X duplas" sheets and Regulamento ponto 3.
 *
 * Every format is data: groups (round robin in the same order as the sheets)
 * followed by knockout matches whose slots reference group positions or the
 * winner/loser of earlier matches. Each knockout match decides two final places.
 */
import type { Score } from "./types";

export type SlotRef =
  | { group: string; pos: number }
  | { match: string; take: "winner" | "loser" };

export interface KnockoutMatch {
  id: string;
  label: string;
  a: SlotRef;
  b: SlotRef;
  /** Final places decided by this match: [winnerPlace, loserPlace] */
  places?: [number, number];
}

export interface FormatDef {
  id: string;
  numPairs: number;
  label: string;
  /** Group name -> number of pairs */
  groups: Record<string, number>;
  knockout: KnockoutMatch[];
  /** Round-robin finishes the event (no knockout): final place = group position */
  roundRobinOnly?: boolean;
  /**
   * Places for pairs not decided by a knockout match, by group position
   * (pairs in the same position of different groups share the places).
   */
  groupPlaces?: Record<number, number>;
}

/** Round-robin order per group size, 1-based seeds, as in the spreadsheet templates. */
export const ROUND_ROBIN: Record<number, Array<Array<[number, number]>>> = {
  3: [[[1, 2]], [[1, 3]], [[2, 3]]],
  4: [
    [[1, 2], [3, 4]],
    [[1, 3], [2, 4]],
    [[1, 4], [2, 3]],
  ],
  5: [
    [[1, 2], [3, 4]],
    [[1, 3], [2, 5]],
    [[1, 5], [2, 4]],
    [[1, 4], [3, 5]],
    [[4, 5], [2, 3]],
  ],
  6: [
    [[1, 2], [3, 4], [5, 6]],
    [[1, 3], [2, 5], [4, 6]],
    [[1, 4], [2, 6], [5, 3]],
    [[1, 5], [2, 4], [3, 6]],
    [[1, 6], [2, 3], [4, 5]],
  ],
};

const g = (group: string, pos: number): SlotRef => ({ group, pos });
const w = (match: string): SlotRef => ({ match, take: "winner" });
const l = (match: string): SlotRef => ({ match, take: "loser" });

export const FORMATS: FormatDef[] = [
  { id: "rr4", numPairs: 4, label: "Todos contra todos (4 duplas)", groups: { A: 4 }, knockout: [], roundRobinOnly: true },
  { id: "rr6", numPairs: 6, label: "Todos contra todos (6 duplas)", groups: { A: 6 }, knockout: [], roundRobinOnly: true },
  {
    id: "g8",
    numPairs: 8,
    label: "2 grupos de 4 + meias-finais",
    groups: { A: 4, B: 4 },
    knockout: [
      { id: "MF1", label: "Meia-final vencedores 1", a: g("A", 1), b: g("B", 2) },
      { id: "MF2", label: "Meia-final vencedores 2", a: g("B", 1), b: g("A", 2) },
      { id: "MB1", label: "Meia-final bombos 1", a: g("A", 3), b: g("B", 4) },
      { id: "MB2", label: "Meia-final bombos 2", a: g("B", 3), b: g("A", 4) },
      { id: "F", label: "Final dos vencedores", a: w("MF1"), b: w("MF2"), places: [1, 2] },
      { id: "P3", label: "3.º e 4.º lugar", a: l("MF1"), b: l("MF2"), places: [3, 4] },
      { id: "P5", label: "5.º e 6.º lugar", a: w("MB1"), b: w("MB2"), places: [5, 6] },
      { id: "FB", label: "Final dos bombos", a: l("MB1"), b: l("MB2"), places: [7, 8] },
    ],
  },
  {
    id: "g10",
    numPairs: 10,
    label: "2 grupos de 5 + meias-finais",
    groups: { A: 5, B: 5 },
    knockout: [
      // Regulamento 3.f.ii: 3rd places play their classification game right after the groups
      { id: "P5", label: "5.º e 6.º lugar", a: g("A", 3), b: g("B", 3), places: [5, 6] },
      { id: "MF1", label: "Meia-final vencedores 1", a: g("A", 1), b: g("B", 2) },
      { id: "MF2", label: "Meia-final vencedores 2", a: g("B", 1), b: g("A", 2) },
      { id: "MB1", label: "Meia-final bombos 1", a: g("A", 4), b: g("B", 5) },
      { id: "MB2", label: "Meia-final bombos 2", a: g("B", 4), b: g("A", 5) },
      { id: "F", label: "Final dos vencedores", a: w("MF1"), b: w("MF2"), places: [1, 2] },
      { id: "P3", label: "3.º e 4.º lugar", a: l("MF1"), b: l("MF2"), places: [3, 4] },
      { id: "P7", label: "7.º e 8.º lugar", a: w("MB1"), b: w("MB2"), places: [7, 8] },
      { id: "FB", label: "Final dos bombos", a: l("MB1"), b: l("MB2"), places: [9, 10] },
    ],
  },
  {
    id: "g12",
    numPairs: 12,
    label: "4 grupos de 3 + meias-finais",
    groups: { A: 3, B: 3, C: 3, D: 3 },
    knockout: [
      { id: "MF1", label: "Meia-final 1", a: g("A", 1), b: g("B", 1) },
      { id: "MF2", label: "Meia-final 2", a: g("C", 1), b: g("D", 1) },
      { id: "M5a", label: "Atribuição 5.º-8.º (1)", a: g("A", 2), b: g("B", 2) },
      { id: "M5b", label: "Atribuição 5.º-8.º (2)", a: g("C", 2), b: g("D", 2) },
      { id: "MB1", label: "Meia-final bombos 1", a: g("A", 3), b: g("B", 3) },
      { id: "MB2", label: "Meia-final bombos 2", a: g("C", 3), b: g("D", 3) },
      { id: "F", label: "Final NMD", a: w("MF1"), b: w("MF2"), places: [1, 2] },
      { id: "P3", label: "3.º e 4.º lugar", a: l("MF1"), b: l("MF2"), places: [3, 4] },
      { id: "P5", label: "5.º e 6.º lugar", a: w("M5a"), b: w("M5b"), places: [5, 6] },
      { id: "P7", label: "7.º e 8.º lugar", a: l("M5a"), b: l("M5b"), places: [7, 8] },
      { id: "P9", label: "9.º e 10.º lugar", a: w("MB1"), b: w("MB2"), places: [9, 10] },
      { id: "FB", label: "Final dos bombos", a: l("MB1"), b: l("MB2"), places: [11, 12] },
    ],
  },
];

/**
 * No time for semi-finals (two groups): only the final (1st A v 1st B) and the
 * bombos final (last A v last B). Everyone else is placed by group position,
 * sharing the places with the pair in the same position of the other group
 * (as on 4 Oct: two pairs in 3rd/4th, two in 5th/6th, ...).
 */
export function finalsOnlyFormat(base: FormatDef): FormatDef {
  const names = Object.keys(base.groups);
  if (names.length !== 2) throw new Error("Só finais existe com 2 grupos.");
  const [A, B] = names as [string, string];
  const size = base.groups[A]!;
  const groupPlaces: Record<number, number> = {};
  for (let pos = 2; pos < size; pos++) groupPlaces[pos] = 2 * pos - 1;
  return {
    ...base,
    id: `${base.id}-finals`,
    label: `${base.label.replace(" + meias-finais", "")} + finais`,
    knockout: [
      { id: "F", label: "Final dos vencedores", a: g(A, 1), b: g(B, 1), places: [1, 2] },
      { id: "FB", label: "Final dos bombos", a: g(A, size), b: g(B, size), places: [2 * size - 1, 2 * size] },
    ],
    groupPlaces,
  };
}

/**
 * "Cruzamento direto" (Regulamento 3.f.i): when there is no time for semis,
 * 1st vs 1st, 2nd vs 2nd ... last vs last (final dos bombos). Two groups only.
 */
export function directCrossFormat(base: FormatDef): FormatDef {
  const names = Object.keys(base.groups);
  if (names.length !== 2) throw new Error("Cruzamento direto só existe com 2 grupos.");
  const [A, B] = names as [string, string];
  const size = base.groups[A]!;
  return {
    ...base,
    id: `${base.id}-direct`,
    label: `${base.label} (cruzamento direto)`,
    knockout: Array.from({ length: size }, (_, i) => ({
      id: `X${i + 1}`,
      label: i === size - 1 ? "Final dos bombos" : i === 0 ? "Final" : `${2 * i + 1}.º e ${2 * i + 2}.º lugar`,
      a: g(A, i + 1),
      b: g(B, i + 1),
      places: [2 * i + 1, 2 * i + 2] as [number, number],
    })),
  };
}

export function formatFor(numPairs: number): FormatDef {
  const f = FORMATS.find((x) => x.numPairs === numPairs);
  if (!f) throw new Error(`Sem formato para ${numPairs} duplas (disponíveis: ${FORMATS.map((x) => x.numPairs).join(", ")}).`);
  return f;
}

// ---------------------------------------------------------------- scores

/** One set starting 1-1, tie-break at 5-5 (recorded 6-5), golden point. 0 is kept valid for late-arrival penalties and old results. */
export function validateScore(s: Score): string | null {
  const hi = Math.max(s.a, s.b);
  const lo = Math.min(s.a, s.b);
  if (!Number.isInteger(s.a) || !Number.isInteger(s.b)) return "Resultado inválido.";
  if (hi !== 6) return "O vencedor tem de chegar aos 6 jogos.";
  if (lo < 0 || lo > 5) return "O perdedor tem entre 0 e 5 jogos (6-5 = tie-break).";
  return null;
}

// ---------------------------------------------------------------- standings

export interface GroupMatch {
  a: string; // pair id
  b: string;
  score?: Score;
}

export interface StandingRow {
  pairId: string;
  played: number;
  wins: number;
  gamesFor: number;
  gamesAgainst: number;
  delta: number;
  /** Set when the order between tied pairs could not be decided automatically */
  unresolvedTie?: boolean;
}

/**
 * Group table. Order: wins, then (Regulamento 3.h-j)
 *  - 2 pairs tied: head-to-head
 *  - 3+ pairs tied: games delta within the group
 *  - still tied: older combined age (ages in days, optional)
 */
export function groupStandings(
  pairIds: string[],
  matches: GroupMatch[],
  combinedAgeDays?: Record<string, number>,
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    pairIds.map((id) => [id, { pairId: id, played: 0, wins: 0, gamesFor: 0, gamesAgainst: 0, delta: 0 }]),
  );
  for (const m of matches) {
    if (!m.score) continue;
    const ra = rows.get(m.a)!;
    const rb = rows.get(m.b)!;
    ra.played++; rb.played++;
    ra.gamesFor += m.score.a; ra.gamesAgainst += m.score.b;
    rb.gamesFor += m.score.b; rb.gamesAgainst += m.score.a;
    if (m.score.a > m.score.b) ra.wins++; else rb.wins++;
  }
  for (const r of rows.values()) r.delta = r.gamesFor - r.gamesAgainst;

  const headToHead = (x: string, y: string): number => {
    const m = matches.find((mm) => mm.score && ((mm.a === x && mm.b === y) || (mm.a === y && mm.b === x)));
    if (!m?.score) return 0;
    const xWon = m.a === x ? m.score.a > m.score.b : m.score.b > m.score.a;
    return xWon ? -1 : 1;
  };
  const byAge = (x: string, y: string) => {
    const ax = combinedAgeDays?.[x];
    const ay = combinedAgeDays?.[y];
    if (ax === undefined || ay === undefined || ax === ay) return 0;
    return ay - ax; // older first
  };

  const sorted = [...rows.values()].sort((a, b) => b.wins - a.wins);
  const out: StandingRow[] = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i;
    while (j < sorted.length && sorted[j]!.wins === sorted[i]!.wins) j++;
    const tied = sorted.slice(i, j);
    if (tied.length === 2) {
      tied.sort((a, b) => headToHead(a.pairId, b.pairId) || byAge(a.pairId, b.pairId));
      if (headToHead(tied[0]!.pairId, tied[1]!.pairId) === 0 && byAge(tied[0]!.pairId, tied[1]!.pairId) === 0) {
        tied.forEach((t) => (t.unresolvedTie = true));
      }
    } else if (tied.length > 2) {
      tied.sort((a, b) => b.delta - a.delta || byAge(a.pairId, b.pairId));
      for (let k = 0; k < tied.length - 1; k++) {
        const x = tied[k]!, y = tied[k + 1]!;
        if (x.delta === y.delta && byAge(x.pairId, y.pairId) === 0) x.unresolvedTie = y.unresolvedTie = true;
      }
    }
    out.push(...tied);
    i = j;
  }
  return out;
}

/** Group fixtures (pair ids per round) in the spreadsheet order. */
export function groupFixtures(pairIds: string[]): Array<Array<[string, string]>> {
  const rr = ROUND_ROBIN[pairIds.length];
  if (!rr) throw new Error(`Sem calendário para grupo de ${pairIds.length}.`);
  return rr.map((round) => round.map(([x, y]) => [pairIds[x - 1]!, pairIds[y - 1]!] as [string, string]));
}

/** Resolve a knockout slot to a pair id once the data is available. */
export function resolveSlot(
  slot: SlotRef,
  groupOrder: Record<string, string[]>,
  knockoutResults: Record<string, { winner: string; loser: string }>,
): string | undefined {
  if ("group" in slot) return groupOrder[slot.group]?.[slot.pos - 1];
  const r = knockoutResults[slot.match];
  return r ? r[slot.take] : undefined;
}

/** Final places of every pair once all matches are played. */
export function finalPlaces(
  format: FormatDef,
  groupOrder: Record<string, string[]>,
  knockoutResults: Record<string, { winner: string; loser: string }>,
): Map<string, number> {
  const places = new Map<string, number>();
  if (format.roundRobinOnly) {
    const order = Object.values(groupOrder)[0] ?? [];
    order.forEach((id, i) => places.set(id, i + 1));
    return places;
  }
  for (const m of format.knockout) {
    if (!m.places) continue;
    const r = knockoutResults[m.id];
    if (!r) continue;
    places.set(r.winner, m.places[0]);
    places.set(r.loser, m.places[1]);
  }
  if (format.groupPlaces) {
    for (const [pos, place] of Object.entries(format.groupPlaces)) {
      for (const order of Object.values(groupOrder)) {
        const id = order[Number(pos) - 1];
        if (id && !places.has(id)) places.set(id, place);
      }
    }
  }
  return places;
}

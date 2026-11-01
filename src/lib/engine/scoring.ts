/**
 * Ranking points (Regulamento ponto 6 + practice in the season spreadsheet):
 *  - points = numberOfPairs - position + 1  (10 pairs: winner 10, last 1)
 *  - pairs that share positions split the points of the slots they occupy
 *    (two pairs sharing 3rd/4th with 10 pairs -> (8 + 7) / 2 = 7.5 each)
 *  - Joker: winner doubles, anyone else halves
 *  - showing up only for the repasto: +0.5
 */

export const REPASTO_ONLY_BONUS = 0.5;

export interface Placement {
  /** Player ids of the pair */
  players: [string, string];
  /** First position occupied (1 = winner). Tied pairs share the same value. */
  position: number;
}

export function slotPoints(numPairs: number, position: number): number {
  if (position < 1 || position > numPairs) {
    throw new Error(`Position ${position} out of range for ${numPairs} pairs`);
  }
  return numPairs - position + 1;
}

/** Base points per pair, handling shared positions. */
export function placementPoints(numPairs: number, placements: Placement[]): number[] {
  const tiedCount = new Map<number, number>();
  for (const p of placements) tiedCount.set(p.position, (tiedCount.get(p.position) ?? 0) + 1);

  return placements.map((p) => {
    const k = tiedCount.get(p.position) ?? 1;
    let sum = 0;
    for (let i = 0; i < k; i++) sum += slotPoints(numPairs, p.position + i);
    return sum / k;
  });
}

export function applyJoker(points: number, position: number, jokerUsed: boolean): number {
  if (!jokerUsed) return points;
  return position === 1 ? points * 2 : points / 2;
}

export interface PlayerEventPoints {
  playerId: string;
  base: number;
  final: number;
  jokerUsed: boolean;
}

export function eventPoints(
  numPairs: number,
  placements: Placement[],
  jokers: ReadonlySet<string> = new Set(),
): PlayerEventPoints[] {
  const base = placementPoints(numPairs, placements);
  return placements.flatMap((p, i) =>
    p.players.map((playerId) => {
      const jokerUsed = jokers.has(playerId);
      const b = base[i] ?? 0;
      return { playerId, base: b, final: applyJoker(b, p.position, jokerUsed), jokerUsed };
    }),
  );
}

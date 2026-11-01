export type Side = "L" | "R";

export interface Player {
  id: string;
  name: string;
  /** Preferred side: L = esquerda, R = direita */
  side: Side;
  /** Strength used for pairing (season ranking points, or weighted average) */
  strength: number;
  isWildCard: boolean;
}

export type FixedPairReason = "winners" | "bombos" | "training" | "admin";

export interface FixedPair {
  a: string;
  b: string;
  reason: FixedPairReason;
}

export interface Pair {
  left: Player;
  right: Player;
  reason: FixedPairReason | "ranking" | "draw";
}

export interface Score {
  /** Games won by pair A / pair B in the single set (e.g. 6-4, 6-5 after tie-break) */
  a: number;
  b: number;
}

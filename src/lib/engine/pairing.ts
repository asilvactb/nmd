/**
 * Emparceiramento (Regulamento ponto 5 + rules agreed with the admins):
 *
 * 1. Fixed pairs go first (winners defending, bombos defending, training pairs,
 *    admin choices such as Bibombo/Tribombo picks). If one of them is missing,
 *    the other goes back into the normal pool.
 * 2. Side balance: if one side has more players, volunteers switch first; then a
 *    random draw among the larger side decides who switches.
 * 3. Mode "ranking"/"weighted": wild cards are paired with the best-ranked
 *    members of the opposite side (WC+WC only if impossible otherwise). Then,
 *    starting with the best-ranked player, each is paired with the worst-ranked
 *    available player of the opposite side.
 *    Mode "draw": random pairing, preserving sides.
 * 4. Constraint: a pair can't have played together in the last 4 encounters
 *    (fixed pairs are exempt). If no valid solution exists, the constraint is
 *    relaxed and a warning lists the repeated pairs.
 */
import type { FixedPair, Pair, Player, Side } from "./types";

export type PairingMode = "ranking" | "weighted" | "draw";

export interface PairingInput {
  players: Player[];
  fixedPairs?: FixedPair[];
  /** Pairs that played together in the last 4 encounters (ids, any order) */
  recentPairs?: Array<[string, string]>;
  mode?: PairingMode;
  /** Players that volunteer to play on the opposite side if needed */
  volunteers?: string[];
  rng?: () => number;
}

export interface SideSwitch {
  playerId: string;
  from: Side;
  to: Side;
  how: "volunteer" | "draw";
}

export interface PairingResult {
  pairs: Pair[];
  sideSwitches: SideSwitch[];
  warnings: string[];
  /** Human readable explanation of every decision, in order */
  log: string[];
}

const other = (s: Side): Side => (s === "L" ? "R" : "L");
const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j] as T, a[i] as T];
  }
  return a;
}

/** Best first. Ties broken by name so the result is reproducible. */
const byStrengthDesc = (a: Player, b: Player) =>
  b.strength - a.strength || a.name.localeCompare(b.name, "pt");

export function generatePairs(input: PairingInput): PairingResult {
  const rng = input.rng ?? Math.random;
  const mode = input.mode ?? "ranking";
  const log: string[] = [];
  const warnings: string[] = [];
  const byId = new Map(input.players.map((p) => [p.id, p]));

  if (input.players.length % 2 !== 0) {
    throw new Error(`Número ímpar de jogadores (${input.players.length}).`);
  }

  // 1. Fixed pairs
  const pairs: Pair[] = [];
  const taken = new Set<string>();
  for (const fp of input.fixedPairs ?? []) {
    const a = byId.get(fp.a);
    const b = byId.get(fp.b);
    if (!a || !b) {
      const present = a ?? b;
      log.push(
        `Dupla fixa (${fp.reason}) desfeita: falta ${a ? fp.b : fp.a}` +
          (present ? `; ${present.name} vai ao emparceiramento normal.` : "."),
      );
      continue;
    }
    if (taken.has(a.id) || taken.has(b.id)) {
      warnings.push(`Dupla fixa ${a.name}/${b.name} ignorada: jogador já está noutra dupla fixa.`);
      continue;
    }
    // Keep each player's own side when possible
    const [left, right] = a.side === "L" || b.side === "R" ? [a, b] : [b, a];
    pairs.push({ left, right, reason: fp.reason });
    taken.add(a.id).add(b.id);
    log.push(`Dupla fixa (${fp.reason}): ${left.name} / ${right.name}.`);
  }

  // 2. Side balance
  const pool = input.players.filter((p) => !taken.has(p.id)).map((p) => ({ ...p }));
  const sideSwitches: SideSwitch[] = [];
  const count = (s: Side) => pool.filter((p) => p.side === s).length;
  const diff = count("L") - count("R");
  if (diff !== 0) {
    const big: Side = diff > 0 ? "L" : "R";
    let toMove = Math.abs(diff) / 2;
    const candidates = pool.filter((p) => p.side === big);
    const volunteers = candidates.filter((p) => input.volunteers?.includes(p.id));
    const drawn = shuffle(
      candidates.filter((p) => !input.volunteers?.includes(p.id)),
      rng,
    );
    for (const [list, how] of [
      [volunteers, "volunteer"],
      [drawn, "draw"],
    ] as const) {
      for (const p of list) {
        if (toMove === 0) break;
        p.side = other(big);
        sideSwitches.push({ playerId: p.id, from: big, to: p.side, how });
        log.push(
          `${p.name} passa para ${p.side === "L" ? "a esquerda" : "a direita"} (${how === "volunteer" ? "voluntário" : "sorteio"}).`,
        );
        toMove--;
      }
    }
  }

  // 3. Pair the pool
  const recent = new Set((input.recentPairs ?? []).map(([a, b]) => key(a, b)));
  const solve = (respectRecent: boolean) =>
    mode === "draw"
      ? solveDraw(pool, recent, respectRecent, rng)
      : solveRanking(pool, recent, respectRecent);

  let solved = solve(true);
  if (!solved) {
    solved = solve(false);
    if (!solved) throw new Error("Não foi possível formar duplas.");
    const repeats = solved.filter((p) => recent.has(key(p.left.id, p.right.id)));
    warnings.push(
      "Sem solução que respeite a regra dos últimos 4 encontros. Duplas repetidas: " +
        repeats.map((p) => `${p.left.name}/${p.right.name}`).join(", "),
    );
  }
  for (const p of solved) {
    log.push(`${mode === "draw" ? "Sorteio" : "Ranking"}: ${p.left.name} / ${p.right.name}.`);
  }

  return { pairs: [...pairs, ...solved], sideSwitches, warnings, log };
}

function solveRanking(pool: Player[], recent: Set<string>, respectRecent: boolean): Pair[] | null {
  const ok = (a: Player, b: Player) => !respectRecent || !recent.has(key(a.id, b.id));
  const make = (a: Player, b: Player): Pair =>
    a.side === "L"
      ? { left: a, right: b, reason: "ranking" }
      : { left: b, right: a, reason: "ranking" };

  const used = new Set<string>();
  const result: Pair[] = [];

  // Wild cards first: each with the best-ranked available member on the other side.
  const wcs = pool.filter((p) => p.isWildCard).sort(byStrengthDesc);
  const members = pool.filter((p) => !p.isWildCard);

  const rec = (wcIdx: number): boolean => {
    if (wcIdx < wcs.length) {
      const wc = wcs[wcIdx]!;
      if (used.has(wc.id)) return rec(wcIdx + 1);
      const options = members
        .filter((m) => !used.has(m.id) && m.side !== wc.side && ok(wc, m))
        .sort(byStrengthDesc);
      for (const m of options) {
        used.add(wc.id).add(m.id);
        result.push(make(wc, m));
        if (rec(wcIdx + 1)) return true;
        result.pop();
        used.delete(wc.id);
        used.delete(m.id);
      }
      // Leave this WC for the general phase (may end up with another WC)
      return rec(wcIdx + 1) ;
    }
    return general();
  };

  // General phase: best remaining player with worst remaining on the opposite side.
  // Members are preferred as partners for leftover wild cards.
  const general = (): boolean => {
    const remaining = pool.filter((p) => !used.has(p.id)).sort(byStrengthDesc);
    const top = remaining[0];
    if (!top) return true;
    const options = remaining
      .filter((p) => p.id !== top.id && p.side !== top.side && ok(top, p))
      .sort((a, b) => {
        if (top.isWildCard && a.isWildCard !== b.isWildCard) return a.isWildCard ? 1 : -1;
        return -byStrengthDesc(a, b); // worst first
      });
    for (const p of options) {
      used.add(top.id).add(p.id);
      result.push(make(top, p));
      if (general()) return true;
      result.pop();
      used.delete(top.id);
      used.delete(p.id);
    }
    return false;
  };

  return rec(0) ? result : null;
}

function solveDraw(
  pool: Player[],
  recent: Set<string>,
  respectRecent: boolean,
  rng: () => number,
): Pair[] | null {
  const lefts = pool.filter((p) => p.side === "L");
  const rights = pool.filter((p) => p.side === "R");
  for (let attempt = 0; attempt < 500; attempt++) {
    const r = shuffle(rights, rng);
    const pairs = shuffle(lefts, rng).map((l, i) => ({
      left: l,
      right: r[i]!,
      reason: "draw" as const,
    }));
    if (!respectRecent || pairs.every((p) => !recent.has(key(p.left.id, p.right.id)))) {
      return pairs;
    }
  }
  return null;
}

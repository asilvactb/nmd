/**
 * Reads the Sunday sign-up list as it is posted on WhatsApp:
 *
 *   🎾 Moura🏆/Christophe🏆🤡     <- fixed pair (🏆 last week's winners, 🥁 bombos), 🤡 = Joker
 *   🎾 Taipas🥁                   <- fixed-pair player whose partner did not come: normal draw
 *   🎾 T. Lourenço
 *   🎾 Figueiredo (wc)            <- wild card
 *
 * Decorations (🎾, numbering, bullets) are ignored. Names are matched loosely against
 * the players: surname only ("Azevedo"), initials ("JPC", "ZP Martins", "T. Lourenço",
 * "Helder M."), accents and case don't matter.
 */

export interface ListName {
  raw: string;
  /** Name as typed, without decorations */
  text: string;
  wildCard: boolean;
  joker: boolean;
}

export interface ListLine {
  raw: string;
  names: ListName[];
  /** Set when the line is a fixed pair */
  reason: "winners" | "bombos" | null;
}

const EMOJI = /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu;

export function parseList(text: string): ListLine[] {
  const out: ListLine[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    const reason = rawLine.includes("🏆") ? "winners" : rawLine.includes("🥁") ? "bombos" : null;
    const parts = rawLine.split(/[\/,;&+]|\s+e\s+/);
    const names: ListName[] = [];
    for (const part of parts) {
      const joker = part.includes("🤡");
      const wildCard = /\(\s*w\.?\s*c\.?\s*\)|\bwc\b|\bwild ?card\b/i.test(part);
      const clean = part
        .replace(EMOJI, " ")
        .replace(/\(\s*w\.?\s*c\.?\s*\)|\bwc\b|\bwild ?card\b/gi, " ")
        .replace(/^\s*(\d+\s*[.)\-:]?|[-•*·])\s*/, "")
        .replace(/[()\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (clean && /\p{L}/u.test(clean)) names.push({ raw: part.trim(), text: clean, wildCard, joker });
    }
    if (!names.length) continue;
    out.push({ raw: rawLine.trim(), names, reason: names.length === 2 ? reason : null });
  }
  return out;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const tokens = (s: string) => fold(s).replace(/[^a-z0-9. ]/g, " ").split(/[\s]+/).filter(Boolean);

/**
 * How well a typed name fits a player name, 0 = no match.
 * Typed tokens must appear in order; each one is covered by one or more consecutive
 * name tokens, each given in full, as a prefix or as its initial ("zp" = Zé Pedro).
 */
export function nameScore(typed: string, name: string): number {
  const q = tokens(typed).map((t) => t.replace(/\./g, "")).filter(Boolean);
  const n = tokens(name).map((t) => t.replace(/\./g, ""));
  if (!q.length || !n.length) return 0;
  if (q.join(" ") === n.join(" ")) return 1000;

  // best(qi, ni): best score matching q[qi..] using name tokens from n[ni..]
  const memo = new Map<string, number>();
  const best = (qi: number, ni: number): number => {
    if (qi === q.length) return 0;
    const key = `${qi}:${ni}`;
    if (memo.has(key)) return memo.get(key)!;
    let top = -Infinity;
    for (let start = ni; start < n.length; start++) {
      // cover q[qi] with n[start..end]
      const cover = (pos: number, k: number, acc: number) => {
        const tok = q[qi]!;
        if (pos === tok.length) {
          const rest = best(qi + 1, k);
          if (rest > -Infinity) top = Math.max(top, acc + rest - (start - ni) * 0.1);
          return;
        }
        if (k >= n.length) return;
        const nt = n[k]!;
        const remaining = tok.slice(pos);
        if (remaining.startsWith(nt)) cover(pos + nt.length, k + 1, acc + 10); // full token
        for (let len = Math.min(nt.length - 1, remaining.length); len >= 1; len--) {
          if (nt.startsWith(remaining.slice(0, len))) cover(pos + len, k + 1, acc + (len >= 3 ? 4 : 2));
        }
      };
      cover(0, start, 0);
    }
    memo.set(key, top);
    return top;
  };
  const s = best(0, 0);
  return s > 0 ? s : 0;
}

export function matchPlayer<P extends { name: string; aliases?: string[] | null }>(
  typed: string,
  players: P[],
): { player: P } | { ambiguous: P[] } | null {
  const scored = players
    .map((p) => ({ p, s: Math.max(nameScore(typed, p.name), ...(p.aliases ?? []).map((a) => nameScore(typed, a))) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  if (!scored.length) return null;
  const top = scored.filter((x) => x.s === scored[0]!.s);
  return top.length === 1 ? { player: top[0]!.p } : { ambiguous: top.map((x) => x.p) };
}

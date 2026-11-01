/** Honorary titles (players.title): icon and order of importance. */
const TITLES: { match: RegExp; icon: string; order: number }[] = [
  { match: /\bddt\b/i, icon: "🎖️", order: 0 }, // the most important member
  { match: /presidente/i, icon: "👑", order: 1 },
  { match: /\bcfo\b/i, icon: "💼", order: 2 },
];

export function titleIcon(title: string | null | undefined): string | null {
  if (!title) return null;
  return TITLES.find((t) => t.match.test(title))?.icon ?? "⭐";
}

export function titleOrder(title: string | null | undefined): number {
  if (!title) return 99;
  return TITLES.find((t) => t.match.test(title))?.order ?? 50;
}

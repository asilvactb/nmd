/** Number of players per Sunday and the format it implies (see engine/tournament FORMATS). */
export const PLAYER_OPTIONS = [
  { n: 8, label: "8 jogadores · 4 duplas · todos contra todos" },
  { n: 12, label: "12 jogadores · 6 duplas · todos contra todos" },
  { n: 16, label: "16 jogadores · 8 duplas · 2 grupos de 4 + finais" },
  { n: 20, label: "20 jogadores · 10 duplas · 2 grupos de 5 + finais" },
  { n: 24, label: "24 jogadores · 12 duplas · 4 grupos de 3 + finais" },
] as const;

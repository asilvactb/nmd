/** Hall of Fame medals: one design per award, metal tier by kind of award. */

type Tier = "gold" | "silver" | "bronze" | "fun";
interface MedalDef { icon: string; tier: Tier; short: string }

const RINGS: Record<Tier, [string, string]> = {
  gold: ["#f8e08e", "#b07d24"],
  silver: ["#eef1f6", "#7c8594"],
  bronze: ["#eab38a", "#7d4a28"],
  fun: ["#7da4ff", "#9b7bff"],
};

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function medalFor(award: string): MedalDef {
  const a = norm(award);
  if (a.includes("melhor direita")) return { icon: "D", tier: "gold", short: "Melhor Direita" };
  if (a.includes("melhor esquerda")) return { icon: "E", tier: "gold", short: "Melhor Esquerda" };
  if (a.includes("ballon")) return { icon: "⚽", tier: "gold", short: "Ballon d'Or" };
  if (a.includes("vitorias")) return { icon: "🏆", tier: "gold", short: "Mais Vitórias" };
  if (a.includes("carreira")) return { icon: "🎖️", tier: "silver", short: "Prémio Carreira" };
  if (a.includes("presencas")) return { icon: "📅", tier: "silver", short: "Mais Presenças" };
  if (a.includes("centenario")) return { icon: "💯", tier: "silver", short: "Centenário" };
  if (a.includes("rookie")) return { icon: "🌱", tier: "silver", short: "Rookie do Ano" };
  if (a.includes("3/4")) return { icon: "¾", tier: "bronze", short: "Prémio 3/4" };
  if (a.includes("bombo")) return { icon: "🥁", tier: "bronze", short: "Master Bombo" };
  if (a.includes("chef") || a.includes("michelin")) return { icon: "👨‍🍳", tier: "fun", short: "Master Chef" };
  if (a.includes("bandalho")) return { icon: "🏴‍☠️", tier: "fun", short: "Bandalho do Ano" };
  if (a.includes("pirilampo")) return { icon: "✨", tier: "fun", short: "Pirilampo Mágico" };
  if (a.includes("careca")) return { icon: "👨‍🦲", tier: "gold", short: "Careca Dourada" };
  if (a.includes("testa de ferro")) return { icon: "🛡️", tier: "fun", short: "Testa de Ferro" };
  return { icon: "🏅", tier: "silver", short: award };
}

/** Circular medal with a metallic ring; `count` shows ×N when won more than once. */
export function Medal({ award, size = 56, count = 1 }: { award: string; size?: number; count?: number }) {
  const m = medalFor(award);
  const [c1, c2] = RINGS[m.tier];
  const isLetter = m.icon.length === 1 && /[A-Z¾]/.test(m.icon);
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }} title={m.short}>
      <span className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(from 210deg, ${c1}, ${c2}, ${c1}, ${c2}, ${c1})`, boxShadow: `0 6px 20px -6px ${c2}` }} />
      <span className="absolute rounded-full" style={{ inset: size * 0.08, background: `radial-gradient(circle at 35% 30%, #22252c, #0c0d10 70%)` }} />
      <span className="absolute rounded-full border border-white/10" style={{ inset: size * 0.14 }} />
      <span className={`relative m-auto ${isLetter ? "display" : ""}`}
        style={{ fontSize: size * (isLetter ? 0.38 : 0.4), color: isLetter ? c1 : undefined, lineHeight: 1 }}>
        {m.icon}
      </span>
      {count > 1 && (
        <span className="display-num absolute -bottom-1 -right-1 rounded-full bg-fg px-1.5 text-[11px] text-bg">×{count}</span>
      )}
    </span>
  );
}

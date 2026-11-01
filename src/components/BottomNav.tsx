"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  home: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  games: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3.5 9.5c4 1.5 13 1.5 17 0M3.5 14.5c4-1.5 13-1.5 17 0",
  ranking: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3",
  finos: "M7 4h10l-1.2 15.2A2 2 0 0 1 13.8 21h-3.6a2 2 0 0 1-2-1.8zM7.5 9h9",
  admin: "M4 6h16M4 12h16M4 18h16M8 4v4M16 10v4M10 16v4",
};

const ITEMS = [
  { href: "/", label: "Início", icon: ICONS.home },
  { href: "/encontros", label: "Jogos", icon: ICONS.games },
  { href: "/ranking", label: "Ranking", icon: ICONS.ranking },
  { href: "/finos", label: "Finos", icon: ICONS.finos },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const items = isAdmin ? [...ITEMS, { href: "/admin", label: "Admin", icon: ICONS.admin }] : ITEMS;
  return (
    <nav className="fixed inset-x-0 z-30 flex justify-center px-4"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
      <ul className="flex w-full max-w-md items-center justify-between rounded-full border border-white/10 bg-[#1a1a1c]/85 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href}
                className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors ${active ? "bg-accent text-accent-ink" : "text-muted"}`}>
                <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="none" stroke="currentColor"
                  strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round">
                  <path d={it.icon} />
                </svg>
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

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
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  const icon = (d: string, active: boolean, cls: string) => (
    <svg viewBox="0 0 24 24" className={cls} fill="none" stroke="currentColor"
      strokeWidth={active ? 2.2 : 1.7} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
  );
  return (
    <>
      {/* Phone: floating pill */}
      <nav className="fixed inset-x-0 z-30 flex justify-center px-4 lg:hidden"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>
        <ul className="flex w-full max-w-md items-center justify-between rounded-full border border-white/10 bg-[#15171b]/80 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
          {items.map((it) => {
            const active = isActive(it.href);
            return (
              <li key={it.href} className="flex-1">
                <Link href={it.href}
                  className={`flex flex-col items-center gap-0.5 rounded-full py-2 text-[10px] font-medium transition-colors ${active ? "bg-fg text-bg" : "text-muted"}`}>
                  {icon(it.icon, active, "h-[22px] w-[22px]")}
                  {it.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: icon rail that expands on hover (overlays the page, doesn't push it) */}
      <aside className="group fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col overflow-hidden border-r border-line bg-[#0b0c0f]/95 px-3 py-6 backdrop-blur-xl transition-[width,box-shadow] duration-300 ease-out hover:w-[248px] hover:shadow-2xl hover:shadow-black/60 lg:flex">
        <Link href="/" className="relative mb-8 flex h-10 items-center px-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="NMD" className="h-9 w-9 shrink-0 rounded-xl transition-opacity duration-200 group-hover:opacity-0" />
          <Logo className="absolute left-1.5 h-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
        </Link>
        <ul className="flex flex-col gap-1">
          {[
            ...items.map((it) => ({ href: it.href, label: it.label, icon: icon(it.icon, isActive(it.href), "h-5 w-5") })),
            { href: "/morfes", label: "Morfes", icon: <span className="text-base leading-none">🍽️</span> },
            { href: "/tesouraria", label: "Tesouraria", icon: <span className="text-base leading-none">💶</span> },
            { href: "/hall", label: "Hall of Fame", icon: icon("M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z", isActive("/hall"), "h-5 w-5") },
          ].map((it) => {
            const active = isActive(it.href);
            return (
              <li key={it.href}>
                <Link href={it.href} title={it.label}
                  className={`relative flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition ${active ? "bg-card-2 text-fg" : "text-muted hover:bg-card hover:text-fg"}`}>
                  <span className="flex w-5 shrink-0 items-center justify-center">{it.icon}</span>
                  <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">{it.label}</span>
                  {active && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-accent" />}
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="mt-auto whitespace-nowrap px-3 text-[11px] leading-relaxed text-muted opacity-0 transition-opacity group-hover:opacity-100">Nunca Mais é Domingo<br />Mesh Padel Center · Braga</p>
      </aside>
    </>
  );
}

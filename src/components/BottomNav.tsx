"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Início", icon: "M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/encontros", label: "Encontros", icon: "M4 6h16M4 12h16M4 18h10" },
  { href: "/ranking", label: "Ranking", icon: "M6 20V10M12 20V4M18 20v-7" },
  { href: "/finos", label: "Finos", icon: "M7 4h10l-1.2 15.2A2 2 0 0 1 13.8 21h-3.6a2 2 0 0 1-2-1.8zM7.5 9h9" },
];

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const path = usePathname();
  if (path.startsWith("/login")) return null;
  const items = isAdmin
    ? [...ITEMS, { href: "/admin", label: "Admin", icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2 3.4-.2-.1a1.7 1.7 0 0 0-1.8.1 7 7 0 0 1-1.6.9 1.7 1.7 0 0 0-1 1.5V23H10.8v-.3a1.7 1.7 0 0 0-1-1.5 7 7 0 0 1-1.6-.9 1.7 1.7 0 0 0-1.8-.1l-.2.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15a7 7 0 0 1 0-1.9A1.7 1.7 0 0 0 4.3 11.3l-.1-.1 2-3.4.2.1a1.7 1.7 0 0 0 1.8-.1 7 7 0 0 1 1.6-.9 1.7 1.7 0 0 0 1-1.5V5h2.4v.3a1.7 1.7 0 0 0 1 1.5 7 7 0 0 1 1.6.9 1.7 1.7 0 0 0 1.8.1l.2-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.8 7 7 0 0 1 0 1.9z" }]
    : ITEMS;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="mx-auto flex max-w-lg">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href} className="flex-1">
              <Link href={it.href} className={`flex flex-col items-center gap-1 py-2.5 text-[11px] ${active ? "text-fg" : "text-muted"}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
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

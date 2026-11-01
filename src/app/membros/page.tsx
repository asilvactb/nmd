import Link from "next/link";
import type { CSSProperties } from "react";
import { Page } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { getMe, type PlayerRow } from "@/lib/db";
import { titleIcon, titleOrder } from "@/lib/titles";

type Member = Pick<PlayerRow, "id" | "name" | "avatar_path" | "side" | "is_wild_card" | "is_admin" | "title" | "active">;

/** Everyone in the group, so any profile can be opened (even without games this season). */
export default async function MembrosPage({ searchParams }: { searchParams: Promise<{ lado?: string }> }) {
  const { lado } = await searchParams;
  const { supabase } = await getMe();
  const { data } = await supabase
    .from("players")
    .select("id, name, avatar_path, side, is_wild_card, is_admin, title, active")
    .eq("active", true);
  const all = ((data ?? []) as Member[]).sort((a, b) => a.name.localeCompare(b.name, "pt"));
  const side = lado === "esquerdas" ? "L" : lado === "direitas" ? "R" : null;
  const shown = side ? all.filter((m) => m.side === side) : all;
  // Honorary titles first, then members, wild cards at the end
  const rank = (m: Member) => (m.title ? titleOrder(m.title) : m.is_wild_card ? 200 : 100);
  shown.sort((a, b) => rank(a) - rank(b));

  const tab = (label: string, value?: string) => {
    const active = (value ?? null) === (lado ?? null);
    return (
      <Link href={value ? `/membros?lado=${value}` : "/membros"}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${active ? "bg-fg text-bg" : "border border-line text-muted hover:text-fg"}`}>
        {label}
      </Link>
    );
  };

  return (
    <Page eyebrow={`${all.filter((m) => !m.is_wild_card).length} membros · ${all.filter((m) => m.is_wild_card).length} wild cards`} title="Membros">
      <div className="rise mb-5 flex gap-2">
        {tab("Todos")}
        {tab("Esquerdas", "esquerdas")}
        {tab("Direitas", "direitas")}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {shown.map((m, i) => (
          <Link key={m.id} href={`/jogadores/${m.id}`} style={{ "--i": Math.min(i, 18) } as CSSProperties}
            className={`rise lift relative flex flex-col items-center gap-2 rounded-3xl border bg-card px-2 pb-3 pt-4 text-center ${m.title ? "border-[#f8e08e]/40" : "border-line"}`}>
            {m.title && <span className="absolute right-2 top-2 text-sm">{titleIcon(m.title)}</span>}
            <Avatar name={m.name} path={m.avatar_path} size={56} />
            <span className="w-full truncate text-[13px] font-medium">{m.name}</span>
            <span className={`text-[10px] uppercase tracking-wider ${m.title ? "text-[#f8e08e]" : "text-muted"}`}>
              {m.title ?? `${m.side === "L" ? "Esq" : "Dir"}${m.is_wild_card ? " · WC" : ""}`}
            </span>
          </Link>
        ))}
      </div>
    </Page>
  );
}

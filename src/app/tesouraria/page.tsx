import type { CSSProperties } from "react";
import { Page, SectionTitle } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { CountUp } from "@/components/CountUp";
import { getMe, type PlayerRow } from "@/lib/db";
import { deleteMovement, setMovementPending } from "../actions";
import { MovementForm } from "./MovementForm";

interface Movement {
  id: string;
  date: string;
  kind: "credit" | "debit";
  player_id: string | null;
  counterparty: string | null;
  amount: number;
  reason: string | null;
  pending: boolean;
}

const eur = (n: number, sign = false) =>
  `${sign && n > 0 ? "+" : ""}${n.toLocaleString("pt-PT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** Tesouraria: open to every member. Cash = all movements except money still to be received. */
export default async function TesourariaPage({ searchParams }: { searchParams: Promise<{ ver?: string }> }) {
  const { ver = "todos" } = await searchParams;
  const { supabase, player } = await getMe();
  const [{ data }, { data: people }] = await Promise.all([
    supabase.from("ledger").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("players").select("id, name, avatar_path").eq("active", true).order("name"),
  ]);
  const all = ((data ?? []) as Movement[]).map((m) => ({ ...m, amount: Number(m.amount) }));
  const byId = new Map(((people ?? []) as Pick<PlayerRow, "id" | "name" | "avatar_path">[]).map((p) => [p.id, p]));

  const total = all.reduce((s, m) => s + m.amount, 0);
  const owed = all.filter((m) => m.pending).reduce((s, m) => s + m.amount, 0);
  const cash = total - owed;
  const ins = all.filter((m) => m.amount > 0 && !m.pending).reduce((s, m) => s + m.amount, 0);
  const outs = all.filter((m) => m.amount < 0).reduce((s, m) => s + m.amount, 0);

  const list = all.filter((m) => ver === "entradas" ? m.amount > 0 : ver === "saidas" ? m.amount < 0 : ver === "pendentes" ? m.pending : true);
  const months = new Map<string, Movement[]>();
  for (const m of list) {
    const k = m.date.slice(0, 7);
    months.set(k, [...(months.get(k) ?? []), m]);
  }
  const monthLabel = (k: string) => new Date(k + "-15").toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  const isAdmin = !!player?.is_admin;
  const filters = [["todos", "Todos"], ["entradas", "Entradas"], ["saidas", "Saídas"], ["pendentes", "Por receber"]] as const;

  return (
    <Page eyebrow="Contas do NMD · transparentes" title="Tesouraria">
      <div className="lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start lg:gap-8">
        <div className="lg:sticky lg:top-10">
          <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6">
            <div className="aurora !opacity-40" />
            <div className="relative">
              <p className="eyebrow">Em caixa</p>
              <p className="mt-2 leading-none">
                <CountUp value={cash} decimals={2} className="display-num text-[64px]" /><span className="display-num ml-1 text-3xl text-muted">€</span>
              </p>
              <div className="mt-6 grid grid-cols-3 gap-2 text-sm">
                <div><p className="eyebrow !text-[10px]">Entradas</p><p className="display-num mt-1 text-lg text-accent">{eur(ins)}</p></div>
                <div><p className="eyebrow !text-[10px]">Saídas</p><p className="display-num mt-1 text-lg">{eur(outs)}</p></div>
                <div><p className="eyebrow !text-[10px]">Por receber</p><p className="display-num mt-1 text-lg text-muted">{eur(owed)}</p></div>
              </div>
            </div>
          </section>

          {isAdmin && (
            <section className="rise mt-3 rounded-[28px] border border-line bg-card p-5" style={{ "--i": 1 } as CSSProperties}>
              <p className="eyebrow mb-3">Novo movimento</p>
              <MovementForm players={((people ?? []) as { id: string; name: string }[])} />
            </section>
          )}
        </div>

        <div>
          <nav className="mt-6 flex w-fit flex-wrap gap-1 rounded-full border border-line bg-card p-1 lg:mt-0">
            {filters.map(([k, label]) => (
              <a key={k} href={k === "todos" ? "/tesouraria" : `/tesouraria?ver=${k}`}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition ${ver === k ? "bg-fg text-bg" : "text-muted hover:text-fg"}`}>
                {label}
              </a>
            ))}
          </nav>

          {[...months.entries()].map(([k, ms]) => (
            <div key={k}>
              <SectionTitle action={<span className="text-xs text-muted tabular">{eur(ms.reduce((s, m) => s + m.amount, 0), true)}</span>}>
                <span className="capitalize">{monthLabel(k)}</span>
              </SectionTitle>
              <ol className="flex flex-col gap-1.5">
                {ms.map((m) => {
                  const p = m.player_id ? byId.get(m.player_id) : undefined;
                  const who = p?.name ?? m.counterparty ?? "—";
                  return (
                    <li key={m.id} className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 ${m.pending ? "border-dashed border-line bg-transparent" : "border-line bg-card"}`}>
                      {p ? <Avatar name={p.name} path={p.avatar_path} size={34} /> : (
                        <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full text-sm ${m.amount > 0 ? "bg-accent/15 text-accent" : "bg-card-2 text-muted"}`}>{m.amount > 0 ? "+" : "−"}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{who}{m.reason && <span className="font-normal text-muted"> · {m.reason}</span>}</p>
                        <p className="text-[11px] text-muted">
                          {new Date(m.date + "T12:00:00").toLocaleDateString("pt-PT", { day: "numeric", month: "short" })}
                          {m.pending && <span className="ml-1.5 rounded-full bg-card-2 px-1.5 py-0.5">por receber</span>}
                        </p>
                      </div>
                      <span className={`display-num text-right text-lg ${m.pending ? "text-muted" : m.amount > 0 ? "text-accent" : ""}`}>{eur(m.amount, true)}</span>
                      {isAdmin && (
                        <span className="flex flex-col gap-0.5 text-[10px] text-muted">
                          {m.pending && (
                            <form action={setMovementPending.bind(null, m.id, false)}><button className="hover:text-accent">✓ recebido</button></form>
                          )}
                          <form action={deleteMovement.bind(null, m.id)}><button className="hover:text-danger">apagar</button></form>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {list.length === 0 && <p className="mt-6 text-sm text-muted">Sem movimentos.</p>}
        </div>
      </div>
    </Page>
  );
}

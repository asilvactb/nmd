import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Card, Page, SectionTitle, btn, btnGhost } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { Avatar, PairAvatars } from "@/components/Avatar";
import { CountUp } from "@/components/CountUp";
import { FinoPlus } from "@/components/FinoPlus";
import { Countdown } from "@/components/Countdown";
import {
  formatDate, getCurrentSeason, getMe,
  type EventRow, type PairRow, type PlayerRow, type RankingRow,
} from "@/lib/db";
import { signOut } from "./actions";

type Mini = Pick<PlayerRow, "id" | "name" | "side" | "is_wild_card" | "avatar_path">;

export default async function Home() {
  const { supabase, player } = await getMe();

  if (!player) {
    const { data: claimed } = await supabase.rpc("claim_by_email");
    if (claimed) redirect("/");
    const { data: req } = await supabase.from("signup_requests").select("status").maybeSingle();
    return (
      <Page>
        <Logo className="rise mx-auto mb-10 mt-16 w-32" />
        <Card className="text-center">
          <p className="display text-2xl">
            {req?.status === "rejected" ? "Pedido recusado" : !req ? "Registo a meio" : "Quase lá"}
          </p>
          <p className="mt-3 text-sm text-muted">
            {req?.status === "rejected"
              ? "Um admin recusou este registo. Fala com a administração do NMD."
              : !req
                ? "Sai e volta a fazer Criar conta com o mesmo email e password."
                : "A tua conta está à espera de validação por um admin. Volta daqui a pouco."}
          </p>
          <form action={signOut} className="mt-6"><button className={btnGhost}>Sair</button></form>
        </Card>
      </Page>
    );
  }

  const season = await getCurrentSeason();
  const [{ data: next }, { data: last }, { data: ranking }, { data: finos }] = await Promise.all([
    supabase.from("events").select("*").neq("status", "finished").order("date").limit(1).maybeSingle<EventRow>(),
    supabase.from("events").select("*").eq("status", "finished").order("date", { ascending: false }).limit(1).maybeSingle<EventRow>(),
    season
      ? supabase.from("season_ranking").select("*").eq("season_id", season.id).order("points", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("finos").select("player_id, quantity"),
  ]);
  const [{ data: awards }, { data: allPlayers }] = await Promise.all([
    supabase.from("awards").select("season_name, award, winner"),
    supabase.from("players").select("name, avatar_path"),
  ]);
  // Hall of Fame teaser: the latest season's awards
  const seasonOrder = (n: string) => Number(n.match(/\d{4}/)?.[0] ?? 0) + (/inverno/i.test(n) ? 0.5 : 0);
  const lastAwardSeason = [...new Set((awards ?? []).map((a) => a.season_name as string))].sort((a, b) => seasonOrder(b) - seasonOrder(a))[0];
  const hall = (awards ?? []).filter((a) => a.season_name === lastAwardSeason).slice(0, 4);
  const normName = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  const photoOf = (w: string) => {
    const n = normName(w);
    return (allPlayers ?? []).find((p) => normName(p.name) === n || n.startsWith(normName(p.name) + " ") || n.endsWith(" " + normName(p.name)))?.avatar_path ?? null;
  };

  const { data: regs } = next
    ? await supabase.from("registrations").select("player_id, joker, players(id, name, side, is_wild_card, avatar_path)").eq("event_id", next.id)
    : { data: [] };
  const registered = (regs ?? []).map((r) => r.players as unknown as Mini);
  const mine = regs?.find((r) => r.player_id === player.id);

  const rows = (ranking ?? []) as RankingRow[];
  const myIdx = rows.findIndex((r) => r.player_id === player.id);
  const me = rows[myIdx];
  const totalFinos = (finos ?? []).reduce((s, f) => s + f.quantity, 0);
  const myFinos = (finos ?? []).filter((f) => f.player_id === player.id).reduce((s, f) => s + f.quantity, 0);

  // Last Sunday: champions and bombos
  let champions: [Mini, Mini] | null = null;
  let bombos: [Mini, Mini] | null = null;
  if (last) {
    const [{ data: lp }, { data: people }] = await Promise.all([
      supabase.from("pairs").select("*").eq("event_id", last.id),
      supabase.from("players").select("id, name, side, is_wild_card, avatar_path"),
    ]);
    const byId = new Map(((people ?? []) as Mini[]).map((p) => [p.id, p]));
    const ps = (lp ?? []) as PairRow[];
    const max = Math.max(...ps.map((p) => p.final_position ?? 0));
    const duo = (p?: PairRow) => (p ? [byId.get(p.left_player)!, byId.get(p.right_player)!] as [Mini, Mini] : null);
    champions = duo(ps.find((p) => p.final_position === 1));
    bombos = duo(ps.find((p) => p.final_position === max));
  }

  return (
    <Page>
      <header className="rise mb-6 flex items-center justify-between">
        <Logo className="h-6" />
        <Link href="/conta" aria-label="A minha conta">
          <Avatar name={player.name} path={player.avatar_path} size={38} />
        </Link>
      </header>

      {/* Hero: next encounter */}
      {next ? (
        <section className="rise court relative overflow-hidden rounded-[28px] border border-line bg-card p-6"
          style={{ "--i": 1 } as CSSProperties}>
          <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-accent/25 blur-3xl" />
          <p className="eyebrow">Olá, {player.name.split(" ")[0]} · próximo NMD</p>
          <p className="display mt-3 text-[44px] capitalize">{formatDate(next.date).replace(".", "")}</p>
          <div className="mt-4"><Countdown date={next.date} /></div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex -space-x-2.5">
              {registered.slice(0, 7).map((p) => <Avatar key={p.id} name={p.name} path={p.avatar_path} size={34} />)}
              {registered.length > 7 && (
                <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-card-2 text-xs ring-2 ring-bg">
                  +{registered.length - 7}
                </span>
              )}
            </div>
            <p className="text-sm text-muted"><span className="display-num text-xl text-fg">{registered.length}</span> convocados</p>
          </div>

          {next.status === "registration" ? (
            <p className="mt-6 rounded-2xl border border-line bg-bg/60 px-4 py-3 text-sm text-muted">
              {registered.length
                ? mine ? "✓ Estás convocado. As duplas saem em breve." : "As duplas saem em breve."
                : "Inscrições no grupo do WhatsApp."}
            </p>
          ) : (
            <Link href={`/encontros/${next.id}`} className={`${btn} mt-6 w-full`}>
              {next.status === "live" && <span className="live-dot !bg-accent-ink" />} Ver jogos e duplas
            </Link>
          )}
        </section>
      ) : (
        <Card i={1}><p className="display text-2xl">Sem encontro marcado</p><p className="mt-2 text-sm text-muted">As inscrições são no grupo do WhatsApp.</p></Card>
      )}

      {/* Finos: global counter, everyone taps their own +1 */}
      <section className="rise mt-3 rounded-3xl bg-accent p-5 text-accent-ink" style={{ "--i": 2 } as CSSProperties}>
        <Link href="/finos" className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.14em] opacity-70">
          <span>Finos bebidos pelo NMD</span><span>→</span>
        </Link>
        <div className="mt-2"><FinoPlus total={totalFinos} mine={myFinos} /></div>
      </section>

      {/* My season */}
      <SectionTitle>{season?.name ?? "Temporada"}</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <Stat i={3} label="Posição" value={me ? myIdx + 1 : 0} suffix={me ? "º" : ""} />
        <Stat i={4} label="Pontos" value={me ? Number(me.points) : 0} decimals={me && Number(me.points) % 1 ? 1 : 0} />
        <Stat i={5} label="Encontros" value={me?.events_played ?? 0} />
      </div>

      {/* Last Sunday */}
      {last && champions && bombos && (
        <>
          <SectionTitle action={<Link href={`/encontros/${last.id}`} className="text-xs text-muted">Ver →</Link>}>
            Último domingo · <span className="capitalize">{formatDate(last.date)}</span>
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            <Card i={5} className="!p-4">
              <p className="eyebrow !text-accent">🏆 Campeões</p>
              <div className="mt-3"><PairAvatars a={{ name: champions[0].name, path: champions[0].avatar_path }} b={{ name: champions[1].name, path: champions[1].avatar_path }} size={44} /></div>
              <p className="mt-3 text-sm font-semibold leading-tight">{champions[0].name}<br />{champions[1].name}</p>
            </Card>
            <Card i={6} className="!p-4">
              <p className="eyebrow">🥁 Bombos</p>
              <div className="mt-3 grayscale"><PairAvatars a={{ name: bombos[0].name, path: bombos[0].avatar_path }} b={{ name: bombos[1].name, path: bombos[1].avatar_path }} size={44} /></div>
              <p className="mt-3 text-sm font-semibold leading-tight">{bombos[0].name}<br />{bombos[1].name}</p>
            </Card>
          </div>
        </>
      )}

      {/* Top 3 */}
      {rows.length >= 3 && (
        <>
          <SectionTitle action={<Link href="/ranking" className="text-xs text-muted">Ranking →</Link>}>Top 3</SectionTitle>
          <Card i={7} className="!p-0">
            {rows.slice(0, 3).map((r, i) => (
              <Link key={r.player_id} href="/ranking" className="flex items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
                <span className={`display-num w-6 text-xl ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                <Avatar name={r.name} path={r.avatar_path} size={36} />
                <span className="flex-1 font-medium">{r.name}</span>
                <span className="display-num text-lg">{Number(r.points).toLocaleString("pt-PT")}</span>
              </Link>
            ))}
          </Card>
        </>
      )}

      {/* Hall of Fame */}
      {hall.length > 0 && (
        <>
          <SectionTitle action={<Link href="/hall" className="text-xs text-muted">Ver tudo →</Link>}>Hall of Fame · {lastAwardSeason}</SectionTitle>
          <Link href="/hall" className="rise court block rounded-3xl border border-line bg-card p-4" style={{ "--i": 8 } as CSSProperties}>
            <div className="grid grid-cols-2 gap-3">
              {hall.map((a) => (
                <div key={a.award} className="flex items-center gap-2.5">
                  <Avatar name={a.winner ?? "?"} path={a.winner ? photoOf(a.winner) : null} size={38} />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] uppercase tracking-wider text-muted">{a.award}</p>
                    <p className="truncate text-sm font-semibold">{a.winner}</p>
                  </div>
                </div>
              ))}
            </div>
          </Link>
        </>
      )}
    </Page>
  );
}

function Stat({ label, value, suffix = "", decimals = 0, i }: {
  label: string; value: number; suffix?: string; decimals?: number; i: number;
}) {
  return (
    <Card i={i} className="!rounded-2xl !p-4">
      <p className="eyebrow !text-[10px]">{label}</p>
      <p className="mt-2 text-[30px] leading-none">
        <CountUp value={value} decimals={decimals} className="display-num" />{suffix && <span className="display-num">{suffix}</span>}
      </p>
    </Card>
  );
}

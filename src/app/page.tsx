import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { Card, Page, SectionTitle, btn, btnGhost } from "@/components/ui";
import { Logo } from "@/components/Logo";
import { Avatar, PairAvatars } from "@/components/Avatar";
import { CountUp } from "@/components/CountUp";
import { FinoPlus } from "@/components/FinoPlus";
import { Countdown } from "@/components/Countdown";
import { Reveal } from "@/components/Reveal";
import { Ticker } from "@/components/Ticker";
import {
  formatDate, getCurrentSeason, getMe,
  type EventRow, type MatchRow, type PairRow, type PlayerRow, type RankingRow,
} from "@/lib/db";
import { signOut } from "./actions";

type Mini = Pick<PlayerRow, "id" | "name" | "side" | "is_wild_card" | "avatar_path">;
const first = (n: string) => n.split(" ")[0];

export default async function Home() {
  const { supabase, player } = await getMe();

  if (!player) {
    const { data: claimed } = await supabase.rpc("claim_by_email");
    if (claimed) redirect("/");
    const { data: req } = await supabase.from("signup_requests").select("status").maybeSingle();
    return (
      <Page wide={false}>
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
  const [{ data: next }, { data: last }, { data: ranking }, { data: finos }, { data: awards }, { data: people }] = await Promise.all([
    supabase.from("events").select("*").neq("status", "finished").eq("counts_for_ranking", true).order("date").limit(1).maybeSingle<EventRow>(),
    supabase.from("events").select("*").eq("status", "finished").eq("counts_for_ranking", true).order("date", { ascending: false }).limit(1).maybeSingle<EventRow>(),
    season
      ? supabase.from("season_ranking").select("*").eq("season_id", season.id).order("points", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase.from("finos").select("player_id, quantity"),
    supabase.from("awards").select("season_name, award, winner"),
    supabase.from("players").select("id, name, side, is_wild_card, avatar_path"),
  ]);
  const byId = new Map(((people ?? []) as Mini[]).map((p) => [p.id, p]));

  const { data: regs } = next
    ? await supabase.from("registrations").select("player_id").eq("event_id", next.id)
    : { data: [] };
  const called = (regs ?? []).map((r) => byId.get(r.player_id)).filter((p): p is Mini => !!p);
  const amCalled = called.some((p) => p.id === player.id);
  const { data: morfesRows } = next
    ? await supabase.from("repasto").select("player_id").eq("event_id", next.id)
    : { data: [] };
  const morfes = (morfesRows ?? []).map((r) => byId.get(r.player_id)).filter((p): p is Mini => !!p);

  const rows = (ranking ?? []) as RankingRow[];
  const myIdx = rows.findIndex((r) => r.player_id === player.id);
  const me = rows[myIdx];
  const totalFinos = (finos ?? []).reduce((s, f) => s + f.quantity, 0);
  const myFinos = (finos ?? []).filter((f) => f.player_id === player.id).reduce((s, f) => s + f.quantity, 0);

  // Last Sunday: champions, bombos and every result for the ticker
  let champions: [Mini, Mini] | null = null;
  let bombos: [Mini, Mini] | null = null;
  let results: { a: string; b: string; sa: number; sb: number }[] = [];
  if (last) {
    const [{ data: lp }, { data: lm }] = await Promise.all([
      supabase.from("pairs").select("*").eq("event_id", last.id),
      supabase.from("matches").select("*").eq("event_id", last.id).not("score_a", "is", null),
    ]);
    const ps = (lp ?? []) as PairRow[];
    const pairById = new Map(ps.map((p) => [p.id, p]));
    const max = Math.max(...ps.map((p) => p.final_position ?? 0));
    const duo = (p?: PairRow) => (p ? [byId.get(p.left_player)!, byId.get(p.right_player)!] as [Mini, Mini] : null);
    champions = duo(ps.find((p) => p.final_position === 1));
    bombos = duo(ps.find((p) => p.final_position === max));
    const label = (id: string | null) => {
      const p = id ? pairById.get(id) : undefined;
      return p ? `${first(byId.get(p.left_player)?.name ?? "?")}/${first(byId.get(p.right_player)?.name ?? "?")}` : "?";
    };
    results = ((lm ?? []) as MatchRow[]).map((m) => ({ a: label(m.pair_a), b: label(m.pair_b), sa: m.score_a!, sb: m.score_b! }));
  }

  // Hall of Fame teaser: the latest season's awards
  const seasonOrder = (n: string) => Number(n.match(/\d{4}/)?.[0] ?? 0) + (/inverno/i.test(n) ? 0.5 : 0);
  const lastAwardSeason = [...new Set((awards ?? []).map((a) => a.season_name as string))].sort((a, b) => seasonOrder(b) - seasonOrder(a))[0];
  const hall = (awards ?? []).filter((a) => a.season_name === lastAwardSeason).slice(0, 4);
  const normName = (x: string) => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const photoOf = (w: string) => {
    const n = normName(w);
    return ((people ?? []) as Mini[]).find((p) => normName(p.name) === n || n.startsWith(normName(p.name) + " ") || n.endsWith(" " + normName(p.name)))?.avatar_path ?? null;
  };

  return (
    <Page>
      <header className="rise mb-6 flex items-center justify-between lg:mb-8">
        <Logo className="h-6 lg:hidden" />
        <p className="eyebrow hidden lg:block">Olá, {first(player.name)}</p>
        <Link href={`/jogadores/${player.id}`} aria-label="O meu perfil" className="flex items-center gap-3">
          <span className="hidden text-sm text-muted lg:inline">O meu perfil</span>
          <Avatar name={player.name} path={player.avatar_path} size={38} />
        </Link>
      </header>

      <div className="grid gap-3 lg:grid-cols-12 lg:gap-5">
        {/* Hero: next encounter */}
        <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-card p-6 lg:col-span-7 lg:p-9"
          style={{ "--i": 1 } as CSSProperties}>
          <div className="aurora" />
          <span className="display outline-type pointer-events-none absolute -bottom-6 -right-2 select-none text-[150px] leading-none lg:text-[220px]">NMD</span>
          <div className="relative">
            <p className="eyebrow lg:hidden">Olá, {first(player.name)} · próximo NMD</p>
            <p className="eyebrow hidden lg:block">Próximo encontro</p>
            {next ? (
              <>
                <p className="display text-gradient mt-3 text-[46px] capitalize lg:text-[76px]">{formatDate(next.date).replace(".", "")}</p>
                <div className="mt-4"><Countdown date={next.date} /></div>
                <div className="mt-7 flex items-center justify-between">
                  <div className="flex -space-x-2.5">
                    {called.slice(0, 8).map((p) => <Avatar key={p.id} name={p.name} path={p.avatar_path} size={36} />)}
                    {called.length > 8 && (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-card-2 text-xs ring-2 ring-bg">+{called.length - 8}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted"><span className="display-num text-2xl text-fg">{called.length}</span> convocados</p>
                </div>
                {next.status === "registration" ? (
                  <p className="mt-6 rounded-2xl border border-line bg-bg/50 px-4 py-3 text-sm text-muted backdrop-blur">
                    {called.length ? (amCalled ? "✓ Estás convocado. As duplas saem em breve." : "As duplas saem em breve.") : "Inscrições no grupo do WhatsApp."}
                  </p>
                ) : (
                  <Link href={`/encontros/${next.id}`} className={`${btn} mt-6 w-full lg:w-auto`}>
                    {next.status === "live" && <span className="live-dot" />} Ver jogos e duplas →
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="display mt-3 text-[40px] lg:text-[64px]">Sem encontro marcado</p>
                <p className="mt-3 text-sm text-muted">As inscrições são no grupo do WhatsApp.</p>
              </>
            )}
          </div>
        </section>

        {/* Right column on desktop: finos + my season */}
        <div className="flex flex-col gap-3 lg:col-span-5 lg:gap-5">
          <section className="rise relative overflow-hidden rounded-[28px] border border-line bg-gradient-to-br from-accent/25 via-card to-accent-2/20 p-5 lg:p-7"
            style={{ "--i": 2 } as CSSProperties}>
            <div className="shine absolute inset-0" />
            <Link href="/finos" className="relative flex items-center justify-between">
              <span className="eyebrow">🍺 Finos bebidos pelo NMD</span><span className="text-muted">→</span>
            </Link>
            <div className="relative mt-3"><FinoPlus total={totalFinos} mine={myFinos} /></div>
          </section>

          <div className="grid grid-cols-3 gap-2 lg:gap-3">
            <Stat i={3} label="Posição" value={me ? myIdx + 1 : 0} suffix={me ? "º" : ""} />
            <Stat i={4} label="Pontos" value={me ? Number(me.points) : 0} decimals={me && Number(me.points) % 1 ? 1 : 0} />
            <Stat i={5} label="Presenças" value={me?.events_played ?? 0} />
          </div>

          {next && (
            <Link href="/morfes" className="rise lift flex items-center gap-3 rounded-3xl border border-line bg-card p-4" style={{ "--i": 6 } as CSSProperties}>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-xl">🍽️</span>
              <div className="min-w-0 flex-1">
                <p className="eyebrow !text-[10px]">Morfes deste domingo</p>
                <p className="truncate text-sm font-semibold">
                  {morfes.length ? morfes.map((p) => p.name).join(" + ") : "Ninguém ainda — voluntaria-te"}
                  {morfes.length === 1 && <span className="font-normal text-muted"> · falta 1</span>}
                </p>
              </div>
              <span className="flex -space-x-2">{morfes.map((p) => <Avatar key={p.id} name={p.name} path={p.avatar_path} size={30} />)}</span>
              <span className="text-muted">→</span>
            </Link>
          )}
        </div>
      </div>

      {/* Results ticker */}
      {results.length > 0 && (
        <div className="mt-6">
          <Ticker items={results.map((r, i) => (
            <span key={i} className="flex items-center gap-2">
              <span className={r.sa > r.sb ? "font-semibold" : "text-muted"}>{r.a}</span>
              <span className="display-num text-base">{r.sa}–{r.sb}</span>
              <span className={r.sb > r.sa ? "font-semibold" : "text-muted"}>{r.b}</span>
            </span>
          ))} />
        </div>
      )}

      <div className="grid gap-x-5 lg:grid-cols-12">
        {/* Last Sunday */}
        {last && champions && bombos && (
          <Reveal className="lg:col-span-7">
            <SectionTitle action={<Link href={`/encontros/${last.id}`} className="text-xs text-muted hover:text-fg">Resultados →</Link>}>
              Último domingo · <span className="capitalize">{formatDate(last.date)}</span>
            </SectionTitle>
            <div className="grid grid-cols-2 gap-2 lg:gap-3">
              <Link href={`/encontros/${last.id}`} className="lift relative overflow-hidden rounded-3xl border border-line bg-card p-4 lg:p-6">
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/30 blur-2xl" />
                <p className="eyebrow relative">🏆 Campeões</p>
                <div className="relative mt-4"><PairAvatars a={{ name: champions[0].name, path: champions[0].avatar_path }} b={{ name: champions[1].name, path: champions[1].avatar_path }} size={52} /></div>
                <p className="relative mt-3 text-sm font-semibold leading-tight lg:text-base">{champions[0].name}<br />{champions[1].name}</p>
              </Link>
              <Link href={`/encontros/${last.id}`} className="lift rounded-3xl border border-line bg-card p-4 lg:p-6">
                <p className="eyebrow">🥁 Bombos</p>
                <div className="mt-4 grayscale"><PairAvatars a={{ name: bombos[0].name, path: bombos[0].avatar_path }} b={{ name: bombos[1].name, path: bombos[1].avatar_path }} size={52} /></div>
                <p className="mt-3 text-sm font-semibold leading-tight text-muted lg:text-base">{bombos[0].name}<br />{bombos[1].name}</p>
              </Link>
            </div>
          </Reveal>
        )}

        {/* Top 5 */}
        {rows.length >= 3 && (
          <Reveal className="lg:col-span-5" i={1}>
            <SectionTitle action={<Link href="/ranking" className="text-xs text-muted hover:text-fg">Ranking →</Link>}>{season?.name}</SectionTitle>
            <div className="overflow-hidden rounded-3xl border border-line bg-card">
              {rows.slice(0, 5).map((r, i) => (
                <Link key={r.player_id} href={`/jogadores/${r.player_id}`} className="flex items-center gap-3 border-t border-line px-4 py-3 transition first:border-t-0 hover:bg-card-2">
                  <span className={`display-num w-6 text-xl ${i === 0 ? "text-accent" : "text-muted"}`}>{i + 1}</span>
                  <Avatar name={r.name} path={r.avatar_path} size={34} />
                  <span className="flex-1 truncate font-medium">{r.name}</span>
                  <span className="text-xs text-muted">{r.events_played}P · {r.wins}V</span>
                  <span className="display-num w-12 text-right text-lg">{Number(r.points).toLocaleString("pt-PT")}</span>
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </div>

      {/* Hall of Fame */}
      {hall.length > 0 && (
        <Reveal>
          <SectionTitle action={<Link href="/hall" className="text-xs text-muted hover:text-fg">Ver tudo →</Link>}>Hall of Fame · {lastAwardSeason}</SectionTitle>
          <Link href="/hall" className="lift court block rounded-3xl border border-line bg-card p-4 lg:p-6">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {hall.map((a) => (
                <div key={a.award} className="flex items-center gap-2.5">
                  <Avatar name={a.winner ?? "?"} path={a.winner ? photoOf(a.winner) : null} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-[10px] uppercase tracking-wider text-muted">{a.award}</p>
                    <p className="truncate text-sm font-semibold">{a.winner}</p>
                  </div>
                </div>
              ))}
            </div>
          </Link>
        </Reveal>
      )}
    </Page>
  );
}

function Stat({ label, value, suffix = "", decimals = 0, i }: {
  label: string; value: number; suffix?: string; decimals?: number; i: number;
}) {
  return (
    <Card i={i} className="!rounded-2xl !p-4 lg:!p-5">
      <p className="eyebrow !text-[10px]">{label}</p>
      <p className="mt-2 text-[30px] leading-none lg:text-[40px]">
        <CountUp value={value} decimals={decimals} className="display-num" />{suffix && <span className="display-num">{suffix}</span>}
      </p>
    </Card>
  );
}

import Link from "next/link";
import { Card, Page, SectionTitle, btnGhost, input } from "@/components/ui";
import { formatDate, requireAdmin, type EventRow, type PlayerRow } from "@/lib/db";
import { PLAYER_OPTIONS } from "@/lib/player-options";
import { addFixedPair, deleteTestEvent, removeFixedPair, setEventCourts, updateEventSettings } from "../../../actions";
import { PairingPanel } from "./PairingPanel";
import { SidePicker } from "./SidePicker";
import { JokerList } from "./JokerList";

const REASON: Record<string, string> = { winners: "Vencedores", bombos: "Bombos", training: "Treino p/ torneio", admin: "Escolha admin" };

export default async function AdminEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: event }, { data: playersData }, { data: regs }, { data: fixed }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).single<EventRow>(),
    supabase.from("players").select("*").eq("active", true).order("name"),
    supabase.from("registrations").select("*").eq("event_id", id),
    supabase.from("fixed_pair_requests").select("*").eq("event_id", id),
  ]);
  const { data: ranking } = event
    ? await supabase.from("season_ranking").select("player_id, points").eq("season_id", event.season_id)
    : { data: [] };
  if (!event) return null;

  const players = (playersData ?? []) as PlayerRow[];
  const byId = new Map(players.map((p) => [p.id, p]));
  const reg = new Map((regs ?? []).map((r) => [r.player_id as string, r]));
  const registered = players.filter((p) => reg.has(p.id));
  const drawn = event.status !== "registration";

  return (
    <Page eyebrow={`${event.counts_for_ranking ? "" : "🧪 Teste · "}${drawn ? "Duplas sorteadas" : "Preparar sorteio"}`} title={formatDate(event.date).replace(".", "")}
      action={<Link href={`/encontros/${id}`} className={btnGhost}>Ver jogos</Link>}>

      {!drawn ? (
        <>
          <SectionTitle>1 · Quem joga e de que lado</SectionTitle>
          <SidePicker eventId={id}
            players={players.map((p) => ({ id: p.id, name: p.name, side: p.side, avatar_path: p.avatar_path, is_wild_card: p.is_wild_card }))}
            initial={Object.fromEntries(registered.map((p) => [p.id, (reg.get(p.id)?.side ?? p.side) as "L" | "R"]))}
            points={Object.fromEntries((ranking ?? []).map((r) => [r.player_id as string, Number(r.points)]))}
            initialNote={event.notes}
            target={event.expected_players} />
          <p className="mt-2 text-xs text-muted">Falta alguém? Adiciona-o em Admin → Jogadores (wild cards incluídos).</p>

          <SectionTitle>2 · Duplas fixas</SectionTitle>
          <Card className="!p-0">
            {(fixed ?? []).map((f) => (
              <div key={f.id} className="flex items-center justify-between border-b border-line px-4 py-3 text-sm">
                <span>{byId.get(f.player_a)?.name} / {byId.get(f.player_b)?.name} <span className="text-muted">· {REASON[f.reason]}</span></span>
                <form action={removeFixedPair.bind(null, f.id, id)}><button className="text-muted">✕</button></form>
              </div>
            ))}
            <form action={addFixedPair} className="grid grid-cols-2 gap-2 p-3">
              <input type="hidden" name="event_id" value={id} />
              <select className={input} name="player_a" required>{registered.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select className={input} name="player_b" required>{registered.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
              <select className={input} name="reason">{Object.entries(REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              <button className={btnGhost}>Adicionar</button>
            </form>
          </Card>

          <SectionTitle>3 · Regra do sorteio</SectionTitle>
          <form action={updateEventSettings} className="grid gap-2 sm:grid-cols-[1fr_2fr_1fr]">
            <input type="hidden" name="event_id" value={id} />
            <select className={input} name="pairing_mode" defaultValue={event.pairing_mode}>
              <option value="ranking">Ranking</option>
              <option value="weighted">Média ponderada</option>
              <option value="draw">Sorteio</option>
            </select>
            <select className={input} name="expected_players" defaultValue={String(event.expected_players ?? 20)}>
              {PLAYER_OPTIONS.map((o) => <option key={o.n} value={o.n}>{o.label}</option>)}
            </select>
            <select className={input} name="courts" defaultValue={String(event.courts ?? 4)}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} campo{n > 1 ? "s" : ""}</option>)}
            </select>
            <button className={`${btnGhost} sm:col-span-3`}>Guardar</button>
          </form>

          <SectionTitle>4 · Sortear</SectionTitle>
          <PairingPanel eventId={id} />
        </>
      ) : (
        <>
          <SectionTitle>Campos e jornadas</SectionTitle>
          <form action={setEventCourts} className="flex gap-2">
            <input type="hidden" name="event_id" value={id} />
            <select className={input} name="courts" defaultValue={String(event.courts ?? 4)}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} campo{n > 1 ? "s" : ""}</option>)}
            </select>
            <button className={btnGhost}>Reorganizar jornadas</button>
          </form>
          <p className="mt-2 text-xs text-muted">Distribui os jogos por jornadas e campos. Usa se o número de campos mudar no próprio dia.</p>

          <SectionTitle>Quem jogou o Joker</SectionTitle>
          <JokerList eventId={id} locked={event.status === "finished"}
            rows={registered.map((p) => ({ id: p.id, name: p.name, avatar_path: p.avatar_path, joker: !!reg.get(p.id)?.joker }))} />

          <SectionTitle>Explicação do sorteio</SectionTitle>
          <Card>
            {event.pairing_log?.warnings.map((w) => <p key={w} className="mb-2 text-sm">⚠︎ {w}</p>)}
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{event.pairing_log?.log.map((l) => <li key={l}>{l}</li>)}</ul>
          </Card>
        </>
      )}
      {!event.counts_for_ranking && (
        <div className="mt-12 rounded-3xl border border-danger/40 bg-danger/10 p-5">
          <p className="font-semibold">Encontro de teste</p>
          <p className="mt-1 text-sm text-muted">Não conta para o ranking e só os admins o veem. Quando acabares, apaga-o: vão as duplas, os jogos, os pontos, os morfes e os finos deste teste.</p>
          <form action={deleteTestEvent.bind(null, id)} className="mt-4">
            <button className="rounded-full bg-danger px-5 py-3 text-sm font-semibold text-white active:scale-[0.97]">Apagar encontro de teste</button>
          </form>
        </div>
      )}
    </Page>
  );
}

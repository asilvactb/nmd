import Link from "next/link";
import { Card, Page, SectionTitle, btnGhost, input } from "@/components/ui";
import { formatDate, requireAdmin, type EventRow, type PlayerRow } from "@/lib/db";
import { FORMATS } from "@/lib/engine/tournament";
import { addFixedPair, adminRegister, adminSetRegistrationFlag, removeFixedPair, updateEventSettings } from "../../../actions";
import { PairingPanel } from "./PairingPanel";

const REASON: Record<string, string> = { winners: "Vencedores", bombos: "Bombos", training: "Treino p/ torneio", admin: "Escolha admin" };

export default async function AdminEvent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data: event } = await supabase.from("events").select("*").eq("id", id).single<EventRow>();
  const { data: playersData } = await supabase.from("players").select("*").eq("active", true).order("name");
  const { data: regs } = await supabase.from("registrations").select("*").eq("event_id", id);
  const { data: fixed } = await supabase.from("fixed_pair_requests").select("*").eq("event_id", id);
  const players = (playersData ?? []) as PlayerRow[];
  const byId = new Map(players.map((p) => [p.id, p]));
  const reg = new Map((regs ?? []).map((r) => [r.player_id, r]));
  const registered = players.filter((p) => reg.has(p.id));
  const nL = registered.filter((p) => p.side === "L").length;
  const nR = registered.length - nL;
  const validSizes = FORMATS.map((f) => f.numPairs * 2);

  if (!event) return null;
  const locked = event.status !== "registration";

  return (
    <Page title={formatDate(event.date)} action={<Link href={`/encontros/${id}`} className={btnGhost}>Ver</Link>}>
      <Card>
        <p className="tabular text-3xl font-semibold">{registered.length}<span className="text-base font-normal text-muted"> inscritos</span></p>
        <p className="text-sm text-muted">{nL} esquerdas · {nR} direitas</p>
        {!validSizes.includes(registered.length) && (
          <p className="mt-2 text-sm">⚠︎ Formatos disponíveis para {validSizes.join(", ")} jogadores.</p>
        )}
      </Card>

      <SectionTitle>Definições</SectionTitle>
      <form action={updateEventSettings} className="grid grid-cols-2 gap-2">
        <input type="hidden" name="event_id" value={id} />
        <select className={input} name="pairing_mode" defaultValue={event.pairing_mode} disabled={locked}>
          <option value="ranking">Ranking</option>
          <option value="weighted">Média ponderada</option>
          <option value="draw">Sorteio</option>
        </select>
        <select className={input} name="courts" defaultValue={String(event.courts)} disabled={locked}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} campo{n > 1 ? "s" : ""}</option>)}
        </select>
        {!locked && <button className={`${btnGhost} col-span-2`}>Guardar</button>}
      </form>

      <SectionTitle>Duplas fixas</SectionTitle>
      <Card className="!p-0">
        {(fixed ?? []).map((f) => (
          <div key={f.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm">
            <span>{byId.get(f.player_a)?.name} / {byId.get(f.player_b)?.name} <span className="text-muted">· {REASON[f.reason]}</span></span>
            {!locked && <form action={removeFixedPair.bind(null, f.id, id)}><button className="text-muted">✕</button></form>}
          </div>
        ))}
        {!locked && (
          <form action={addFixedPair} className="grid grid-cols-2 gap-2 p-3">
            <input type="hidden" name="event_id" value={id} />
            <select className={input} name="player_a" required>{registered.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select className={input} name="player_b" required>{registered.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <select className={input} name="reason">{Object.entries(REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <button className={btnGhost}>Adicionar</button>
          </form>
        )}
      </Card>

      <SectionTitle>Jogadores</SectionTitle>
      <Card className="!p-0">
        {players.map((p) => {
          const r = reg.get(p.id);
          return (
            <div key={p.id} className="flex items-center gap-2 border-b border-line px-4 py-2 text-sm last:border-b-0">
              <form action={adminRegister.bind(null, id, p.id, !r)} className="flex-1">
                <button disabled={locked} className="flex w-full items-center gap-3 text-left">
                  <span className={`flex h-5 w-5 items-center justify-center rounded-md border ${r ? "border-fg bg-fg text-bg" : "border-line"}`}>{r ? "✓" : ""}</span>
                  <span>{p.name}{p.is_wild_card && <span className="text-muted"> (wc)</span>}</span>
                  <span className="text-xs text-muted">{p.side === "L" ? "E" : "D"}</span>
                </button>
              </form>
              {r && !locked && (
                <>
                  <form action={adminSetRegistrationFlag.bind(null, id, p.id, "joker", !r.joker)}>
                    <button className={`rounded-full px-2 py-1 text-xs ${r.joker ? "bg-fg text-bg" : "border border-line text-muted"}`}>Joker</button>
                  </form>
                  <form action={adminSetRegistrationFlag.bind(null, id, p.id, "volunteer_switch", !r.volunteer_switch)}>
                    <button className={`rounded-full px-2 py-1 text-xs ${r.volunteer_switch ? "bg-fg text-bg" : "border border-line text-muted"}`}>Troca lado</button>
                  </form>
                </>
              )}
            </div>
          );
        })}
      </Card>

      <SectionTitle>Emparceiramento</SectionTitle>
      {locked ? (
        <Card>
          <p className="text-sm">Duplas publicadas.</p>
          {event.pairing_log?.warnings.map((w) => <p key={w} className="mt-2 text-sm">⚠︎ {w}</p>)}
          <details className="mt-2 text-sm text-muted"><summary>Explicação</summary>
            <ul className="mt-2 list-disc pl-5">{event.pairing_log?.log.map((l) => <li key={l}>{l}</li>)}</ul>
          </details>
        </Card>
      ) : (
        <PairingPanel eventId={id} />
      )}
    </Page>
  );
}

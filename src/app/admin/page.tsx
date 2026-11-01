import Link from "next/link";
import { Card, Page, SectionTitle, btn, btnGhost, input } from "@/components/ui";
import { formatDate, requireAdmin, type EventRow } from "@/lib/db";
import { PLAYER_OPTIONS } from "@/lib/player-options";
import { Avatar } from "@/components/Avatar";
import { approveSignup, createEvent, rejectSignup } from "../actions";

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("events").select("*").neq("status", "finished").order("date");
  const { data: requests } = await supabase
    .from("signup_requests").select("*, players(name)").eq("status", "pending").order("created_at");
  return (
    <Page title="Admin" action={<Link href="/admin/jogadores" className={btnGhost}>Jogadores</Link>}>
      {!!requests?.length && (
        <>
          <SectionTitle>Contas por validar</SectionTitle>
          <div className="mb-6 flex flex-col gap-2">
            {requests.map((r) => (
              <Card key={r.user_id}>
                <div className="flex items-center gap-3">
                <Avatar name={r.email} path={r.avatar_path} size={56} />
                <div>
                <p className="font-medium">
                  {r.player_id
                    ? (r.players as unknown as { name: string } | null)?.name
                    : `${r.new_name} (novo, ${r.new_side === "L" ? "esquerda" : "direita"})`}
                </p>
                <p className="text-sm text-muted">{r.email}</p>
                </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <form action={approveSignup.bind(null, r.user_id)}><button className={btn}>Validar</button></form>
                  <form action={rejectSignup.bind(null, r.user_id)}><button className={btnGhost}>Recusar</button></form>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
      <Card>
        <p className="eyebrow mb-3">Novo encontro</p>
        <form action={createEvent} className="flex flex-col gap-2">
          <input className={input} type="date" name="date" defaultValue={nextSunday()} required />
          <div className="grid grid-cols-2 gap-2">
            <select className={input} name="pairing_mode" defaultValue="ranking">
              <option value="ranking">Ranking</option>
              <option value="weighted">Média ponderada</option>
              <option value="draw">Sorteio</option>
            </select>
            <select className={input} name="expected_players" defaultValue="20">
              {PLAYER_OPTIONS.map((o) => <option key={o.n} value={o.n}>{o.label}</option>)}
            </select>
          </div>
          <button className={btn}>Criar encontro e preparar sorteio</button>
        </form>
      </Card>

      <SectionTitle>Em curso</SectionTitle>
      <div className="flex flex-col gap-2">
        {((data ?? []) as EventRow[]).map((e) => (
          <Link key={e.id} href={`/admin/encontros/${e.id}`}>
            <Card className="flex justify-between"><span className="capitalize">{formatDate(e.date)}</span><span className="text-muted">Gerir →</span></Card>
          </Link>
        ))}
      </div>
    </Page>
  );
}

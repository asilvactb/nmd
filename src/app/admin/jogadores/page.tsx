import { Card, Page, SectionTitle, btn, input } from "@/components/ui";
import { requireAdmin, type PlayerRow } from "@/lib/db";
import { upsertPlayer } from "../../actions";

export default async function Jogadores() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("players").select("*").order("name");
  const players = (data ?? []) as PlayerRow[];
  return (
    <Page title="Jogadores">
      <Card>
        <p className="mb-3 font-medium">Novo jogador</p>
        <PlayerForm />
      </Card>
      <SectionTitle>{players.length} jogadores</SectionTitle>
      <div className="flex flex-col gap-2">
        {players.map((p) => (
          <details key={p.id} className="rounded-2xl bg-card px-4 py-3">
            <summary className="flex cursor-pointer justify-between text-sm">
              <span>{p.name}{p.is_wild_card && " (wc)"}{p.is_admin && " · admin"}</span>
              <span className="text-muted">{p.email ? "✓ email" : "sem email"}</span>
            </summary>
            <div className="mt-3"><PlayerForm player={p} /></div>
          </details>
        ))}
      </div>
    </Page>
  );
}

function PlayerForm({ player }: { player?: PlayerRow }) {
  return (
    <form action={upsertPlayer} className="flex flex-col gap-2">
      {player && <input type="hidden" name="id" value={player.id} />}
      <input className={input} name="name" placeholder="Nome" defaultValue={player?.name} required />
      <input className={input} name="email" type="email" placeholder="Email (para login)" defaultValue={player?.email ?? ""} />
      <select className={input} name="side" defaultValue={player?.side ?? "L"}>
        <option value="L">Esquerda</option>
        <option value="R">Direita</option>
      </select>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_wild_card" defaultChecked={player?.is_wild_card} /> Wild card</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_admin" defaultChecked={player?.is_admin} /> Admin</label>
      <button className={btn}>{player ? "Guardar" : "Adicionar"}</button>
    </form>
  );
}

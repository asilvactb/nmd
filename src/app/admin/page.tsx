import Link from "next/link";
import { Card, Page, SectionTitle, btn, btnGhost, input } from "@/components/ui";
import { formatDate, requireAdmin, type EventRow } from "@/lib/db";
import { createEvent } from "../actions";

function nextSunday() {
  const d = new Date();
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7 || 7));
  return d.toISOString().slice(0, 10);
}

export default async function AdminPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("events").select("*").neq("status", "finished").order("date");
  return (
    <Page title="Admin" action={<Link href="/admin/jogadores" className={btnGhost}>Jogadores</Link>}>
      <Card>
        <p className="mb-3 font-medium">Abrir novo encontro</p>
        <form action={createEvent} className="flex flex-col gap-2">
          <input className={input} type="date" name="date" defaultValue={nextSunday()} required />
          <div className="grid grid-cols-2 gap-2">
            <select className={input} name="pairing_mode" defaultValue="ranking">
              <option value="ranking">Ranking</option>
              <option value="weighted">Média ponderada</option>
              <option value="draw">Sorteio</option>
            </select>
            <select className={input} name="courts" defaultValue="2">
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} campo{n > 1 ? "s" : ""}</option>)}
            </select>
          </div>
          <button className={btn}>Abrir inscrições</button>
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

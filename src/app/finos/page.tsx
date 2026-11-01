import { Card, Page, SectionTitle, btn } from "@/components/ui";
import { getMe } from "@/lib/db";
import { addFinos } from "../actions";

export default async function FinosPage() {
  const { supabase, player } = await getMe();
  const { data } = await supabase.from("finos").select("player_id, quantity, kind, players(name)");
  const totals = new Map<string, { name: string; drink: number; fine: number }>();
  for (const f of data ?? []) {
    const name = (f.players as unknown as { name: string }).name;
    const t = totals.get(f.player_id) ?? { name, drink: 0, fine: 0 };
    if (f.kind === "fine") t.fine += f.quantity; else t.drink += f.quantity;
    totals.set(f.player_id, t);
  }
  const board = [...totals.entries()].sort((a, b) => b[1].drink + b[1].fine - (a[1].drink + a[1].fine));
  const total = board.reduce((s, [, t]) => s + t.drink + t.fine, 0);

  return (
    <Page title="Finos">
      <Card className="text-center">
        <p className="text-xs uppercase tracking-wider text-muted">Total do NMD</p>
        <p className="tabular mt-1 text-5xl font-semibold">{total}</p>
        <p className="mt-1 text-sm text-muted">{(total * 0.2).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} litros</p>
      </Card>

      {player && (
        <form action={addFinos} className="mt-4 flex gap-2">
          <input type="hidden" name="quantity" value="1" />
          <button className={`${btn} flex-1`}>+1 fino</button>
        </form>
      )}

      <SectionTitle>Classificação</SectionTitle>
      <Card className="!p-0">
        <ul>
          {board.map(([id, t], i) => (
            <li key={id} className="flex items-center justify-between border-t border-line px-4 py-3 first:border-t-0">
              <span><span className="mr-3 text-muted">{i + 1}</span>{t.name}</span>
              <span className="tabular">{t.drink + t.fine}{t.fine > 0 && <span className="ml-1 text-xs text-muted">({t.fine} multa)</span>}</span>
            </li>
          ))}
          {board.length === 0 && <li className="px-4 py-3 text-muted">Ainda ninguém bebeu. Por enquanto.</li>}
        </ul>
      </Card>
    </Page>
  );
}

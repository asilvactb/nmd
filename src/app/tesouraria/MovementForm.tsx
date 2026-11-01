"use client";
import { useRef, useState, useTransition } from "react";
import { addMovement } from "../actions";

type P = { id: string; name: string };

/** Quick entry: amount with sign (+ adds, − subtracts), who, what for. */
export function MovementForm({ players }: { players: P[] }) {
  const ref = useRef<HTMLFormElement>(null);
  const [sign, setSign] = useState<1 | -1>(1);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();
  const field = "w-full rounded-2xl border border-line bg-bg px-4 py-3 text-base outline-none focus:border-accent";

  return (
    <form ref={ref} className="flex flex-col gap-2"
      action={(fd) => start(async () => {
        const v = String(fd.get("amount") ?? "").replace(/^[+−-]/, "");
        fd.set("amount", `${sign < 0 ? "-" : ""}${v}`);
        const r = await addMovement(fd);
        setError(r.error);
        if (!r.error) { ref.current?.reset(); setOk(true); setTimeout(() => setOk(false), 1800); }
      })}>
      <div className="grid grid-cols-2 gap-2">
        {([1, -1] as const).map((s) => (
          <button key={s} type="button" onClick={() => setSign(s)}
            className={`rounded-2xl py-3 text-sm font-semibold transition ${sign === s ? (s > 0 ? "bg-accent text-white" : "bg-danger text-white") : "border border-line text-muted"}`}>
            {s > 0 ? "+ Entrada" : "− Saída"}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input name="amount" inputMode="decimal" required placeholder="Valor (€)" className={`${field} display-num !text-2xl`} />
        <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} className={`${field} !w-auto`} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <select name="player_id" className={field} defaultValue="">
          <option value="">{sign > 0 ? "Quem pagou (jogador)…" : "Jogador (opcional)…"}</option>
          {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input name="counterparty" placeholder={sign > 0 ? "Ou outro (ex.: WC, patrocínio)" : "Para quem (ex.: Mesh, restaurante)"} className={field} />
      </div>
      <input name="reason" placeholder="Motivo (ex.: NMD 8/nov, Comida, Troféus)" className={field} />
      <label className="flex items-center gap-2 px-1 text-sm text-muted">
        <input type="checkbox" name="pending" className="h-4 w-4" /> Ainda por receber (aguarda transferência)
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
      <button disabled={pending} className="rounded-full bg-fg py-3.5 font-semibold text-bg transition active:scale-[0.97] disabled:opacity-50">
        {pending ? "A guardar…" : ok ? "✓ Guardado" : "Registar movimento"}
      </button>
    </form>
  );
}

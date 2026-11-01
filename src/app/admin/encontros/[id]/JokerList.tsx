"use client";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { adminSetJoker } from "../../../actions";

type Row = { id: string; name: string; avatar_path: string | null; joker: boolean };

/** After the draw, the admin marks who played the Joker. */
export function JokerList({ eventId, rows, locked }: { eventId: string; rows: Row[]; locked: boolean }) {
  const [state, setState] = useState(() => Object.fromEntries(rows.map((r) => [r.id, r.joker])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function toggle(id: string) {
    const on = !state[id];
    setState((s) => ({ ...s, [id]: on }));
    setError(null);
    start(async () => {
      const r = await adminSetJoker(eventId, id, on);
      if (r.error) {
        setState((s) => ({ ...s, [id]: !on }));
        setError(r.error);
      }
    });
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5">
        {rows.map((r) => (
          <button key={r.id} disabled={locked || pending} onClick={() => toggle(r.id)}
            className={`flex items-center gap-2 rounded-2xl border px-2 py-2 text-left text-sm transition active:scale-[0.97] ${state[r.id] ? "border-accent bg-accent/15" : "border-line bg-card"}`}>
            <Avatar name={r.name} path={r.avatar_path} size={28} />
            <span className="min-w-0 flex-1 truncate">{r.name}</span>
            <span className={state[r.id] ? "text-accent" : "text-line"}>★</span>
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <p className="mt-2 text-xs text-muted">
        {locked ? "Encontro fechado: o Joker já contou para os pontos." : "Toca em quem jogou o Joker. Conta ao fechar o encontro (×2 se ganhar, ÷2 se não)."}
      </p>
    </div>
  );
}

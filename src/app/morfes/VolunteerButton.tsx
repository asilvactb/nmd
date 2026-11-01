"use client";
import { useState, useTransition } from "react";
import { leaveMorfes, volunteerMorfes } from "../actions";

export function VolunteerButton({ eventId, amIn, full }: { eventId: string; amIn: boolean; full: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (amIn) {
    return (
      <button disabled={pending} onClick={() => start(() => leaveMorfes(eventId))}
        className="w-full rounded-full border border-line bg-card-2 py-3.5 text-sm font-medium transition active:scale-[0.97]">
        {pending ? "…" : "Afinal não posso levar"}
      </button>
    );
  }
  return (
    <div>
      <button disabled={pending || full} onClick={() => start(async () => { const r = await volunteerMorfes(eventId); setError(r.error); })}
        className="w-full rounded-full bg-fg py-3.5 text-[15px] font-semibold text-bg transition hover:bg-white active:scale-[0.97] disabled:opacity-40">
        {pending ? "A registar…" : full ? "Já está tratado" : "🍽️ Eu levo os morfes"}
      </button>
      {error && <p className="mt-2 text-center text-sm text-danger">{error}</p>}
    </div>
  );
}

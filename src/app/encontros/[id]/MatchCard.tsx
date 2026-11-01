"use client";
import { useState, useTransition } from "react";
import type { MatchRow } from "@/lib/db";
import { saveScore } from "../../actions";

const LOSER_SCORES = [0, 1, 2, 3, 4, 5];

export function MatchCard({ match, eventId, nameA, nameB, tag, canEdit }: {
  match: MatchRow; eventId: string; nameA: string; nameB: string; tag?: string; canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const played = match.score_a != null && match.score_b != null;

  function submit(loser: number) {
    const [a, b] = winner === "a" ? [6, loser] : [loser, 6];
    start(async () => {
      const r = await saveScore(match.id, eventId, a, b);
      if (r.error) setError(r.error);
      else { setOpen(false); setWinner(null); setError(null); }
    });
  }

  const row = (name: string, score: number | null, won: boolean) => (
    <div className="flex items-center justify-between py-1">
      <span className={won ? "font-semibold" : played ? "text-muted" : ""}>{name}</span>
      <span className="tabular text-lg font-semibold">{score ?? ""}</span>
    </div>
  );

  return (
    <div className={`rounded-2xl bg-card px-4 py-3 ${pending ? "opacity-60" : ""}`}>
      {tag && <p className="mb-1 text-[11px] uppercase tracking-wider text-muted">{tag}</p>}
      <button type="button" className="block w-full text-left" disabled={!canEdit} onClick={() => setOpen((o) => !o)}>
        {row(nameA, match.score_a, played && match.score_a! > match.score_b!)}
        {row(nameB, match.score_b, played && match.score_b! > match.score_a!)}
      </button>
      {open && canEdit && (
        <div className="mt-3 border-t border-line pt-3">
          {!winner ? (
            <div className="grid grid-cols-2 gap-2">
              <p className="col-span-2 text-xs text-muted">Quem ganhou?</p>
              <button className="rounded-xl border border-line py-2.5 text-sm" onClick={() => setWinner("a")}>{nameA}</button>
              <button className="rounded-xl border border-line py-2.5 text-sm" onClick={() => setWinner("b")}>{nameB}</button>
            </div>
          ) : (
            <div>
              <p className="mb-2 text-xs text-muted">6 – ? (6-5 = tie-break)</p>
              <div className="grid grid-cols-6 gap-1.5">
                {LOSER_SCORES.map((n) => (
                  <button key={n} className="rounded-xl border border-line py-2.5 text-lg" onClick={() => submit(n)}>{n}</button>
                ))}
              </div>
              <button className="mt-2 text-xs text-muted" onClick={() => setWinner(null)}>← voltar</button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

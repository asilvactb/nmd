"use client";
import { useState, useTransition } from "react";
import type { MatchRow } from "@/lib/db";
import { saveScore } from "../../actions";
import { PairAvatars } from "@/components/Avatar";

type Person = { name: string; path: string | null };
const LOSER_SCORES = [0, 1, 2, 3, 4, 5];

export function MatchCard({ match, eventId, nameA, nameB, peopleA, peopleB, tag, canEdit }: {
  match: MatchRow; eventId: string; nameA: string; nameB: string;
  peopleA?: [Person, Person]; peopleB?: [Person, Person]; tag?: string; canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [winner, setWinner] = useState<"a" | "b" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const played = match.score_a != null && match.score_b != null;
  const aWon = played && match.score_a! > match.score_b!;
  const tbd = !match.pair_a || !match.pair_b;

  function submit(loser: number) {
    const [a, b] = winner === "a" ? [6, loser] : [loser, 6];
    start(async () => {
      const r = await saveScore(match.id, eventId, a, b);
      if (r.error) setError(r.error);
      else { setOpen(false); setWinner(null); setError(null); }
    });
  }

  const side = (name: string, people: [Person, Person] | undefined, score: number | null, won: boolean) => (
    <div className={`flex items-center gap-3 py-1.5 ${played && !won ? "opacity-45" : ""}`}>
      {people ? <PairAvatars a={people[0]} b={people[1]} size={34} /> : <span className="h-[34px] w-[54px] rounded-full border border-dashed border-line" />}
      <span className={`min-w-0 flex-1 truncate text-[15px] ${won ? "font-semibold" : ""}`}>{name}</span>
      <span className={`display-num w-9 text-right text-3xl ${won ? "text-accent" : ""}`}>{score ?? ""}</span>
    </div>
  );

  return (
    <div className={`rise rounded-3xl border bg-card px-4 py-3 transition ${open ? "border-accent/60" : "border-line"} ${pending ? "opacity-60" : ""}`}>
      <div className="mb-1 flex items-center justify-between">
        {tag ? <p className="eyebrow !text-[10px]">{tag}</p> : <span />}
        {!played && !tbd && canEdit && <span className="text-[10px] font-semibold uppercase tracking-wider text-accent">Lançar</span>}
        {played && <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">Final</span>}
      </div>
      <button type="button" className="block w-full text-left" disabled={!canEdit || tbd} onClick={() => setOpen((o) => !o)}>
        {side(nameA, peopleA, match.score_a, aWon)}
        {side(nameB, peopleB, match.score_b, played && !aWon)}
      </button>
      {open && canEdit && (
        <div className="mt-3 border-t border-line pt-3">
          {!winner ? (
            <div className="grid grid-cols-2 gap-2">
              <p className="eyebrow col-span-2">Quem ganhou?</p>
              <button className="truncate rounded-2xl bg-card-2 px-3 py-3 text-sm font-medium active:scale-95" onClick={() => setWinner("a")}>{nameA}</button>
              <button className="truncate rounded-2xl bg-card-2 px-3 py-3 text-sm font-medium active:scale-95" onClick={() => setWinner("b")}>{nameB}</button>
            </div>
          ) : (
            <div>
              <p className="eyebrow mb-2">6 – ? · 6-5 = tie-break</p>
              <div className="grid grid-cols-6 gap-1.5">
                {LOSER_SCORES.map((n) => (
                  <button key={n} className="display-num rounded-2xl bg-card-2 py-3 text-2xl active:scale-95 active:bg-accent active:text-accent-ink" onClick={() => submit(n)}>{n}</button>
                ))}
              </div>
              <button className="mt-2 text-xs text-muted" onClick={() => setWinner(null)}>← voltar</button>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      )}
    </div>
  );
}

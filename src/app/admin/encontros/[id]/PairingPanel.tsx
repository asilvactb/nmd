"use client";
import { useState, useTransition } from "react";
import { btn, btnGhost } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { previewPairs, publishPairs } from "../../../actions";

type Preview = Awaited<ReturnType<typeof previewPairs>>;
type Person = { id: string; name: string; path: string | null };
type Board = { left: Person; right: Person; reason: string }[];
type SlotRef = { pair: number; side: "left" | "right" };

const REASON: Record<string, string> = {
  ranking: "Ranking", draw: "Sorteio", winners: "Vencedores", bombos: "Bombos",
  training: "Treino", admin: "Escolha admin", manual: "Ajustada",
};

/**
 * Draw preview as cards. Before publishing, the admin can drag a player onto another
 * (or tap one, then the other) to swap them. What is shown is exactly what gets published.
 */
export function PairingPanel({ eventId }: { eventId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [board, setBoard] = useState<Board>([]);
  const [swaps, setSwaps] = useState<string[]>([]);
  const [picked, setPicked] = useState<SlotRef | null>(null);
  const [dragging, setDragging] = useState<SlotRef | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function load() {
    start(async () => {
      const r = await previewPairs(eventId);
      setPreview(r);
      setSwaps([]);
      setPicked(null);
      setError(null);
      setBoard(r.pairs.map((p) => ({
        left: { id: p.leftId, name: p.left, path: p.leftPath },
        right: { id: p.rightId, name: p.right, path: p.rightPath },
        reason: p.reason,
      })));
    });
  }

  function swap(a: SlotRef, b: SlotRef) {
    if (a.pair === b.pair && a.side === b.side) return;
    const x = board[a.pair]![a.side], y = board[b.pair]![b.side];
    const next = board.map((p) => ({ ...p }));
    next[a.pair]![a.side] = y;
    next[b.pair]![b.side] = x;
    next[a.pair]!.reason = "manual";
    next[b.pair]!.reason = "manual";
    setBoard(next);
    setSwaps((s) => [...s, `Troca manual: ${x.name} ↔ ${y.name}`]);
  }

  function tap(ref: SlotRef) {
    if (!picked) return setPicked(ref);
    swap(picked, ref);
    setPicked(null);
  }

  function publish() {
    if (!preview) return;
    setError(null);
    start(async () => {
      try {
        await publishPairs(eventId, {
          pairs: board.map((p) => ({ leftId: p.left.id, rightId: p.right.id, reason: p.reason })),
          log: [...preview.log, ...swaps],
          warnings: preview.warnings,
        });
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  const chip = (person: Person, ref: SlotRef) => {
    const key = `${ref.pair}-${ref.side}`;
    const isPicked = picked?.pair === ref.pair && picked.side === ref.side;
    return (
      <button
        type="button"
        draggable
        onDragStart={(e) => { setDragging(ref); e.dataTransfer.effectAllowed = "move"; }}
        onDragEnd={() => { setDragging(null); setOver(null); }}
        onDragOver={(e) => { e.preventDefault(); setOver(key); }}
        onDragLeave={() => setOver((o) => (o === key ? null : o))}
        onDrop={(e) => { e.preventDefault(); if (dragging) swap(dragging, ref); setDragging(null); setOver(null); }}
        onClick={() => tap(ref)}
        className={`flex min-w-0 flex-1 cursor-grab items-center gap-2 rounded-2xl border px-2 py-2 text-left text-sm transition active:cursor-grabbing ${
          isPicked ? "border-accent bg-accent/20" : over === key ? "border-accent bg-accent/10" : "border-line bg-card-2 hover:border-accent/50"}`}>
        <Avatar name={person.name} path={person.path} size={30} />
        <span className="min-w-0 flex-1 truncate font-medium">{person.name}</span>
        <span className="text-[10px] text-muted">{ref.side === "left" ? "E" : "D"}</span>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <button className={btnGhost} disabled={pending} onClick={load}>
        {pending && !board.length ? "A calcular…" : preview ? "Refazer sorteio" : "Sortear duplas"}
      </button>
      {preview?.error && <p className="text-sm text-danger">{preview.error}</p>}

      {preview && !preview.error && board.length > 0 && (
        <div>
          <p className="mb-3 text-sm text-muted">
            Arrasta um jogador para cima de outro para os trocar (no telemóvel: toca num e depois no outro). Só fica publicado quando confirmares.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {board.map((p, i) => (
              <div key={i} className={`rounded-3xl border p-2.5 ${p.reason === "manual" ? "border-accent/50 bg-accent/5" : "border-line bg-card"}`}>
                <div className="mb-1.5 flex items-center justify-between px-1">
                  <span className="display-num text-sm text-muted">Dupla {i + 1}</span>
                  <span className={`text-[10px] uppercase tracking-wider ${p.reason === "manual" ? "text-accent" : "text-muted"}`}>{REASON[p.reason] ?? p.reason}</span>
                </div>
                <div className="flex gap-1.5">
                  {chip(p.left, { pair: i, side: "left" })}
                  {chip(p.right, { pair: i, side: "right" })}
                </div>
              </div>
            ))}
          </div>

          {preview.warnings.map((w) => <p key={w} className="mt-3 text-sm">⚠︎ {w}</p>)}
          {swaps.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs text-accent">{swaps.map((s, i) => <li key={i}>↔ {s.replace("Troca manual: ", "")}</li>)}</ul>
          )}
          <details className="mt-3 text-sm text-muted"><summary>Explicação do sorteio</summary>
            <ul className="mt-2 list-disc pl-5">{preview.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </details>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}
          <button className={`${btn} mt-4 w-full`} disabled={pending} onClick={publish}>
            {pending ? "A publicar…" : "Confirmar duplas e criar jogos"}
          </button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState, useTransition } from "react";
import { btn, btnGhost, Card } from "@/components/ui";
import { previewPairs, publishPairs } from "../../../actions";
import { PairAvatars } from "@/components/Avatar";

type Preview = Awaited<ReturnType<typeof previewPairs>>;

export function PairingPanel({ eventId }: { eventId: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <button className={btnGhost} disabled={pending} onClick={() => start(async () => setPreview(await previewPairs(eventId)))}>
        {pending ? "A calcular…" : preview ? "Recalcular" : "Pré-visualizar duplas"}
      </button>
      {preview?.error && <p className="text-sm text-danger">{preview.error}</p>}
      {preview && !preview.error && (
        <Card>
          <ol className="space-y-1.5">
            {preview.pairs.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2">
                  <PairAvatars a={{ name: p.left, path: p.leftPath }} b={{ name: p.right, path: p.rightPath }} size={26} />
                  {p.left} / {p.right}
                </span>
                <span className="text-xs text-muted">{p.reason}</span>
              </li>
            ))}
          </ol>
          {preview.warnings.map((w) => <p key={w} className="mt-3 text-sm">⚠︎ {w}</p>)}
          <details className="mt-3 text-sm text-muted"><summary>Explicação</summary>
            <ul className="mt-2 list-disc pl-5">{preview.log.map((l, i) => <li key={i}>{l}</li>)}</ul>
          </details>
          <p className="mt-3 text-xs text-muted">Os sorteios (lados, primeiro encontro) voltam a correr ao publicar.</p>
          <button className={`${btn} mt-3 w-full`} disabled={pending}
            onClick={() => start(async () => { await publishPairs(eventId); })}>
            Publicar duplas e jogos
          </button>
        </Card>
      )}
    </div>
  );
}

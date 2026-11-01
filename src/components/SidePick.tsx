"use client";

/** Left / right segmented choice (mandatory: nothing selected until the player picks). */
export function SidePick({ value, onChange, disabled }: {
  value: "L" | "R" | null; onChange: (s: "L" | "R") => void; disabled?: boolean;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">De que lado jogas?</p>
      <div className="grid grid-cols-2 gap-2">
        {(["L", "R"] as const).map((s) => (
          <button key={s} type="button" disabled={disabled} onClick={() => onChange(s)}
            className={`rounded-2xl border py-3.5 text-sm font-semibold transition active:scale-[0.97] ${
              value === s ? "border-fg bg-fg text-bg" : "border-line bg-card text-muted hover:border-accent/50"}`}>
            {s === "L" ? "Esquerda" : "Direita"}
          </button>
        ))}
      </div>
    </div>
  );
}

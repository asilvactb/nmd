"use client";
import { useOptimistic, useState, useTransition } from "react";
import { addFinos, removeFino } from "@/app/actions";
import { CountUp } from "./CountUp";

/** Global finos total; each player taps +1 for their own fino and −1 to undo their last one. */
export function FinoPlus({ total, mine, variant = "card" }: {
  total: number; mine: number; variant?: "card" | "hero";
}) {
  const [state, change] = useOptimistic({ total, mine }, (s, n: number) => ({ total: s.total + n, mine: s.mine + n }));
  const [, start] = useTransition();
  const [bump, setBump] = useState(0);
  const [first, setFirst] = useState(true);

  function apply(n: 1 | -1) {
    if (n === -1 && state.mine <= 0) return;
    setFirst(false);
    setBump((b) => b + 1);
    navigator.vibrate?.(n === 1 ? 15 : [10, 40, 10]);
    start(async () => {
      change(n);
      await (n === 1 ? addFinos() : removeFino());
    });
  }

  const hero = variant === "hero";
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <span key={bump} className={`display-num block leading-none ${hero ? "text-[88px]" : "text-6xl"} ${first ? "" : "pop"}`}>
          {first ? <CountUp value={state.total} /> : state.total.toLocaleString("pt-PT")}
        </span>
        <span className="mt-2 block text-sm font-semibold opacity-80">
          {(state.total * 0.2).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} litros · {state.mine} teus
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => apply(-1)} disabled={state.mine <= 0} aria-label="Retirar o meu último fino"
          className={`flex h-11 w-11 items-center justify-center rounded-full text-lg font-semibold transition active:scale-90 disabled:opacity-30 ${
            "border border-white/15 bg-white/5 text-fg"}`}>
          −1
        </button>
        <button onClick={() => apply(1)} aria-label="Mais um fino"
          className={`display flex shrink-0 items-center justify-center rounded-full bg-fg text-xl text-bg shadow-[0_0_40px_rgb(91_140_255_/_0.45)] transition hover:scale-105 active:scale-90 ${
            hero ? "h-[84px] w-[84px]" : "h-16 w-16"}`}>
          +1
        </button>
      </div>
    </div>
  );
}

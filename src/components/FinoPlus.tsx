"use client";
import { useOptimistic, useState, useTransition } from "react";
import { addFinos } from "@/app/actions";
import { CountUp } from "./CountUp";

/** Global finos total with a "+1" that each player taps for their own fino. */
export function FinoPlus({ total, variant = "card" }: { total: number; variant?: "card" | "hero" }) {
  const [count, add] = useOptimistic(total, (c, n: number) => c + n);
  const [, start] = useTransition();
  const [bump, setBump] = useState(0);
  const [first, setFirst] = useState(true);

  function plusOne() {
    setFirst(false);
    setBump((b) => b + 1);
    navigator.vibrate?.(15);
    start(async () => {
      add(1);
      await addFinos();
    });
  }

  const big = variant === "hero" ? "text-[88px]" : "text-6xl";
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <span key={bump} className={`display-num block leading-none ${big} ${first ? "" : "pop"}`}>
          {first ? <CountUp value={count} /> : count.toLocaleString("pt-PT")}
        </span>
        <span className="mt-2 block text-sm font-semibold opacity-80">
          {(count * 0.2).toLocaleString("pt-PT", { maximumFractionDigits: 1 })} litros
        </span>
      </div>
      <button onClick={plusOne} aria-label="Mais um fino"
        className={`display flex shrink-0 items-center justify-center rounded-full text-xl transition active:scale-90 ${
          variant === "hero"
            ? "h-[84px] w-[84px] bg-accent text-accent-ink shadow-[0_0_40px_rgb(214_255_61_/_0.35)]"
            : "h-16 w-16 bg-accent-ink text-accent"}`}>
        +1
      </button>
    </div>
  );
}

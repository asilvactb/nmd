"use client";
import { useEffect, useRef, useState } from "react";

/** Animates a number from 0 to `value` when it first appears. */
export function CountUp({ value, decimals = 0, duration = 900, className = "" }: {
  value: number; decimals?: number; duration?: number; className?: string;
}) {
  const [shown, setShown] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    if (started.current) { setShown(value); return; }
    started.current = true;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      setShown(value * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return (
    <span className={`tabular ${className}`}>
      {shown.toLocaleString("pt-PT", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
    </span>
  );
}

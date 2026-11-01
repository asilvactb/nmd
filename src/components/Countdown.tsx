"use client";
import { useEffect, useState } from "react";

/** Live countdown to an encounter (Sundays start at 08:00 by default). */
export function Countdown({ date, hour = 8 }: { date: string; hour?: number }) {
  const target = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (now === null) return <span className="opacity-0">00</span>;
  const diff = target - now;
  if (diff <= 0) return <span className="flex items-center gap-2"><span className="live-dot" /> É hoje</span>;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff / 3_600_000) % 24);
  const m = Math.floor((diff / 60_000) % 60);
  const s = Math.floor((diff / 1000) % 60);
  const cells = d > 0 ? [[d, "d"], [h, "h"], [m, "m"]] : [[h, "h"], [m, "m"], [s, "s"]];
  return (
    <span className="flex gap-3">
      {cells.map(([v, u]) => (
        <span key={u as string} className="flex items-baseline gap-0.5">
          <span className="display-num text-3xl">{String(v).padStart(2, "0")}</span>
          <span className="text-xs text-muted">{u}</span>
        </span>
      ))}
    </span>
  );
}

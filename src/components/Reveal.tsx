"use client";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/** Fades content in when it scrolls into view. */
export function Reveal({ children, className = "", i = 0 }: { children: ReactNode; className?: string; i?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) { el.classList.add("in"); io.disconnect(); }
    }, { rootMargin: "0px 0px -8% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} className={`reveal ${className}`} style={{ "--i": i } as CSSProperties}>{children}</div>;
}

"use client";
import { useState, type ReactNode } from "react";

/** Sticky segmented control; panels are rendered on the server and passed in. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 py-3 backdrop-blur-xl" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <div className="flex rounded-full border border-line bg-card p-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setActive(t.id)}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition ${active === t.id ? "bg-fg text-bg" : "text-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.id} hidden={active !== t.id}>{t.content}</div>
      ))}
    </div>
  );
}

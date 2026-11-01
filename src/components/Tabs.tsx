"use client";
import { useState, type ReactNode } from "react";

/**
 * Phone: sticky segmented control showing one panel at a time.
 * Desktop: every panel side by side, each with its own heading.
 */
export function Tabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  return (
    <div>
      <div className="sticky top-0 z-20 -mx-4 bg-bg/90 px-4 py-3 backdrop-blur-xl lg:hidden" style={{ paddingTop: "calc(env(safe-area-inset-top) + 12px)" }}>
        <div className="flex rounded-full border border-line bg-card p-1">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setActive(t.id)}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition ${active === t.id ? "bg-fg text-bg" : "text-muted"}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="lg:mt-8">
        {tabs.map((t, i) => i === 0 && (
          <div key={t.id} className={`${active === t.id ? "block" : "hidden"} lg:block`}>
            <h2 className="display mb-1 hidden text-2xl lg:block">{t.label}</h2>
            {t.content}
          </div>
        ))}
        <div className={`lg:mt-12 lg:grid lg:items-start lg:gap-8 ${tabs.length > 2 ? "lg:grid-cols-2" : ""}`}>
          {tabs.slice(1).map((t) => (
            <div key={t.id} className={`${active === t.id ? "block" : "hidden"} lg:block`}>
              <h2 className="display mb-1 hidden text-2xl lg:block">{t.label}</h2>
              {t.content}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

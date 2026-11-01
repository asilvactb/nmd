"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SidePick } from "@/components/SidePick";

/** The player's side, editable from their account. */
export function SideSetting() {
  const [side, setSide] = useState<"L" | "R" | null>(null);
  const [confirmed, setConfirmed] = useState(true);
  const [state, setState] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data } = await supabase.from("players").select("side, side_confirmed").eq("user_id", user.id).maybeSingle();
      if (data) { setSide(data.side_confirmed ? data.side : null); setConfirmed(data.side_confirmed); }
    });
  }, []);

  async function change(s: "L" | "R") {
    setSide(s);
    setState("A guardar…");
    const { error } = await createClient().rpc("set_my_side", { new_side: s });
    setState(error ? "Não foi possível guardar." : "Guardado.");
    if (!error) setConfirmed(true);
  }

  return (
    <div>
      {!confirmed && <p className="mb-3 rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 text-sm">Confirma de que lado jogas — é usado no sorteio e no ranking.</p>}
      <SidePick value={side} onChange={change} />
      {state && <p className="mt-2 text-xs text-muted">{state}</p>}
    </div>
  );
}

"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Re-render the page whenever a result changes, for everyone watching. */
export function LiveRefresh({ eventId }: { eventId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`matches-${eventId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `event_id=eq.${eventId}` },
        () => router.refresh())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [eventId, router]);
  return null;
}

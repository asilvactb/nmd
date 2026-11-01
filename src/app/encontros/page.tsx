import Link from "next/link";
import { Card, Page } from "@/components/ui";
import { formatDate, getMe, type EventRow } from "@/lib/db";

const STATUS: Record<EventRow["status"], string> = {
  registration: "Inscrições abertas",
  pairs_published: "Duplas publicadas",
  live: "A decorrer",
  finished: "Terminado",
};

export default async function EncontrosPage() {
  const { supabase } = await getMe();
  const { data } = await supabase.from("events").select("*").order("date", { ascending: false }).limit(40);
  return (
    <Page title="Encontros">
      <div className="flex flex-col gap-2">
        {((data ?? []) as EventRow[]).map((e) => (
          <Link key={e.id} href={`/encontros/${e.id}`}>
            <Card className="flex items-center justify-between">
              <span className="font-medium capitalize">{formatDate(e.date)}</span>
              <span className={`text-sm ${e.status === "live" ? "font-medium" : "text-muted"}`}>
                {e.status === "live" && "● "}{STATUS[e.status]}
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </Page>
  );
}

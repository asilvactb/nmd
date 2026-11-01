"use client";
import { useMemo, useState, useTransition } from "react";
import { Avatar } from "@/components/Avatar";
import { adminQuickPlayer, adminSetSide } from "../../../actions";

type P = { id: string; name: string; side: "L" | "R"; avatar_path: string | null; is_wild_card: boolean };
type Side = "L" | "R";
const VALID = [8, 12, 16, 20, 24];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\(wc\)/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Admin picks who plays this Sunday (registrations come from WhatsApp):
 * tap a card to add the player on their usual side, tap a chip to swap sides,
 * paste the WhatsApp list to add everyone at once, or "+" for a new player / wild card.
 */
export function SidePicker({ eventId, players: initialPlayers, initial }: {
  eventId: string; players: P[]; initial: Record<string, Side>;
}) {
  const [players, setPlayers] = useState(initialPlayers);
  const [sel, setSel] = useState(initial);
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSide, setNewSide] = useState<Side>("L");
  const [newWc, setNewWc] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();

  function put(id: string, side: Side | null) {
    setSel((s) => {
      const c = { ...s };
      if (side) c[id] = side; else delete c[id];
      return c;
    });
    start(() => adminSetSide(eventId, id, side));
  }

  // Match pasted WhatsApp lines ("1. Moura", "- Zé Vieira 🎾") to players
  function addFromPaste() {
    const index = new Map<string, P[]>();
    const push = (k: string, p: P) => index.set(k, [...(index.get(k) ?? []), p]);
    for (const p of players) {
      push(norm(p.name), p);
      const first = norm(p.name).split(" ")[0]!;
      if (first !== norm(p.name)) push(first, p);
    }
    const missed: string[] = [];
    for (const raw of paste.split(/\n|,/)) {
      const line = norm(raw.replace(/^\s*(\d+[.)-]?|[-•*])\s*/, ""));
      if (!line) continue;
      const hit = index.get(line);
      if (hit?.length === 1) {
        if (!sel[hit[0]!.id]) put(hit[0]!.id, hit[0]!.side);
      } else missed.push(raw.trim());
    }
    setUnmatched(missed);
    setPaste("");
    if (!missed.length) setPasteOpen(false);
  }

  function createPlayer() {
    if (!newName.trim()) return;
    start(async () => {
      const r = await adminQuickPlayer(eventId, newName, newSide, newWc);
      if (r.error || !r.player) return setMsg(r.error);
      setPlayers((ps) => [...ps, r.player!]);
      setSel((s) => ({ ...s, [r.player!.id]: newSide }));
      setUnmatched((u) => u.filter((x) => norm(x) !== norm(newName)));
      setNewName(""); setAdding(false); setMsg(null);
    });
  }

  const lefts = players.filter((p) => sel[p.id] === "L");
  const rights = players.filter((p) => sel[p.id] === "R");
  const total = lefts.length + rights.length;
  const balanced = lefts.length === rights.length;
  const valid = VALID.includes(total);
  const shown = useMemo(
    () => players.filter((p) => !sel[p.id] && norm(p.name).includes(norm(q))).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    [players, sel, q],
  );

  const column = (title: string, ps: P[]) => (
    <div className="min-h-[132px] rounded-3xl border border-line bg-card p-3">
      <p className="eyebrow mb-2 flex justify-between"><span>{title}</span><span className="display-num text-lg text-fg">{ps.length}</span></p>
      <div className="flex flex-col gap-1">
        {ps.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-card-2 py-0.5 pl-0.5 pr-1">
            <button onClick={() => put(p.id, sel[p.id] === "L" ? "R" : "L")} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs" title="Trocar de lado">
              <Avatar name={p.name} path={p.avatar_path} size={24} />
              <span className="truncate">{p.name}</span>
              <span className="text-muted">⇄</span>
            </button>
            <button onClick={() => put(p.id, null)} className="px-1.5 text-muted" aria-label={`Tirar ${p.name}`}>✕</button>
          </div>
        ))}
        {!ps.length && <p className="py-6 text-center text-xs text-muted">Toca nos cartões em baixo</p>}
      </div>
    </div>
  );

  return (
    <div className="lg:grid lg:grid-cols-[380px_1fr] lg:items-start lg:gap-6">
      <div className="lg:sticky lg:top-6">
      <div className="grid grid-cols-2 gap-2">
        {column("Esquerda", lefts)}
        {column("Direita", rights)}
      </div>
      <p className={`mt-2 text-center text-sm ${total && balanced && valid ? "text-accent" : "text-muted"}`}>
        {total} jogadores · {Math.floor(total / 2)} duplas
        {!balanced && ` · ${Math.abs(lefts.length - rights.length)} a mais na ${lefts.length > rights.length ? "esquerda" : "direita"} (toca para trocar)`}
        {balanced && !valid && total > 0 && " · precisa de 8, 12, 16, 20 ou 24"}
      </p>

      {/* Paste from WhatsApp */}
      <div className="mt-4 rounded-3xl border border-line bg-card p-3">
        <button onClick={() => setPasteOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-medium">
          <span>📋 Colar lista do WhatsApp</span><span className="text-muted">{pasteOpen ? "−" : "+"}</span>
        </button>
        {pasteOpen && (
          <div className="mt-3">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6}
              placeholder={"1. Moura\n2. Zé Vieira\n3. Caniço…"}
              className="w-full rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button onClick={addFromPaste} disabled={!paste.trim()}
              className="mt-2 w-full rounded-full bg-fg py-3 text-sm font-semibold text-bg disabled:opacity-40">
              Adicionar todos
            </button>
          </div>
        )}
        {!!unmatched.length && (
          <div className="mt-3 text-sm">
            <p className="text-muted">Não encontrei (toca para criar):</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {unmatched.map((u) => (
                <button key={u} onClick={() => { setNewName(u); setAdding(true); }}
                  className="rounded-full border border-dashed border-line px-3 py-1 text-xs">+ {u}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      </div>
      <div>
      {/* Everyone as cards */}
      <input className="mt-4 w-full rounded-2xl border border-line bg-card px-4 py-3 text-base outline-none focus:border-accent"
        placeholder="Procurar…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <button onClick={() => setAdding(true)}
          className="flex aspect-[4/5] flex-col items-center justify-center gap-1.5 rounded-3xl border border-dashed border-accent/60 text-accent active:scale-95">
          <span className="display text-3xl">+</span>
          <span className="text-xs font-medium">Novo / WC</span>
        </button>
        {shown.map((p) => (
          <button key={p.id} onClick={() => put(p.id, p.side)}
            className="lift flex aspect-[4/5] flex-col items-center justify-center gap-2 rounded-3xl border border-line bg-card px-1.5 active:scale-95 active:border-accent">
            <Avatar name={p.name} path={p.avatar_path} size={48} />
            <span className="w-full truncate text-center text-xs font-medium">{p.name}</span>
            <span className="text-[10px] uppercase tracking-wider text-muted">{p.is_wild_card ? "wc · " : ""}{p.side === "L" ? "esq" : "dir"}</span>
          </button>
        ))}
      </div>

      </div>
      {/* New player / wild card */}
      {adding && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center" onClick={() => setAdding(false)}>
          <div className="w-full rounded-t-[28px] border-t border-line bg-card p-5 pb-[calc(env(safe-area-inset-bottom)+20px)] lg:max-w-md lg:rounded-[28px] lg:border" onClick={(e) => e.stopPropagation()}>
            <p className="display text-2xl">Novo jogador</p>
            <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome"
              className="mt-4 w-full rounded-2xl border border-line bg-bg px-4 py-3.5 text-base outline-none focus:border-accent" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {(["L", "R"] as const).map((s) => (
                <button key={s} onClick={() => setNewSide(s)}
                  className={`rounded-full py-3 text-sm font-semibold ${newSide === s ? "bg-fg text-bg" : "border border-line text-muted"}`}>
                  {s === "L" ? "Esquerda" : "Direita"}
                </button>
              ))}
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={newWc} onChange={(e) => setNewWc(e.target.checked)} /> Wild card (convidado)</label>
            {msg && <p className="mt-2 text-sm text-danger">{msg}</p>}
            <button onClick={createPlayer} disabled={!newName.trim()}
              className="mt-4 w-full rounded-full bg-fg py-3.5 font-semibold text-bg disabled:opacity-40">Adicionar ao domingo</button>
          </div>
        </div>
      )}
    </div>
  );
}

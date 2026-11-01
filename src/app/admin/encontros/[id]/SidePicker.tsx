"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { matchPlayer, parseList } from "@/lib/whatsapp-list";
import { Avatar } from "@/components/Avatar";
import { adminDrawSides, adminImportList, adminQuickPlayer, adminSetSide } from "../../../actions";

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
export function SidePicker({ eventId, players: initialPlayers, initial, points, initialNote, target }: {
  eventId: string; players: P[]; initial: Record<string, Side>;
  /** Season ranking points, to order each column like the ranking */
  points: Record<string, number>;
  initialNote?: string | null;
  /** Players expected this Sunday (from the encounter settings) */
  target?: number | null;
}) {
  const [drawn, setDrawn] = useState<Set<string>>(new Set());
  const [drawNote, setDrawNote] = useState<string | null>(initialNote ?? null);
  const [drawing, setDrawing] = useState(false);
  const [players, setPlayers] = useState(initialPlayers);
  const [sel, setSel] = useState(initial);
  const [q, setQ] = useState("");
  const [paste, setPaste] = useState("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [unmatched, setUnmatched] = useState<{ text: string; wc: boolean; options: P[] }[]>([]);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const router = useRouter();
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

  // WhatsApp list: "🎾 Moura🏆/Christophe🏆🤡", "🎾 T. Lourenço", "🎾 Figueiredo (wc)"
  function addFromPaste() {
    const lines = parseList(paste);
    const entries: { playerId: string; side: Side; joker: boolean }[] = [];
    const fixedPairs: { a: string; b: string; reason: "winners" | "bombos" }[] = [];
    const missed: { text: string; wc: boolean; options: P[] }[] = [];
    for (const line of lines) {
      const ids: (string | null)[] = [];
      for (const n of line.names) {
        const m = matchPlayer(n.text, players);
        if (m && "player" in m) {
          ids.push(m.player.id);
          if (!entries.some((e) => e.playerId === m.player.id)) entries.push({ playerId: m.player.id, side: sel[m.player.id] ?? m.player.side, joker: n.joker });
        } else {
          ids.push(null);
          missed.push({ text: n.text, wc: n.wildCard, options: m && "ambiguous" in m ? m.ambiguous : [] });
        }
      }
      if (line.reason && ids[0] && ids[1]) fixedPairs.push({ a: ids[0], b: ids[1], reason: line.reason });
    }
    setUnmatched(missed);
    setPaste("");
    if (!missed.length) setPasteOpen(false);
    if (!entries.length) return;
    start(async () => {
      const r = await adminImportList(eventId, entries, fixedPairs);
      if (r.error) return setMsg(r.error);
      setSel((s) => ({ ...s, ...r.sides }));
      const parts = [`${entries.length} jogadores adicionados`];
      if (fixedPairs.length) parts.push(`${fixedPairs.length} dupla${fixedPairs.length > 1 ? "s" : ""} fixa${fixedPairs.length > 1 ? "s" : ""}`);
      const jokers = entries.filter((e) => e.joker).length - r.notes.length;
      if (jokers > 0) parts.push(`${jokers} Joker 🤡`);
      setPasteNote([parts.join(" · "), ...r.notes].join(". "));
      router.refresh();
    });
  }

  function pickOption(u: { text: string }, p: P) {
    put(p.id, p.side);
    setUnmatched((list) => list.filter((x) => x !== u));
  }

  function createPlayer() {
    if (!newName.trim()) return;
    start(async () => {
      const r = await adminQuickPlayer(eventId, newName, newSide, newWc);
      if (r.error || !r.player) return setMsg(r.error);
      setPlayers((ps) => [...ps, r.player!]);
      setSel((s) => ({ ...s, [r.player!.id]: newSide }));
      setUnmatched((u) => u.filter((x) => norm(x.text) !== norm(newName)));
      setNewName(""); setAdding(false); setMsg(null);
    });
  }

  // Columns follow the ranking order (best first)
  const byRank = (a: P, b: P) => (points[b.id] ?? 0) - (points[a.id] ?? 0) || a.name.localeCompare(b.name, "pt");
  const lefts = players.filter((p) => sel[p.id] === "L").sort(byRank);
  const rights = players.filter((p) => sel[p.id] === "R").sort(byRank);
  const extra = Math.abs(lefts.length - rights.length);
  const bigSide = lefts.length > rights.length ? "esquerda" : "direita";
  const otherSide = lefts.length > rights.length ? "direita" : "esquerda";

  function drawSides() {
    setDrawing(true);
    setMsg(null);
    start(async () => {
      const r = await adminDrawSides(eventId);
      if (r.error) { setMsg(r.error); setDrawing(false); return; }
      // Let the dice roll for a moment before revealing
      await new Promise((ok) => setTimeout(ok, 900));
      setSel((s) => {
        const c = { ...s };
        for (const m of r.moved) c[m.id] = r.to!;
        return c;
      });
      setDrawn(new Set(r.moved.map((m) => m.id)));
      setDrawNote(r.note ?? null);
      setDrawing(false);
    });
  }
  const total = lefts.length + rights.length;
  const balanced = lefts.length === rights.length;
  const valid = VALID.includes(total);
  const shown = useMemo(
    () => players.filter((p) => !sel[p.id] && norm(p.name).includes(norm(q))).sort((a, b) => a.name.localeCompare(b.name, "pt")),
    [players, sel, q],
  );

  const rankOf = (id: string) => {
    const sorted = Object.entries(points).sort((a, b) => b[1] - a[1]);
    const i = sorted.findIndex(([k]) => k === id);
    return i >= 0 ? sorted.findIndex(([, v]) => v === sorted[i]![1]) + 1 : null;
  };
  const column = (title: string, ps: P[]) => (
    <div className="min-h-[132px] rounded-3xl border border-line bg-card p-3">
      <p className="eyebrow mb-2 flex justify-between"><span>{title}</span><span className="display-num text-lg text-fg">{ps.length}</span></p>
      <div className="flex flex-col gap-1">
        {ps.map((p) => (
          <div key={p.id} className="flex items-center gap-1.5 rounded-full bg-card-2 py-0.5 pl-0.5 pr-1">
            <button onClick={() => put(p.id, sel[p.id] === "L" ? "R" : "L")} className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-xs" title="Trocar de lado">
              <span className="w-5 shrink-0 text-center text-[10px] text-muted tabular">{rankOf(p.id) ?? "–"}</span>
              <Avatar name={p.name} path={p.avatar_path} size={24} />
              <span className="truncate">{p.name}</span>
              {drawn.has(p.id) && <span className="pop rounded-full bg-accent px-1.5 text-[9px] font-semibold text-white">🎲</span>}
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
      {target ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-card-2">
            <div className={`h-full rounded-full transition-all ${total === target ? "bg-accent" : "bg-fg/60"}`} style={{ width: `${Math.min(100, (total / target) * 100)}%` }} />
          </div>
          <p className="mt-1.5 text-center text-xs text-muted">
            {total}/{target} jogadores{total < target ? ` · faltam ${target - total}` : total > target ? ` · ${total - target} a mais` : " ✓"}
          </p>
        </div>
      ) : null}
      <p className={`mt-2 text-center text-sm ${total && balanced && valid ? "text-accent" : "text-muted"}`}>
        {lefts.length} E · {rights.length} D · {total} jogadores
        {balanced && valid && ` · ${total / 2} duplas ✓`}
        {balanced && !valid && total > 0 && " · precisa de 8, 12, 16, 20 ou 24"}
      </p>

      {!balanced && total > 0 && (
        <div className="mt-3 rounded-3xl border border-accent/40 bg-accent/10 p-4">
          {extra % 2 === 0 ? (
            <>
              <p className="text-sm">
                <b>{lefts.length}–{rights.length}</b>: há <b>{extra}</b> a mais na {bigSide}.
                Sorteia-se <b>{extra / 2}</b> {bigSide === "direita" ? (extra / 2 > 1 ? "direitas" : "direita") : (extra / 2 > 1 ? "esquerdas" : "esquerda")} para jogar{extra / 2 > 1 ? "em" : ""} na {otherSide}.
              </p>
              <button onClick={drawSides} disabled={drawing}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-fg py-3 text-sm font-semibold text-bg transition active:scale-[0.97] disabled:opacity-60">
                <span className={drawing ? "inline-block animate-spin" : ""}>🎲</span>
                {drawing ? "A sortear…" : `Sortear ${extra / 2} para a ${otherSide}`}
              </button>
            </>
          ) : (
            <p className="text-sm">{lefts.length}–{rights.length}: número ímpar de jogadores. Falta um jogador (ou wild card) para fechar as duplas.</p>
          )}
        </div>
      )}
      {drawNote && (
        <p className="mt-3 rounded-2xl border border-line bg-card px-4 py-3 text-xs text-muted">🎲 {drawNote}</p>
      )}
      {msg && <p className="mt-2 text-center text-sm text-danger">{msg}</p>}

      {/* Paste from WhatsApp */}
      <div className="mt-4 rounded-3xl border border-line bg-card p-3">
        <button onClick={() => setPasteOpen((o) => !o)} className="flex w-full items-center justify-between text-sm font-medium">
          <span>📋 Colar lista do WhatsApp</span><span className="text-muted">{pasteOpen ? "−" : "+"}</span>
        </button>
        {pasteOpen && (
          <div className="mt-3">
            <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6}
              placeholder={"🎾 Moura🏆/Christophe🏆🤡\n🎾 Taipas🥁\n🎾 T. Lourenço\n🎾 Figueiredo (wc)…"}
              className="w-full rounded-2xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-accent" />
            <button onClick={addFromPaste} disabled={!paste.trim()}
              className="mt-2 w-full rounded-full bg-fg py-3 text-sm font-semibold text-bg disabled:opacity-40">
              Adicionar todos
            </button>
          </div>
        )}
        {pasteNote && <p className="mt-3 text-sm text-accent">✓ {pasteNote}</p>}
        {!!unmatched.length && (
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <p className="text-muted">Não consegui identificar:</p>
            {unmatched.map((u) => (
              <div key={u.text} className="flex flex-wrap items-center gap-1.5">
                {u.options.length ? (
                  <>
                    <span className="text-xs">{u.text} é</span>
                    {u.options.map((p) => (
                      <button key={p.id} onClick={() => pickOption(u, p)} className="rounded-full border border-line bg-card-2 px-3 py-1 text-xs">{p.name}</button>
                    ))}
                  </>
                ) : (
                  <button onClick={() => { setNewName(u.text); setNewWc(u.wc); setAdding(true); }}
                    className="rounded-full border border-dashed border-line px-3 py-1 text-xs">+ Criar {u.text}{u.wc ? " (WC)" : ""}</button>
                )}
              </div>
            ))}
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

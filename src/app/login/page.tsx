"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { btn, input } from "@/components/ui";
import { PhotoPicker } from "@/components/PhotoPicker";
import { SidePick } from "@/components/SidePick";
import { squareJpeg } from "@/lib/image";

const NEW = "__new__";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [players, setPlayers] = useState<{ id: string; name: string }[]>([]);
  const [playerId, setPlayerId] = useState("");
  const [newName, setNewName] = useState("");
  const [newSide, setNewSide] = useState<"L" | "R" | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "signup" && !players.length) {
      createClient().rpc("unclaimed_players").then(({ data }) => setPlayers(data ?? []));
    }
  }, [mode, players.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const cleanEmail = email.trim().toLowerCase();

    if (mode === "signup" && !photo) {
      setBusy(false);
      return setError("Escolhe uma foto tua.");
    }
    if (mode === "signup" && !newSide) {
      setBusy(false);
      return setError("Escolhe de que lado jogas.");
    }
    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
      setBusy(false);
      if (error) return setError("Email ou password errados.");
    } else {
      let userId: string | undefined;
      const { data, error } = await supabase.auth.signUp({ email: cleanEmail, password });
      if (error?.message.toLowerCase().includes("registered")) {
        // Account exists from an unfinished sign-up: same email + password resumes it
        const { data: signIn, error: signInError } =
          await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (signInError) {
          setBusy(false);
          return setError("Esse email já tem conta. Usa Entrar com a tua password.");
        }
        userId = signIn.user.id;
      } else if (error || !data.user) {
        setBusy(false);
        return setError("Não foi possível criar a conta.");
      } else {
        userId = data.user.id;
      }
      const avatarPath = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upError } = await supabase.storage
        .from("avatars").upload(avatarPath, photo!, { contentType: "image/jpeg" });
      if (upError) {
        setBusy(false);
        return setError("A foto não foi enviada. Tenta outra vez.");
      }
      const isNew = playerId === NEW;
      const { error: reqError } = await supabase.from("signup_requests").upsert({
        user_id: userId,
        email: cleanEmail,
        player_id: isNew ? null : playerId,
        new_name: isNew ? newName.trim() : null,
        new_side: newSide,
        avatar_path: avatarPath,
      });
      setBusy(false);
      if (reqError) return setError("Conta criada, mas o pedido de validação falhou. Fala com um admin.");
      await supabase.rpc("claim_by_email");
    }
    router.replace("/");
    router.refresh();
  }

  return (
    // Phone: single column. Desktop: brand panel on the left, form on the right (full screen, no nav rail)
    <main className="relative min-h-[100dvh] overflow-hidden lg:fixed lg:inset-0 lg:grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:overflow-y-auto">
      {/* Brand panel (desktop) */}
      <section className="court relative hidden overflow-hidden border-r border-line bg-card lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div className="aurora !opacity-60" />
        <Logo className="rise relative w-32" />
        <div className="relative">
          <p className="rise eyebrow !text-accent" style={{ "--i": 1 } as React.CSSProperties}>Padel ao domingo · Braga</p>
          <h1 className="rise display mt-5 text-[clamp(56px,6.2vw,104px)]" style={{ "--i": 2 } as React.CSSProperties}>
            Nunca<br />mais é<br /><span className="text-gradient">domingo.</span>
          </h1>
          <ul className="rise mt-10 flex flex-wrap gap-2 text-sm text-muted" style={{ "--i": 3 } as React.CSSProperties}>
            {["Sorteios", "Jogos ao vivo", "Ranking", "Hall of Fame", "Finos", "Morfes", "Tesouraria"].map((t) => (
              <li key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 backdrop-blur">{t}</li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted">Mesh Padel Center · Braga</p>
        <span aria-hidden className="display outline-type pointer-events-none absolute -bottom-10 -right-6 select-none text-[260px] leading-none">NMD</span>
      </section>

      {/* Form */}
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-center px-6 py-12 lg:max-w-md lg:px-12">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[70%] overflow-hidden [mask-image:linear-gradient(to_bottom,black_40%,transparent)] lg:hidden"><div className="aurora !opacity-70" /></div>
        <div className="court pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(circle_at_50%_30%,black,transparent_70%)] lg:hidden" />
        <Logo className="rise relative mx-auto mb-4 w-44 lg:hidden" />
        <p className="rise eyebrow relative mb-10 text-center lg:hidden" style={{ "--i": 1 } as React.CSSProperties}>Nunca Mais é Domingo</p>
        <div className="relative mb-8 hidden lg:block">
          <h2 className="display text-[40px]">{mode === "login" ? "Bem-vindo" : "Junta-te"}</h2>
          <p className="mt-2 text-sm text-muted">{mode === "login" ? "Entra com o teu email e password." : "Cria a tua conta — um admin valida-a."}</p>
        </div>

      <div className="relative mb-4 grid grid-cols-2 rounded-full border border-line bg-card p-1 text-sm">
        {(["login", "signup"] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); setError(null); }}
            className={`rounded-full py-2.5 font-medium transition ${mode === m ? "bg-fg text-bg" : "text-muted"}`}>
            {m === "login" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="relative flex flex-col gap-3">
        <input className={input} type="email" required autoComplete="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className={input} type="password" required minLength={6} placeholder="Password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password} onChange={(e) => setPassword(e.target.value)} />

        {mode === "signup" && (
          <>
            <PhotoPicker preview={preview} required onPick={async (f) => {
              try {
                const jpg = await squareJpeg(f);
                setPhoto(jpg);
                setPreview(URL.createObjectURL(jpg));
              } catch { setError("Não foi possível ler essa imagem."); }
            }} />
            <select className={input} value={playerId} onChange={(e) => setPlayerId(e.target.value)} required>
              <option value="" disabled>Quem és no NMD?</option>
              {players.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value={NEW}>Sou novo — não estou na lista</option>
            </select>
            {playerId === NEW && (
              <input className={input} placeholder="O teu nome" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            )}
            <SidePick value={newSide} onChange={setNewSide} />
          </>
        )}

        <button className={btn} disabled={busy}>
          {busy ? "Um momento…" : mode === "login" ? "Entrar" : "Criar conta"}
        </button>
      </form>
      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
      {mode === "signup" && (
        <p className="mt-6 text-center text-xs text-muted lg:text-left">A tua conta fica ativa depois de um admin a validar.</p>
      )}
      </div>
    </main>
  );
}

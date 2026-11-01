"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { btn, input } from "@/components/ui";

/**
 * Email + 6-digit code. A code (not a magic link) is needed because on iPhone a link
 * opens Safari, whose session is not shared with the app installed on the home screen.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.signInWithOtp({ email: email.trim().toLowerCase() });
    setBusy(false);
    if (error) setError("Não foi possível enviar o código.");
    else setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await createClient().auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setError("Código inválido ou expirado.");
    else {
      router.replace("/");
      router.refresh();
    }
  }

  return (
    <main className="mx-auto flex min-h-[85dvh] max-w-sm flex-col justify-center px-6">
      <Logo className="mx-auto mb-3 w-40" />
      <p className="mb-10 text-center text-sm text-muted">Nunca Mais é Domingo</p>
      {step === "email" ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <input className={input} type="email" required autoComplete="email" placeholder="o teu email"
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className={btn} disabled={busy}>{busy ? "A enviar…" : "Receber código"}</button>
        </form>
      ) : (
        <form onSubmit={verify} className="flex flex-col gap-3">
          <p className="text-center text-sm">Enviámos um código para <b>{email}</b>.</p>
          <input className={`${input} text-center text-2xl tracking-[0.4em]`} inputMode="numeric"
            autoComplete="one-time-code" maxLength={6} required placeholder="000000"
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
          <button className={btn} disabled={busy || code.length < 6}>{busy ? "A entrar…" : "Entrar"}</button>
          <button type="button" className="text-sm text-muted" onClick={() => setStep("email")}>Mudar email</button>
        </form>
      )}
      {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
      <p className="mt-6 text-center text-xs text-muted">Só os membros registados pela administração têm acesso.</p>
    </main>
  );
}

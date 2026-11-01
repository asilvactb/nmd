"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Page, SectionTitle, btn, input } from "@/components/ui";
import { PhotoPicker } from "@/components/PhotoPicker";
import { squareJpeg } from "@/lib/image";

export default function ContaPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setState("error");
      return setError("As passwords não coincidem.");
    }
    setState("busy");
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setState("error");
      setError("Não foi possível mudar a password.");
    } else setState("done");
  }

  const [photoState, setPhotoState] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  async function changePhoto(file: File) {
    setPhotoState("A enviar…");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      const jpg = await squareJpeg(file);
      const path = `${user!.id}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("avatars").upload(path, jpg, { contentType: "image/jpeg" });
      if (error) throw error;
      await supabase.rpc("set_my_avatar", { path });
      await supabase.from("signup_requests").update({ avatar_path: path }).eq("user_id", user!.id);
      setPreview(URL.createObjectURL(jpg));
      setPhotoState("Foto atualizada.");
    } catch {
      setPhotoState("Não foi possível mudar a foto.");
    }
  }

  return (
    <Page title="A minha conta">
      <PhotoPicker preview={preview} onPick={changePhoto} />
      {photoState && <p className="mt-2 text-center text-sm text-muted">{photoState}</p>}
      <SectionTitle>Mudar password</SectionTitle>
      {state === "done" ? (
        <p>Password alterada.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input className={input} type="password" placeholder="Nova password" minLength={6} required
            autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <input className={input} type="password" placeholder="Repetir password" minLength={6} required
            autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className={btn} disabled={state === "busy"}>Guardar</button>
          {state === "error" && <p className="text-sm text-red-600">{error}</p>}
        </form>
      )}
    </Page>
  );
}

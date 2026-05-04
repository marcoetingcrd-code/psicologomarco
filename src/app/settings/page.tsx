"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Shield, ArrowLeft } from "lucide-react";
import { getBrowserClient } from "../../lib/supabase";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [mlConsent, setMlConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const c = getBrowserClient();
    if (!c) {
      router.replace("/");
      return;
    }
    c.auth.getSession().then(async ({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setEmail(data.session.user.email ?? null);
      // load ml consent
      const { data: settings } = await c
        .from("user_settings")
        .select("ml_consent")
        .eq("user_id", data.session.user.id)
        .single();
      setMlConsent(settings?.ml_consent ?? false);
      setLoading(false);
    });
  }, [router]);

  async function toggleML() {
    const c = getBrowserClient();
    if (!c) return;
    setSaving(true);
    const { data } = await c.auth.getSession();
    if (!data.session) return;
    const newVal = !mlConsent;
    await c
      .from("user_settings")
      .update({
        ml_consent: newVal,
        ml_consent_at: newVal ? new Date().toISOString() : null,
      })
      .eq("user_id", data.session.user.id);
    setMlConsent(newVal);
    setSaving(false);
    setMsg(newVal ? "Contributo aggregato attivato. Grazie." : "Consenso revocato.");
    setTimeout(() => setMsg(null), 3000);
  }

  async function exportData() {
    const c = getBrowserClient();
    if (!c) return;
    const { data } = await c.auth.getSession();
    if (!data.session) return;
    const res = await fetch("/api/account?action=export", {
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (!res.ok) {
      setMsg("Errore nell'export");
      return;
    }
    const json = await res.json();
    const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `atlas-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("Export scaricato.");
    setTimeout(() => setMsg(null), 3000);
  }

  async function deleteAccount() {
    if (!confirm("Sei sicuro? Verranno cancellate TUTTE le tue conversazioni in modo irreversibile.")) return;
    if (!confirm("Ultima conferma: procedo con la cancellazione definitiva?")) return;
    const c = getBrowserClient();
    if (!c) return;
    const { data } = await c.auth.getSession();
    if (!data.session) return;
    const res = await fetch("/api/account", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
    });
    if (res.ok) {
      await c.auth.signOut();
      router.replace("/");
    } else {
      setMsg("Errore nella cancellazione");
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        Caricamento…
      </div>
    );
  }

  return (
    <div className="min-h-screen max-w-2xl mx-auto px-4 py-8 text-zinc-300">
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 mb-6"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Torna alla chat
      </a>

      <h1 className="text-2xl font-semibold text-white mb-1">Impostazioni</h1>
      <p className="text-sm text-zinc-500 mb-8">Account: {email}</p>

      {msg && (
        <div className="mb-6 rounded-xl bg-emerald-900/20 border border-emerald-500/30 p-3 text-sm text-emerald-200">
          {msg}
        </div>
      )}

      <section className="rounded-xl border border-zinc-800 p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-medium text-white mb-1">Contributo aggregato anonimo</h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Permetti ad Atlas di usare il feedback che dai (👍/👎) e il tema delle tue
                domande in forma <strong>anonima e aggregata</strong> per migliorare le
                risposte future. Il contenuto delle tue conversazioni non esce mai dalla tua
                area privata.
              </p>
            </div>
          </div>
          <button
            onClick={toggleML}
            disabled={saving}
            className={`shrink-0 relative w-11 h-6 rounded-full transition-colors ${mlConsent ? "bg-indigo-600" : "bg-zinc-700"}`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${mlConsent ? "translate-x-5" : "translate-x-0.5"}`}
            />
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-800 p-5 mb-4">
        <div className="flex items-start gap-3 mb-4">
          <Download className="w-5 h-5 text-zinc-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-medium text-white mb-1">Esporta i miei dati</h2>
            <p className="text-sm text-zinc-400">
              Scarica tutte le tue conversazioni come JSON (decriptate).
            </p>
          </div>
        </div>
        <button
          onClick={exportData}
          className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"
        >
          Scarica export
        </button>
      </section>

      <section className="rounded-xl border border-red-500/30 bg-red-900/10 p-5">
        <div className="flex items-start gap-3 mb-4">
          <Trash2 className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-medium text-red-300 mb-1">Cancella account</h2>
            <p className="text-sm text-zinc-400">
              Azione irreversibile: elimina il tuo account e TUTTI i dati associati
              (conversazioni, feedback, impostazioni).
            </p>
          </div>
        </div>
        <button
          onClick={deleteAccount}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white"
        >
          Cancella definitivamente
        </button>
      </section>

      <div className="mt-8 text-xs text-zinc-500 text-center space-x-3">
        <a href="/privacy" className="hover:text-zinc-300">Privacy</a>
        <span>·</span>
        <a href="/terms" className="hover:text-zinc-300">Termini</a>
      </div>
    </div>
  );
}

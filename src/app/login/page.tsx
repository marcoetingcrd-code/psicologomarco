"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Brain, Mail } from "lucide-react";
import { getBrowserClient, isSupabaseReady } from "../../lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setReady(isSupabaseReady());
    const c = getBrowserClient();
    if (!c) return;
    c.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router]);

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const c = getBrowserClient();
    if (!c) {
      setErr("Sistema auth non configurato. Contatta l'amministratore.");
      return;
    }
    setLoading(true);
    const { error } = await c.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo:
          typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
      },
    });
    setLoading(false);
    if (error) setErr(error.message);
    else setSent(true);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Atlas</h1>
            <p className="text-xs text-zinc-400">Il tuo spazio privato</p>
          </div>
        </div>

        {!ready && (
          <div className="rounded-xl bg-amber-900/20 border border-amber-500/30 p-4 text-sm text-amber-200">
            Il cloud Atlas non è ancora configurato. Puoi usare l&apos;app senza
            login: la chat sarà salvata solo su questo dispositivo.
            <div className="mt-3">
              <a
                href="/"
                className="inline-block text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700"
              >
                Continua senza login
              </a>
            </div>
          </div>
        )}

        {ready && !sent && (
          <form onSubmit={sendMagicLink} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-2">
                La tua email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@esempio.it"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-medium text-sm flex items-center justify-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {loading ? "Invio in corso…" : "Invia link di accesso"}
            </button>
            {err && <p className="text-sm text-red-400">{err}</p>}
            <p className="text-xs text-zinc-500 text-center">
              Nessuna password. Riceverai un link che ti farà entrare.
              <br />
              Accedendo accetti la{" "}
              <a href="/privacy" className="underline hover:text-zinc-300">
                Privacy Policy
              </a>{" "}
              e i{" "}
              <a href="/terms" className="underline hover:text-zinc-300">
                Termini
              </a>
              .
            </p>
          </form>
        )}

        {ready && sent && (
          <div className="rounded-xl bg-emerald-900/20 border border-emerald-500/30 p-5 text-center">
            <Mail className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
            <h2 className="text-lg font-medium mb-2">Controlla la tua email</h2>
            <p className="text-sm text-zinc-300">
              Ti ho mandato un link a <strong>{email}</strong>. Clicca per
              entrare. Il link scade in un&apos;ora.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

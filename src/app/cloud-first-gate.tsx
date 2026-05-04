"use client";
import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { Cloud, HardDrive, Lock } from "lucide-react";
import { getBrowserClient, isSupabaseReady } from "../lib/supabase";

export default function CloudFirstGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [localMode, setLocalMode] = useState(false);

  useEffect(() => {
    const local = localStorage.getItem("atlas-storage-mode") === "local";
    setLocalMode(local);
    const r = isSupabaseReady();
    setReady(r);
    const c = getBrowserClient();
    if (!r || !c) {
      setChecking(false);
      return;
    }
    c.auth.getSession().then(({ data }) => {
      setLoggedIn(Boolean(data.session));
      setChecking(false);
    });
    const { data: sub } = c.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  function useLocal() {
    localStorage.setItem("atlas-storage-mode", "local");
    setLocalMode(true);
  }

  function useCloud() {
    localStorage.removeItem("atlas-storage-mode");
    window.location.href = "/login";
  }

  if (checking) {
    return <div className="py-10 text-center text-sm text-zinc-500">Controllo accesso cloud…</div>;
  }

  if (loggedIn && !localMode) return <>{children}</>;

  if (localMode) return <>{children}</>;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 my-4">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center shrink-0">
          <Cloud className="w-5 h-5 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-white mb-1">Atlas salva online di default</h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Per non perdere nulla tra telefono e PC, accedi gratis: le conversazioni vengono
            salvate nel tuo spazio cloud cifrato e le ritrovi ovunque.
          </p>
          {!ready && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-900/20 p-3 text-xs text-amber-200">
              Cloud non ancora configurato: serve completare Supabase/Vercel env. Fino ad allora puoi usare solo la modalità locale.
            </div>
          )}
          <div className="mt-5 grid sm:grid-cols-2 gap-3">
            {ready ? (
              <Link
                href="/login"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Accedi e sincronizza
              </Link>
            ) : (
              <button
                onClick={useLocal}
                className="rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <HardDrive className="w-4 h-4" />
                Continua locale
              </button>
            )}
            {ready && (
              <button
                onClick={useLocal}
                className="rounded-xl border border-zinc-700 hover:bg-zinc-900 text-zinc-300 px-4 py-3 text-sm font-medium flex items-center justify-center gap-2"
              >
                <HardDrive className="w-4 h-4" />
                Salva solo in locale
              </button>
            )}
          </div>
          <p className="mt-3 text-[11px] text-zinc-500">
            Locale significa: resta solo su questo dispositivo. Se cambi telefono/PC non lo ritrovi.
          </p>
        </div>
      </div>
    </div>
  );
}

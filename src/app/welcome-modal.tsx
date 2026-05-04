"use client";
import { useEffect, useState } from "react";
import { Shield, Lock, Eye, X } from "lucide-react";

const KEY = "atlas-welcome-seen-v1";

export default function WelcomeModal() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = localStorage.getItem(KEY);
    if (!seen) {
      // piccolo delay per non bloccare il first paint
      const t = setTimeout(() => setOpen(true), 400);
      return () => clearTimeout(t);
    }
  }, []);

  function dismiss() {
    localStorage.setItem(KEY, new Date().toISOString());
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500"
          aria-label="Chiudi"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-indigo-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Le tue parole, al sicuro</h2>
            <p className="text-xs text-zinc-400">Apri liberamente. Nessuno legge al posto tuo.</p>
          </div>
        </div>

        <div className="space-y-4 text-sm text-zinc-300 leading-relaxed">
          <div className="flex gap-3">
            <Lock className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p>
              Le tue conversazioni sono <strong>cifrate</strong> e legate al tuo accesso.
              Senza le tue credenziali sono illeggibili — anche per chi gestisce il sistema.
            </p>
          </div>
          <div className="flex gap-3">
            <Eye className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
            <p>
              Nessun pubblicitario, nessun tracker, nessun occhio indiscreto.
              Atlas è il tuo spazio: parla come parleresti a te stesso, ad alta voce.
            </p>
          </div>
          <div className="flex gap-3">
            <Shield className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
            <p className="text-zinc-400 text-[13px]">
              Puoi esportare o cancellare tutto in qualunque momento dalle{" "}
              <a href="/settings" className="text-indigo-400 hover:text-indigo-300 underline">
                impostazioni
              </a>
              . Trovi i dettagli completi nella{" "}
              <a href="/privacy" className="text-indigo-400 hover:text-indigo-300 underline">
                privacy
              </a>
              .
            </p>
          </div>
        </div>

        <button
          onClick={dismiss}
          className="mt-6 w-full px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 font-medium text-sm text-white"
        >
          Ho capito, parliamo
        </button>
      </div>
    </div>
  );
}

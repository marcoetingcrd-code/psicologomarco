"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, LogOut, Settings, Cloud, CloudOff, Brain, Shield } from "lucide-react";
import { getBrowserClient, isSupabaseReady } from "../lib/supabase";

export default function AuthHeader() {
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setReady(isSupabaseReady());
    const c = getBrowserClient();
    if (!c) return;
    c.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = c.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function logout() {
    const c = getBrowserClient();
    if (!c) return;
    await c.auth.signOut();
    setEmail(null);
  }

  if (!mounted) return null;

  // Cloud non configurato: mostra badge discreto
  if (!ready) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
        <CloudOff className="w-3.5 h-3.5" />
        <span>Solo locale</span>
      </div>
    );
  }

  if (!email) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
      >
        <LogIn className="w-3.5 h-3.5" />
        Accedi
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
        <Cloud className="w-3.5 h-3.5 text-emerald-400" />
        <span className="truncate max-w-[160px]">{email}</span>
      </div>
      <Link
        href="/mind"
        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-indigo-300"
        title="La mente di Atlas (Knowledge Graph)"
      >
        <Brain className="w-3.5 h-3.5" />
      </Link>
      <Link
        href="/sovereign"
        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-rose-300"
        title="Sovereign Contract"
      >
        <Shield className="w-3.5 h-3.5" />
      </Link>
      <Link
        href="/settings"
        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
        title="Impostazioni"
      >
        <Settings className="w-3.5 h-3.5" />
      </Link>
      <button
        onClick={logout}
        className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400"
        title="Esci"
      >
        <LogOut className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

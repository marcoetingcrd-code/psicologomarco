"use client";
import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Zap, Brain } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string; sources?: any[]; cached?: boolean; usedLLM?: boolean };

export default function ChatTab({ sid }: { sid: string }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [load, setLoad] = useState(false);
  const [preds, setPreds] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch(`/api/predict?sessionId=${sid}`).then(r => r.json()).then(d => setPreds(d.predictions ?? [])); }, [sid]);
  useEffect(() => { ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: "smooth" }); }, [msgs]);

  async function send(q?: string) {
    const query = (q ?? input).trim(); if (!query || load) return;
    setInput(""); setMsgs(m => [...m, { role: "user", content: query }]); setLoad(true);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, sessionId: sid }) });
      const d = await r.json();
      setMsgs(m => [...m, { role: "assistant", content: d.answer, sources: d.sources, cached: d.cached, usedLLM: d.usedLLM }]);
      setPreds(d.predictions ?? []);
    } catch (e: unknown) { const err = e instanceof Error ? e.message : String(e); setMsgs(m => [...m, { role: "assistant", content: `Errore: ${err}` }]); }
    finally { setLoad(false); }
  }

  return (
    <>
      <div ref={ref} className="flex-1 overflow-y-auto space-y-4 pb-32 min-h-[60vh]">
        {msgs.length === 0 && <div className="text-center py-16 text-zinc-500"><Sparkles className="w-10 h-10 mx-auto mb-4 text-indigo-400"/><p className="mb-2 text-zinc-300 font-medium">Fai una domanda per iniziare</p><p className="text-xs">Atlas apprende il tuo focus e predice le prossime domande</p></div>}
        {msgs.map((m, i) => <div key={i} className={`rounded-xl p-4 ${m.role === "user" ? "bg-indigo-600/20 border border-indigo-500/30 ml-8" : "bg-zinc-900/80 border border-zinc-800 mr-8"}`}>
          {m.role === "assistant" && <div className="flex items-center gap-2 text-xs text-zinc-400 mb-2"><Brain className="w-3.5 h-3.5" /><span>Atlas</span>
            {m.cached && <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-300"><Zap className="w-3 h-3" />cached</span>}
            {m.usedLLM === false && <span className="px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-300">retrieval-only</span>}
          </div>}
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</div>
          {m.sources && m.sources.length > 0 && <details className="mt-3 text-xs text-zinc-400"><summary className="cursor-pointer hover:text-zinc-200">Fonti ({m.sources.length})</summary>
            <ul className="mt-2 space-y-1">{m.sources.map((s: any, j: number) => <li key={j} className="pl-2 border-l border-zinc-700"><code className="text-indigo-300">[{s.source.id}]</code> {s.source.authors} ({s.source.year}) — <em>{s.source.title}</em>. {s.source.venue}. <span className="text-zinc-500">score: {s.score.toFixed(3)}</span></li>)}</ul>
          </details>}
        </div>)}
        {load && <div className="rounded-xl p-4 bg-zinc-900/80 border border-zinc-800 mr-8"><div className="flex items-center gap-2 text-zinc-400 text-sm"><div className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" /><span>Atlas sta cercando e ragionando…</span></div></div>}
      </div>
      <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black to-transparent pt-6 pb-4 px-4">
        <div className="max-w-4xl mx-auto">
          {preds.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1">{preds.map((p, i) => <button key={i} onClick={() => send(p)} className="shrink-0 text-xs px-3 py-1.5 rounded-full bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700 text-zinc-300"><Sparkles className="w-3 h-3 inline mr-1 text-indigo-400" />{p}</button>)}</div>}
          <form onSubmit={e => { e.preventDefault(); send(); }} className="flex gap-2">
            <input value={input} onChange={e => setInput(e.target.value)} placeholder="Chiedi qualcosa ad Atlas…" className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500" />
            <button type="submit" disabled={load || !input.trim()} className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 font-medium text-sm flex items-center gap-2"><Send className="w-4 h-4" />Invia</button>
          </form>
        </div>
      </div>
    </>
  );
}

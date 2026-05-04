"use client";
import { useState } from "react";
import { ClipboardPaste, Sparkles, Save } from "lucide-react";
import { saveMessage, createConversation } from "../lib/chat-store";

export default function ImportTab({ sid }: { sid: string }) {
  const [text, setText] = useState("");
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [saved, setSaved] = useState(false);

  async function analyze() {
    if (text.trim().length < 300 || loading) return;
    setLoading(true);
    setAnalysis("");
    setSaved(false);
    try {
      const res = await fetch("/api/import-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, goal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore analisi");
      setAnalysis(data.analysis || "");
    } catch (e: any) {
      setAnalysis(`Errore: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function saveAsConversation() {
    if (!analysis) return;
    const convo = await createConversation("Analisi conversazione importata");
    const cid = convo?.id;
    await saveMessage(sid, {
      role: "user",
      content: `Conversazione importata${goal ? ` — obiettivo: ${goal}` : ""}\n\n${text.slice(0, 12000)}`,
      timestamp: Date.now(),
    }, cid);
    await saveMessage(sid, {
      role: "assistant",
      content: analysis,
      timestamp: Date.now(),
    }, cid);
    setSaved(true);
  }

  return (
    <div className="space-y-4 pb-32">
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ClipboardPaste className="w-4 h-4 text-indigo-400" />
          <h2 className="font-medium text-white">Importa una conversazione</h2>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed">
          Incolla qui una chat fatta con ChatGPT, Claude, Gemini o una conversazione lunga.
          Atlas la legge, trova pattern e ti restituisce una spiegazione più utile + un piano concreto.
        </p>
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">Cosa vuoi capire da questa conversazione? (opzionale)</label>
        <input
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="es. voglio capire perché non riesco a lasciarla andare"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500"
        />
      </div>

      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">Conversazione da analizzare</label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          placeholder="Incolla qui tutta la conversazione…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 resize-none"
        />
        <p className="mt-1 text-[11px] text-zinc-500">Minimo 300 caratteri. Non salvata finché non premi “Salva analisi”.</p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={analyze}
          disabled={loading || text.trim().length < 300}
          className="px-4 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-sm font-medium flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {loading ? "Analizzo…" : "Analizza"}
        </button>
        {analysis && (
          <button
            onClick={saveAsConversation}
            className="px-4 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-sm font-medium flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saved ? "Salvata" : "Salva analisi"}
          </button>
        )}
      </div>

      {analysis && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-xs text-zinc-500 mb-2">Analisi Atlas</div>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-200">{analysis}</div>
        </div>
      )}
    </div>
  );
}

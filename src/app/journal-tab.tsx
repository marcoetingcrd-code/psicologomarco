"use client";
import { useEffect, useState } from "react";

export default function JournalTab({ sid }: { sid: string }) {
  const [text, setText] = useState("");
  const [entries, setEntries] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [pat, setPat] = useState<any>(null);

  useEffect(() => { fetch(`/api/journal?sessionId=${sid}`).then(r => r.json()).then(d => setEntries(d.entries ?? [])); }, [sid]);

  async function save() {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/journal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId: sid, text, mood: 5 }) });
      const d = await r.json();
      setEntries(p => [...p, d.entry]);
      setPat(d.pattern);
      setText("");
    } catch { }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">Journaling strutturato (Pennebaker Protocol)</h2>
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">Scrivi continuamente per 15-20 minuti. Non fermarti, non correggere. Esplora emozioni, corpo, connessioni.</p>
        <textarea value={text} onChange={e => setText(e.target.value)} className="w-full h-48 bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-sm outline-none focus:border-indigo-500 resize-none" placeholder="Inizia a scrivere..." />
        <div className="flex justify-between items-center mt-2">
          <span className="text-xs text-zinc-500">{text.split(/\s+/).filter(Boolean).length} parole</span>
          <button onClick={save} disabled={saving || !text.trim()} className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-sm font-medium">{saving ? "Salvataggio…" : "Salva entry"}</button>
        </div>
      </div>
      {pat && <div className="bg-emerald-900/20 border border-emerald-800/50 rounded-xl p-4">
        <h3 className="text-xs font-medium text-emerald-300 mb-1">Pattern rilevato</h3>
        <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{pat.prompt}</pre>
      </div>}
      {entries.length > 0 && <div className="space-y-3">
        <h3 className="text-sm font-medium text-zinc-300">Tue entry ({entries.length})</h3>
        {entries.map((e: any) => <div key={e.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
          <div className="flex justify-between items-center text-xs text-zinc-500 mb-1"><span>{new Date(e.timestamp).toLocaleString()}</span><span>{e.wordCount} parole · {e.negativeEmotionWords} neg · {e.positiveEmotionWords} pos</span></div>
          <p className="text-sm text-zinc-300 line-clamp-3">{e.text}</p>
        </div>)}
      </div>}
    </div>
  );
}

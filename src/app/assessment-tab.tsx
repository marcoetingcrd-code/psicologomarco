"use client";
import { useEffect, useState } from "react";

export default function AssessmentTab({ sid }: { sid: string }) {
  const [scales, setScales] = useState<any[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [ans, setAns] = useState<number[]>([]);
  const [res, setRes] = useState<any>(null);
  const [load, setLoad] = useState(false);

  useEffect(() => { fetch("/api/assessment").then(r => r.json()).then(d => setScales(d.scales ?? [])); }, []);

  async function start(id: string) {
    const r = await fetch("/api/assessment"); const d = await r.json();
    const scale = d.scales.find((s: any) => s.id === id);
    if (!scale) return;
    const { ALL_SCALES } = await import("@/lib/assessment");
    const full = ALL_SCALES.find(s => s.id === id);
    if (!full) return;
    setActive(id);
    setItems(full.items);
    setAns(new Array(full.items.length).fill(3));
    setRes(null);
  }

  async function submit() {
    if (!active) return; setLoad(true);
    try {
      const r = await fetch("/api/assessment", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scaleId: active, answers: ans, sessionId: sid }) });
      const d = await r.json();
      setRes(d);
    } catch { }
    finally { setLoad(false); }
  }

  return (
    <div className="space-y-6 pb-24">
      {!active && <div className="space-y-3">
        {scales.map(s => <button key={s.id} onClick={() => start(s.id)} className="w-full text-left bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 rounded-xl p-4 transition-colors">
          <h3 className="text-sm font-medium text-zinc-300">{s.name}</h3>
          <p className="text-xs text-zinc-500 mt-1">{s.description}</p>
          <span className="text-xs text-indigo-400 mt-2 inline-block">{s.itemCount} item</span>
        </button>)}
      </div>}
      {active && items.length > 0 && <div className="space-y-4">
        <button onClick={() => setActive(null)} className="text-xs text-zinc-500 hover:text-zinc-300">← Torna alla lista</button>
        <div className="space-y-4">
          {items.map((item, i) => <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-300 mb-3">{i + 1}. {item.text}</p>
            <div className="grid grid-cols-4 sm:flex sm:gap-1 gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map(v => <button key={v} onClick={() => setAns(p => { const a = [...p]; a[i] = v; return a; })} className={`min-h-[44px] py-2 rounded-lg text-xs font-medium border ${ans[i] === v ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"}`}>{v}</button>)}
            </div>
          </div>)}
        </div>
        <button onClick={submit} disabled={load || ans.some(a => !a)} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 font-medium text-sm">{load ? "Calcolo…" : "Calcola risultati"}</button>
        {res && <div className="bg-zinc-900/80 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">{res.name}</h3>
          <pre className="text-xs text-zinc-400 whitespace-pre-wrap">{JSON.stringify(res.scores, null, 2)}</pre>
          {res.critical && <div className="mt-3 bg-red-900/30 border border-red-800 rounded-lg p-3 text-xs text-red-300">{res.criticalMessage}</div>}
        </div>}
      </div>}
    </div>
  );
}

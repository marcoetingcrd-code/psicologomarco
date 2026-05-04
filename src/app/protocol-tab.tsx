"use client";
import { useEffect, useState } from "react";
import { Sparkles, Brain, Dumbbell, Heart, AlertTriangle } from "lucide-react";

export default function ProtocolTab({ sid }: { sid: string }) {
  const [protocols, setProtocols] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/protocol?sessionId=${sid}`).then(r => r.json()).then(d => setProtocols(d.protocols ?? []));
  }, [sid]);

  async function generate() {
    setLoading(true);
    try {
      const r = await fetch("/api/protocol", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, assessment: lastAssessment ?? {} }),
      });
      const d = await r.json();
      if (d.protocol) setProtocols(p => [...p, d.protocol]);
    } catch { }
    finally { setLoading(false); }
  }

  const latest = protocols[protocols.length - 1];

  return (
    <div className="space-y-6 pb-24">
      <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
        <h2 className="text-sm font-medium text-zinc-300 mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-400" /> Protocollo personalizzato
        </h2>
        <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
          Atlas analizza journal, assessment e domande per generare un piano settimanale evidence-based: mente, corpo, relazione.
        </p>
        <button onClick={generate} disabled={loading} className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 text-sm font-medium flex items-center justify-center gap-2">
          <Sparkles className="w-4 h-4" /> {loading ? "Generazione…" : "Genera nuovo protocollo"}
        </button>
      </div>

      {latest && (
        <div className="space-y-4">
          {/* Analysis */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">Analisi profilo</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <span className="text-zinc-500">Tonalità emotiva</span>
                <p className="text-zinc-300 mt-1">{latest.analysis.emotionalTone}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <span className="text-zinc-500">Attaccamento</span>
                <p className="text-zinc-300 mt-1">{latest.analysis.attachmentStyle ?? "non valutato"}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <span className="text-zinc-500">Rischio ACE</span>
                <p className="text-zinc-300 mt-1">{latest.analysis.aceRisk ?? "non valutato"}</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <span className="text-zinc-500">Temi</span>
                <p className="text-zinc-300 mt-1">{latest.analysis.themes.join(", ") || "nessun tema chiaro"}</p>
              </div>
            </div>

            {latest.analysis.riskAreas.length > 0 && (
              <div className="mt-3 bg-amber-900/20 border border-amber-800/50 rounded-lg p-3 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-amber-300">Aree di attenzione</p>
                  <p className="text-xs text-zinc-400 mt-1">{latest.analysis.riskAreas.join(" · ")}</p>
                </div>
              </div>
            )}

            {latest.analysis.strengths.length > 0 && (
              <div className="mt-2 text-xs text-emerald-400">
                Punti di forza: {latest.analysis.strengths.join(" · ")}
              </div>
            )}
          </div>

          {/* Rationale */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <h3 className="text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Razionale clinico</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">{latest.rationale}</p>
          </div>

          {/* Plan */}
          <div className="space-y-4">
            <Section icon={<Brain className="w-4 h-4" />} title="Mente" color="indigo" items={latest.plan.mind} />
            <Section icon={<Dumbbell className="w-4 h-4" />} title="Corpo" color="emerald" items={latest.plan.body} />
            <Section icon={<Heart className="w-4 h-4" />} title="Relazione" color="rose" items={latest.plan.relation} />
          </div>
        </div>
      )}

      {!latest && !loading && (
        <div className="text-center py-12 text-zinc-500">
          <Sparkles className="w-8 h-8 mx-auto mb-3 text-indigo-400" />
          <p className="text-sm text-zinc-400">Nessun protocollo generato</p>
          <p className="text-xs mt-1">Completa almeno 3 journal entries e un assessment per un piano mirato</p>
        </div>
      )}
    </div>
  );
}

function Section({ icon, title, color, items }: { icon: React.ReactNode; title: string; color: string; items: any[] }) {
  if (!items.length) return null;
  const colorMap: Record<string, string> = {
    indigo: "border-l-indigo-500 bg-indigo-900/10",
    emerald: "border-l-emerald-500 bg-emerald-900/10",
    rose: "border-l-rose-500 bg-rose-900/10",
  };
  return (
    <div className="space-y-2">
      <h3 className={`text-xs font-medium uppercase tracking-wider flex items-center gap-2 ${color === "indigo" ? "text-indigo-400" : color === "emerald" ? "text-emerald-400" : "text-rose-400"}`}>
        {icon} {title}
      </h3>
      {items.map((it, i) => (
        <div key={i} className={`rounded-xl border border-zinc-800 p-3 border-l-2 ${colorMap[color] ?? ""}`}>
          <div className="flex justify-between items-start gap-2">
            <div>
              <p className="text-sm text-zinc-300 font-medium">{it.activity}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{it.goal}</p>
            </div>
            <span className="shrink-0 text-[10px] bg-zinc-800 text-zinc-400 px-2 py-1 rounded-full">{it.day} · {it.duration}</span>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 italic">{it.evidenceBase}</p>
        </div>
      ))}
    </div>
  );
}

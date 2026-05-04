"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, Sparkles, Heart, Brain, BookOpen, CheckCircle } from "lucide-react";

const LIFE_THEMES = [
  { id: "lavoro", label: "Lavoro / Carriera", icon: "💼" },
  { id: "relazione", label: "Relazioni affettive", icon: "❤️" },
  { id: "corpo", label: "Corpo / Salute", icon: "💪" },
  { id: "identita", label: "Identità / Scopo", icon: "🔮" },
  { id: "sessualita", label: "Sessualità", icon: "🔥" },
  { id: "famiglia", label: "Famiglia / Passato", icon: "🏠" },
];

const ACE_ITEMS = [
  { id: "ace1", text: "Prima dei 18 anni un genitore o adulto in casa ti ha spinto, afferrato, schiaffeggiato o gettato qualcosa addosso?" },
  { id: "ace2", text: "Prima dei 18 anni un adulto ti ha toccato o accarezzato in modo sessuale?" },
  { id: "ace3", text: "Prima dei 18 anni ti è capitato di non avere abbastanza da mangiare, vestiti puliti o cure mediche?" },
  { id: "ace4", text: "I tuoi genitori erano talmente assorbiti dai loro problemi che non potevano prendersi cura di te o proteggerti?" },
  { id: "ace5", text: "Hai vissuto la separazione/divorzio dei tuoi genitori?" },
  { id: "ace6", text: "Un genitore ha maltrattato l'altro (fisicamente)?" },
  { id: "ace7", text: "Qualcuno in casa aveva problemi di alcol o droghe?" },
  { id: "ace8", text: "Qualcuno in casa era depresso o mentalmente malato?" },
  { id: "ace9", text: "Qualcuno in casa è stato in prigione?" },
  { id: "ace10", text: "Prima dei 18 anni un genitore o adulto ti ha insultato, umiliato o fatto sentire inadeguato?" },
];

const ECR_ITEMS = [
  // Anxiety
  { id: "ecr1", text: "Mi preoccupo che le persone di cui mi innamoro non mi amino tanto quanto le amo io." },
  { id: "ecr2", text: "Ho paura di essere abbandonato/a." },
  { id: "ecr3", text: "Desidero essere così vicino/a alle persone che mi spaventa." },
  { id: "ecr4", text: "Ho bisogno di essere rassicurato/a costantemente che sono amato/a." },
  { id: "ecr5", text: "Quando il partner si allontana emotivamente, temo di perderlo/a." },
  { id: "ecr6", text: "Mi preoccupo di essere lasciato/a." },
  { id: "ecr7", text: "Desidero una fusione totale con la persona che amo." },
  { id: "ecr8", text: "Il mio desiderio di vicinanza a volte spaventa le persone." },
  { id: "ecr9", text: "Mi arrabbio quando il partner non è disponibile quando ne ho bisogno." },
  // Avoidance (reversed in scoring)
  { id: "ecr10", text: "Preferisco non mostrare al partner come mi sento profondamente.", reverse: true },
  { id: "ecr11", text: "Trovo difficile permettermi di dipendere dal partner.", reverse: true },
  { id: "ecr12", text: "Mi sento a disagio quando il partner vuole essere troppo vicino.", reverse: true },
  { id: "ecr13", text: "Non mi piace dover dipendere dagli altri.", reverse: true },
  { id: "ecr14", text: "Quando mostro i miei sentimenti, temo di essere giudicato/a.", reverse: true },
  { id: "ecr15", text: "Trovo difficile fidarmi completamente del partner.", reverse: true },
  { id: "ecr16", text: "Mi sento nervoso/a quando il partner si avvicina troppo.", reverse: true },
  { id: "ecr17", text: "Preferisco mantenere una certa distanza emotiva nei rapporti.", reverse: true },
  { id: "ecr18", text: "Non mi piace dover chiedere aiuto o supporto emotivo.", reverse: true },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [aceAns, setAceAns] = useState<Record<string, number>>({});
  const [ecrAns, setEcrAns] = useState<Record<string, number>>({});
  const [journal, setJournal] = useState("");
  const [loading, setLoading] = useState(false);
  const sid = typeof window !== "undefined" ? localStorage.getItem("atlas_sid") || `anon-${Date.now()}` : `anon-${Date.now()}`;

  function toggleTheme(t: string) {
    setThemes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  async function finish() {
    setLoading(true);
    try {
      // 1. Save profile basics
      await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, action: "update", data: { goals: goal, lifeThemes: themes } }),
      });
      // 2. Save ACE
      const aceAnswers = ACE_ITEMS.map(i => aceAns[i.id] ?? 0);
      await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, scaleId: "ace", answers: aceAnswers }),
      });
      // 3. Save ECR-R
      const ecrAnswers = ECR_ITEMS.map(i => ecrAns[i.id] ?? 4);
      await fetch("/api/assessment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, scaleId: "ecr-r", answers: ecrAnswers }),
      });
      // 4. Save journal
      if (journal.trim()) {
        await fetch("/api/journal", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: sid, content: journal }),
        });
      }
      // 5. Ingest assessments into profile
      const aceTotal = aceAnswers.filter(a => a >= 1).length;
      await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, action: "assessment", data: { scaleId: "ace", scores: { aceTotal, risk: aceTotal >= 4 ? "elevato" : aceTotal >= 2 ? "moderato" : "basso" } } }),
      });
      const anxiety = ECR_ITEMS.slice(0, 9).map(i => ecrAns[i.id] ?? 4).reduce((a, b) => a + b, 0) / 9;
      const avoidance = ECR_ITEMS.slice(9).map(i => ecrAns[i.id] ?? 4).reduce((a, b) => a + b, 0) / 9;
      await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: sid, action: "assessment", data: { scaleId: "ecr-r-short", scores: { anxiety, avoidance, style: anxiety < 3 && avoidance < 3 ? "secure" : anxiety >= 3 && avoidance < 3 ? "anxious" : anxiety < 3 && avoidance >= 3 ? "avoidant" : "fearful" } } }),
      });
      router.push("/");
    } catch {
      setLoading(false);
    }
  }

  const steps = [
    {
      title: "Benvenuto in Atlas",
      subtitle: "Costruiamo il tuo profilo per risposte davvero personalizzate.",
      content: (
        <div className="space-y-6">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
            <label className="text-sm text-zinc-300 font-medium">Cosa speri di ottenere da Atlas?</label>
            <textarea value={goal} onChange={e => setGoal(e.target.value)} placeholder="Es: voglio capire perché finisco sempre con persone che mi abbandonano..." className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500 min-h-[80px]" />
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-3">
            <label className="text-sm text-zinc-300 font-medium">Quali aree ti pesano di più ora?</label>
            <div className="flex flex-wrap gap-2">
              {LIFE_THEMES.map(t => (
                <button key={t.id} onClick={() => toggleTheme(t.id)} className={`px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${themes.includes(t.id) ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"}`}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ),
      canNext: goal.trim().length > 5 && themes.length > 0,
    },
    {
      title: "Esperienze infantili (ACE)",
      subtitle: "10 domande sul tuo ambiente familiare prima dei 18 anni. Questo aiuta Atlas a mappare i tuoi pattern relazionali.",
      content: (
        <div className="space-y-3">
          {ACE_ITEMS.map((item, i) => (
            <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-300 mb-3">{i + 1}. {item.text}</p>
              <div className="flex gap-3">
                {[
                  { val: 0, label: "No" },
                  { val: 1, label: "Sì" },
                ].map(opt => (
                  <button key={opt.val} onClick={() => setAceAns(prev => ({ ...prev, [item.id]: opt.val }))} className={`flex-1 py-2.5 rounded-lg text-xs font-medium border min-h-[44px] ${aceAns[item.id] === opt.val ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
      canNext: ACE_ITEMS.every(i => aceAns[i.id] !== undefined),
    },
    {
      title: "Stile di attaccamento (ECR-R)",
      subtitle: "18 domande su come ti senti nelle relazioni romantiche. 1 = Completamente falso, 7 = Completamente vero.",
      content: (
        <div className="space-y-3">
          {ECR_ITEMS.map((item, i) => (
            <div key={item.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
              <p className="text-sm text-zinc-300 mb-3">{i + 1}. {item.text}</p>
              <div className="grid grid-cols-7 gap-1">
                {[1, 2, 3, 4, 5, 6, 7].map(v => (
                  <button key={v} onClick={() => setEcrAns(prev => ({ ...prev, [item.id]: v }))} className={`py-2 rounded-lg text-xs font-medium border min-h-[44px] ${ecrAns[item.id] === v ? "bg-indigo-600 border-indigo-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"}`}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ),
      canNext: ECR_ITEMS.every(i => ecrAns[i.id] !== undefined),
    },
    {
      title: "Journal iniziale",
      subtitle: "Scrivi liberamente per 3-5 minuti. Non ci sono risposte giuste.",
      content: (
        <div className="space-y-3">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
            <p className="text-sm text-zinc-400 mb-3">Prompt: "Cosa ti pesa di più in questo momento della tua vita? Cosa vorresti che fosse diverso tra un anno?"</p>
            <textarea value={journal} onChange={e => setJournal(e.target.value)} placeholder="Inizia a scrivere..." className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-indigo-500 min-h-[200px]" />
          </div>
        </div>
      ),
      canNext: journal.trim().length > 20,
    },
    {
      title: "Riepilogo profilo",
      subtitle: "Ecco cosa Atlas ha imparato su di te. Puoi sempre aggiornare queste informazioni dalla chat.",
      content: (
        <div className="space-y-4">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Heart className="w-4 h-4 text-rose-400" /> Obiettivo</h3>
            <p className="text-xs text-zinc-400">{goal}</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Sparkles className="w-4 h-4 text-amber-400" /> Aree di focus</h3>
            <div className="flex flex-wrap gap-1">{themes.map(t => <span key={t} className="px-2 py-1 rounded bg-zinc-800 text-zinc-400 text-xs">{LIFE_THEMES.find(l => l.id === t)?.label}</span>)}</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><Brain className="w-4 h-4 text-indigo-400" /> Esiti assessment</h3>
            <p className="text-xs text-zinc-400">ACE: {Object.values(aceAns).filter(v => v >= 1).length}/10 esperienze avverse</p>
            <p className="text-xs text-zinc-400">Attaccamento: ansia e evitamento calcolati da ECR-R</p>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 space-y-2">
            <h3 className="text-sm font-medium text-zinc-300 flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-400" /> Journal</h3>
            <p className="text-xs text-zinc-400 line-clamp-3">{journal.slice(0, 120)}...</p>
          </div>
          <button onClick={finish} disabled={loading} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 font-medium text-sm flex items-center justify-center gap-2">
            {loading ? "Salvataggio…" : <><CheckCircle className="w-4 h-4" /> Completa e inizia"</>}
          </button>
        </div>
      ),
      canNext: true,
    },
  ];

  const current = steps[step];

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <h1 className="text-sm font-semibold text-zinc-300">Atlas Onboarding</h1>
        <span className="text-xs text-zinc-500">Step {step + 1} di {steps.length}</span>
      </header>
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-2xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-zinc-200">{current.title}</h2>
          <p className="text-xs text-zinc-500 mt-1">{current.subtitle}</p>
        </div>
        {current.content}
      </main>
      <footer className="border-t border-zinc-800 px-4 py-3 flex items-center justify-between bg-black">
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-30">
          <ArrowLeft className="w-4 h-4" /> Indietro
        </button>
        <div className="flex gap-1">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full ${i === step ? "bg-indigo-500" : i < step ? "bg-zinc-500" : "bg-zinc-800"}`} />
          ))}
        </div>
        {step < steps.length - 1 && (
          <button onClick={() => setStep(s => s + 1)} disabled={!current.canNext} className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 disabled:opacity-30 font-medium">
            Avanti <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </footer>
    </div>
  );
}

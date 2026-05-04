"use client";
import { useState } from "react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";

interface Props {
  sid: string;
  onClose: () => void;
  onComplete: () => void;
}

const LIFE_THEMES = [
  { id: "relazioni", label: "Relazioni affettive" },
  { id: "lavoro", label: "Lavoro / carriera" },
  { id: "corpo", label: "Corpo / salute" },
  { id: "denaro", label: "Soldi / business" },
  { id: "identita", label: "Identità / scopo" },
  { id: "dipendenze", label: "Dipendenze" },
  { id: "famiglia", label: "Famiglia di origine" },
  { id: "sessualita", label: "Sessualità / intimità" },
  { id: "ansia_umore", label: "Ansia / umore" },
  { id: "abitudini", label: "Abitudini / disciplina" },
  { id: "studio", label: "Studio / apprendimento" },
  { id: "sociale", label: "Vita sociale" },
];

const ATTACHMENT_REACTION = [
  { id: "inseguo", label: "Insegua, voglio capire subito cosa è successo" },
  { id: "calmo", label: "Cerco di parlarne con calma quando si può" },
  { id: "chiudo", label: "Mi chiudo, aspetto che torni da sé" },
  { id: "indifferente", label: "Non mi tocca particolarmente" },
];

const ATTACHMENT_DEPENDENCE = [
  { id: "molto", label: "Mi viene naturale, mi piace" },
  { id: "abbastanza", label: "Abbastanza, dipende dalla persona" },
  { id: "poco", label: "Poco, preferisco fare da solo" },
  { id: "perniente", label: "Per niente, mi mette a disagio" },
];

const EMOTION_PATTERN = [
  { id: "expression", label: "La esprimo subito, esce" },
  { id: "suppression", label: "La reprimo, vado avanti" },
  { id: "rumination", label: "Ci penso a lungo, gira nella testa" },
  { id: "reflection", label: "Cerco di capire cosa c'è sotto" },
];

const TRAUMA_SOFT = [
  { id: "no", label: "No, infanzia tranquilla" },
  { id: "qualche", label: "Qualche cosa pesante ma niente di grave" },
  { id: "si", label: "Sì, eventi importanti" },
  { id: "skip", label: "Preferisco non dire" },
];

type StyleKey = "secure" | "anxious" | "avoidant" | "fearful";

function inferAttachmentStyle(reaction?: string, dependence?: string): StyleKey | undefined {
  if (!reaction || !dependence) return undefined;
  const anx = reaction === "inseguo";
  const avo = reaction === "chiudo" || dependence === "perniente" || dependence === "poco";
  if (anx && avo) return "fearful";
  if (anx) return "anxious";
  if (avo) return "avoidant";
  return "secure";
}

export default function ProfileModal({ sid, onClose, onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // form state
  const [age, setAge] = useState("");
  const [situation, setSituation] = useState("");
  const [themes, setThemes] = useState<string[]>([]);
  const [goals, setGoals] = useState("");
  const [reaction, setReaction] = useState<string>("");
  const [dependence, setDependence] = useState<string>("");
  const [emotion, setEmotion] = useState<string>("");
  const [trauma, setTrauma] = useState<string>("");
  const [avoid, setAvoid] = useState("");

  const steps = ["Chi sei", "Cosa ti pesa", "Obiettivo", "Relazioni", "Emozioni", "Cosa evitare"];

  function toggleTheme(id: string) {
    setThemes((arr) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]));
  }

  async function save(final = false) {
    setSaving(true);
    const style = inferAttachmentStyle(reaction, dependence);
    const patch: Record<string, unknown> = {
      onboardingComplete: final,
    };
    if (age) patch.age = age;
    if (situation) patch.situation = situation;
    if (themes.length) patch.lifeThemes = themes;
    if (goals.trim()) patch.goals = goals.trim();
    if (style) {
      patch.attachment = { style, confidence: "medium" };
    }
    if (emotion) {
      patch.emotionalRegulation = { pattern: emotion, confidence: "medium" };
    }
    if (trauma && trauma !== "skip") {
      patch.trauma = {
        confidence: trauma === "no" ? "high" : "medium",
        aceRisk: trauma === "no" ? "low" : trauma === "qualche" ? "moderate" : "high",
      };
    }
    if (avoid.trim()) patch.avoidApproaches = avoid.trim();

    try {
      await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid, action: "update", data: patch }),
      });
    } catch {}
    setSaving(false);
    if (final) {
      onComplete();
      onClose();
    }
  }

  async function skipAll() {
    await save(true);
  }

  async function next() {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      await save(true);
    }
  }

  function prev() {
    if (step > 0) setStep(step - 1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:px-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-zinc-800 bg-zinc-950 p-5 sm:p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-500"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mb-5">
          <div className="flex items-center gap-1 mb-3">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-colors ${
                  i <= step ? "bg-indigo-500" : "bg-zinc-800"
                }`}
              />
            ))}
          </div>
          <h2 className="text-lg font-semibold text-white">{steps[step]}</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Passo {step + 1} di {steps.length} · Puoi saltare in qualunque momento
          </p>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Due righe per inquadrarti — le risposte sono molto più precise se so chi ho davanti.
            </p>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">Età (opzionale)</label>
              <input
                type="text"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="es. 32"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1.5">
                Situazione attuale (opzionale)
              </label>
              <textarea
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                rows={3}
                placeholder="es. single, lavoro freelance da casa, città piccola, vivo da solo"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              In questo momento, quali aree ti stanno pesando? Tocca quelle che senti tue.
            </p>
            <div className="flex flex-wrap gap-2">
              {LIFE_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTheme(t.id)}
                  className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                    themes.includes(t.id)
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:border-zinc-600"
                  }`}
                >
                  {themes.includes(t.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Cosa speri di ottenere parlando con me? Più sei concreto, più posso esserti utile.
            </p>
            <textarea
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              rows={4}
              placeholder="es. capire perché finisco sempre con persone che mi abbandonano e smettere di farlo"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
            />
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <p className="text-sm text-zinc-400">
              Due domande veloci sul modo in cui stai nelle relazioni. Niente test, solo per
              calibrare le risposte.
            </p>
            <div>
              <p className="text-xs text-zinc-300 mb-2">
                Quando una persona importante si allontana emotivamente:
              </p>
              <div className="space-y-1.5">
                {ATTACHMENT_REACTION.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setReaction(o.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      reaction === o.id
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-100"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-300 mb-2">
                Dipendere emotivamente da qualcuno per te è:
              </p>
              <div className="space-y-1.5">
                {ATTACHMENT_DEPENDENCE.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setDependence(o.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      dependence === o.id
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-100"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <p className="text-sm text-zinc-400">
              Quando ti arriva un'emozione forte (rabbia, ansia, tristezza), di solito:
            </p>
            <div className="space-y-1.5">
              {EMOTION_PATTERN.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setEmotion(o.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                    emotion === o.id
                      ? "bg-indigo-600/20 border-indigo-500 text-indigo-100"
                      : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-zinc-800">
              <p className="text-xs text-zinc-300 mb-2">
                Hai vissuto eventi pesanti nell'infanzia? (puoi saltare)
              </p>
              <div className="space-y-1.5">
                {TRAUMA_SOFT.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => setTrauma(o.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-colors ${
                      trauma === o.id
                        ? "bg-indigo-600/20 border-indigo-500 text-indigo-100"
                        : "bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-400">
              Ultima cosa: c&apos;è un tipo di approccio che <strong>non</strong> vuoi che usi
              con te? (es. non darmi del paziente, non parlare di Dio, niente test clinici…)
            </p>
            <textarea
              value={avoid}
              onChange={(e) => setAvoid(e.target.value)}
              rows={3}
              placeholder="opzionale — lascia vuoto se non hai preferenze"
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 resize-none"
            />
            <p className="text-xs text-zinc-500">
              Hai finito. Puoi aggiornare il profilo quando vuoi dalle impostazioni.
            </p>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-zinc-800">
          <button
            onClick={step === 0 ? skipAll : prev}
            disabled={saving}
            className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1.5 flex items-center gap-1"
          >
            {step === 0 ? (
              "Salta tutto"
            ) : (
              <>
                <ChevronLeft className="w-3.5 h-3.5" /> Indietro
              </>
            )}
          </button>
          <div className="flex items-center gap-2">
            {step < steps.length - 1 && (
              <button
                onClick={() => save(false)}
                disabled={saving}
                className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-800"
              >
                Salta questa
              </button>
            )}
            <button
              onClick={next}
              disabled={saving}
              className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1.5 disabled:opacity-50"
            >
              {step === steps.length - 1 ? "Fine" : "Avanti"}
              {step < steps.length - 1 && <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

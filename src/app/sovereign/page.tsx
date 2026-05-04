"use client";
import { useEffect, useState } from "react";
import { Shield, Target, AlertTriangle, Check, Trash2, Plus, Save, Lock } from "lucide-react";
import {
  type SovereignContract,
  type FrontKey,
  type FrontGoal,
  type ManipulationConsent,
  emptyContract,
  loadContract,
  saveContract,
  isContractValid,
  DEFAULT_CONSENT,
  SOFTER_CONSENT,
} from "../../lib/sovereign/contract";
import Link from "next/link";

const FRONT_LABELS: Record<FrontKey, { title: string; subtitle: string }> = {
  money: { title: "Soldi / Business / Carriera", subtitle: "lancio, fatturato, clienti, prezzo, vendite" },
  relationship: { title: "Relazioni / Riconquista / Seduzione", subtitle: "ex, dating, social, contatti, blocchi" },
  body: { title: "Fisico / Disciplina / Abitudini", subtitle: "allenamento, dieta, sonno, sostanze, sveglia" },
  mind: { title: "Controllo emotivo / Anti-procrastinazione", subtitle: "blocchi, evitamento, cicli motivazione" },
};

export default function SovereignPage() {
  const [contract, setContract] = useState<SovereignContract>(() => emptyContract());
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedTick, setSavedTick] = useState(false);

  useEffect(() => {
    loadContract().then((c) => {
      if (c) setContract(c);
      setLoaded(true);
    });
  }, []);

  const valid = isContractValid(contract);
  const daysLeft = Math.max(0, Math.ceil((contract.expiresAt - Date.now()) / 86400000));

  function updateFront<K extends FrontKey>(key: K, mut: (f: typeof contract.fronts[K]) => typeof contract.fronts[K]) {
    setContract((c) => ({ ...c, fronts: { ...c.fronts, [key]: mut(c.fronts[key]) } }));
  }
  function updateConsent(k: keyof ManipulationConsent, v: boolean) {
    setContract((c) => ({ ...c, manipulationConsent: { ...c.manipulationConsent, [k]: v } }));
  }
  function addGoal(key: FrontKey) {
    updateFront(key, (f) => ({
      ...f,
      goals: [...f.goals, { title: "", metric: "", why: "", nonNegotiable: false }],
    }));
  }
  function removeGoal(key: FrontKey, idx: number) {
    updateFront(key, (f) => ({ ...f, goals: f.goals.filter((_, i) => i !== idx) }));
  }
  function setGoal(key: FrontKey, idx: number, patch: Partial<FrontGoal>) {
    updateFront(key, (f) => ({
      ...f,
      goals: f.goals.map((g, i) => (i === idx ? { ...g, ...patch } : g)),
    }));
  }

  async function onSign() {
    setSaving(true);
    const next = { ...contract, active: true, signedAt: Date.now(), expiresAt: Date.now() + 90 * 24 * 3600 * 1000 };
    setContract(next);
    await saveContract(next);
    setSaving(false);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  }

  async function onDeactivate() {
    if (!confirm("Vuoi davvero disattivare il contratto sovereign? Atlas tornerà alla modalità coach normale.")) return;
    const next = { ...contract, active: false };
    setContract(next);
    await saveContract(next);
  }

  async function onSaveDraft() {
    setSaving(true);
    await saveContract(contract);
    setSaving(false);
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800);
  }

  if (!loaded) {
    return <div className="text-zinc-500 p-8">Carico contratto…</div>;
  }

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6 pb-24">
      <header className="space-y-2">
        <Link href="/" className="text-xs text-indigo-400 hover:underline">← Atlas</Link>
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-indigo-400" />
          <h1 className="text-2xl font-bold">Sovereign Contract</h1>
        </div>
        <p className="text-sm text-zinc-400">
          Firmi un contratto col tuo te-futuro. Da quel momento Atlas è autorizzato a usare contro di te le leve psicologiche
          che selezioni — vergogna, paura, derisione, identità — per portarti dove dichiari di voler andare.
          Una sola riga rossa non disattivabile: se Atlas rileva una crisi acuta, smette tutto e ti indirizza a risorse reali.
        </p>
        {valid && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 flex items-center gap-2">
            <Check className="w-4 h-4" /> Contratto attivo · scade tra {daysLeft} giorni
          </div>
        )}
        {!contract.active && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Contratto in bozza — non attivo. Atlas opera in modalità standard.
          </div>
        )}
      </header>

      {/* IDENTITY + FAILURE COST */}
      <section className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
        <h2 className="font-semibold flex items-center gap-2"><Target className="w-4 h-4" /> Identità che stai costruendo</h2>
        <input
          value={contract.identityCommitment}
          onChange={(e) => setContract((c) => ({ ...c, identityCommitment: e.target.value }))}
          placeholder="Es. Sono lo stratega che non si fa più mollare e che chiude quello che inizia."
          className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
        <h3 className="font-medium text-sm pt-2">Costo del fallimento (parole tue, niente filtri)</h3>
        <textarea
          value={contract.failureCost}
          onChange={(e) => setContract((c) => ({ ...c, failureCost: e.target.value }))}
          placeholder="Es. Se mollo: torno al divano, lei è con un altro, il progetto muore, tra 6 mesi guardo questo testo e mi vergogno."
          rows={3}
          className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
        />
      </section>

      {/* FRONTI */}
      {(Object.keys(FRONT_LABELS) as FrontKey[]).map((key) => {
        const def = contract.fronts[key];
        return (
          <section key={key} className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
            <header className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{FRONT_LABELS[key].title}</div>
                <div className="text-xs text-zinc-500">{FRONT_LABELS[key].subtitle}</div>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={def.active}
                  onChange={(e) => updateFront(key, (f) => ({ ...f, active: e.target.checked }))}
                  className="accent-indigo-500"
                />
                Fronte attivo
              </label>
            </header>
            {def.active && (
              <>
                <div className="space-y-3">
                  {def.goals.map((g, i) => (
                    <div key={i} className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 space-y-2">
                      <div className="flex items-start gap-2">
                        <input
                          value={g.title}
                          onChange={(e) => setGoal(key, i, { title: e.target.value })}
                          placeholder="Obiettivo concreto (es. Lanciare landing distributore)"
                          className="flex-1 rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                        />
                        <button onClick={() => removeGoal(key, i)} className="text-zinc-500 hover:text-red-400 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <input
                        value={g.metric}
                        onChange={(e) => setGoal(key, i, { metric: e.target.value })}
                        placeholder="Metrica misurabile (es. 10 chiamate clienti / settimana)"
                        className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                      />
                      <input
                        value={g.why}
                        onChange={(e) => setGoal(key, i, { why: e.target.value })}
                        placeholder="Perché conta davvero per te"
                        className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                      />
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={g.nonNegotiable}
                          onChange={(e) => setGoal(key, i, { nonNegotiable: e.target.checked })}
                          className="accent-red-500"
                        />
                        Non-negoziabile (Atlas non accetterà scuse su questo)
                      </label>
                    </div>
                  ))}
                </div>
                <button onClick={() => addGoal(key)} className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300">
                  <Plus className="w-3.5 h-3.5" /> Aggiungi obiettivo
                </button>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-zinc-800">
                  <input
                    value={def.rituals.morning ?? ""}
                    onChange={(e) => updateFront(key, (f) => ({ ...f, rituals: { ...f.rituals, morning: e.target.value } }))}
                    placeholder="Rituale mattutino"
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                  />
                  <input
                    value={def.rituals.evening ?? ""}
                    onChange={(e) => updateFront(key, (f) => ({ ...f, rituals: { ...f.rituals, evening: e.target.value } }))}
                    placeholder="Rituale serale"
                    className="rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <input
                  value={(def.rituals.forbidden ?? []).join(", ")}
                  onChange={(e) => updateFront(key, (f) => ({ ...f, rituals: { ...f.rituals, forbidden: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } }))}
                  placeholder="Vietati (separati da virgola): no alcol, no messaggi a ex, no procrastinazione lavoro"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-sm"
                />
              </>
            )}
          </section>
        );
      })}

      {/* CONSENT */}
      <section className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2"><Lock className="w-4 h-4" /> Consenso alla manipolazione</h2>
        <p className="text-xs text-zinc-500">
          Selezioni quali leve Atlas può usare contro di te. Tutto è disattivabile in qualsiasi momento.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          {([
            ["allowShame", "Vergogna", "Atlas può usare il senso di vergogna per pungolarti su scuse e cedimenti"],
            ["allowFear", "Paura", "Atlas può attivare la paura del te-futuro sconfitto"],
            ["allowMockery", "Derisione", "Atlas può prenderti in giro fraternamente quando esiti su cose piccole"],
            ["allowSelectiveValidation", "Validazione selettiva", "Niente bravo gratis: l'approvazione si guadagna"],
            ["allowIdentityChallenge", "Sfida identitaria", "Atlas nomina apertamente quando un'azione tradisce la tua identità"],
            ["allowMessageBlocking", "Blocco messaggi impulsivi", "Atlas intercetta messaggi a ex/clienti scritti in stato emotivo"],
            ["allowRandomAudit", "Audit random", "Spot-check 2-3 volte/giorno: cosa stai facendo ora?"],
            ["allowHardTruth", "Verità brutale", "Atlas dice la verità senza filtri quando conta"],
          ] as [keyof ManipulationConsent, string, string][]).map(([k, label, desc]) => (
            <label key={k} className="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 cursor-pointer hover:border-zinc-700">
              <input
                type="checkbox"
                checked={contract.manipulationConsent[k]}
                onChange={(e) => updateConsent(k, e.target.checked)}
                className="accent-indigo-500 mt-0.5"
              />
              <div className="flex-1 text-xs">
                <div className="font-medium">{label}</div>
                <div className="text-zinc-500">{desc}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2 text-xs pt-2">
          <button onClick={() => setContract((c) => ({ ...c, manipulationConsent: { ...DEFAULT_CONSENT } }))}
            className="text-indigo-400 hover:underline">Tutte attive (default)</button>
          <span className="text-zinc-600">·</span>
          <button onClick={() => setContract((c) => ({ ...c, manipulationConsent: { ...SOFTER_CONSENT } }))}
            className="text-indigo-400 hover:underline">Versione soft</button>
        </div>
      </section>

      {/* SAFETY */}
      <section className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-rose-300 font-medium"><AlertTriangle className="w-4 h-4" /> Riga rossa non disattivabile</div>
        <p className="text-rose-200/80">
          Se Atlas rileva linguaggio di crisi acuta (ideazione suicidaria, autolesionismo, panico esteso), smette ogni
          manipolazione, cambia tono a soft e ti propone risorse reali. Questo è automatico e non disattivabile.
          In caso di emergenza: <strong>Telefono Amico Italia 02 2327 2327</strong>, Telefono Verde Suicidi <strong>800 860 022</strong>, emergenza <strong>118</strong>.
        </p>
        <input
          value={contract.emergencyContact ?? ""}
          onChange={(e) => setContract((c) => ({ ...c, emergencyContact: e.target.value }))}
          placeholder="Contatto emergenza opzionale (persona vera che può starti accanto)"
          className="w-full rounded bg-zinc-900 border border-zinc-800 px-2 py-1.5 text-xs"
        />
      </section>

      {/* ACTIONS */}
      <div className="sticky bottom-4 flex flex-col sm:flex-row gap-2 rounded-xl border border-zinc-800 bg-zinc-950/95 backdrop-blur p-3 z-10">
        <button onClick={onSaveDraft} disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-4 py-2.5 text-sm">
          <Save className="w-4 h-4" /> Salva bozza
        </button>
        {!contract.active ? (
          <button onClick={onSign} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-sm font-medium">
            <Shield className="w-4 h-4" /> Firma e attiva (90 giorni)
          </button>
        ) : (
          <button onClick={onDeactivate}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-rose-600/20 border border-rose-500/40 hover:bg-rose-600/30 px-4 py-2.5 text-sm font-medium">
            Disattiva contratto
          </button>
        )}
        {savedTick && <span className="text-xs text-emerald-400 self-center">✓ Salvato</span>}
      </div>
    </div>
  );
}

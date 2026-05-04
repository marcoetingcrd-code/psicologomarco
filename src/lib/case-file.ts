/**
 * Case File — dossier strategico persistente per conversazione.
 *
 * Storage ibrido:
 *   - Loggato + Supabase configurato: tabella public.case_files (cifrato AES-256-GCM)
 *   - Locale: localStorage[atlas-case-{conversationId|sid}]
 *
 * Il case file contiene i fatti raccolti, i tentativi, le domande aperte,
 * il piano (se generato) e il "pending thread" (cliffhanger/curiosity gap).
 */

import { getBrowserClient, isSupabaseReady } from "./supabase";

export type CaseDomain =
  | "ex_recovery"
  | "seduction"
  | "confrontation"
  | "business"
  | "addiction"
  | "relationship"
  | "fitness"
  | "habit"
  | "generic";

/**
 * Fatto strutturato del caso. La chiave è semantica e dipende dal dominio
 * (es. "durationRel", "breakupReason", "lastContactWho", "metric", "deadline").
 * Il valore è la formulazione naturale dell'utente, normalizzata se serve.
 */
export interface CaseFact {
  key: string;
  value: string;
  source: "user" | "atlas" | "inferred";
  confidence: number; // 0..1
  updatedAt: number;
}

/**
 * Slot atteso per un dominio. Pesa la readiness e guida le domande.
 */
export interface DomainSlot {
  key: string;
  label: string;
  weight: number; // contributo alla readiness 0..100
  required?: boolean;
  questionTemplate: string;
}

export interface CaseFile {
  conversationId: string;
  domain: CaseDomain;
  facts: Record<string, CaseFact>;
  attempts: string[];          // azioni che l'utente ha già provato
  openQuestions: string[];     // domande da fare in priorità
  pendingThread?: string;      // cliffhanger da riprendere alla prossima
  plan?: string;               // piano generato quando readiness >= soglia
  readiness: number;           // 0..100
  updatedAt: number;
}

const STORAGE_KEY = (id: string) => `atlas-case-${id}`;

// ---------------------------------------------------------------------------
// Definizione slot per dominio
// ---------------------------------------------------------------------------

export const DOMAIN_SLOTS: Record<CaseDomain, DomainSlot[]> = {
  ex_recovery: [
    { key: "durationRel", label: "Durata rapporto", weight: 18, required: true,
      questionTemplate: "Da quanto stavate insieme?" },
    { key: "daysSinceBreakup", label: "Giorni dalla rottura", weight: 14, required: true,
      questionTemplate: "Quando vi siete lasciati esattamente?" },
    { key: "breakupReason", label: "Motivo dichiarato", weight: 18, required: true,
      questionTemplate: "Cosa ti ha detto precisamente nel lasciarti? Le sue parole." },
    { key: "lastContact", label: "Ultimo contatto", weight: 12, required: true,
      questionTemplate: "Quando è stato l'ultimo contatto e chi ha scritto per ultimo?" },
    { key: "attempts", label: "Tentativi già fatti", weight: 12,
      questionTemplate: "Cosa hai già provato dopo la rottura? Messaggi, chiamate, incontri?" },
    { key: "otherPerson", label: "Terza persona coinvolta", weight: 10,
      questionTemplate: "C'è di mezzo qualcun altro o lei è single ora?" },
    { key: "distance", label: "Distanza geografica", weight: 8,
      questionTemplate: "Vivete vicini o lontani?" },
    { key: "userGoal", label: "Obiettivo reale", weight: 8,
      questionTemplate: "Vuoi davvero recuperarla o vuoi vincere la rottura? Sii onesto." },
  ],
  seduction: [
    { key: "context", label: "Contesto (online/dal vivo)", weight: 20, required: true,
      questionTemplate: "Vuoi conoscere persone online, dal vivo, o entrambi?" },
    { key: "blocker", label: "Blocco principale", weight: 20, required: true,
      questionTemplate: "Il tuo blocco vero è approcciare, conversazione, attrazione o rifiuto?" },
    { key: "targetType", label: "Tipo di persona", weight: 15,
      questionTemplate: "Che tipo di persona vuoi attrarre? Sii specifico." },
    { key: "lastAttempt", label: "Ultimo tentativo", weight: 15,
      questionTemplate: "Qual è stato il tuo ultimo tentativo concreto e com'è andato?" },
    { key: "currentPhysique", label: "Stato fisico/stile", weight: 10,
      questionTemplate: "Come stai a livello fisico/stile/cura di sé?" },
    { key: "socialEnv", label: "Ambiente sociale", weight: 10,
      questionTemplate: "Hai un ambiente sociale dove conoscere persone o sei isolato?" },
    { key: "userGoal", label: "Obiettivo (avventura/relazione)", weight: 10,
      questionTemplate: "Vuoi avventure, relazione, o non lo sai ancora?" },
  ],
  confrontation: [
    { key: "opponent", label: "Chi è l'avversario", weight: 20, required: true,
      questionTemplate: "Con chi stai per scontrarti — capo, partner, collega, familiare?" },
    { key: "stake", label: "Cosa è in gioco", weight: 20, required: true,
      questionTemplate: "Cosa vuoi ottenere precisamente da questo confronto?" },
    { key: "leverage", label: "Le tue leve", weight: 15,
      questionTemplate: "Quali leve hai su di lui (informazioni, posizione, alternative)?" },
    { key: "weaknesses", label: "Sue debolezze", weight: 15,
      questionTemplate: "Cosa lo rende vulnerabile? Cosa teme? Cosa desidera?" },
    { key: "history", label: "Storia precedente", weight: 10,
      questionTemplate: "Quando vi siete confrontati prima, com'è andata? Cosa funziona/non funziona con lui?" },
    { key: "deadline", label: "Tempistica", weight: 10,
      questionTemplate: "Quando avviene il confronto?" },
    { key: "exitOption", label: "Alternativa se perdi", weight: 10,
      questionTemplate: "Cosa fai se la cosa va male? Hai un piano B?" },
  ],
  business: [
    { key: "offer", label: "Cosa vendi", weight: 18, required: true,
      questionTemplate: "Cosa stai vendendo o vuoi vendere, in una frase?" },
    { key: "market", label: "Mercato target", weight: 15, required: true,
      questionTemplate: "Chi è il cliente reale, non quello ideale: chi ha il problema e lo paga?" },
    { key: "metric", label: "Metrica chiave", weight: 15, required: true,
      questionTemplate: "Qual è la metrica che decide vinto/perso ogni settimana?" },
    { key: "currentResult", label: "Risultato attuale", weight: 12,
      questionTemplate: "Dove sei oggi sulla metrica chiave?" },
    { key: "biggestBlock", label: "Blocco principale", weight: 15,
      questionTemplate: "Cosa ti blocca davvero — paura, soldi, tempo, competenza, o qualcos'altro?" },
    { key: "deadline", label: "Deadline reale", weight: 10,
      questionTemplate: "Entro quando devi avere risultati o cambia tutto?" },
    { key: "hoursPerWeek", label: "Ore disponibili", weight: 8,
      questionTemplate: "Quante ore reali alla settimana puoi metterci?" },
    { key: "exitOption", label: "Conseguenza fallimento", weight: 7,
      questionTemplate: "Cosa succede concretamente se non funziona?" },
  ],
  addiction: [
    { key: "substance", label: "Sostanza/comportamento", weight: 20, required: true,
      questionTemplate: "Cosa esattamente, in che dose, da quanto?" },
    { key: "trigger", label: "Trigger principali", weight: 20, required: true,
      questionTemplate: "In che momenti scatta? Orari, contesti, persone, emozioni?" },
    { key: "lastUse", label: "Ultimo uso", weight: 15,
      questionTemplate: "Quando l'ultima volta? Cosa è successo prima?" },
    { key: "longestClean", label: "Periodo più lungo pulito", weight: 15,
      questionTemplate: "Qual è stato il periodo più lungo senza cedere e cosa l'ha rotto?" },
    { key: "support", label: "Sistema di supporto", weight: 15,
      questionTemplate: "Hai qualcuno che sa o sei solo in questa cosa?" },
    { key: "userGoal", label: "Obiettivo reale", weight: 15,
      questionTemplate: "Smettere del tutto o ridurre? Sii onesto, non è la stessa cosa." },
  ],
  relationship: [
    { key: "partner", label: "Chi è il partner", weight: 15, required: true,
      questionTemplate: "Chi è — partner attuale, da quanto, situazione di vita?" },
    { key: "issue", label: "Problema centrale", weight: 20, required: true,
      questionTemplate: "Qual è il problema vero, non quello di superficie?" },
    { key: "yourPart", label: "La tua parte", weight: 18,
      questionTemplate: "Cosa stai facendo tu che alimenta il problema? Sii onesto." },
    { key: "tried", label: "Cosa avete provato", weight: 12,
      questionTemplate: "Cosa avete già provato e com'è finita?" },
    { key: "userGoal", label: "Obiettivo (riparare/uscire)", weight: 20,
      questionTemplate: "Vuoi riparare o uscire? Anche se non sei sicuro, propendi da una parte." },
    { key: "deadline", label: "Tempistica decisione", weight: 15,
      questionTemplate: "Entro quando devi decidere o la situazione decide per te?" },
  ],
  fitness: [
    { key: "currentState", label: "Stato attuale", weight: 18, required: true,
      questionTemplate: "Stato attuale: peso, livello allenamento, da quanto fermo o attivo?" },
    { key: "goal", label: "Obiettivo concreto", weight: 18, required: true,
      questionTemplate: "Obiettivo misurabile e con deadline: dimagrire X kg, alzare Y, correre Z entro?" },
    { key: "constraints", label: "Vincoli", weight: 15,
      questionTemplate: "Vincoli reali: ore disponibili, palestra/casa, infortuni, dieta possibile?" },
    { key: "biggestBlock", label: "Blocco abituale", weight: 15,
      questionTemplate: "Dove molli di solito — costanza, dieta, sonno, motivazione iniziale?" },
    { key: "previousAttempts", label: "Tentativi passati", weight: 12,
      questionTemplate: "Cosa hai provato prima e perché si è rotto?" },
    { key: "support", label: "Supporto", weight: 12,
      questionTemplate: "Hai qualcuno con cui ti alleni o sei solo?" },
    { key: "consequences", label: "Costo del fallimento", weight: 10,
      questionTemplate: "Cosa succede se nei prossimi 90 giorni non cambia nulla?" },
  ],
  habit: [
    { key: "habit", label: "Abitudine target", weight: 25, required: true,
      questionTemplate: "Quale abitudine precisa e misurabile vuoi installare?" },
    { key: "trigger", label: "Trigger esistente", weight: 20,
      questionTemplate: "A quale routine già esistente puoi agganciarla (dopo X faccio Y)?" },
    { key: "minimumViable", label: "Versione minima", weight: 15,
      questionTemplate: "Qual è la versione ridicolmente piccola che fai sempre, anche nei giorni di merda?" },
    { key: "previousFails", label: "Fallimenti precedenti", weight: 15,
      questionTemplate: "Hai già provato? Cosa è andato storto?" },
    { key: "deadline", label: "Orizzonte", weight: 10,
      questionTemplate: "Per quando vuoi che sia automatica?" },
    { key: "consequences", label: "Costo fallimento", weight: 15,
      questionTemplate: "Se tra 60 giorni non è abitudine, cosa cambia in peggio?" },
  ],
  generic: [
    { key: "topic", label: "Argomento", weight: 30, required: true,
      questionTemplate: "Su cosa esattamente vuoi che lavoriamo, in una frase?" },
    { key: "stake", label: "Cosa è in gioco", weight: 25,
      questionTemplate: "Cosa vuoi ottenere e cosa rischi se non lo ottieni?" },
    { key: "deadline", label: "Tempistica", weight: 20,
      questionTemplate: "Entro quando deve essere risolto?" },
    { key: "blocker", label: "Blocco principale", weight: 25,
      questionTemplate: "Cosa ti blocca davvero ora?" },
  ],
};

// ---------------------------------------------------------------------------
// Calcolo readiness
// ---------------------------------------------------------------------------

export function computeReadiness(domain: CaseDomain, facts: Record<string, CaseFact>): number {
  const slots = DOMAIN_SLOTS[domain] ?? DOMAIN_SLOTS.generic;
  let total = 0;
  let earned = 0;
  for (const s of slots) {
    total += s.weight;
    const f = facts[s.key];
    if (f && f.value && f.value.length >= 3 && f.confidence >= 0.4) {
      earned += s.weight * Math.min(1, f.confidence);
    }
  }
  if (total === 0) return 0;
  return Math.min(100, Math.round((earned / total) * 100));
}

export function nextMissingSlot(domain: CaseDomain, facts: Record<string, CaseFact>): DomainSlot | null {
  const slots = DOMAIN_SLOTS[domain] ?? DOMAIN_SLOTS.generic;
  // Required mancanti per primi, poi per peso decrescente
  const sorted = [...slots].sort((a, b) => {
    const aHas = !!facts[a.key]?.value;
    const bHas = !!facts[b.key]?.value;
    if (aHas !== bHas) return aHas ? 1 : -1;
    if (a.required !== b.required) return a.required ? -1 : 1;
    return b.weight - a.weight;
  });
  for (const s of sorted) {
    const f = facts[s.key];
    if (!f || !f.value || f.confidence < 0.4) return s;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

function emptyCase(conversationId: string, domain: CaseDomain = "generic"): CaseFile {
  return {
    conversationId,
    domain,
    facts: {},
    attempts: [],
    openQuestions: [],
    plan: undefined,
    pendingThread: undefined,
    readiness: 0,
    updatedAt: Date.now(),
  };
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const c = getBrowserClient();
  if (!c) return {};
  const { data } = await c.auth.getSession();
  if (!data.session) return {};
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function isCloud(): Promise<boolean> {
  if (!isSupabaseReady()) return false;
  const c = getBrowserClient();
  if (!c) return false;
  const { data } = await c.auth.getSession();
  return !!data.session;
}

/** Carica case file da cloud o localStorage. Se non esiste, lo inizializza. */
export async function loadCaseFile(id: string, domain: CaseDomain = "generic"): Promise<CaseFile> {
  if (typeof window !== "undefined") {
    if (await isCloud()) {
      try {
        const r = await fetch(`/api/case?conversationId=${encodeURIComponent(id)}`, {
          headers: await getAuthHeader(),
        });
        if (r.ok) {
          const d = await r.json();
          if (d.caseFile) return d.caseFile as CaseFile;
        }
      } catch {
        /* fallback locale */
      }
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY(id));
      if (raw) {
        const cf = JSON.parse(raw) as CaseFile;
        return cf;
      }
    } catch {
      /* ignore */
    }
  }
  return emptyCase(id, domain);
}

/** Salva case file (cloud + locale come fallback redundante). */
export async function saveCaseFile(cf: CaseFile): Promise<void> {
  if (typeof window === "undefined") return;
  cf.updatedAt = Date.now();
  cf.readiness = computeReadiness(cf.domain, cf.facts);
  try {
    localStorage.setItem(STORAGE_KEY(cf.conversationId), JSON.stringify(cf));
  } catch {
    /* quota piena, ignora */
  }
  if (await isCloud()) {
    try {
      await fetch("/api/case", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ action: "update", caseFile: cf }),
      });
    } catch {
      /* offline, locale è già salvato */
    }
  }
}

/** Aggiunge/aggiorna un fatto. Mantiene il vecchio se confidence nuovo è inferiore. */
export function applyFact(cf: CaseFile, fact: CaseFact): CaseFile {
  const existing = cf.facts[fact.key];
  if (existing && existing.confidence > fact.confidence + 0.1) return cf;
  return {
    ...cf,
    facts: { ...cf.facts, [fact.key]: { ...fact, updatedAt: Date.now() } },
    updatedAt: Date.now(),
  };
}

/**
 * Versione client-safe dell'estrattore di fatti: solo heuristic regex, zero LLM.
 * Sicura nel browser, sincrona, veloce. Per LLM extraction usare /api/case action=extract.
 */
export async function extractAndApplyLight(text: string, cf: CaseFile): Promise<CaseFile> {
  const t = text.toLowerCase();
  const now = Date.now();

  // --- Domain inference inline ---
  const DOMAIN_RX: { domain: CaseDomain; rx: RegExp }[] = [
    { domain: "ex_recovery", rx: /\b(ex\b|riconquist|riattrar|mi ha (lasciat|mollat)|tornare con|recuperare il rapporto|rottura)/i },
    { domain: "seduction", rx: /\b(rimorchiar|sedurre|approcciar|conquistare(?!.*\bex\b)|flirt|tinder|bumble|incontri)/i },
    { domain: "addiction", rx: /\b(alcol|alcoo?l|sigaret|fumo\b|nicotin|cocaina|cannabis|astinenz|craving|dipendenz)/i },
    { domain: "fitness", rx: /\b(palestra|allenament|dimagrir|massa muscolare|cardio|squat|bench|panca|stacchi)/i },
    { domain: "business", rx: /\b(startup|fatturato|cliente|vendite|imprend|carriera|landing|funnel|saas)/i },
    { domain: "confrontation", rx: /\b(confronto|scontro|capo|collega|negoziaz|litig)/i },
    { domain: "relationship", rx: /\b(moglie|marito|fidanzat|partner|matrimonio|convivenza)/i },
    { domain: "habit", rx: /\b(abitudin|routine|ogni giorno|costanza|disciplina quotidiana)/i },
  ];
  let nextDomain = cf.domain;
  for (const { domain, rx } of DOMAIN_RX) {
    if (rx.test(t)) {
      // Promuovi solo se attualmente generic, oppure dominio corrente non riconfermato
      if (cf.domain === "generic") nextDomain = domain;
      break;
    }
  }
  let next: CaseFile = nextDomain !== cf.domain ? { ...cf, domain: nextDomain } : cf;

  // --- Fact extraction per dominio (client-side minimo) ---
  const push = (key: string, value: string | null, conf = 0.7) => {
    if (!value || value.length < 2) return;
    next = applyFact(next, { key, value: value.trim().slice(0, 300), source: "user", confidence: conf, updatedAt: now });
  };

  if (next.domain === "ex_recovery") {
    const dur = t.match(/(\d+)\s*(?:anni|anno|mesi|mese|settiman[ae]|giorn[oi])\b/);
    if (dur) push("durationRel", dur[0], 0.85);
    const ago = t.match(/(?:circa\s+)?\d+\s*(?:giorn[oi]|settiman[ae]|mesi|mese|anni|anno)\s*fa\b|\b(?:ieri|oggi|stamattina|stasera|stanotte)\b/);
    if (ago) push("daysSinceBreakup", ago[0], 0.8);
    const quoted = text.match(/["«''""„"]([^"«»''""„"]{6,180})["»''""„"]/);
    if (quoted) push("breakupReason", quoted[1], 0.9);
    else if (/\bnon c'?è (più )?chimica|cresciuti diversi|cambiat[ai]|non mi ami più\b/i.test(text)) {
      const m = text.match(/\bnon c'?è (?:più )?chimica|cresciuti diversi|cambiat[ai]|non mi ami più\b/i);
      if (m) push("breakupReason", m[0], 0.7);
    }
    if (/\bbloccat[oa]|ghost|non risponde\b/i.test(t)) push("lastContact", "non risponde / bloccato", 0.7);
    const km = t.match(/\b(\d+)\s*km/);
    if (km) push("distance", km[0], 0.85);
    if (/\bc'è un altro|c'è un'altra|sta con un altro|sta con un'altra\b/i.test(t)) push("otherPerson", "sì, terza persona coinvolta", 0.8);
    else if (/\bè single|nessun altro|nessuno\b/i.test(t)) push("otherPerson", "lei single", 0.65);
    // Tentativi
    const attempts = [...text.matchAll(/(?:le ho scritto|l'ho chiamat|le ho mandato|ho mandato|le ho detto|ho fatto \d+\s*km)\s*([^.!?\n]{0,150})/gi)];
    for (const m of attempts) next = appendAttempt(next, m[0]);
  } else if (next.domain === "seduction") {
    if (/\b(online|tinder|bumble|hinge|instagram)\b/i.test(t)) push("context", "online", 0.8);
    else if (/\b(dal vivo|in giro|al bar|in palestra|al lavoro|in piazza)\b/i.test(t)) push("context", "dal vivo", 0.8);
    if (/\bapprocciar|paura del rifiuto|non mi avvicin\b/i.test(t)) push("blocker", "approccio", 0.7);
    else if (/\bconversazione|non so cosa dire|finisce il discorso\b/i.test(t)) push("blocker", "mantenere conversazione", 0.7);
    else if (/\battrazione|friendzone\b/i.test(t)) push("blocker", "creare attrazione", 0.65);
  } else if (next.domain === "addiction") {
    if (/\balcol|vino|birra|drink\b/i.test(t)) {
      const m = t.match(/\balcol|vino|birra|drink\b[^.!?\n]{0,80}/i);
      if (m) push("substance", m[0], 0.8);
    } else if (/\bsigaret|fumo|nicotin|svapo\b/i.test(t)) push("substance", "fumo", 0.85);
  } else if (next.domain === "fitness") {
    const w = t.match(/\b(\d+)\s*(?:kg|chil[oi])\b/);
    if (w) push("currentState", w[0], 0.7);
  }

  next = { ...next, readiness: computeReadiness(next.domain, next.facts), updatedAt: Date.now() };
  return next;
}

export function appendAttempt(cf: CaseFile, attempt: string): CaseFile {
  const a = attempt.trim();
  if (!a) return cf;
  if (cf.attempts.includes(a)) return cf;
  return { ...cf, attempts: [...cf.attempts, a].slice(-30), updatedAt: Date.now() };
}

/**
 * Sintesi compatta del case file per iniezione nel prompt LLM.
 * Volutamente densa, italiano, formato testuale (non JSON, l'LLM legge meglio).
 */
export function summarizeCaseFile(cf: CaseFile): string {
  const slots = DOMAIN_SLOTS[cf.domain] ?? DOMAIN_SLOTS.generic;
  const lines: string[] = [];
  lines.push(`Dominio: ${cf.domain}`);
  lines.push(`Readiness intel: ${cf.readiness}%`);
  const knownFacts = slots
    .map((s) => ({ s, f: cf.facts[s.key] }))
    .filter((x) => x.f && x.f.value);
  if (knownFacts.length > 0) {
    lines.push("Fatti noti:");
    for (const { s, f } of knownFacts) lines.push(`  - ${s.label}: ${f!.value}`);
  } else {
    lines.push("Fatti noti: nessuno ancora.");
  }
  if (cf.attempts.length > 0) {
    lines.push(`Tentativi già fatti: ${cf.attempts.slice(-8).join(" | ")}`);
  }
  if (cf.pendingThread) {
    lines.push(`Filo lasciato in sospeso: ${cf.pendingThread}`);
  }
  if (cf.plan) {
    lines.push(`Piano già generato (riferiti a esso, non duplicare): ${cf.plan.slice(0, 200)}…`);
  }
  // Slot mancanti più importanti
  const missing = slots
    .filter((s) => !cf.facts[s.key] || (cf.facts[s.key].confidence ?? 0) < 0.4)
    .sort((a, b) => (b.required ? 1 : 0) - (a.required ? 1 : 0) || b.weight - a.weight)
    .slice(0, 3);
  if (missing.length > 0) {
    lines.push(`Info ancora mancanti per piano solido: ${missing.map((m) => m.label).join(", ")}`);
  }
  return lines.join("\n");
}

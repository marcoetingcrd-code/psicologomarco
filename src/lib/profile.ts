// User profiling: apprende pattern di domande in sessione, mantiene centroide
// semantico del focus dell'utente, e predice le prossime 3-5 domande probabili.
// In produzione: persisti in Supabase per utente. Qui: in-memory per sessione.

import { embedQuery } from "./vectorstore";
import { CORPUS } from "./corpus";

type QEntry = { query: string; vector: number[]; t: number };
const SESSIONS = new Map<string, QEntry[]>();

export async function recordQuery(sessionId: string, query: string) {
  const vector = await embedQuery(query);
  const arr = SESSIONS.get(sessionId) ?? [];
  arr.push({ query, vector, t: Date.now() });
  // keep last 30
  while (arr.length > 30) arr.shift();
  SESSIONS.set(sessionId, arr);
}

export function getHistory(sessionId: string): QEntry[] {
  return SESSIONS.get(sessionId) ?? [];
}

function centroid(vectors: number[][]): number[] {
  if (!vectors.length) return [];
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  for (const v of vectors) for (let i = 0; i < dim; i++) out[i] += v[i];
  for (let i = 0; i < dim; i++) out[i] /= vectors.length;
  const n = Math.sqrt(out.reduce((s, x) => s + x * x, 0)) || 1;
  return out.map((x) => x / n);
}

// Genera pool di candidate next-questions dal corpus (una per topic cluster).
function candidateQuestions(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const templates = [
    (s: string) => `Come applicare praticamente ${s.toLowerCase()} nella mia vita?`,
    (s: string) => `Quali studi contraddicono ${s.toLowerCase()}?`,
    (s: string) => `Qual è il meccanismo neurobiologico di ${s.toLowerCase()}?`,
    (s: string) => `Come misurare progressi su ${s.toLowerCase()}?`,
  ];
  for (const src of CORPUS) {
    for (const topic of src.topic) {
      if (seen.has(topic)) continue;
      seen.add(topic);
      out.push(templates[out.length % templates.length](topic));
    }
  }
  // extra seed questions
  out.push(
    "Come costruire attaccamento sicuro da adulto?",
    "Quali abitudini mente+corpo aumentano realmente l'attrattività?",
    "Come distinguere attrazione sana da attivazione ansiosa?",
    "Che differenza c'è tra carisma allenabile e manipolazione?",
    "Qual è un protocollo di journaling evidence-based?",
    "Come allenare la regolazione emotiva nel quotidiano?",
  );
  return Array.from(new Set(out));
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) dot += a[i] * b[i];
  return dot;
}

export async function predictNext(sessionId: string, topK = 5): Promise<string[]> {
  const hist = getHistory(sessionId);
  if (!hist.length) {
    // cold start: mostra domande seed più ampie
    return [
      "Cos'è l'attaccamento sicuro e come si costruisce?",
      "Quali studi smontano le tecniche pick-up?",
      "Come il sonno influenza attrattività e relazioni?",
      "Che cos'è il self-expansion model di Aron?",
      "Come misurare empiricamente l'autostima?",
    ].slice(0, topK);
  }
  // Use recency-weighted centroid (more weight on recent queries)
  const weighted: number[][] = [];
  hist.forEach((h, i) => {
    const w = Math.pow(1.3, i); // recency bias
    for (let k = 0; k < w; k++) weighted.push(h.vector);
  });
  const c = centroid(weighted);

  const candidates = candidateQuestions();
  const scored: { q: string; s: number }[] = [];
  for (const q of candidates) {
    const v = await embedQuery(q);
    scored.push({ q, s: cosine(v, c) });
  }
  scored.sort((a, b) => b.s - a.s);
  // Avoid near-duplicates of past questions
  const past = hist.map((h) => h.query.toLowerCase());
  const filtered = scored.filter((x) => !past.some((p) => x.q.toLowerCase().includes(p.slice(0, 20))));
  return filtered.slice(0, topK).map((x) => x.q);
}

// Pre-cache: risposte precomputate per le prossime domande predette.
const ANSWER_CACHE = new Map<string, string>();
export function cacheAnswer(q: string, a: string) {
  ANSWER_CACHE.set(q.toLowerCase().trim(), a);
}
export function getCachedAnswer(q: string): string | undefined {
  return ANSWER_CACHE.get(q.toLowerCase().trim());
}

// ========== PROFILO PSICOLOGICO DINAMICO ==========

export type Confidence = "low" | "medium" | "high";

export interface UserProfile {
  sessionId: string;
  // Attaccamento
  attachment: {
    anxiety?: number; // 1-7 ECR-R
    avoidance?: number; // 1-7 ECR-R
    style?: "secure" | "anxious" | "avoidant" | "fearful";
    confidence: Confidence;
  };
  // Trauma infantile
  trauma: {
    aceScore?: number; // 0-10
    aceRisk?: "low" | "moderate" | "high" | "severe";
    confidence: Confidence;
  };
  // Regolazione emotiva
  emotionalRegulation: {
    pattern?: "suppression" | "rumination" | "expression" | "reflection" | "avoidance";
    confidence: Confidence;
  };
  // Focus vita
  lifeThemes: string[]; // lavoro, relazione, corpo, identità, sessualità, famiglia
  // Obiettivo esplicito
  goals?: string;
  // Pattern rilevati dal journal
  journalPatterns: {
    dominantEmotions: string[];
    recurringThemes: string[];
    insightLevel: "low" | "medium" | "high";
    negativeDensity: "low" | "medium" | "high";
  };
  // Interazioni
  interactionCount: number;
  lastInteractionAt: number;
  // Probing già fatto (per non ripetere)
  probedSlots: string[];
}

const PROFILES = new Map<string, UserProfile>();

function emptyProfile(sessionId: string): UserProfile {
  return {
    sessionId,
    attachment: { confidence: "low" },
    trauma: { confidence: "low" },
    emotionalRegulation: { confidence: "low" },
    lifeThemes: [],
    goals: undefined,
    journalPatterns: { dominantEmotions: [], recurringThemes: [], insightLevel: "low", negativeDensity: "low" },
    interactionCount: 0,
    lastInteractionAt: Date.now(),
    probedSlots: [],
  };
}

export function getProfile(sessionId: string): UserProfile {
  return PROFILES.get(sessionId) ?? emptyProfile(sessionId);
}

export function setProfile(sessionId: string, profile: UserProfile) {
  PROFILES.set(sessionId, profile);
}

export function updateProfile(sessionId: string, patch: Partial<UserProfile>) {
  const p = getProfile(sessionId);
  const next = { ...p, ...patch, sessionId };
  PROFILES.set(sessionId, next);
  return next;
}

// Riempie profilo da risultato assessment
export function ingestAssessment(sessionId: string, scaleId: string, scores: Record<string, any>) {
  const p = getProfile(sessionId);
  if (scaleId === "ecr-r-short") {
    p.attachment.anxiety = scores.anxiety;
    p.attachment.avoidance = scores.avoidance;
    p.attachment.style = scores.style;
    p.attachment.confidence = "high";
  }
  if (scaleId === "ace") {
    p.trauma.aceScore = scores.aceTotal;
    p.trauma.aceRisk = scores.risk;
    p.trauma.confidence = "high";
  }
  setProfile(sessionId, p);
}

// Riempie profilo da journal analysis
export function ingestJournal(sessionId: string, analysis: any) {
  const p = getProfile(sessionId);
  if (analysis?.dominantEmotions) {
    p.journalPatterns.dominantEmotions = analysis.dominantEmotions;
  }
  if (analysis?.themes) {
    p.journalPatterns.recurringThemes = analysis.themes;
  }
  if (analysis?.insightLevel) {
    p.journalPatterns.insightLevel = analysis.insightLevel;
  }
  if (analysis?.negativeDensity) {
    p.journalPatterns.negativeDensity = analysis.negativeDensity;
  }
  // Infer emotional regulation pattern
  if (analysis?.dominantEmotions?.includes("rabbia") || analysis?.dominantEmotions?.includes("resentment")) {
    p.emotionalRegulation.pattern = "expression";
    p.emotionalRegulation.confidence = "medium";
  } else if (analysis?.dominantEmotions?.includes("tristezza") || analysis?.dominantEmotions?.includes("vuoto")) {
    p.emotionalRegulation.pattern = "rumination";
    p.emotionalRegulation.confidence = "medium";
  } else if (analysis?.insightLevel === "high") {
    p.emotionalRegulation.pattern = "reflection";
    p.emotionalRegulation.confidence = "medium";
  }
  setProfile(sessionId, p);
}

// Incrementa contatore interazione
export function recordInteraction(sessionId: string) {
  const p = getProfile(sessionId);
  p.interactionCount += 1;
  p.lastInteractionAt = Date.now();
  setProfile(sessionId, p);
}

// ========== GAP DETECTION E PROBING ==========

export interface ProbingQuestion {
  slot: string;
  question: string;
  context: string; // perché è rilevante ora
  priority: number; // 1-10
}

export function detectGaps(sessionId: string, currentQuery: string): ProbingQuestion[] {
  const p = getProfile(sessionId);
  const q = currentQuery.toLowerCase();
  const gaps: ProbingQuestion[] = [];

  // Se attachment è low e la domanda parla di relazione
  if (p.attachment.confidence === "low" && !p.probedSlots.includes("attachment") &&
      (q.includes("ragazza") || q.includes("moglie") || q.includes("partner") || q.includes("relazione"))) {
    gaps.push({
      slot: "attachment",
      question: "Quando lei si allontana emotivamente, tu tendi a inseguirla con messaggi/chiamate, o ti chiudi e aspetti in silenzio?",
      context: "Questo mi aiuta a capire il tuo stile di attaccamento, che influenza come percepisci la distanza nel rapporto.",
      priority: 9,
    });
  }

  // Se trauma è low e ci sono segnali
  if (p.trauma.confidence === "low" && !p.probedSlots.includes("trauma") &&
      (q.includes("infanzia") || q.includes("mamma") || q.includes("padre") || q.includes("famiglia"))) {
    gaps.push({
      slot: "trauma",
      question: "Quando eri bambino, quando eri triste o spaventato, i tuoi genitori ti abbracciavano e ti rassicuravano, o ti dicevano di 'non piangere' / 'sii forte'?",
      context: "Le esperienze infantili modellano come regoliamo emozioni e intimità da adulti.",
      priority: 8,
    });
  }

  // Se emotional regulation è low e ci sono emozioni forti
  if (p.emotionalRegulation.confidence === "low" && !p.probedSlots.includes("emotional_regulation") &&
      (q.includes("rabbia") || q.includes("ansia") || q.includes("panico") || q.includes("tristezza"))) {
    gaps.push({
      slot: "emotional_regulation",
      question: "Quando provi un'emozione intensa (rabbia, ansia, tristezza), cosa fai tipicamente: la esprimi subito, la reprimi, ci pensi ossessivamente, o provi a capire cosa c'è sotto?",
      context: "Come gestiamo le emozioni determina la qualità delle nostre relazioni più di qualsiasi altra cosa.",
      priority: 8,
    });
  }

  // Se life themes è vuoto
  if (p.lifeThemes.length === 0 && !p.probedSlots.includes("life_themes") && p.interactionCount >= 2) {
    gaps.push({
      slot: "life_themes",
      question: "In questo momento della tua vita, quale area ti pesa di più: il lavoro/caro, le relazioni affettive, il corpo/salute, o il senso di chi sei?",
      context: "Per darti risposte davvero mirate, devo capire dove è il tuo centro di gravità emotivo.",
      priority: 7,
    });
  }

  // Se goals è vuoto
  if (!p.goals && !p.probedSlots.includes("goals") && p.interactionCount >= 3) {
    gaps.push({
      slot: "goals",
      question: "Cosa speri di ottenere usando Atlas? Un esempio concreto: 'voglio capire perché finisco sempre con persone che mi abbandonano'.",
      context: "Conoscere il tuo obiettivo mi permette di collegare ogni risposta a un percorso che ha senso per te.",
      priority: 6,
    });
  }

  return gaps.sort((a, b) => b.priority - a.priority);
}

export function markProbed(sessionId: string, slot: string) {
  const p = getProfile(sessionId);
  if (!p.probedSlots.includes(slot)) {
    p.probedSlots.push(slot);
  }
  setProfile(sessionId, p);
}

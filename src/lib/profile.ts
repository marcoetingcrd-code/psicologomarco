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

/**
 * Mood Router — rileva stato emotivo dal messaggio + storia recente
 * e seleziona voce + leva manipolativa ottimale.
 *
 * Heuristic-based per zero-latency. Server-side e client-safe.
 */

import type { ManipulationConsent } from "./contract";
import type { VoiceId } from "./voices";

export type Mood =
  | "determinato"
  | "depresso"
  | "agitato"
  | "euforico"
  | "paralizzato"
  | "stanco"
  | "fingendo_stanco"  // usa "stanco" come scusa quando ha energia per altro
  | "scusante"         // cerca scuse
  | "vittimista"
  | "neutro";

const MOOD_PATTERNS: { mood: Mood; rx: RegExp; weight: number }[] = [
  { mood: "depresso", rx: /\b(non ce la faccio|crolla|crollo|distrutto|svuotato|annientato|piango|sto male|disperat|annientat)/i, weight: 3 },
  { mood: "paralizzato", rx: /\b(bloccato|paralizzato|fermo|congelato|non riesco a iniziare|procrastin|non so da dove)/i, weight: 3 },
  { mood: "agitato", rx: /\b(agitato|nervoso|ansia|in panico|cuore in gola|sto andando in tilt|non riesco a stare fermo)/i, weight: 2 },
  { mood: "euforico", rx: /\b(ce l'ho fatta|finalmente|grande|wow|figo|euforico|carichissimo|spaccato tutto)/i, weight: 2 },
  { mood: "scusante", rx: /\b(non ho avuto tempo|domani|più avanti|quando posso|forse|magari|vedremo|non era il momento|non sono pronto)/i, weight: 2 },
  { mood: "stanco", rx: /\b(sono stanco|esausto|fuso|distrutto dal lavoro|non ho energie|spossato)/i, weight: 2 },
  { mood: "vittimista", rx: /\b(perché a me|sempre a me|non è giusto|tutti contro|niente funziona mai|sfortunato)/i, weight: 2 },
  { mood: "determinato", rx: /\b(faccio|farò|mi metto|adesso|stasera|deciso|basta|stop|cambio)/i, weight: 1.5 },
];

export function detectMood(text: string, recentText?: string): Mood {
  const scores: Record<string, number> = {};
  const corpus = (text + " " + (recentText ?? "")).toLowerCase();
  for (const { mood, rx, weight } of MOOD_PATTERNS) {
    if (rx.test(corpus)) scores[mood] = (scores[mood] ?? 0) + weight;
  }
  // "Fingendo stanco" euristica: stanco + parole di evitamento + presenza azioni a basso costo nello stesso messaggio
  if (scores.stanco && /\b(domani|più tardi|forse|vediamo|magari)/i.test(text)) {
    scores.fingendo_stanco = (scores.fingendo_stanco ?? 0) + 2;
  }
  let best: Mood = "neutro";
  let bestScore = 0;
  for (const m in scores) {
    if (scores[m] > bestScore) {
      best = m as Mood;
      bestScore = scores[m];
    }
  }
  return best;
}

export interface MoodRouting {
  mood: Mood;
  voice: VoiceId;
  reason: string;
  /** Suggerimento operativo per il prompt: leva consigliata. */
  suggestedLever: string;
}

export function routeVoice(mood: Mood, consent: ManipulationConsent): MoodRouting {
  switch (mood) {
    case "depresso":
      // Mai aggressivo se depresso: te_vincente o stratega_freddo soft
      return {
        mood,
        voice: "te_vincente",
        reason: "stato depressivo: niente derisione/vergogna, serve identità + futuro",
        suggestedLever: "future_self + identity",
      };
    case "paralizzato":
      return {
        mood,
        voice: consent.allowMockery ? "fratello_beffardo" : "stratega_freddo",
        reason: "paralisi: ridurre la posta, sbloccare con UN passo minimo",
        suggestedLever: "challenge + minimum_viable_action",
      };
    case "agitato":
      return {
        mood,
        voice: "stratega_freddo",
        reason: "agitazione: serve calma operativa e una mossa concreta",
        suggestedLever: "structure + clarity",
      };
    case "euforico":
      return {
        mood,
        voice: "mentore_severo",
        reason: "euforia: capitalizzare con disciplina, non disperdere",
        suggestedLever: "selective_validation + structure",
      };
    case "scusante":
    case "fingendo_stanco":
      return {
        mood,
        voice: consent.allowShame || consent.allowMockery ? "coach_brutale" : "stratega_freddo",
        reason: "scuse rilevate: nominarle e forzare azione minima",
        suggestedLever: "excuse_buster + identity_challenge",
      };
    case "stanco":
      return {
        mood,
        voice: "stratega_freddo",
        reason: "stanchezza reale: micro-azione + recupero programmato",
        suggestedLever: "minimum_viable_action",
      };
    case "vittimista":
      return {
        mood,
        voice: consent.allowIdentityChallenge ? "mentore_severo" : "stratega_freddo",
        reason: "vittimismo: ribaltare locus of control, identità",
        suggestedLever: "identity_challenge + reframing",
      };
    case "determinato":
      return {
        mood,
        voice: "stratega_freddo",
        reason: "determinato: capitalizzare con piano concreto e immediato",
        suggestedLever: "action + verification",
      };
    default:
      return {
        mood: "neutro",
        voice: "stratega_freddo",
        reason: "neutro: voce default operativa",
        suggestedLever: "structure",
      };
  }
}

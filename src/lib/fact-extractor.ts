/**
 * Fact Extractor — estrae fatti strutturati dal messaggio dell'utente
 * e li mappa sui DomainSlot del case file. Server-side.
 *
 * Pipeline:
 *   1. Quick heuristics (regex/keyword) → cattura fatti ovvi senza LLM call
 *      (durata, date relative, blocchi, riferimenti a persone)
 *   2. Se Gemini disponibile e il messaggio è abbastanza ricco, LLM extraction
 *      con structured output che restituisce facts/attempts/domain.
 *   3. Detezione domain inferita se ancora "generic".
 *
 * Contratto: NON inventa fatti che l'utente non ha detto. confidence riflette quanto
 * la heuristic/LLM si fida.
 */

import { generate, hasGemini } from "./gemini";
import {
  type CaseDomain,
  type CaseFact,
  type CaseFile,
  applyFact,
  appendAttempt,
  computeReadiness,
  DOMAIN_SLOTS,
} from "./case-file";

interface Extraction {
  domain?: CaseDomain;
  facts: CaseFact[];
  attempts: string[];
}

// ---------------------------------------------------------------------------
// Domain detection (semplice ma robusto)
// ---------------------------------------------------------------------------

const DOMAIN_PATTERNS: { domain: CaseDomain; rx: RegExp }[] = [
  { domain: "ex_recovery", rx: /\b(ex\b|riconquist|riattrar|mi ha (lasciat|mollat)|tornare con|recuperare il rapporto|rottura)/i },
  { domain: "seduction", rx: /\b(rimorchiar|sedurre|approcciar|conquistare(?!.*\bex\b)|flirt|tinder|bumble|dating app|incontri)/i },
  { domain: "addiction", rx: /\b(alcol|alcoo?l|sigaret|fumo\b|nicotin|cocaina|cannabis|eroina|gioco d'azzardo|porno|astinenz|craving|dipendenz)/i },
  { domain: "fitness", rx: /\b(palestra|allenament|dimagrir|massa muscolare|chil[oi]\s*in (più|meno)|cardio|squat|bench|panca|stacchi|muscol)/i },
  { domain: "business", rx: /\b(startup|fatturato|cliente|vendite|marketing|imprend|carriera|prezzo|landing|funnel|saas|ecommerce|negozio)/i },
  { domain: "confrontation", rx: /\b(confronto|scontro|capo|collega|negoziaz|discussione|litig|battaglia|tribunal|causa legale|farmi valere)/i },
  { domain: "relationship", rx: /\b(moglie|marito|fidanzat|partner|coppia|relazione attuale|matrimonio|convivenza)/i },
  { domain: "habit", rx: /\b(abitudin|routine|ogni giorno|tutti i giorni|costanza|disciplina quotidiana)/i },
];

export function inferDomain(text: string, current: CaseDomain = "generic"): CaseDomain {
  // Se già su dominio specifico, non degradare a generic
  if (current !== "generic") {
    // Ma permetti escalation se compaiono segnali fortissimi di altro dominio
    for (const { domain, rx } of DOMAIN_PATTERNS) {
      if (domain !== current && rx.test(text)) {
        // Solo escalate se il pattern è vicino all'inizio (focus principale del messaggio)
        const m = text.toLowerCase().search(rx);
        if (m >= 0 && m < 60) return domain;
      }
    }
    return current;
  }
  for (const { domain, rx } of DOMAIN_PATTERNS) {
    if (rx.test(text)) return domain;
  }
  return "generic";
}

// ---------------------------------------------------------------------------
// Heuristic extraction (zero LLM, sempre attivo)
// ---------------------------------------------------------------------------

function extractDuration(text: string): { value: string; conf: number } | null {
  const m = text.match(/(\d+)\s*(?:anni|anno|mesi|mese|settiman[ae]|giorn[oi])\b/i);
  if (m) return { value: m[0], conf: 0.85 };
  return null;
}

function extractTimeAgo(text: string): { value: string; conf: number } | null {
  const patterns = [
    /(?:circa\s+)?(\d+)\s*(?:giorn[oi]|settiman[ae]|mesi|mese|anni|anno)\s*fa\b/i,
    /(?:ieri|stamattina|stasera|stanotte|oggi)\b/i,
    /(?:la scorsa|lo scorso)\s+\w+/i,
    /(?:da|nelle ultime)\s+\d+\s*(giorn[oi]|settiman[ae])/i,
  ];
  for (const rx of patterns) {
    const m = text.match(rx);
    if (m) return { value: m[0], conf: 0.8 };
  }
  return null;
}

function extractBreakupReason(text: string): { value: string; conf: number } | null {
  // Cerca virgolette con cose che lei/lui ha detto
  const quoted = text.match(/["«''""„"]([^"«»''""„"]{6,180})["»''""„"]/);
  if (quoted) return { value: quoted[1].trim(), conf: 0.9 };
  // Frasi tipiche
  const tipical = [
    /(?:mi ha detto che|ha detto che|mi ha (?:lasciato|mollato).*perché|perché)\s+([^.!?\n]{8,200})/i,
    /(?:non c'è più|non sento più|non provo più|non c'è più chimica|cresciuti diversi|cambiat[ai])([^.!?\n]{0,120})/i,
  ];
  for (const rx of tipical) {
    const m = text.match(rx);
    if (m) return { value: (m[1] ?? m[0]).trim(), conf: 0.7 };
  }
  return null;
}

function extractLastContact(text: string): { value: string; conf: number } | null {
  if (/(?:l'ultimo contatto|ultimo messaggio|ultima volta che|ultima telefonata)/i.test(text)) {
    const m = text.match(/(?:l'ultimo contatto|ultimo messaggio|ultima volta).{0,100}/i);
    if (m) return { value: m[0].trim(), conf: 0.75 };
  }
  if (/(?:bloccat[oa]|ghost|non risponde|ignor)/i.test(text)) {
    const m = text.match(/(?:bloccat[oa]|ghost|non risponde|ignor).{0,80}/i);
    if (m) return { value: m[0].trim(), conf: 0.7 };
  }
  return null;
}

function extractAttempts(text: string): string[] {
  const out: string[] = [];
  const patterns = [
    /(?:ho già provato|ho provato|le ho scritto|l'ho chiamat|ho mandato|le ho mandato|le ho detto)\s+([^.!?\n]{4,150})/gi,
    /(?:le mando|continuo a scriver|sono andato a casa sua|ho fatto \d+\s*km)\s*([^.!?\n]{0,150})/gi,
  ];
  for (const rx of patterns) {
    const matches = [...text.matchAll(rx)];
    for (const m of matches) out.push(m[0].trim());
  }
  return out.slice(0, 5);
}

function extractDistance(text: string): { value: string; conf: number } | null {
  const m = text.match(/\b(\d+)\s*(km|chilometr|metr)/i);
  if (m) return { value: m[0], conf: 0.85 };
  if (/\b(stessa città|stesso quartiere|vicini|distanz[ae]|lontan[oi]|altro paese|estero)/i.test(text)) {
    const m2 = text.match(/\b(stessa città|stesso quartiere|vicini|distanz[ae]|lontan[oi]|altro paese|estero)/i);
    if (m2) return { value: m2[0], conf: 0.65 };
  }
  return null;
}

function extractOtherPerson(text: string): { value: string; conf: number } | null {
  if (/\b(c'è un altro|c'è un'altra|sta con un altro|sta con un'altra|è uscita con|si è messa con)/i.test(text)) {
    return { value: "sì, terza persona coinvolta", conf: 0.8 };
  }
  if (/\b(è single|non c'è nessuno|nessun altro|sola)/i.test(text)) {
    return { value: "lei single attualmente", conf: 0.7 };
  }
  return null;
}

function quickExtract(text: string, domain: CaseDomain): Extraction {
  const facts: CaseFact[] = [];
  const attempts: string[] = [];
  const now = Date.now();
  const push = (key: string, x: { value: string; conf: number } | null) => {
    if (x) facts.push({ key, value: x.value, source: "user", confidence: x.conf, updatedAt: now });
  };

  if (domain === "ex_recovery") {
    push("durationRel", extractDuration(text));
    push("daysSinceBreakup", extractTimeAgo(text));
    push("breakupReason", extractBreakupReason(text));
    push("lastContact", extractLastContact(text));
    push("distance", extractDistance(text));
    push("otherPerson", extractOtherPerson(text));
    attempts.push(...extractAttempts(text));
  } else if (domain === "seduction") {
    if (/\b(online|tinder|bumble|hinge|instagram)\b/i.test(text)) {
      facts.push({ key: "context", value: "online", source: "user", confidence: 0.8, updatedAt: now });
    } else if (/\b(dal vivo|in giro|al bar|in palestra|in università|in piazza|al lavoro)\b/i.test(text)) {
      facts.push({ key: "context", value: "dal vivo", source: "user", confidence: 0.8, updatedAt: now });
    }
    if (/\b(approcciar|paura del rifiuto|non mi avvicin)/i.test(text)) {
      facts.push({ key: "blocker", value: "approccio", source: "user", confidence: 0.7, updatedAt: now });
    } else if (/\b(conversazione|non so cosa dire|finisce il discorso)/i.test(text)) {
      facts.push({ key: "blocker", value: "mantenere conversazione", source: "user", confidence: 0.7, updatedAt: now });
    } else if (/\b(attrazione|friendzone|amico|amica)/i.test(text)) {
      facts.push({ key: "blocker", value: "creare attrazione", source: "user", confidence: 0.65, updatedAt: now });
    }
  } else if (domain === "addiction") {
    push("substance", null);
    if (/\b(alcol|vino|birra|drink|gin|whisky)/i.test(text)) {
      const m = text.match(/\b(alcol|vino|birra|drink|gin|whisky)\b[^.!?\n]{0,80}/i);
      if (m) facts.push({ key: "substance", value: m[0].trim(), source: "user", confidence: 0.8, updatedAt: now });
    } else if (/\b(sigaret|fumo|nicotin|svapo)\b/i.test(text)) {
      facts.push({ key: "substance", value: "fumo", source: "user", confidence: 0.85, updatedAt: now });
    }
    push("longestClean", extractTimeAgo(text));
  }

  return { facts, attempts };
}

// ---------------------------------------------------------------------------
// LLM extraction (Gemini structured output)
// ---------------------------------------------------------------------------

function buildExtractionPrompt(text: string, domain: CaseDomain): string {
  const slots = DOMAIN_SLOTS[domain] ?? DOMAIN_SLOTS.generic;
  const slotDesc = slots.map((s) => `- ${s.key}: ${s.label} (${s.questionTemplate})`).join("\n");
  return `Estrai SOLO fatti esplicitamente presenti nel messaggio dell'utente, senza inventare o inferire.

Dominio: ${domain}

Slot da popolare se presenti nel messaggio:
${slotDesc}

Ulteriori output:
- "attempts": array di stringhe brevi (azioni che l'utente dice di aver già fatto/provato).
- "domain_correction": se il messaggio è chiaramente di un dominio diverso, indicalo (uno tra: ex_recovery, seduction, confrontation, business, addiction, relationship, fitness, habit, generic). Altrimenti null.

Regole:
- Se uno slot non è presente nel testo, NON inserirlo nell'output (NON inventare).
- Confidence 0..1: 0.95 se citazione testuale, 0.7 se parafrasata, 0.5 se inferita debolmente.
- Risposta SOLO JSON valido, niente testo prima/dopo.

Schema atteso:
{
  "facts": [{ "key": "string", "value": "string", "confidence": 0.0 }],
  "attempts": ["string"],
  "domain_correction": null | "string"
}

MESSAGGIO UTENTE:
"""
${text}
"""`;
}

async function llmExtract(text: string, domain: CaseDomain): Promise<Extraction | null> {
  if (!hasGemini()) return null;
  if (text.length < 30) return null;
  try {
    const raw = await generate(buildExtractionPrompt(text, domain), "Sei un estrattore di fatti rigoroso. Rispondi SOLO con JSON valido.");
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned) as {
      facts?: { key: string; value: string; confidence: number }[];
      attempts?: string[];
      domain_correction?: CaseDomain | null;
    };
    const now = Date.now();
    return {
      domain: parsed.domain_correction ?? undefined,
      facts: (parsed.facts ?? [])
        .filter((f) => f && f.key && typeof f.value === "string" && f.value.length >= 2)
        .map((f) => ({
          key: f.key,
          value: f.value.trim().slice(0, 400),
          confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0.6)),
          source: "user" as const,
          updatedAt: now,
        })),
      attempts: (parsed.attempts ?? []).filter((a) => typeof a === "string" && a.length > 3).slice(0, 8),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Estrae fatti dal messaggio dell'utente e applica al case file (immutabile).
 * Restituisce nuovo case file con readiness ricalcolato.
 *
 * Esegue:
 *   1. inferenza domain (può promuovere "generic" → specifico)
 *   2. quick extract heuristics
 *   3. LLM extract se disponibile e messaggio ricco abbastanza
 */
export async function extractAndApply(text: string, cf: CaseFile): Promise<CaseFile> {
  const detected = inferDomain(text, cf.domain);
  let next: CaseFile = detected !== cf.domain ? { ...cf, domain: detected } : cf;

  // Heuristic
  const quick = quickExtract(text, next.domain);
  for (const f of quick.facts) next = applyFact(next, f);
  for (const a of quick.attempts) next = appendAttempt(next, a);

  // LLM (best effort)
  const llm = await llmExtract(text, next.domain);
  if (llm) {
    if (llm.domain && llm.domain !== next.domain) {
      next = { ...next, domain: llm.domain };
    }
    for (const f of llm.facts) next = applyFact(next, f);
    for (const a of llm.attempts) next = appendAttempt(next, a);
  }

  next = { ...next, readiness: computeReadiness(next.domain, next.facts), updatedAt: Date.now() };
  return next;
}

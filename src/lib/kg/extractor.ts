/**
 * KG Extractor — il cervello a polipo.
 *
 * Riceve il messaggio dell'utente + grafo esistente (lista entità note),
 * chiede a Gemini structured output di:
 *   1. Identificare nuove entità (persone, eventi, atteggiamenti, traumi…)
 *   2. Riconoscere quando l'utente parla di entità già esistenti (alias matching)
 *   3. Estrarre relazioni tra entità (causa, blocca, ripete, boicotta…)
 *   4. Suggerire categoria macro per ogni nuova entità
 *
 * Vincolo cruciale: NON inventare. Se non c'è evidenza nel testo, non emettere.
 */

import { generate, hasGemini } from "../gemini";
import type {
  Category,
  EntityKind,
  RelationKind,
  Entity,
} from "./types";
import { CATEGORY_LABELS, ENTITY_KIND_LABELS, RELATION_LABELS } from "./types";

export interface ExtractedEntity {
  /** Riferimento entità esistente (id) se è la stessa già nota; altrimenti undefined per crearla. */
  matchExistingId?: string;
  /** Etichetta canonica (es. "Marta", "padre"). */
  label: string;
  kind: EntityKind;
  category: Category;
  aliases?: string[];
  attributes?: {
    role?: string;
    traits?: string[];
    intensity?: number;
    timeframe?: string;
    notes?: string;
  };
  /** Quanto è importante questa menzione, 0..100. */
  saliencyDelta?: number;
}

export interface ExtractedRelation {
  /** Riferimenti per label dei due nodi (l'API risolverà gli ID dopo create). */
  sourceLabel: string;
  targetLabel: string;
  kind: RelationKind;
  detail?: string;
  weight?: number; // 0..100
}

export interface KgExtraction {
  entities: ExtractedEntity[];
  relations: ExtractedRelation[];
  /** Note libere che il modello vuole loggare (per debug/audit, max 240 char). */
  notes?: string;
}

const EMPTY: KgExtraction = { entities: [], relations: [] };

function buildExtractionPrompt(text: string, knownEntities: Entity[]): string {
  const knownBlock = knownEntities.length === 0
    ? "Nessuna entità nota ancora."
    : knownEntities.slice(0, 60).map((e, i) =>
        `${i + 1}. id="${e.id}" | label="${e.label}" | kind=${e.kind} | cat=${e.category}${e.aliases.length ? ` | alias=${e.aliases.join(",")}` : ""}`,
      ).join("\n");

  const kinds = Object.keys(ENTITY_KIND_LABELS).join(", ");
  const categories = Object.keys(CATEGORY_LABELS).join(", ");
  const relations = Object.keys(RELATION_LABELS).join(", ");

  return `Sei un estrattore di knowledge graph rigoroso. Analizza il messaggio dell'utente e:

1. Identifica ENTITÀ menzionate: persone (Marta, padre, capo), eventi (rottura, licenziamento), atteggiamenti (nervosismo, evitamento), pattern, traumi, obiettivi, fallimenti, luoghi rilevanti, credenze.
2. Per ogni entità, decidi se è GIÀ NOTA (riusa il suo id) o NUOVA (label canonica + kind + categoria).
3. Identifica RELAZIONI tra entità (causa/blocca/ripete/boicotta/triggera/somiglia…).

VINCOLI:
- NON INVENTARE: se l'entità non è nominata o chiaramente implicita nel messaggio, non emetterla.
- "lei", "lui", "mia ex", "lui" → prova a risolverli verso entità note se contesto chiaro; altrimenti crea nuova entità con label generica ("ex non specificata") + alias [pronome].
- Per persone, label = nome proprio se conosciuto, altrimenti ruolo ("padre", "capo Marco", "ex Marta").
- Categoria deve essere quella più "macro" di pertinenza (es. "padre" → family + trauma se contesto traumatico).
- Atteggiamenti/pattern: label deve essere descrittivo breve (es. "nervosismo da lavoro", "evitamento conflitto").
- Intensity: 0.7 se carica forte, 0.4 se neutra, 0.9 se centrale al messaggio.
- Saliency delta: quanto questa menzione aumenta importanza (0..100). Default 10.

Kinds ammessi: ${kinds}
Categorie ammesse: ${categories}
Relazioni ammesse: ${relations}

ENTITÀ GIÀ NOTE NEL GRAFO (riusa i loro id se l'utente sta parlando di loro):
${knownBlock}

MESSAGGIO UTENTE:
"""
${text}
"""

Rispondi SOLO con JSON valido, niente testo prima/dopo, schema:
{
  "entities": [
    {
      "matchExistingId": "uuid o null",
      "label": "string",
      "kind": "person|event|attitude|pattern|trauma|goal|failure|place|resource|belief",
      "category": "relationships|family|work|money|body|trauma|identity|fear|power|addiction|sex|social|spiritual|generic",
      "aliases": ["string"],
      "attributes": { "role": "string?", "traits": ["string"], "intensity": 0.7, "timeframe": "string?", "notes": "string?" },
      "saliencyDelta": 10
    }
  ],
  "relations": [
    {
      "sourceLabel": "string (label dell'entità sorgente, anche di una nuova)",
      "targetLabel": "string",
      "kind": "causes|blocks|repeats|links_to|boycotts|triggers|heals|resembles|part_of|involves",
      "detail": "breve frase",
      "weight": 60
    }
  ],
  "notes": "string opzionale max 240 char"
}`;
}

const VALID_KINDS = new Set<EntityKind>([
  "person", "event", "attitude", "pattern", "trauma", "goal", "failure", "place", "resource", "belief",
]);
const VALID_CATEGORIES = new Set<Category>([
  "relationships", "family", "work", "money", "body", "trauma", "identity", "fear", "power", "addiction", "sex", "social", "spiritual", "generic",
]);
const VALID_RELATIONS = new Set<RelationKind>([
  "causes", "blocks", "repeats", "links_to", "boycotts", "triggers", "heals", "resembles", "part_of", "involves",
]);

function sanitizeExtraction(raw: any): KgExtraction {
  if (!raw || typeof raw !== "object") return EMPTY;
  const entities: ExtractedEntity[] = [];
  const seenLabels = new Set<string>();
  for (const e of (raw.entities ?? []) as any[]) {
    if (!e || typeof e !== "object") continue;
    const label = String(e.label ?? "").trim().slice(0, 120);
    if (!label || label.length < 2) continue;
    const dedupKey = label.toLowerCase();
    if (seenLabels.has(dedupKey)) continue;
    const kind = VALID_KINDS.has(e.kind) ? e.kind as EntityKind : null;
    const category = VALID_CATEGORIES.has(e.category) ? e.category as Category : "generic";
    if (!kind) continue;
    const aliases = Array.isArray(e.aliases) ? e.aliases.filter((s: any) => typeof s === "string" && s.length > 0).slice(0, 8) : [];
    const matchExistingId = typeof e.matchExistingId === "string" && e.matchExistingId.length > 8 ? e.matchExistingId : undefined;
    const attrs = (e.attributes && typeof e.attributes === "object") ? e.attributes : {};
    const intensity = typeof attrs.intensity === "number" ? Math.max(0, Math.min(1, attrs.intensity)) : 0.5;
    const traits = Array.isArray(attrs.traits) ? attrs.traits.filter((s: any) => typeof s === "string").slice(0, 8) : undefined;
    const saliencyDelta = typeof e.saliencyDelta === "number" ? Math.max(0, Math.min(100, e.saliencyDelta)) : 10;
    entities.push({
      matchExistingId,
      label,
      kind,
      category,
      aliases,
      attributes: {
        role: typeof attrs.role === "string" ? attrs.role.slice(0, 60) : undefined,
        traits,
        intensity,
        timeframe: typeof attrs.timeframe === "string" ? attrs.timeframe.slice(0, 60) : undefined,
        notes: typeof attrs.notes === "string" ? attrs.notes.slice(0, 240) : undefined,
      },
      saliencyDelta,
    });
    seenLabels.add(dedupKey);
  }
  const relations: ExtractedRelation[] = [];
  for (const r of (raw.relations ?? []) as any[]) {
    if (!r || typeof r !== "object") continue;
    const sourceLabel = String(r.sourceLabel ?? "").trim().slice(0, 120);
    const targetLabel = String(r.targetLabel ?? "").trim().slice(0, 120);
    if (!sourceLabel || !targetLabel || sourceLabel === targetLabel) continue;
    const kind = VALID_RELATIONS.has(r.kind) ? r.kind as RelationKind : null;
    if (!kind) continue;
    const weight = typeof r.weight === "number" ? Math.max(0, Math.min(100, r.weight)) : 60;
    relations.push({
      sourceLabel,
      targetLabel,
      kind,
      detail: typeof r.detail === "string" ? r.detail.slice(0, 240) : undefined,
      weight,
    });
  }
  return {
    entities,
    relations,
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, 240) : undefined,
  };
}

/**
 * Estrae entità + relazioni dal messaggio. Server-side (richiede Gemini).
 * Se Gemini non disponibile o messaggio < 30 char, ritorna vuoto.
 */
export async function extractKnowledge(text: string, knownEntities: Entity[]): Promise<KgExtraction> {
  if (!hasGemini()) return EMPTY;
  if (!text || text.length < 30) return EMPTY;
  try {
    const raw = await generate(
      buildExtractionPrompt(text, knownEntities),
      "Sei un estrattore di knowledge graph. Rispondi SOLO con JSON valido, mai testo libero.",
    );
    const cleaned = raw.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return sanitizeExtraction(parsed);
  } catch {
    return EMPTY;
  }
}

// ---------------------------------------------------------------------------
// Heuristic prefilter — entità ovvie senza LLM (zero latency, sempre attivo)
// ---------------------------------------------------------------------------

const ATTITUDE_PATTERNS: { rx: RegExp; label: string; cat: Category }[] = [
  { rx: /\bnervos[oi] (?:per|col|sul|dal) lavoro|stress(?:ato)? (?:per|dal) lavoro\b/i, label: "nervosismo da lavoro", cat: "work" },
  { rx: /\bevito (?:il|i|le|lo) confront[oi]|evitamento conflitt/i, label: "evitamento conflitto", cat: "fear" },
  { rx: /\bprocrastin[ao]/i, label: "procrastinazione", cat: "work" },
  { rx: /\bgeloso?ia\b/i, label: "gelosia", cat: "relationships" },
  { rx: /\babbandono|paura di esser[ei] lasciat/i, label: "paura abbandono", cat: "trauma" },
];

const TRAUMA_PATTERNS: { rx: RegExp; label: string }[] = [
  { rx: /\bmio padre (?:mi )?(?:sgridava|picchiava|umiliava|criticava sempre|denigrava)/i, label: "padre punitivo" },
  { rx: /\bmia madre (?:mi )?(?:non c'era|era assente|era depressa|trascurava)/i, label: "madre assente" },
  { rx: /\bsono cresciuto con (?:un|una)\b/i, label: "infanzia significativa" },
];

export function quickHeuristicExtract(text: string): KgExtraction {
  const out: ExtractedEntity[] = [];
  const seen = new Set<string>();
  for (const p of ATTITUDE_PATTERNS) {
    if (p.rx.test(text) && !seen.has(p.label)) {
      out.push({
        label: p.label,
        kind: "attitude",
        category: p.cat,
        aliases: [],
        attributes: { intensity: 0.6 },
        saliencyDelta: 8,
      });
      seen.add(p.label);
    }
  }
  for (const p of TRAUMA_PATTERNS) {
    if (p.rx.test(text) && !seen.has(p.label)) {
      out.push({
        label: p.label,
        kind: "trauma",
        category: "trauma",
        aliases: [],
        attributes: { intensity: 0.8 },
        saliencyDelta: 14,
      });
      seen.add(p.label);
    }
  }
  return { entities: out, relations: [] };
}

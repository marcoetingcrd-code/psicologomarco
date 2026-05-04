/**
 * Pattern Detector — riconosce ripetizioni e boicottaggi nel KG.
 *
 * Trigger: chiamato dopo ogni extract significativo (server-side).
 * Ritorna pattern proposti che l'API persiste in kg_patterns con dedup via signature.
 */

import { createHash } from "crypto";
import type { Category, Entity, Pattern, PatternKind, Relation } from "./types";

export interface ProposedPattern {
  signature: string;
  kind: PatternKind;
  title: string;
  summary: string;
  category: Category;
  involvedEntityIds: string[];
  strength: number;
  evidenceCount: number;
}

function sig(parts: string[]): string {
  return createHash("sha256").update(parts.join("|").toLowerCase()).digest("hex").slice(0, 24);
}

/**
 * Repetition: 2+ entità (es. persone) collegate alla STESSA entità causale (es. attitude/trauma)
 * via relazione "causes" o "triggers" → schema ripetuto.
 *
 * Esempio: padre→nervosismo, nervosismo→Marta(perdita), nervosismo→Sara(perdita)
 *   → pattern repetition: "Schema: nervosismo da lavoro perde le partner"
 */
export function detectRepetitions(
  entities: Entity[],
  relations: Relation[],
): ProposedPattern[] {
  const out: ProposedPattern[] = [];
  const byId = new Map(entities.map((e) => [e.id, e]));

  // Per ogni entità "causale" (attitude/trauma/pattern/belief), trova le entità "target" che essa causa/blocca/triggera.
  const causalKinds = new Set(["attitude", "trauma", "pattern", "belief"]);
  const targetCausalRelations = new Set(["causes", "triggers", "blocks", "boycotts"]);

  const causes = new Map<string, { targets: Entity[]; rels: Relation[] }>();
  for (const r of relations) {
    if (!targetCausalRelations.has(r.kind)) continue;
    const src = byId.get(r.sourceId);
    const tgt = byId.get(r.targetId);
    if (!src || !tgt) continue;
    if (!causalKinds.has(src.kind)) continue;
    const slot = causes.get(src.id) ?? { targets: [], rels: [] };
    slot.targets.push(tgt);
    slot.rels.push(r);
    causes.set(src.id, slot);
  }

  for (const [srcId, { targets, rels }] of causes.entries()) {
    if (targets.length < 2) continue;
    // Raggruppa target per kind+categoria — ripetizione vera se ci sono 2+ target dello stesso "tipo" (es. 2 persone romantic, 2 fallimenti business)
    const groups = new Map<string, Entity[]>();
    for (const t of targets) {
      const k = `${t.kind}:${t.category}`;
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }
    const src = byId.get(srcId)!;
    for (const [groupKey, group] of groups.entries()) {
      if (group.length < 2) continue;
      const [kind, category] = groupKey.split(":");
      const labels = group.map((e) => e.label).slice(0, 4).join(", ");
      const pattern: ProposedPattern = {
        signature: sig(["repetition", srcId, kind, category]),
        kind: "repetition",
        title: `Schema ripetuto: "${src.label}" → ${kind === "person" ? "perdita di" : ""} ${labels}`,
        summary: `Hai legato "${src.label}" a ${group.length} ${kind === "person" ? "persone" : kind} simili (${labels}). È uno schema che si ripete: ogni volta che "${src.label}" è attivo, succede questo.`,
        category: (category as Category) || src.category,
        involvedEntityIds: [srcId, ...group.map((e) => e.id)],
        strength: Math.min(100, 40 + group.length * 15 + rels.reduce((a, r) => a + r.evidenceCount, 0) * 2),
        evidenceCount: group.length + rels.reduce((a, r) => a + r.evidenceCount, 0),
      };
      out.push(pattern);
    }
  }

  return out;
}

/**
 * Boycott: entità (attitude/trauma/belief) che ha relazione "blocks" o "boycotts"
 * verso 1+ goal/category-related entity, oppure verso multipli target di stessa categoria.
 *
 * Esempio: paura abbandono → blocca relazioni stabili
 */
export function detectBoycotts(
  entities: Entity[],
  relations: Relation[],
): ProposedPattern[] {
  const out: ProposedPattern[] = [];
  const byId = new Map(entities.map((e) => [e.id, e]));
  const blockKinds = new Set(["blocks", "boycotts"]);

  for (const r of relations) {
    if (!blockKinds.has(r.kind)) continue;
    const src = byId.get(r.sourceId);
    const tgt = byId.get(r.targetId);
    if (!src || !tgt) continue;
    // Solo se la sorgente è "interna" (atteggiamento/trauma/credenza/pattern)
    if (!["attitude", "trauma", "belief", "pattern"].includes(src.kind)) continue;
    out.push({
      signature: sig(["boycott", src.id, tgt.id]),
      kind: "boycott",
      title: `Boicottaggio: "${src.label}" sabota "${tgt.label}"`,
      summary: `"${src.label}" sta bloccando attivamente "${tgt.label}". Detail: ${r.detail ?? "evidenza dal grafo"}. Peso: ${r.weight}/100, evidenze: ${r.evidenceCount}.`,
      category: tgt.category,
      involvedEntityIds: [src.id, tgt.id],
      strength: Math.min(100, r.weight + r.evidenceCount * 5),
      evidenceCount: r.evidenceCount,
    });
  }
  return out;
}

export function detectAllPatterns(entities: Entity[], relations: Relation[]): ProposedPattern[] {
  const reps = detectRepetitions(entities, relations);
  const bcs = detectBoycotts(entities, relations);
  // Dedup per signature
  const all = [...reps, ...bcs];
  const seen = new Set<string>();
  return all.filter((p) => {
    if (seen.has(p.signature)) return false;
    seen.add(p.signature);
    return true;
  });
}

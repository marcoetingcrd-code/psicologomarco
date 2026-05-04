/**
 * Riassunto compatto del KG per iniezione nel prompt RAG.
 * Mostra top entità per categoria, pattern attivi, relazioni chiave.
 */

import { CATEGORY_LABELS, RELATION_LABELS, type Entity, type Relation, type Pattern } from "./types";

export interface KgSnapshot {
  entities: Entity[];
  patterns: Pattern[];
  relations: Relation[];
}

export function summarizeKg(snap: KgSnapshot, maxLines = 25): string {
  if (!snap || snap.entities.length === 0) return "";
  const lines: string[] = [];
  lines.push(`KNOWLEDGE GRAPH (mente del polipo: cosa Atlas sa di te):`);

  // Pattern (più importanti, vanno per primi se forti)
  const strongPatterns = snap.patterns.filter((p) => p.strength >= 50).slice(0, 4);
  if (strongPatterns.length > 0) {
    lines.push(`Pattern attivi rilevati:`);
    for (const p of strongPatterns) {
      lines.push(`  • [${p.kind}] ${p.title} — forza ${p.strength}/100, ${p.evidenceCount} evidenze`);
    }
  }

  // Entità raggruppate per categoria, top 3 per categoria
  const byCat = new Map<string, Entity[]>();
  for (const e of snap.entities) {
    const arr = byCat.get(e.category) ?? [];
    arr.push(e);
    byCat.set(e.category, arr);
  }
  const sortedCats = [...byCat.entries()]
    .map(([cat, arr]) => ({ cat, arr: arr.sort((a, b) => b.importance - a.importance), max: Math.max(...arr.map((e) => e.importance)) }))
    .sort((a, b) => b.max - a.max);
  for (const { cat, arr } of sortedCats.slice(0, 6)) {
    const label = CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat;
    const top = arr.slice(0, 3).map((e) => {
      const role = e.attributes.role ? ` (${e.attributes.role})` : "";
      return `${e.label}${role}`;
    }).join(", ");
    lines.push(`  ${label}: ${top}`);
  }

  // Top relazioni (causes/blocks/boycotts/repeats)
  const importantRelKinds = new Set(["causes", "blocks", "boycotts", "repeats", "triggers"]);
  const byId = new Map(snap.entities.map((e) => [e.id, e]));
  const topRelations = snap.relations
    .filter((r) => importantRelKinds.has(r.kind))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);
  if (topRelations.length > 0) {
    lines.push(`Connessioni chiave nel grafo:`);
    for (const r of topRelations) {
      const s = byId.get(r.sourceId)?.label;
      const t = byId.get(r.targetId)?.label;
      if (!s || !t) continue;
      lines.push(`  • "${s}" ${RELATION_LABELS[r.kind]} "${t}"${r.detail ? ` — ${r.detail}` : ""}`);
    }
  }

  return lines.slice(0, maxLines).join("\n");
}

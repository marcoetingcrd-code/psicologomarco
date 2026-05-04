/**
 * API /api/kg — Knowledge Graph: entities, relations, patterns.
 *
 * Actions:
 *   POST  action=extract       → estrae da messaggio + persiste entità/relazioni + ricalcola pattern
 *   GET   action=list-entities → lista entità (con filtri categoria/kind)
 *   GET   action=list-patterns → lista pattern rilevati
 *   GET   action=relevant      → estratto rilevante per una query (per RAG)
 *   POST  action=merge         → merge manuale di 2 entità (alias unite)
 *   POST  action=delete        → cancella entità (e relazioni collegate)
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";
import { encrypt, decrypt, isEncryptionReady } from "@/lib/crypto";
import { extractKnowledge, quickHeuristicExtract, type KgExtraction, type ExtractedEntity, type ExtractedRelation } from "@/lib/kg/extractor";
import { detectAllPatterns } from "@/lib/kg/pattern-detector";
import type { Entity, Relation, Pattern, Category, EntityKind, RelationKind } from "@/lib/kg/types";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Row helpers
// ---------------------------------------------------------------------------

function decJSON<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(decrypt(s)) as T; } catch { return null; }
}

function rowToEntity(row: any): Entity {
  return {
    id: row.id,
    kind: row.kind as EntityKind,
    category: row.category as Category,
    label: row.label,
    aliases: decJSON<string[]>(row.aliases_encrypted) ?? [],
    attributes: decJSON<Entity["attributes"]>(row.attributes_encrypted) ?? {},
    firstSeenAt: new Date(row.first_seen_at).getTime(),
    lastMentionedAt: new Date(row.last_mentioned_at).getTime(),
    mentionCount: row.mention_count,
    importance: row.importance,
  };
}

function rowToRelation(row: any): Relation {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    kind: row.kind as RelationKind,
    detail: decJSON<string>(row.detail_encrypted) ?? undefined,
    weight: row.weight,
    firstSeenAt: new Date(row.first_seen_at).getTime(),
    lastSeenAt: new Date(row.last_seen_at).getTime(),
    evidenceCount: row.evidence_count,
  };
}

function rowToPattern(row: any): Pattern {
  return {
    id: row.id,
    signature: row.signature,
    kind: row.kind,
    title: row.title,
    summary: decJSON<string>(row.summary_encrypted) ?? "",
    category: row.category as Category,
    involvedEntityIds: row.involved_entity_ids ?? [],
    strength: row.strength,
    firstDetectedAt: new Date(row.first_detected_at).getTime(),
    lastReinforcedAt: new Date(row.last_reinforced_at).getTime(),
    evidenceCount: row.evidence_count,
  };
}

// ---------------------------------------------------------------------------
// Entity matching (fuzzy)
// ---------------------------------------------------------------------------

function normalizeLabel(s: string): string {
  return s.toLowerCase()
    .replace(/[àá]/g, "a").replace(/[èé]/g, "e").replace(/[ìí]/g, "i").replace(/[òó]/g, "o").replace(/[ùú]/g, "u")
    .replace(/[^a-z0-9 ]/g, "").trim();
}

function findMatch(label: string, aliases: string[], existing: Entity[], kind: EntityKind, category: Category): Entity | null {
  const norm = normalizeLabel(label);
  const aliasNorm = aliases.map(normalizeLabel);
  for (const e of existing) {
    if (e.kind !== kind) continue;
    const eLab = normalizeLabel(e.label);
    if (eLab === norm) return e;
    const eAliases = e.aliases.map(normalizeLabel);
    if (eAliases.includes(norm)) return e;
    for (const a of aliasNorm) {
      if (a && (eLab === a || eAliases.includes(a))) return e;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Persist extraction
// ---------------------------------------------------------------------------

async function persistEntity(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  ex: ExtractedEntity,
  existing: Entity[],
): Promise<Entity | null> {
  if (!db) return null;

  // Match: prima id esplicito, poi label/alias fuzzy
  let match: Entity | null = null;
  if (ex.matchExistingId) {
    match = existing.find((e) => e.id === ex.matchExistingId) ?? null;
  }
  if (!match) {
    match = findMatch(ex.label, ex.aliases ?? [], existing, ex.kind, ex.category);
  }

  if (match) {
    // UPDATE
    const newAliases = Array.from(new Set([...match.aliases, ...(ex.aliases ?? [])])).slice(0, 12);
    const mergedAttrs = { ...match.attributes, ...ex.attributes };
    if (ex.attributes?.traits) {
      mergedAttrs.traits = Array.from(new Set([...(match.attributes.traits ?? []), ...ex.attributes.traits])).slice(0, 12);
    }
    const newImportance = Math.min(100, match.importance + (ex.saliencyDelta ?? 5));
    const { data } = await db.from("kg_entities").update({
      aliases_encrypted: encrypt(JSON.stringify(newAliases)),
      attributes_encrypted: encrypt(JSON.stringify(mergedAttrs)),
      mention_count: match.mentionCount + 1,
      importance: newImportance,
      last_mentioned_at: new Date().toISOString(),
    }).eq("id", match.id).eq("user_id", userId).select().single();
    return data ? rowToEntity(data) : match;
  }

  // CREATE
  const insert: any = {
    user_id: userId,
    kind: ex.kind,
    category: ex.category,
    label: ex.label,
    aliases_encrypted: encrypt(JSON.stringify(ex.aliases ?? [])),
    attributes_encrypted: encrypt(JSON.stringify(ex.attributes ?? {})),
    importance: 30 + (ex.saliencyDelta ?? 10),
  };
  const { data, error } = await db.from("kg_entities").insert(insert).select().single();
  if (error || !data) return null;
  return rowToEntity(data);
}

async function persistRelation(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  exr: ExtractedRelation,
  labelToId: Map<string, string>,
): Promise<void> {
  if (!db) return;
  const sId = labelToId.get(normalizeLabel(exr.sourceLabel));
  const tId = labelToId.get(normalizeLabel(exr.targetLabel));
  if (!sId || !tId || sId === tId) return;

  // Upsert via unique (user_id, source, target, kind)
  const { data: existing } = await db.from("kg_relations").select("*")
    .eq("user_id", userId).eq("source_id", sId).eq("target_id", tId).eq("kind", exr.kind).maybeSingle();

  if (existing) {
    await db.from("kg_relations").update({
      weight: Math.min(100, (existing.weight as number) + 5),
      evidence_count: (existing.evidence_count as number) + 1,
      last_seen_at: new Date().toISOString(),
      detail_encrypted: exr.detail ? encrypt(JSON.stringify(exr.detail)) : existing.detail_encrypted,
    }).eq("id", existing.id);
  } else {
    await db.from("kg_relations").insert({
      user_id: userId,
      source_id: sId,
      target_id: tId,
      kind: exr.kind,
      detail_encrypted: exr.detail ? encrypt(JSON.stringify(exr.detail)) : null,
      weight: exr.weight ?? 60,
    });
  }
}

async function persistPatterns(
  db: ReturnType<typeof getServiceClient>,
  userId: string,
  entities: Entity[],
  relations: Relation[],
): Promise<Pattern[]> {
  if (!db) return [];
  const proposed = detectAllPatterns(entities, relations);
  const persisted: Pattern[] = [];
  for (const p of proposed) {
    const { data: existing } = await db.from("kg_patterns").select("*")
      .eq("user_id", userId).eq("signature", p.signature).maybeSingle();
    if (existing) {
      const { data } = await db.from("kg_patterns").update({
        strength: Math.max(existing.strength as number, p.strength),
        evidence_count: (existing.evidence_count as number) + 1,
        last_reinforced_at: new Date().toISOString(),
        summary_encrypted: encrypt(JSON.stringify(p.summary)),
        involved_entity_ids: p.involvedEntityIds,
      }).eq("id", existing.id).select().single();
      if (data) persisted.push(rowToPattern(data));
    } else {
      const { data } = await db.from("kg_patterns").insert({
        user_id: userId,
        signature: p.signature,
        kind: p.kind,
        title: p.title,
        summary_encrypted: encrypt(JSON.stringify(p.summary)),
        involved_entity_ids: p.involvedEntityIds,
        category: p.category,
        strength: p.strength,
        evidence_count: p.evidenceCount,
      }).select().single();
      if (data) persisted.push(rowToPattern(data));
    }
  }
  return persisted;
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  if (!isSupabaseReady() || !isEncryptionReady()) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  if (action === "extract") {
    const text = (body.text as string | undefined) ?? "";
    if (!text || text.length < 6) return NextResponse.json({ ok: true, entities: [], relations: [], patterns: [] });

    // Carica entità esistenti (ultime 80 per importanza)
    const { data: rows } = await db.from("kg_entities").select("*")
      .eq("user_id", user.id).order("importance", { ascending: false }).limit(120);
    const existing: Entity[] = (rows ?? []).map(rowToEntity);

    // Estrai (heuristic + LLM)
    const heuristic = quickHeuristicExtract(text);
    let llm: KgExtraction = { entities: [], relations: [] };
    try { llm = await extractKnowledge(text, existing); } catch { /* swallow */ }
    const merged: KgExtraction = {
      entities: [...heuristic.entities, ...llm.entities],
      relations: [...heuristic.relations, ...llm.relations],
      notes: llm.notes,
    };
    if (merged.entities.length === 0) {
      return NextResponse.json({ ok: true, entities: [], relations: [], patterns: [] });
    }

    // Persist entità (con merge intelligente)
    const persistedEntities: Entity[] = [];
    const labelToId = new Map<string, string>();
    for (const ex of merged.entities) {
      const e = await persistEntity(db, user.id, ex, existing);
      if (e) {
        persistedEntities.push(e);
        labelToId.set(normalizeLabel(ex.label), e.id);
        for (const a of ex.aliases ?? []) labelToId.set(normalizeLabel(a), e.id);
        // Aggiorna existing in memoria così relazioni/duplicati nello stesso batch matchano
        const idx = existing.findIndex((x) => x.id === e.id);
        if (idx >= 0) existing[idx] = e; else existing.push(e);
      }
    }
    // Aggiungi anche existing matched-only labels
    for (const e of existing) {
      labelToId.set(normalizeLabel(e.label), e.id);
      for (const a of e.aliases) labelToId.set(normalizeLabel(a), e.id);
    }

    // Persist relazioni
    for (const r of merged.relations) {
      try { await persistRelation(db, user.id, r, labelToId); } catch { /* skip */ }
    }

    // Ricarica relazioni per pattern detection
    const { data: relRows } = await db.from("kg_relations").select("*").eq("user_id", user.id).limit(400);
    const allRelations: Relation[] = (relRows ?? []).map(rowToRelation);
    const newPatterns = await persistPatterns(db, user.id, existing, allRelations);

    return NextResponse.json({
      ok: true,
      entities: persistedEntities,
      relationsCount: merged.relations.length,
      patterns: newPatterns,
      notes: merged.notes,
    });
  }

  if (action === "merge") {
    const keepId = body.keepId as string | undefined;
    const dropId = body.dropId as string | undefined;
    if (!keepId || !dropId || keepId === dropId) return NextResponse.json({ error: "invalid merge" }, { status: 400 });
    // sposta relazioni
    await db.from("kg_relations").update({ source_id: keepId }).eq("user_id", user.id).eq("source_id", dropId);
    await db.from("kg_relations").update({ target_id: keepId }).eq("user_id", user.id).eq("target_id", dropId);
    // aggiungi label dropped come alias
    const { data: dropRow } = await db.from("kg_entities").select("*").eq("user_id", user.id).eq("id", dropId).maybeSingle();
    const { data: keepRow } = await db.from("kg_entities").select("*").eq("user_id", user.id).eq("id", keepId).maybeSingle();
    if (dropRow && keepRow) {
      const dropEntity = rowToEntity(dropRow);
      const keepEntity = rowToEntity(keepRow);
      const newAliases = Array.from(new Set([...keepEntity.aliases, dropEntity.label, ...dropEntity.aliases])).slice(0, 16);
      await db.from("kg_entities").update({
        aliases_encrypted: encrypt(JSON.stringify(newAliases)),
        mention_count: keepEntity.mentionCount + dropEntity.mentionCount,
        importance: Math.min(100, keepEntity.importance + dropEntity.importance / 2),
      }).eq("id", keepId);
    }
    await db.from("kg_entities").delete().eq("user_id", user.id).eq("id", dropId);
    return NextResponse.json({ ok: true });
  }

  if (action === "delete") {
    const id = body.id as string | undefined;
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    await db.from("kg_entities").delete().eq("user_id", user.id).eq("id", id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseReady() || !isEncryptionReady()) {
    return NextResponse.json({ ready: false });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  if (action === "list-entities") {
    const category = url.searchParams.get("category");
    const kind = url.searchParams.get("kind");
    let q = db.from("kg_entities").select("*").eq("user_id", user.id).order("importance", { ascending: false }).limit(500);
    if (category) q = q.eq("category", category);
    if (kind) q = q.eq("kind", kind);
    const { data } = await q;
    return NextResponse.json({ ready: true, entities: (data ?? []).map(rowToEntity) });
  }

  if (action === "list-patterns") {
    const { data } = await db.from("kg_patterns").select("*")
      .eq("user_id", user.id).order("strength", { ascending: false }).limit(60);
    return NextResponse.json({ ready: true, patterns: (data ?? []).map(rowToPattern) });
  }

  if (action === "list-relations") {
    const { data } = await db.from("kg_relations").select("*")
      .eq("user_id", user.id).order("weight", { ascending: false }).limit(500);
    return NextResponse.json({ ready: true, relations: (data ?? []).map(rowToRelation) });
  }

  if (action === "relevant") {
    // Estratto per RAG: top entità per importanza + top pattern + relazioni associate
    const [{ data: eRows }, { data: pRows }, { data: rRows }] = await Promise.all([
      db.from("kg_entities").select("*").eq("user_id", user.id).order("importance", { ascending: false }).limit(20),
      db.from("kg_patterns").select("*").eq("user_id", user.id).order("strength", { ascending: false }).limit(5),
      db.from("kg_relations").select("*").eq("user_id", user.id).order("weight", { ascending: false }).limit(40),
    ]);
    return NextResponse.json({
      ready: true,
      entities: (eRows ?? []).map(rowToEntity),
      patterns: (pRows ?? []).map(rowToPattern),
      relations: (rRows ?? []).map(rowToRelation),
    });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

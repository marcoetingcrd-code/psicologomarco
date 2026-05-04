import { NextRequest, NextResponse } from "next/server";
import { answer } from "@/lib/rag";
import { recordQuery, predictNext, cacheAnswer, getCachedAnswer, recordInteraction, detectGaps } from "@/lib/profile";
import type { CaseFile } from "@/lib/case-file";
import { getAuthedUser } from "@/lib/auth-server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { encrypt, decrypt, isEncryptionReady } from "@/lib/crypto";
import type { SovereignContract } from "@/lib/sovereign/contract";
import { isContractValid } from "@/lib/sovereign/contract";
import { applyDetections, detectExcuses, emptyLibrary, type ExcuseLibrary } from "@/lib/sovereign/excuse-buster";
import type { SovereignContext } from "@/lib/sovereign/orchestrator";
import { isSafetyPaused } from "@/lib/sovereign/safety";
import type { KgSnapshot } from "@/lib/kg/summarize";
import type { Entity, Relation, Pattern, EntityKind, Category, RelationKind } from "@/lib/kg/types";
import { extractKnowledge, quickHeuristicExtract } from "@/lib/kg/extractor";
import { detectAllPatterns } from "@/lib/kg/pattern-detector";

export const runtime = "nodejs";

function decryptJSON<T>(s: string | null): T | null {
  if (!s) return null;
  try { return JSON.parse(decrypt(s)) as T; } catch { return null; }
}

async function loadSovereignContext(userId: string, recentText?: string): Promise<SovereignContext | null> {
  if (!isSupabaseReady() || !isEncryptionReady()) return null;
  const db = getServiceClient();
  if (!db) return null;
  const [{ data: cRow }, { data: sRow }] = await Promise.all([
    db.from("sovereign_contracts").select("*").eq("user_id", userId).maybeSingle(),
    db.from("sovereign_state").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const contract = cRow ? decryptJSON<SovereignContract>(cRow.payload_encrypted as string) : null;
  // Safety pause: se attivo, sovereign disattivato (anche se contract attivo)
  const pausedUntil = sRow?.emergency_paused_until ? new Date(sRow.emergency_paused_until as string).getTime() : null;
  const pausedActive = isSafetyPaused(pausedUntil);
  const finalContract = pausedActive ? null : (isContractValid(contract) ? contract : null);
  const excuseLibrary = sRow ? decryptJSON<ExcuseLibrary>(sRow.excuse_library_encrypted as string) ?? emptyLibrary() : emptyLibrary();
  return {
    contract: finalContract,
    excuseLibrary,
    recentUserText: recentText,
    streakDays: undefined,
    identityHandle: undefined,
  };
}

// --- KG helpers (lightweight per chat route) ---
function kgRowToEntity(row: any): Entity {
  return {
    id: row.id,
    kind: row.kind as EntityKind,
    category: row.category as Category,
    label: row.label,
    aliases: decryptJSON<string[]>(row.aliases_encrypted) ?? [],
    attributes: decryptJSON<Entity["attributes"]>(row.attributes_encrypted) ?? {},
    firstSeenAt: new Date(row.first_seen_at).getTime(),
    lastMentionedAt: new Date(row.last_mentioned_at).getTime(),
    mentionCount: row.mention_count,
    importance: row.importance,
  };
}
function kgRowToRelation(row: any): Relation {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    kind: row.kind as RelationKind,
    detail: decryptJSON<string>(row.detail_encrypted) ?? undefined,
    weight: row.weight,
    firstSeenAt: new Date(row.first_seen_at).getTime(),
    lastSeenAt: new Date(row.last_seen_at).getTime(),
    evidenceCount: row.evidence_count,
  };
}
function kgRowToPattern(row: any): Pattern {
  return {
    id: row.id,
    signature: row.signature,
    kind: row.kind,
    title: row.title,
    summary: decryptJSON<string>(row.summary_encrypted) ?? "",
    category: row.category as Category,
    involvedEntityIds: row.involved_entity_ids ?? [],
    strength: row.strength,
    firstDetectedAt: new Date(row.first_detected_at).getTime(),
    lastReinforcedAt: new Date(row.last_reinforced_at).getTime(),
    evidenceCount: row.evidence_count,
  };
}

async function loadKgSnapshot(userId: string): Promise<KgSnapshot | null> {
  if (!isSupabaseReady() || !isEncryptionReady()) return null;
  const db = getServiceClient();
  if (!db) return null;
  const [{ data: e }, { data: r }, { data: p }] = await Promise.all([
    db.from("kg_entities").select("*").eq("user_id", userId).order("importance", { ascending: false }).limit(40),
    db.from("kg_relations").select("*").eq("user_id", userId).order("weight", { ascending: false }).limit(60),
    db.from("kg_patterns").select("*").eq("user_id", userId).order("strength", { ascending: false }).limit(8),
  ]);
  if (!e || e.length === 0) return null;
  return {
    entities: e.map(kgRowToEntity),
    relations: (r ?? []).map(kgRowToRelation),
    patterns: (p ?? []).map(kgRowToPattern),
  };
}

/**
 * Auto-extract KG dal messaggio in background. Non blocca la risposta.
 * Best effort: heuristic + LLM, persist via lo stesso codice di /api/kg in linea (semplificato qui).
 * Per evitare duplicazione, chiama l'endpoint internamente.
 */
function triggerKgExtractInBackground(userId: string, text: string) {
  // Niente await: scheduling indipendente. Errori swallowed.
  (async () => {
    if (!isSupabaseReady() || !isEncryptionReady()) return;
    const db = getServiceClient();
    if (!db || text.length < 30) return;
    try {
      // Carica entità esistenti
      const { data: rows } = await db.from("kg_entities").select("*")
        .eq("user_id", userId).order("importance", { ascending: false }).limit(120);
      const existing: Entity[] = (rows ?? []).map(kgRowToEntity);

      const heuristic = quickHeuristicExtract(text);
      let llm = { entities: [], relations: [], notes: undefined } as Awaited<ReturnType<typeof extractKnowledge>>;
      try { llm = await extractKnowledge(text, existing); } catch { /* skip */ }
      const allEntities = [...heuristic.entities, ...llm.entities];
      if (allEntities.length === 0) return;

      // Persist via /api/kg replicando logica essenziale (no fetch interno per semplicità/perf)
      // Inline: import dinamico
      const { encrypt: enc } = await import("@/lib/crypto");
      const labelToId = new Map<string, string>();
      const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9 ]/g, "").trim();
      const findExisting = (label: string, kind: string) => {
        const n = norm(label);
        return existing.find((e) => e.kind === kind && (norm(e.label) === n || e.aliases.map(norm).includes(n)));
      };
      for (const ex of allEntities) {
        const match = findExisting(ex.label, ex.kind);
        if (match) {
          const newAliases = Array.from(new Set([...match.aliases, ...(ex.aliases ?? [])])).slice(0, 12);
          const mergedAttrs = { ...match.attributes, ...ex.attributes };
          await db.from("kg_entities").update({
            aliases_encrypted: enc(JSON.stringify(newAliases)),
            attributes_encrypted: enc(JSON.stringify(mergedAttrs)),
            mention_count: match.mentionCount + 1,
            importance: Math.min(100, match.importance + (ex.saliencyDelta ?? 5)),
            last_mentioned_at: new Date().toISOString(),
          }).eq("id", match.id).eq("user_id", userId);
          labelToId.set(norm(ex.label), match.id);
          for (const a of ex.aliases ?? []) labelToId.set(norm(a), match.id);
        } else {
          const { data: created } = await db.from("kg_entities").insert({
            user_id: userId,
            kind: ex.kind,
            category: ex.category,
            label: ex.label,
            aliases_encrypted: enc(JSON.stringify(ex.aliases ?? [])),
            attributes_encrypted: enc(JSON.stringify(ex.attributes ?? {})),
            importance: 30 + (ex.saliencyDelta ?? 10),
          }).select().single();
          if (created) {
            labelToId.set(norm(ex.label), (created as any).id);
            for (const a of ex.aliases ?? []) labelToId.set(norm(a), (created as any).id);
            existing.push(kgRowToEntity(created));
          }
        }
      }
      for (const e of existing) {
        labelToId.set(norm(e.label), e.id);
        for (const a of e.aliases) labelToId.set(norm(a), e.id);
      }
      for (const r of llm.relations) {
        const sId = labelToId.get(norm(r.sourceLabel));
        const tId = labelToId.get(norm(r.targetLabel));
        if (!sId || !tId || sId === tId) continue;
        const { data: existingRel } = await db.from("kg_relations").select("*")
          .eq("user_id", userId).eq("source_id", sId).eq("target_id", tId).eq("kind", r.kind).maybeSingle();
        if (existingRel) {
          await db.from("kg_relations").update({
            weight: Math.min(100, ((existingRel as any).weight ?? 60) + 5),
            evidence_count: ((existingRel as any).evidence_count ?? 1) + 1,
            last_seen_at: new Date().toISOString(),
            detail_encrypted: r.detail ? enc(JSON.stringify(r.detail)) : (existingRel as any).detail_encrypted,
          }).eq("id", (existingRel as any).id);
        } else {
          await db.from("kg_relations").insert({
            user_id: userId,
            source_id: sId,
            target_id: tId,
            kind: r.kind,
            detail_encrypted: r.detail ? enc(JSON.stringify(r.detail)) : null,
            weight: r.weight ?? 60,
          });
        }
      }
      // Pattern detection (best effort)
      const { data: relRows } = await db.from("kg_relations").select("*").eq("user_id", userId).limit(400);
      const allRelations: Relation[] = (relRows ?? []).map(kgRowToRelation);
      const patterns = detectAllPatterns(existing, allRelations);
      for (const p of patterns) {
        const { data: existingP } = await db.from("kg_patterns").select("*")
          .eq("user_id", userId).eq("signature", p.signature).maybeSingle();
        if (existingP) {
          await db.from("kg_patterns").update({
            strength: Math.max((existingP as any).strength, p.strength),
            evidence_count: ((existingP as any).evidence_count ?? 1) + 1,
            last_reinforced_at: new Date().toISOString(),
            summary_encrypted: enc(JSON.stringify(p.summary)),
            involved_entity_ids: p.involvedEntityIds,
          }).eq("id", (existingP as any).id);
        } else {
          await db.from("kg_patterns").insert({
            user_id: userId,
            signature: p.signature,
            kind: p.kind,
            title: p.title,
            summary_encrypted: enc(JSON.stringify(p.summary)),
            involved_entity_ids: p.involvedEntityIds,
            category: p.category,
            strength: p.strength,
            evidence_count: p.evidenceCount,
          });
        }
      }
    } catch {
      /* swallow */
    }
  })();
}

async function persistExcuseDetections(userId: string, lib: ExcuseLibrary, query: string) {
  if (!isSupabaseReady() || !isEncryptionReady()) return;
  const db = getServiceClient();
  if (!db) return;
  const detections = detectExcuses(query, lib);
  if (detections.length === 0) return;
  const updated = applyDetections(lib, detections);
  await db.from("sovereign_state").upsert({
    user_id: userId,
    excuse_library_encrypted: encrypt(JSON.stringify(updated)),
  }, { onConflict: "user_id" });
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    query: string;
    sessionId: string;
    deepMode?: boolean;
    conversationHistory?: { role: string; content: string }[];
    caseFile?: CaseFile | null;
  };
  const { query, sessionId, deepMode, conversationHistory, caseFile } = body;
  if (!query || !sessionId) {
    return NextResponse.json({ error: "missing query or sessionId" }, { status: 400 });
  }

  // Sovereign + KG context (solo per utenti loggati, best-effort)
  let sovereignCtx: SovereignContext | null = null;
  let kgSnapshot: KgSnapshot | null = null;
  const authedUser = await getAuthedUser(req).catch(() => null);
  if (authedUser) {
    const recentText = (conversationHistory ?? [])
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content)
      .join(" ");
    [sovereignCtx, kgSnapshot] = await Promise.all([
      loadSovereignContext(authedUser.id, recentText).catch(() => null),
      loadKgSnapshot(authedUser.id).catch(() => null),
    ]);
  }

  // 1. Cache: niente cache se caseFile o sovereign attivi (risposte cucite)
  const useCache = !caseFile && !sovereignCtx?.contract && (!conversationHistory || conversationHistory.length === 0);
  const cached = useCache ? getCachedAnswer(query) : null;
  let result;
  if (cached) {
    result = { answer: cached, sources: [], usedLLM: true, cached: true };
  } else {
    const ragResult = await answer(query, deepMode, sessionId, conversationHistory, caseFile, sovereignCtx, kgSnapshot);
    result = { ...ragResult, cached: false };
    if (useCache && !ragResult.safetyTriggered) {
      cacheAnswer(query, result.answer);
    }
    // Background: persist excuse detections + KG extraction
    if (authedUser && sovereignCtx?.excuseLibrary && !ragResult.safetyTriggered) {
      persistExcuseDetections(authedUser.id, sovereignCtx.excuseLibrary, query).catch(() => null);
    }
    if (authedUser && !ragResult.safetyTriggered) {
      triggerKgExtractInBackground(authedUser.id, query);
    }
  }

  // 2. Record in user profile
  await recordQuery(sessionId, query);
  recordInteraction(sessionId);

  // 3. Predict next probable questions
  const predictions = await predictNext(sessionId, 5);

  // 4. Detect profile gaps and generate probing questions
  const gaps = detectGaps(sessionId, query);
  const probing = gaps.slice(0, 2); // max 2 probing questions per interaction

  // 5. Prefetch top prediction in background (fire-and-forget)
  if (predictions[0] && !getCachedAnswer(predictions[0])) {
    (async () => {
      try {
        const pre = await answer(predictions[0]);
        cacheAnswer(predictions[0], pre.answer);
      } catch {
        /* ignore */
      }
    })();
  }

  return NextResponse.json({ ...result, predictions, probing });
}

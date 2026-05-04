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

  // Sovereign context (solo per utenti loggati, best-effort)
  let sovereignCtx: SovereignContext | null = null;
  const authedUser = await getAuthedUser(req).catch(() => null);
  if (authedUser) {
    const recentText = (conversationHistory ?? [])
      .filter((m) => m.role === "user")
      .slice(-3)
      .map((m) => m.content)
      .join(" ");
    sovereignCtx = await loadSovereignContext(authedUser.id, recentText).catch(() => null);
  }

  // 1. Cache: niente cache se caseFile o sovereign attivi (risposte cucite)
  const useCache = !caseFile && !sovereignCtx?.contract && (!conversationHistory || conversationHistory.length === 0);
  const cached = useCache ? getCachedAnswer(query) : null;
  let result;
  if (cached) {
    result = { answer: cached, sources: [], usedLLM: true, cached: true };
  } else {
    const ragResult = await answer(query, deepMode, sessionId, conversationHistory, caseFile, sovereignCtx);
    result = { ...ragResult, cached: false };
    if (useCache && !ragResult.safetyTriggered) {
      cacheAnswer(query, result.answer);
    }
    // Persisti excuse detections in background (non bloccare risposta)
    if (authedUser && sovereignCtx?.excuseLibrary && !ragResult.safetyTriggered) {
      persistExcuseDetections(authedUser.id, sovereignCtx.excuseLibrary, query).catch(() => null);
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

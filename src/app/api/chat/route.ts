import { NextRequest, NextResponse } from "next/server";
import { answer } from "@/lib/rag";
import { recordQuery, predictNext, cacheAnswer, getCachedAnswer, recordInteraction, detectGaps } from "@/lib/profile";
import type { CaseFile } from "@/lib/case-file";

export const runtime = "nodejs";

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

  // 1. Cache check — solo per query GENERICHE (no caseFile, no history significativa)
  // Risposte cucite sul caso non sono mai riusabili.
  const useCache = !caseFile && (!conversationHistory || conversationHistory.length === 0);
  const cached = useCache ? getCachedAnswer(query) : null;
  let result;
  if (cached) {
    result = { answer: cached, sources: [], usedLLM: true, cached: true };
  } else {
    const ragResult = await answer(query, deepMode, sessionId, conversationHistory, caseFile);
    result = { ...ragResult, cached: false };
    if (useCache && !ragResult.safetyTriggered) {
      cacheAnswer(query, result.answer);
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

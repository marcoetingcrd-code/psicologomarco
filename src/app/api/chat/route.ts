import { NextRequest, NextResponse } from "next/server";
import { answer } from "@/lib/rag";
import { recordQuery, predictNext, cacheAnswer, getCachedAnswer } from "@/lib/profile";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { query, sessionId } = (await req.json()) as { query: string; sessionId: string };
  if (!query || !sessionId) {
    return NextResponse.json({ error: "missing query or sessionId" }, { status: 400 });
  }

  // 1. Cache check
  const cached = getCachedAnswer(query);
  let result;
  if (cached) {
    result = { answer: cached, sources: [], usedLLM: true, cached: true };
  } else {
    result = { ...(await answer(query)), cached: false };
    cacheAnswer(query, result.answer);
  }

  // 2. Record in user profile
  await recordQuery(sessionId, query);

  // 3. Predict next probable questions
  const predictions = await predictNext(sessionId, 5);

  // 4. Prefetch top prediction in background (fire-and-forget)
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

  return NextResponse.json({ ...result, predictions });
}

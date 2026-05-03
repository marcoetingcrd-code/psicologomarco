import { NextRequest, NextResponse } from "next/server";
import { addEntry, analyzeEntry, getEntries, PENNEBAKER_PROMPT } from "@/lib/journal";

export async function POST(req: NextRequest) {
  const { sessionId, text, prompt, mood } = (await req.json()) as {
    sessionId: string;
    text: string;
    prompt?: string;
    mood?: number;
  };
  if (!sessionId || !text) {
    return NextResponse.json({ error: "missing sessionId or text" }, { status: 400 });
  }

  const analysis = analyzeEntry(text);
  const entry = {
    id: crypto.randomUUID?.() ?? Math.random().toString(36),
    sessionId,
    text,
    prompt: prompt ?? PENNEBAKER_PROMPT,
    mood: mood ?? 5,
    timestamp: Date.now(),
    tags: analysis.tags,
    wordCount: analysis.wordCount,
    negativeEmotionWords: analysis.negativeEmotionWords,
    positiveEmotionWords: analysis.positiveEmotionWords,
    firstPersonCount: analysis.firstPersonCount,
    insightMarkers: analysis.insightMarkers,
  };

  addEntry(sessionId, entry);

  // Generate pattern insight if there are multiple entries
  const all = [...(getEntries(sessionId) ?? [])].filter((e) => e.id !== entry.id);
  const pattern = all.length >= 2 ? generatePattern(all, entry) : null;

  return NextResponse.json({ entry, pattern });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? "anon";
  return NextResponse.json({ entries: getEntries(sessionId) });
}

function generatePattern(prev: any[], current: any) {
  // Simple heuristic pattern detection
  const texts = [...prev.map((e) => e.text), current.text].join(" ");
  const lower = texts.toLowerCase();
  const themes: string[] = [];
  if (lower.includes("mamma") || lower.includes("padre") || lower.includes("genitori") || lower.includes("famiglia")) themes.push("famiglia");
  if (lower.includes("amore") || lower.includes("partner") || lower.includes("ragazza") || lower.includes("relazione") || lower.includes("abbandono")) themes.push("relazione");
  if (lower.includes("lavoro") || lower.includes("studio") || lower.includes("carriera")) themes.push("lavoro");
  if (lower.includes("corpo") || lower.includes("salute") || lower.includes("sonno") || lower.includes("sport") || lower.includes("palestra")) themes.push("corpo");
  if (lower.includes("ansia") || lower.includes("paura") || lower.includes("panico") || lower.includes("stress")) themes.push("ansia");
  if (lower.includes("rabbia") || lower.includes("odio") || lower.includes("delusione")) themes.push("rabbia");

  const negRatio = current.negativeEmotionWords / Math.max(current.wordCount, 1);
  const insightCount = current.insightMarkers.length;

  return {
    themes: Array.from(new Set(themes)),
    negativeEmotionDensity: negRatio,
    insightLevel: insightCount > 3 ? "alto" : insightCount > 0 ? "moderato" : "basso",
    trend: prev.length > 0
      ? current.negativeEmotionWords > prev[prev.length - 1].negativeEmotionWords
        ? "emotività in aumento"
        : "emotività stabile o in calo"
      : "prima entry",
    prompt:
      `Pattern rilevato nelle tue ultime ${prev.length + 1} entry:\n` +
      `- Temi ricorrenti: ${themes.join(", ") || "nessun tema chiaro"}\n` +
      `- Densità emotiva negativa: ${(negRatio * 100).toFixed(1)}%\n` +
      `- Livello di insight: ${insightCount > 3 ? "alto" : insightCount > 0 ? "moderato" : "basso"}\n` +
      `- Tendenza: ${current.negativeEmotionWords > (prev[prev.length - 1]?.negativeEmotionWords ?? 0) ? "emotività in aumento" : "emotività stabile o in calo"}`,
  };
}

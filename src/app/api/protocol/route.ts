import { NextRequest, NextResponse } from "next/server";
import { generateProtocolDraft, saveProtocol } from "@/lib/protocol";
import { getEntries } from "@/lib/journal";
import { getProfile } from "@/lib/profile";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { sessionId: string; assessment?: any; topQueries?: string[] };
  const { sessionId } = body;
  if (!sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });

  // Gather user data
  const entries = getEntries(sessionId);
  const texts = entries.map((e) => e.text).join(" ");
  const negCount = entries.reduce((sum, e) => sum + e.negativeEmotionWords, 0);
  const wordCount = entries.reduce((sum, e) => sum + e.wordCount, 0);
  const negDensity = wordCount > 0 ? negCount / wordCount : 0;
  const insightCount = entries.reduce((sum, e) => sum + e.insightMarkers.length, 0);
  const insightLevel = insightCount > 3 ? "alto" : insightCount > 0 ? "moderato" : "basso";

  const themes: string[] = [];
  const allText = texts.toLowerCase();
  if (allText.includes("mamma") || allText.includes("padre") || allText.includes("genitori") || allText.includes("famiglia")) themes.push("famiglia");
  if (allText.includes("amore") || allText.includes("partner") || allText.includes("ragazza") || allText.includes("relazione") || allText.includes("abbandono")) themes.push("relazione");
  if (allText.includes("lavoro") || allText.includes("studio") || allText.includes("carriera")) themes.push("lavoro");
  if (allText.includes("corpo") || allText.includes("salute") || allText.includes("sonno") || allText.includes("sport") || allText.includes("palestra")) themes.push("corpo");
  if (allText.includes("ansia") || allText.includes("paura") || allText.includes("panico") || allText.includes("stress")) themes.push("ansia");
  if (allText.includes("rabbia") || allText.includes("odio") || allText.includes("delusione")) themes.push("rabbia");

  // Dynamic profile integration
  const profile = getProfile(sessionId);
  const profileThemes = [...new Set([...themes, ...profile.lifeThemes])];
  if (profile.goals) themes.push("goals");

  const draft = generateProtocolDraft(
    profileThemes,
    negDensity,
    insightLevel,
    {
      aceTotal: profile.trauma.aceScore ?? body.assessment?.aceTotal,
      ecrAnxiety: profile.attachment.anxiety ?? body.assessment?.ecrAnxiety,
      ecrAvoidance: profile.attachment.avoidance ?? body.assessment?.ecrAvoidance,
      attachmentStyle: profile.attachment.style ?? body.assessment?.attachmentStyle,
      emotionalRegulation: profile.emotionalRegulation.pattern,
      goals: profile.goals,
    },
    body.topQueries ?? []
  );

  const protocol = {
    id: crypto.randomUUID?.() ?? Math.random().toString(36),
    sessionId,
    createdAt: Date.now(),
    ...draft,
  };

  saveProtocol(sessionId, protocol);

  return NextResponse.json({ protocol });
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? "anon";
  const { getProtocols } = await import("@/lib/protocol");
  return NextResponse.json({ protocols: getProtocols(sessionId) });
}

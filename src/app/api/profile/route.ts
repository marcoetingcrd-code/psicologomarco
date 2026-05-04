import { NextResponse } from "next/server";
import { getProfile, setProfile, detectGaps, markProbed, recordInteraction, ingestAssessment, ingestJournal } from "@/lib/profile";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
  const profile = getProfile(sessionId);
  return NextResponse.json({ profile });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { sessionId, action, data } = body;
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    if (action === "update") {
      const profile = getProfile(sessionId);
      Object.assign(profile, data);
      setProfile(sessionId, profile);
      return NextResponse.json({ profile });
    }

    if (action === "assessment") {
      ingestAssessment(sessionId, data.scaleId, data.scores);
      return NextResponse.json({ profile: getProfile(sessionId) });
    }

    if (action === "journal") {
      ingestJournal(sessionId, data.analysis);
      return NextResponse.json({ profile: getProfile(sessionId) });
    }

    if (action === "interact") {
      recordInteraction(sessionId);
      return NextResponse.json({ profile: getProfile(sessionId) });
    }

    if (action === "gaps") {
      const query = data?.query || "";
      const gaps = detectGaps(sessionId, query);
      return NextResponse.json({ gaps });
    }

    if (action === "markProbed") {
      markProbed(sessionId, data.slot);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { ALL_SCALES } from "@/lib/assessment";

export async function GET() {
  return NextResponse.json({ scales: ALL_SCALES.map((s) => ({ id: s.id, name: s.name, description: s.description, itemCount: s.items.length })) });
}

export async function POST(req: NextRequest) {
  const { scaleId, answers, sessionId } = (await req.json()) as { scaleId: string; answers: number[]; sessionId: string };
  if (!scaleId || !answers || !sessionId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  const scale = ALL_SCALES.find((s) => s.id === scaleId);
  if (!scale) return NextResponse.json({ error: "scale not found" }, { status: 404 });

  const scores = scale.compute(answers);
  const critical = scale.criticalCheck(scores);

  return NextResponse.json({
    scaleId: scale.id,
    name: scale.name,
    scores,
    critical,
    criticalMessage: critical ? scale.criticalMessage : undefined,
    timestamp: Date.now(),
    sessionId,
  });
}

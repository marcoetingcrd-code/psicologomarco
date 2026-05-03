import { NextRequest, NextResponse } from "next/server";
import { predictNext } from "@/lib/profile";

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") ?? "anon";
  const predictions = await predictNext(sessionId, 5);
  return NextResponse.json({ predictions });
}

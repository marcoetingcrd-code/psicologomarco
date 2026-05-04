import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";

export const runtime = "nodejs";

/**
 * POST /api/feedback
 * body: { messageId?: string, rating: 1 | -1, topicTag?: string, reason?: string, sources?: string[] }
 *
 * Il feedback è legato all'utente (può rivederlo/cancellarlo) MA popola anche
 * aggregated_insights in modo ANONIMO: solo topic + source_id + counter, niente user_id.
 */
export async function POST(req: NextRequest) {
  if (!isSupabaseReady()) return NextResponse.json({ ok: false }, { status: 503 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rating = Number(body.rating);
  if (rating !== 1 && rating !== -1)
    return NextResponse.json({ error: "rating must be 1 or -1" }, { status: 400 });

  const messageId = (body.messageId as string | undefined) || null;
  const topicTag = (body.topicTag as string | undefined)?.slice(0, 40) || null;
  const reason = (body.reason as string | undefined)?.slice(0, 500) || null;
  const sources = Array.isArray(body.sources) ? (body.sources as string[]).slice(0, 10) : [];

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  // 1. Inserisce feedback legato all'utente
  const { error } = await db.from("feedback").insert({
    user_id: user.id,
    message_id: messageId,
    rating,
    topic_tag: topicTag,
    reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 2. Check consenso ML; se opt-in, aggiorna aggregated_insights (ANONIMO)
  const { data: settings } = await db
    .from("user_settings")
    .select("ml_consent")
    .eq("user_id", user.id)
    .single();

  if (settings?.ml_consent && topicTag) {
    const sourceIds = sources.length > 0 ? sources : [null];
    for (const sid of sourceIds) {
      // upsert atomico: incrementa counter
      await db.rpc("increment_insight", {
        p_topic: topicTag,
        p_source: sid,
        p_positive: rating === 1 ? 1 : 0,
        p_negative: rating === -1 ? 1 : 0,
      });
    }
  }

  return NextResponse.json({ ok: true });
}

// GET /api/feedback?mine=1  → mie preferenze (ultimi 100)
export async function GET(req: NextRequest) {
  if (!isSupabaseReady()) return NextResponse.json({ items: [] });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { data } = await db
    .from("feedback")
    .select("id, message_id, rating, topic_tag, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  return NextResponse.json({ items: data ?? [] });
}

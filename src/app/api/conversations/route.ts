import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";

export const runtime = "nodejs";

// GET /api/conversations  → lista conversazioni dell'utente
export async function GET(req: NextRequest) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ ready: false, conversations: [] });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ready: true, conversations: data ?? [] });
}

// POST /api/conversations  → crea nuova conversazione
export async function POST(req: NextRequest) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ ready: false, error: "cloud not configured" }, { status: 503 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const title = (body.title as string | undefined)?.slice(0, 120) || "Nuova conversazione";

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("conversations")
    .insert({ user_id: user.id, title })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: data });
}

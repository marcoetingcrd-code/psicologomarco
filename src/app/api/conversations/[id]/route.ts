import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

// DELETE /api/conversations/[id]
export async function DELETE(req: NextRequest, { params }: Ctx) {
  if (!isSupabaseReady()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { error } = await db.from("conversations").delete().eq("id", id).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PATCH /api/conversations/[id]  → rinomina
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!isSupabaseReady()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const title = (body.title as string | undefined)?.slice(0, 120);
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { error } = await db
    .from("conversations")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

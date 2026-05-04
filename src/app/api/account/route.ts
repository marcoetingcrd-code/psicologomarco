import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";
import { decrypt } from "@/lib/crypto";

export const runtime = "nodejs";

// GET /api/account?action=export  → JSON di tutte le tue conversazioni decriptate (GDPR)
// DELETE /api/account             → hard delete account + dati (GDPR)
export async function GET(req: NextRequest) {
  if (!isSupabaseReady()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "export") {
    return NextResponse.json({ userId: user.id, email: user.email });
  }

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { data: convos } = await db
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("user_id", user.id);

  const { data: msgs } = await db
    .from("messages")
    .select("id, conversation_id, role, content_encrypted, created_at, sources")
    .eq("user_id", user.id);

  const decoded =
    msgs?.map((m) => {
      let content = "[errore]";
      try {
        content = decrypt(m.content_encrypted);
      } catch {}
      return {
        id: m.id,
        conversation_id: m.conversation_id,
        role: m.role,
        content,
        sources: m.sources,
        created_at: m.created_at,
      };
    }) ?? [];

  return NextResponse.json({
    exported_at: new Date().toISOString(),
    user: { id: user.id, email: user.email },
    conversations: convos ?? [],
    messages: decoded,
  });
}

export async function DELETE(req: NextRequest) {
  if (!isSupabaseReady()) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  // Cancella auth.user → cascade a conversations, messages, feedback, user_settings
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

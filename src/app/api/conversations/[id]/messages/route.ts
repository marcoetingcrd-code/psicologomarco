import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";
import { encrypt, decrypt, isEncryptionReady } from "@/lib/crypto";

export const runtime = "nodejs";

interface Ctx {
  params: Promise<{ id: string }>;
}

// GET /api/conversations/[id]/messages  → legge messaggi decriptati
export async function GET(req: NextRequest, { params }: Ctx) {
  if (!isSupabaseReady()) return NextResponse.json({ ready: false, messages: [] });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isEncryptionReady())
    return NextResponse.json({ error: "encryption key missing" }, { status: 503 });

  const { id } = await params;
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  // verifica ownership conversation
  const { data: convo, error: convErr } = await db
    .from("conversations")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (convErr || !convo || convo.user_id !== user.id)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data, error } = await db
    .from("messages")
    .select("id, role, content_encrypted, sources, used_llm, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const messages = (data ?? []).map((m) => ({
    id: m.id,
    role: m.role,
    content: safeDecrypt(m.content_encrypted),
    sources: m.sources,
    usedLLM: m.used_llm,
    timestamp: new Date(m.created_at).getTime(),
  }));

  return NextResponse.json({ ready: true, messages });
}

// POST /api/conversations/[id]/messages  → salva un messaggio cifrato
export async function POST(req: NextRequest, { params }: Ctx) {
  if (!isSupabaseReady())
    return NextResponse.json({ ready: false, error: "cloud not configured" }, { status: 503 });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isEncryptionReady())
    return NextResponse.json({ error: "encryption key missing" }, { status: 503 });

  const { id } = await params;
  const body = await req.json();
  const { role, content, sources, usedLLM } = body as {
    role: "user" | "assistant";
    content: string;
    sources?: unknown;
    usedLLM?: boolean;
  };
  if (!role || !content)
    return NextResponse.json({ error: "missing role or content" }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  // verifica ownership
  const { data: convo } = await db
    .from("conversations")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (!convo || convo.user_id !== user.id)
    return NextResponse.json({ error: "not found" }, { status: 404 });

  const encrypted = encrypt(content);
  const { data, error } = await db
    .from("messages")
    .insert({
      conversation_id: id,
      user_id: user.id,
      role,
      content_encrypted: encrypted,
      sources: (sources ?? null) as object | null,
      used_llm: !!usedLLM,
    })
    .select("id, created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // touch conversation updated_at
  await db.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", id);

  return NextResponse.json({ id: data.id, timestamp: new Date(data.created_at).getTime() });
}

function safeDecrypt(enc: string): string {
  try {
    return decrypt(enc);
  } catch (e) {
    return "[errore decrittografia]";
  }
}

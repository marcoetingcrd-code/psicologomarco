import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";
import { encrypt, decrypt, isEncryptionReady } from "@/lib/crypto";
import {
  type CaseFile,
  type CaseDomain,
  computeReadiness,
} from "@/lib/case-file";
import { extractAndApply } from "@/lib/fact-extractor";
import { detectSafety } from "@/lib/sovereign/safety";

export const runtime = "nodejs";

interface CaseFileRow {
  conversation_id: string;
  user_id: string;
  domain: string;
  facts_encrypted: string | null;
  attempts_encrypted: string | null;
  open_questions_encrypted: string | null;
  pending_thread_encrypted: string | null;
  plan_encrypted: string | null;
  readiness: number;
  updated_at: string;
}

function rowToCaseFile(row: CaseFileRow): CaseFile {
  const dec = (s: string | null) => {
    if (!s) return null;
    try { return JSON.parse(decrypt(s)); } catch { return null; }
  };
  return {
    conversationId: row.conversation_id,
    domain: row.domain as CaseDomain,
    facts: dec(row.facts_encrypted) ?? {},
    attempts: dec(row.attempts_encrypted) ?? [],
    openQuestions: dec(row.open_questions_encrypted) ?? [],
    pendingThread: dec(row.pending_thread_encrypted) ?? undefined,
    plan: row.plan_encrypted ? decrypt(row.plan_encrypted) : undefined,
    readiness: row.readiness,
    updatedAt: new Date(row.updated_at).getTime(),
  };
}

function caseFileToRow(cf: CaseFile, userId: string): Omit<CaseFileRow, "updated_at"> {
  return {
    conversation_id: cf.conversationId,
    user_id: userId,
    domain: cf.domain,
    facts_encrypted: encrypt(JSON.stringify(cf.facts ?? {})),
    attempts_encrypted: encrypt(JSON.stringify(cf.attempts ?? [])),
    open_questions_encrypted: encrypt(JSON.stringify(cf.openQuestions ?? [])),
    pending_thread_encrypted: cf.pendingThread ? encrypt(JSON.stringify(cf.pendingThread)) : null,
    plan_encrypted: cf.plan ? encrypt(cf.plan) : null,
    readiness: cf.readiness ?? computeReadiness(cf.domain, cf.facts),
  };
}

// GET /api/case?conversationId=...
export async function GET(req: NextRequest) {
  if (!isSupabaseReady() || !isEncryptionReady()) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const conversationId = new URL(req.url).searchParams.get("conversationId");
  if (!conversationId) return NextResponse.json({ error: "missing conversationId" }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { data, error } = await db
    .from("case_files")
    .select("*")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ ready: true, caseFile: null });

  return NextResponse.json({ ready: true, caseFile: rowToCaseFile(data as CaseFileRow) });
}

// POST /api/case  → action: update | extract | clear
export async function POST(req: NextRequest) {
  if (!isSupabaseReady() || !isEncryptionReady()) {
    return NextResponse.json({ ready: false, error: "cloud not configured" }, { status: 503 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as "update" | "extract" | "clear" | undefined;
  if (!action) return NextResponse.json({ error: "missing action" }, { status: 400 });

  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  if (action === "update") {
    const cf = body.caseFile as CaseFile | undefined;
    if (!cf || !cf.conversationId) return NextResponse.json({ error: "missing caseFile" }, { status: 400 });
    const row = caseFileToRow(cf, user.id);
    const { error } = await db.from("case_files").upsert(row, { onConflict: "conversation_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "extract") {
    const conversationId = body.conversationId as string | undefined;
    const text = (body.text as string | undefined) ?? "";
    if (!conversationId) return NextResponse.json({ error: "missing conversationId" }, { status: 400 });
    if (!text) return NextResponse.json({ error: "missing text" }, { status: 400 });

    // Safety check first
    const safety = detectSafety(text);
    if (safety.triggered) {
      return NextResponse.json({ ok: true, safety, caseFile: null });
    }

    // Carica esistente
    const { data: existing } = await db
      .from("case_files")
      .select("*")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();

    const current: CaseFile = existing
      ? rowToCaseFile(existing as CaseFileRow)
      : {
          conversationId,
          domain: "generic",
          facts: {},
          attempts: [],
          openQuestions: [],
          readiness: 0,
          updatedAt: Date.now(),
        };

    const updated = await extractAndApply(text, current);
    const row = caseFileToRow(updated, user.id);
    const { error } = await db.from("case_files").upsert(row, { onConflict: "conversation_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, caseFile: updated, safety });
  }

  if (action === "clear") {
    const conversationId = body.conversationId as string | undefined;
    if (!conversationId) return NextResponse.json({ error: "missing conversationId" }, { status: 400 });
    const { error } = await db
      .from("case_files")
      .delete()
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

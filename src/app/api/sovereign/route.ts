/**
 * API /api/sovereign — gestione contract, sovereign state (excuse library, manipulation profile),
 * audit log, reckoning. Tutto cifrato AES-256-GCM in Supabase.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";
import { encrypt, decrypt, isEncryptionReady } from "@/lib/crypto";
import { type SovereignContract, isContractValid } from "@/lib/sovereign/contract";
import { emptyLibrary, type ExcuseLibrary } from "@/lib/sovereign/excuse-buster";

export const runtime = "nodejs";

interface ContractRow {
  user_id: string;
  payload_encrypted: string;
  signed_at: string;
  expires_at: string;
  active: boolean;
  last_reconsent_at: string | null;
}

interface StateRow {
  user_id: string;
  manipulation_profile_encrypted: string | null;
  excuse_library_encrypted: string | null;
  reckoning_streak: number;
  audit_misses: number;
  last_audit_at: string | null;
  emergency_paused_until: string | null;
}

function decryptJSON<T>(s: string | null): T | null {
  if (!s) return null;
  try {
    return JSON.parse(decrypt(s)) as T;
  } catch {
    return null;
  }
}

async function getOrInitState(db: ReturnType<typeof getServiceClient>, userId: string) {
  if (!db) return null;
  const { data } = await db.from("sovereign_state").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as StateRow;
  // init
  const lib = emptyLibrary();
  const init = {
    user_id: userId,
    excuse_library_encrypted: encrypt(JSON.stringify(lib)),
    manipulation_profile_encrypted: null,
    reckoning_streak: 0,
    audit_misses: 0,
  };
  const { data: inserted } = await db.from("sovereign_state").upsert(init, { onConflict: "user_id" }).select().single();
  return (inserted ?? null) as StateRow | null;
}

// GET handlers
export async function GET(req: NextRequest) {
  if (!isSupabaseReady() || !isEncryptionReady()) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const action = new URL(req.url).searchParams.get("action");
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  if (action === "get-contract") {
    const { data } = await db.from("sovereign_contracts").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) return NextResponse.json({ ready: true, contract: null });
    const row = data as ContractRow;
    const contract = decryptJSON<SovereignContract>(row.payload_encrypted);
    return NextResponse.json({ ready: true, contract });
  }

  if (action === "get-state") {
    const state = await getOrInitState(db, user.id);
    if (!state) return NextResponse.json({ ready: true, state: null });
    return NextResponse.json({
      ready: true,
      state: {
        excuseLibrary: decryptJSON<ExcuseLibrary>(state.excuse_library_encrypted) ?? emptyLibrary(),
        reckoningStreak: state.reckoning_streak,
        auditMisses: state.audit_misses,
        lastAuditAt: state.last_audit_at,
        emergencyPausedUntil: state.emergency_paused_until,
      },
    });
  }

  if (action === "get-log") {
    const limit = Math.min(100, Number(new URL(req.url).searchParams.get("limit") ?? 30));
    const kind = new URL(req.url).searchParams.get("kind");
    let q = db.from("sovereign_log").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(limit);
    if (kind) q = q.eq("kind", kind);
    const { data } = await q;
    const items = (data ?? []).map((r: any) => ({
      id: r.id,
      kind: r.kind,
      payload: decryptJSON<unknown>(r.payload_encrypted),
      createdAt: r.created_at,
    }));
    return NextResponse.json({ ready: true, items });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function POST(req: NextRequest) {
  if (!isSupabaseReady() || !isEncryptionReady()) {
    return NextResponse.json({ ready: false, error: "cloud not configured" }, { status: 503 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  if (action === "save-contract") {
    const c = body.contract as SovereignContract | undefined;
    if (!c) return NextResponse.json({ error: "missing contract" }, { status: 400 });
    const row = {
      user_id: user.id,
      payload_encrypted: encrypt(JSON.stringify(c)),
      signed_at: new Date(c.signedAt).toISOString(),
      expires_at: new Date(c.expiresAt).toISOString(),
      active: !!c.active,
      last_reconsent_at: new Date().toISOString(),
    };
    const { error } = await db.from("sovereign_contracts").upsert(row, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // log reconsent
    await db.from("sovereign_log").insert({
      user_id: user.id,
      kind: "reconsent",
      payload_encrypted: encrypt(JSON.stringify({ active: c.active, fronts: Object.keys(c.fronts).filter((k) => c.fronts[k as keyof typeof c.fronts].active) })),
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "save-state") {
    const state = await getOrInitState(db, user.id);
    if (!state) return NextResponse.json({ error: "state init failed" }, { status: 500 });
    const update: any = { user_id: user.id };
    if (body.excuseLibrary) update.excuse_library_encrypted = encrypt(JSON.stringify(body.excuseLibrary));
    if (body.manipulationProfile) update.manipulation_profile_encrypted = encrypt(JSON.stringify(body.manipulationProfile));
    if (typeof body.reckoningStreak === "number") update.reckoning_streak = body.reckoningStreak;
    if (typeof body.auditMisses === "number") update.audit_misses = body.auditMisses;
    if (body.lastAuditAt) update.last_audit_at = new Date(body.lastAuditAt).toISOString();
    if (body.emergencyPausedUntil) update.emergency_paused_until = new Date(body.emergencyPausedUntil).toISOString();
    const { error } = await db.from("sovereign_state").upsert(update, { onConflict: "user_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "log") {
    const kind = body.kind as string | undefined;
    if (!kind || !["reckoning", "audit", "intervention", "tribunal", "safety", "reconsent"].includes(kind)) {
      return NextResponse.json({ error: "invalid kind" }, { status: 400 });
    }
    const payload = body.payload ?? {};
    const { error } = await db.from("sovereign_log").insert({
      user_id: user.id,
      kind,
      payload_encrypted: encrypt(JSON.stringify(payload)),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "deactivate") {
    const { error } = await db.from("sovereign_contracts").update({ active: false }).eq("user_id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

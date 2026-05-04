/**
 * API /api/hook — streak ping/sync, identity handle, threads, hook state.
 */

import { NextRequest, NextResponse } from "next/server";
import { getServiceClient, isSupabaseReady } from "@/lib/supabase";
import { getAuthedUser } from "@/lib/auth-server";
import { type StreakState, pingStreak } from "@/lib/hook";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  if (!isSupabaseReady()) {
    return NextResponse.json({ ready: false }, { status: 200 });
  }
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const action = new URL(req.url).searchParams.get("action");
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  if (action === "ping-streak") {
    const body = await req.json().catch(() => ({}));
    const local = (body.local ?? null) as StreakState | null;

    const { data: row } = await db.from("hook_state").select("*").eq("user_id", user.id).maybeSingle();
    const cloud: StreakState = row
      ? {
          streakDays: row.streak_days as number,
          longestStreak: row.longest_streak as number,
          lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string).getTime() : 0,
          identityHandle: (row.identity_handle as string) ?? undefined,
        }
      : { streakDays: 0, longestStreak: 0, lastSeenAt: 0 };

    // Take the most recent state (max lastSeenAt) as base
    const base = (local && local.lastSeenAt > cloud.lastSeenAt) ? local : cloud;
    const next = pingStreak(base);

    const update: any = {
      user_id: user.id,
      streak_days: next.streakDays,
      longest_streak: Math.max(next.longestStreak, cloud.longestStreak),
      last_seen_at: new Date(next.lastSeenAt).toISOString(),
    };
    await db.from("hook_state").upsert(update, { onConflict: "user_id" });

    return NextResponse.json({ ready: true, state: next });
  }

  if (action === "set-identity") {
    const body = await req.json().catch(() => ({}));
    const handle = (body.identityHandle as string | undefined)?.slice(0, 80) ?? null;
    await db.from("hook_state").upsert(
      { user_id: user.id, identity_handle: handle },
      { onConflict: "user_id" },
    );
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}

export async function GET(req: NextRequest) {
  if (!isSupabaseReady()) return NextResponse.json({ ready: false });
  const user = await getAuthedUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getServiceClient();
  if (!db) return NextResponse.json({ error: "service unavailable" }, { status: 503 });

  const { data: row } = await db.from("hook_state").select("*").eq("user_id", user.id).maybeSingle();
  return NextResponse.json({
    ready: true,
    state: row
      ? {
          streakDays: row.streak_days,
          longestStreak: row.longest_streak,
          lastSeenAt: row.last_seen_at,
          identityHandle: row.identity_handle,
        }
      : null,
  });
}

/**
 * Hook Engine (light) — streak service.
 * Tracking giorni consecutivi di apertura, longest streak, last seen.
 *
 * Persistito in localStorage; in cloud via /api/sovereign action="ping-streak".
 */

import { getBrowserClient, isSupabaseReady } from "./supabase";

export interface StreakState {
  streakDays: number;
  longestStreak: number;
  lastSeenAt: number;
  identityHandle?: string;
}

const LS = "atlas-hook-streak";

export function loadLocalStreak(): StreakState {
  if (typeof window === "undefined") return { streakDays: 0, longestStreak: 0, lastSeenAt: 0 };
  try {
    const raw = localStorage.getItem(LS);
    if (raw) return JSON.parse(raw) as StreakState;
  } catch {
    /* ignore */
  }
  return { streakDays: 0, longestStreak: 0, lastSeenAt: 0 };
}

export function saveLocalStreak(s: StreakState) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(LS, JSON.stringify(s)); } catch { /* quota */ }
}

function isSameLocalDay(a: number, b: number) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

function daysBetween(a: number, b: number): number {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86400000);
}

/**
 * Aggiorna lo streak alla data di oggi:
 *   - stesso giorno: nessuna variazione
 *   - giorno successivo: +1
 *   - gap > 1 giorno: reset a 1
 */
export function pingStreak(state: StreakState, now = Date.now()): StreakState {
  if (state.lastSeenAt === 0) {
    return { ...state, streakDays: 1, longestStreak: Math.max(1, state.longestStreak), lastSeenAt: now };
  }
  if (isSameLocalDay(state.lastSeenAt, now)) {
    return { ...state, lastSeenAt: now };
  }
  const gap = daysBetween(state.lastSeenAt, now);
  if (gap === 1) {
    const next = state.streakDays + 1;
    return { ...state, streakDays: next, longestStreak: Math.max(state.longestStreak, next), lastSeenAt: now };
  }
  // gap > 1, reset
  return { ...state, streakDays: 1, lastSeenAt: now };
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const c = getBrowserClient();
  if (!c) return {};
  const { data } = await c.auth.getSession();
  if (!data.session) return {};
  return { Authorization: `Bearer ${data.session.access_token}` };
}

async function isCloud(): Promise<boolean> {
  if (!isSupabaseReady()) return false;
  const c = getBrowserClient();
  if (!c) return false;
  const { data } = await c.auth.getSession();
  return !!data.session;
}

/**
 * Sync streak con cloud (best effort). Invia stato corrente, riceve eventuale stato cloud più aggiornato.
 */
export async function syncStreak(local: StreakState): Promise<StreakState> {
  if (!(await isCloud())) return local;
  try {
    const r = await fetch("/api/hook?action=ping-streak", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({ local }),
    });
    if (!r.ok) return local;
    const d = await r.json();
    if (d?.state) return d.state as StreakState;
    return local;
  } catch {
    return local;
  }
}

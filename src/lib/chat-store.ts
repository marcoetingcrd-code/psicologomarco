/**
 * Store ibrido per messaggi chat.
 *
 * - Se utente autenticato + Supabase configurato → sync con backend criptato
 * - Altrimenti → localStorage (comportamento anonimo, come prima)
 *
 * API unificata async. Il chat-tab usa solo questo, non deve preoccuparsi del dove.
 */

import {
  loadMessages as lsLoad,
  saveMessage as lsSave,
  clearMessages as lsClear,
  type ChatMessage,
} from "./conversation-memory";
import { getBrowserClient, isSupabaseReady } from "./supabase";

export type StoreMode = "local" | "cloud";

export interface StoreContext {
  mode: StoreMode;
  userId?: string;
  conversationId?: string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const c = getBrowserClient();
  if (!c) return {};
  const { data } = await c.auth.getSession();
  if (!data.session) return {};
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export async function getContext(): Promise<StoreContext> {
  if (!isSupabaseReady()) return { mode: "local" };
  const c = getBrowserClient();
  if (!c) return { mode: "local" };
  const { data } = await c.auth.getSession();
  if (!data.session) return { mode: "local" };
  return { mode: "cloud", userId: data.session.user.id };
}

// ========================================================================
// Conversazioni (solo cloud)
// ========================================================================

export interface ConversationMeta {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export async function listConversations(): Promise<ConversationMeta[]> {
  const ctx = await getContext();
  if (ctx.mode === "local") return [];
  const res = await fetch("/api/conversations", { headers: await getAuthHeader() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.conversations ?? [];
}

export async function createConversation(title?: string): Promise<ConversationMeta | null> {
  const ctx = await getContext();
  if (ctx.mode === "local") return null;
  const res = await fetch("/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.conversation ?? null;
}

export async function deleteConversation(id: string): Promise<boolean> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: "DELETE",
    headers: await getAuthHeader(),
  });
  return res.ok;
}

export async function renameConversation(id: string, title: string): Promise<boolean> {
  const res = await fetch(`/api/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
    body: JSON.stringify({ title }),
  });
  return res.ok;
}

// ========================================================================
// Messaggi
// ========================================================================

/**
 * Carica messaggi per una sessione (local) o conversation (cloud).
 * - sid: session id locale (fallback)
 * - conversationId: id conversazione cloud (se loggato)
 */
export async function loadMessages(
  sid: string,
  conversationId?: string,
): Promise<ChatMessage[]> {
  const ctx = await getContext();
  if (ctx.mode === "cloud" && conversationId) {
    const res = await fetch(`/api/conversations/${conversationId}/messages`, {
      headers: await getAuthHeader(),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.messages ?? [];
  }
  return lsLoad(sid);
}

export async function saveMessage(
  sid: string,
  message: ChatMessage,
  conversationId?: string,
): Promise<void> {
  const ctx = await getContext();
  if (ctx.mode === "cloud" && conversationId) {
    await fetch(`/api/conversations/${conversationId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
      body: JSON.stringify({
        role: message.role,
        content: message.content,
        sources: message.sources,
        usedLLM: message.usedLLM,
      }),
    });
    return;
  }
  lsSave(sid, message);
}

export function clearMessages(sid: string) {
  lsClear(sid);
}

export async function getLastMessages(
  sid: string,
  count = 6,
  conversationId?: string,
): Promise<ChatMessage[]> {
  const all = await loadMessages(sid, conversationId);
  return all.slice(-count);
}

// ========================================================================
// Migrazione: localStorage → cloud (chiamata la prima volta dopo login)
// ========================================================================

/**
 * Se l'utente ha messaggi in localStorage e si logga per la prima volta,
 * offre di importarli in una conversazione cloud.
 */
export async function migrateLocalToCloud(sid: string): Promise<ConversationMeta | null> {
  const local = lsLoad(sid);
  if (local.length < 2) return null; // niente di importante da migrare
  const convo = await createConversation("Conversazione importata");
  if (!convo) return null;
  for (const m of local) {
    await saveMessage(sid, m, convo.id);
  }
  return convo;
}

// ========================================================================
// Auth
// ========================================================================

export async function signOut() {
  const c = getBrowserClient();
  if (c) await c.auth.signOut();
}

export async function getCurrentUser() {
  const c = getBrowserClient();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  if (!data.session) return null;
  return { id: data.session.user.id, email: data.session.user.email };
}

/**
 * Helper server-side per ricavare l'utente autenticato da una richiesta.
 * Usa il token Supabase passato nell'Authorization header dal client.
 *
 * Convenzione: il client chiama le API con header "Authorization: Bearer <access_token>"
 * ottenuto da supabase.auth.getSession() lato browser.
 */

import { NextRequest } from "next/server";
import { getAnonServerClient } from "./supabase";

export interface AuthedUser {
  id: string;
  email?: string;
}

export async function getAuthedUser(req: NextRequest): Promise<AuthedUser | null> {
  const client = getAnonServerClient();
  if (!client) return null;

  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth || !auth.toLowerCase().startsWith("bearer ")) return null;

  const token = auth.slice(7).trim();
  if (!token) return null;

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

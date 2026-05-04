import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Le env vars sono esposte al client solo se iniziano con NEXT_PUBLIC_
// L'app usa fallback localStorage quando Supabase non è configurato.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function isSupabaseReady(): boolean {
  return Boolean(URL && ANON_KEY);
}

// Client per il browser (auth lato client, RLS attive)
let browserClient: SupabaseClient | null = null;
export function getBrowserClient(): SupabaseClient | null {
  if (!isSupabaseReady()) return null;
  if (browserClient) return browserClient;
  browserClient = createClient(URL, ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return browserClient;
}

// Client server-side "admin" (bypassa RLS, usa SERVICE key).
// USALO SOLO nelle route API server, mai esporre al client.
export function getServiceClient(): SupabaseClient | null {
  if (!URL || !SERVICE_KEY) return null;
  return createClient(URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Client server-side con anon key (per operazioni che richiedono RLS)
export function getAnonServerClient(): SupabaseClient | null {
  if (!isSupabaseReady()) return null;
  return createClient(URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Deprecated alias (compat con codice esistente)
export const supabase = isSupabaseReady() ? createClient(URL, ANON_KEY) : null;

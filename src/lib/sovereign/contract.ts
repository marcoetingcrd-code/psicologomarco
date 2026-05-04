/**
 * Sovereign Contract — auto-vincolo firmato dall'utente.
 *
 * Documento che definisce 4 fronti operativi (money/relationship/body/mind),
 * obiettivi misurabili, identità in costruzione, costo del fallimento,
 * livelli di consenso alla manipolazione.
 *
 * Cifrato in Supabase, durata default 90 giorni con re-consent ogni 7.
 */

import { getBrowserClient, isSupabaseReady } from "../supabase";

export type FrontKey = "money" | "relationship" | "body" | "mind";

export interface FrontGoal {
  title: string;        // "Lanciare landing distributore"
  metric: string;       // "10 chiamate clienti / settimana"
  deadline?: number;    // timestamp
  why: string;          // motivazione profonda
  nonNegotiable: boolean;
}

export interface FrontDefinition {
  active: boolean;
  goals: FrontGoal[];
  rituals: {
    morning?: string;
    evening?: string;
    forbidden?: string[]; // "no alcol", "no messaggi a ex", ecc.
  };
}

export interface ManipulationConsent {
  allowShame: boolean;
  allowFear: boolean;
  allowMockery: boolean;
  allowSelectiveValidation: boolean;
  allowIdentityChallenge: boolean;
  allowMessageBlocking: boolean;
  allowRandomAudit: boolean;
  allowHardTruth: boolean;
}

export interface SovereignContract {
  signedAt: number;
  expiresAt: number;
  fronts: Record<FrontKey, FrontDefinition>;
  manipulationConsent: ManipulationConsent;
  identityCommitment: string; // "Sono lo stratega che…"
  failureCost: string;        // scritto dall'utente: cosa perde se molla
  reconsentEveryDays: number;
  emergencyContact?: string;
  active: boolean;
}

export const DEFAULT_CONSENT: ManipulationConsent = {
  allowShame: true,
  allowFear: true,
  allowMockery: true,
  allowSelectiveValidation: true,
  allowIdentityChallenge: true,
  allowMessageBlocking: true,
  allowRandomAudit: true,
  allowHardTruth: true,
};

export const SOFTER_CONSENT: ManipulationConsent = {
  allowShame: false,
  allowFear: false,
  allowMockery: false,
  allowSelectiveValidation: true,
  allowIdentityChallenge: true,
  allowMessageBlocking: true,
  allowRandomAudit: false,
  allowHardTruth: true,
};

export function emptyContract(): SovereignContract {
  const now = Date.now();
  const ninetyDays = 90 * 24 * 3600 * 1000;
  const emptyFront: FrontDefinition = { active: false, goals: [], rituals: {} };
  return {
    signedAt: now,
    expiresAt: now + ninetyDays,
    fronts: {
      money: { ...emptyFront },
      relationship: { ...emptyFront },
      body: { ...emptyFront },
      mind: { ...emptyFront },
    },
    manipulationConsent: { ...DEFAULT_CONSENT },
    identityCommitment: "",
    failureCost: "",
    reconsentEveryDays: 7,
    active: false,
  };
}

export function isContractValid(c: SovereignContract | null): boolean {
  if (!c) return false;
  if (!c.active) return false;
  if (Date.now() > c.expiresAt) return false;
  // almeno un fronte attivo con almeno un goal
  return Object.values(c.fronts).some((f) => f.active && f.goals.length > 0);
}

export function activeFronts(c: SovereignContract): { key: FrontKey; def: FrontDefinition }[] {
  return (Object.keys(c.fronts) as FrontKey[])
    .filter((k) => c.fronts[k].active && c.fronts[k].goals.length > 0)
    .map((key) => ({ key, def: c.fronts[key] }));
}

export function summarizeContract(c: SovereignContract): string {
  if (!isContractValid(c)) return "";
  const lines: string[] = [];
  lines.push(`Identità: ${c.identityCommitment || "(non dichiarata)"}`);
  lines.push(`Costo del fallimento (sue parole): ${c.failureCost || "(non dichiarato)"}`);
  const days = Math.max(0, Math.ceil((c.expiresAt - Date.now()) / 86400000));
  lines.push(`Contratto attivo, ${days} giorni residui.`);
  for (const { key, def } of activeFronts(c)) {
    lines.push(`Fronte ${key}:`);
    for (const g of def.goals) {
      lines.push(`  - ${g.title} | metrica: ${g.metric}${g.nonNegotiable ? " | NON-NEGOZIABILE" : ""}`);
    }
    if (def.rituals.morning) lines.push(`  rituale mattino: ${def.rituals.morning}`);
    if (def.rituals.evening) lines.push(`  rituale sera: ${def.rituals.evening}`);
    if (def.rituals.forbidden?.length) lines.push(`  vietati: ${def.rituals.forbidden.join(", ")}`);
  }
  const c2 = c.manipulationConsent;
  const levers: string[] = [];
  if (c2.allowShame) levers.push("vergogna");
  if (c2.allowFear) levers.push("paura");
  if (c2.allowMockery) levers.push("derisione");
  if (c2.allowIdentityChallenge) levers.push("identità");
  if (c2.allowSelectiveValidation) levers.push("validazione selettiva");
  if (c2.allowMessageBlocking) levers.push("blocco messaggi");
  if (c2.allowHardTruth) levers.push("verità brutale");
  lines.push(`Leve consentite: ${levers.join(", ") || "nessuna"}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Storage client-side
// ---------------------------------------------------------------------------

const LS_KEY = "atlas-sovereign-contract";

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

export async function loadContract(): Promise<SovereignContract | null> {
  if (typeof window === "undefined") return null;
  if (await isCloud()) {
    try {
      const r = await fetch("/api/sovereign?action=get-contract", { headers: await getAuthHeader() });
      if (r.ok) {
        const d = await r.json();
        if (d.contract) return d.contract as SovereignContract;
      }
    } catch {
      /* fallback locale */
    }
  }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as SovereignContract;
  } catch {
    /* ignore */
  }
  return null;
}

export async function saveContract(c: SovereignContract): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(c));
  } catch {
    /* quota */
  }
  if (await isCloud()) {
    try {
      await fetch("/api/sovereign", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeader()) },
        body: JSON.stringify({ action: "save-contract", contract: c }),
      });
    } catch {
      /* offline */
    }
  }
}

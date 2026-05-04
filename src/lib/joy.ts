/**
 * Joy Engine — rileva e accumula eventi di gioia/successo dell'utente.
 * Il profilo (cosa lo accende) diventa la "carota" usabile dal Sovereign.
 *
 * Heuristic-based, client/server safe.
 */

export type JoyKind =
  | "vittoria"      // ha ottenuto qualcosa
  | "rottura_pattern" // ha rotto un pattern negativo
  | "sblocco"       // ha superato un blocco
  | "accensione"    // qualcosa lo ha eccitato/motivato
  | "connessione"   // legame umano significativo
  | "creativita"    // ha creato qualcosa
  | "potenza";      // si è sentito potente/in controllo

export interface JoyEvent {
  id?: string;
  kind: JoyKind;
  text: string;     // estratto del testo che lo ha rivelato (max 240 char)
  intensity: number; // 0..1
  createdAt: number;
}

export interface JoyProfile {
  events: JoyEvent[];
  topThemes: { theme: string; count: number }[];
  lastUpdated: number;
}

const JOY_PATTERNS: { kind: JoyKind; rx: RegExp; weight: number }[] = [
  { kind: "vittoria",        rx: /\b(ce l'ho fatta|ho chiuso|ho vinto|ho ottenuto|ho preso|ho firmato|ha detto sì|hanno detto sì|ho conquistato)/i, weight: 0.8 },
  { kind: "rottura_pattern", rx: /\b(per la prima volta|finalmente non|sono uscito dal|ho smesso di|ho rotto il|stavolta no)/i, weight: 0.85 },
  { kind: "sblocco",         rx: /\b(mi sono sbloccato|ho superato|ho fatto la cosa difficile|ho trovato il coraggio|ho detto di no)/i, weight: 0.75 },
  { kind: "accensione",      rx: /\b(adoro|mi piace tantissimo|carichissimo|spaccato|wow|figo|che goduria|mi sento vivo|mi sono divertito)/i, weight: 0.7 },
  { kind: "connessione",     rx: /\b(abbracciat|guardato negli occhi|ridevo con|abbiamo parlato per ore|mi ha detto che|si è aperta)/i, weight: 0.7 },
  { kind: "creativita",      rx: /\b(ho creato|ho costruito|ho disegnato|ho scritto|ho prodotto|stavo flow)/i, weight: 0.7 },
  { kind: "potenza",         rx: /\b(in controllo|ho gestito tutto|ho preso le redini|ho deciso e basta|con autorità)/i, weight: 0.75 },
];

export function detectJoy(text: string): JoyEvent[] {
  const out: JoyEvent[] = [];
  const now = Date.now();
  for (const { kind, rx, weight } of JOY_PATTERNS) {
    const m = text.match(rx);
    if (m) {
      const around = extractContext(text, m.index ?? 0, 240);
      out.push({ kind, text: around, intensity: weight, createdAt: now });
    }
  }
  return out;
}

function extractContext(text: string, idx: number, max: number): string {
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + max - 60);
  return text.slice(start, end).trim();
}

export function emptyProfile(): JoyProfile {
  return { events: [], topThemes: [], lastUpdated: 0 };
}

export function applyJoyEvents(profile: JoyProfile, events: JoyEvent[]): JoyProfile {
  if (events.length === 0) return profile;
  const merged = [...profile.events, ...events].slice(-200); // ring buffer
  // Calcola top themes (kind frequency pesato per intensity)
  const byKind: Record<string, number> = {};
  for (const e of merged) byKind[e.kind] = (byKind[e.kind] ?? 0) + e.intensity;
  const topThemes = Object.entries(byKind)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([theme, count]) => ({ theme, count: Math.round(count * 10) / 10 }));
  return { events: merged, topThemes, lastUpdated: Date.now() };
}

export function summarizeJoyProfile(profile: JoyProfile): string {
  if (profile.events.length === 0) return "";
  const themes = profile.topThemes.map((t) => `${t.theme}(${t.count})`).join(", ");
  return `Joy profile (cosa lo accende, top temi pesati): ${themes}. Eventi totali: ${profile.events.length}.`;
}

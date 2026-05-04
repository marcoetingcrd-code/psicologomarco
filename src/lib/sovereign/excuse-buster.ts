/**
 * Excuse Buster — biblioteca delle scuse personali dell'utente.
 *
 * Detection heuristic + tracking conteggi. Quando una scusa è già stata usata,
 * Atlas la cita per nome nel prompt successivo.
 */

export interface ExcuseEntry {
  excuse: string;       // forma normalizzata
  pattern: string;      // regex source
  counter: string;      // contro-mossa standard
  count: number;
  lastUsedAt: number;
}

export interface ExcuseLibrary {
  entries: ExcuseEntry[];
  totalDetected: number;
}

// Scuse universali pre-popolate (italiano)
export const SEED_EXCUSES: Omit<ExcuseEntry, "count" | "lastUsedAt">[] = [
  {
    excuse: "sono stanco",
    pattern: "\\b(sono stanco|esausto|distrutto|fuso|non ho energie)\\b",
    counter: "Stanco è uno stato, non una decisione. Versione minima dell'azione: 5 minuti, set ridotto, fai e basta. Poi rivaluti.",
  },
  {
    excuse: "domani",
    pattern: "\\b(domani|più tardi|stasera lo faccio|nei prossimi giorni)\\b",
    counter: "Domani è dove muoiono le decisioni. Statistica del tuo profilo: cose rimandate a domani non si fanno. Adesso o mai.",
  },
  {
    excuse: "non ho tempo",
    pattern: "\\b(non ho tempo|non riesco con i tempi|sono troppo impegnato|tempo è poco)\\b",
    counter: "Non è tempo, è priorità. Cosa hai fatto nelle ultime 2 ore? Quella è la tua priorità reale. Decidi se cambiarla.",
  },
  {
    excuse: "non sono pronto",
    pattern: "\\b(non sono pronto|non mi sento pronto|devo prima preparar|devo studiare ancora|devo capire meglio)\\b",
    counter: "Pronto non esiste, è una scusa elegante per evitare. Si diventa pronti facendo. Versione 0.1 ora, rifinisci dopo.",
  },
  {
    excuse: "forse / vediamo / magari",
    pattern: "\\b(forse|magari|vediamo|si vedrà|chissà|non lo so se)\\b",
    counter: "Linguaggio vago = decisione non presa. Sì o no, ora. Anche un no chiaro vale più di un forse.",
  },
  {
    excuse: "non sono nel mood",
    pattern: "\\b(non sono nel mood|non mi va|non mi sento|non ho voglia|non ho la testa)\\b",
    counter: "Mood arriva facendo, non aspettando. La motivazione segue l'azione, non la precede. Inizia, il mood arriva al minuto 7.",
  },
  {
    excuse: "non funziona mai con me",
    pattern: "\\b(non funziona mai|non ha mai funzionato|non per me|sono diverso|nel mio caso)\\b",
    counter: "Identità da perdente in costruzione. Non sei diverso, sei umano, e la roba funziona per gli umani che la fanno. Falla.",
  },
  {
    excuse: "ho già provato",
    pattern: "\\b(ho già provato|ci ho già provato|ho fatto di tutto|ho provato tutto)\\b",
    counter: "Hai provato una versione, non è la stessa cosa di averlo finito. Cosa hai provato esattamente, per quanto, con quale costanza? Sii specifico.",
  },
  {
    excuse: "è troppo difficile",
    pattern: "\\b(troppo difficile|troppo complicato|impossibile per me|fuori portata)\\b",
    counter: "Difficile è il punto, altrimenti l'avresti già fatto. Spezza in passi più piccoli finché il primo è stupido da non fare.",
  },
  {
    excuse: "non è il momento",
    pattern: "\\b(non è il momento|momento sbagliato|tempi non maturi|aspetto un segno)\\b",
    counter: "Il momento giusto è stato 6 mesi fa. Il secondo migliore è ora. Aspettare il momento è la forma più educata di non fare mai.",
  },
];

export function emptyLibrary(): ExcuseLibrary {
  const now = Date.now();
  return {
    entries: SEED_EXCUSES.map((e) => ({ ...e, count: 0, lastUsedAt: 0 })),
    totalDetected: 0,
  };
}

export interface DetectedExcuse {
  entry: ExcuseEntry;
  matchedText: string;
}

/** Rileva scuse nel testo. Multiple matches possibili. */
export function detectExcuses(text: string, lib: ExcuseLibrary): DetectedExcuse[] {
  const out: DetectedExcuse[] = [];
  for (const e of lib.entries) {
    try {
      const rx = new RegExp(e.pattern, "i");
      const m = text.match(rx);
      if (m) out.push({ entry: e, matchedText: m[0] });
    } catch {
      /* invalid pattern */
    }
  }
  return out;
}

/** Aggiorna la libreria registrando le scuse rilevate (incrementa count + lastUsedAt). */
export function applyDetections(lib: ExcuseLibrary, detections: DetectedExcuse[]): ExcuseLibrary {
  if (detections.length === 0) return lib;
  const now = Date.now();
  const detected = new Set(detections.map((d) => d.entry.excuse));
  return {
    entries: lib.entries.map((e) =>
      detected.has(e.excuse) ? { ...e, count: e.count + 1, lastUsedAt: now } : e,
    ),
    totalDetected: lib.totalDetected + detections.length,
  };
}

/** Sintesi per prompt: scuse più ricorrenti dell'utente, con counter. */
export function topExcusesBlock(lib: ExcuseLibrary, max = 3): string {
  const top = [...lib.entries].filter((e) => e.count > 0).sort((a, b) => b.count - a.count).slice(0, max);
  if (top.length === 0) return "";
  return (
    "Scuse più ricorrenti del profilo (cita per nome se rilevi una di queste nel messaggio attuale):\n" +
    top.map((e) => `- "${e.excuse}" (usata ${e.count}x). Counter: ${e.counter}`).join("\n")
  );
}

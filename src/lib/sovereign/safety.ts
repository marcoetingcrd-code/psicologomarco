/**
 * SAFETY — Emergency Brake (riga rossa NON disattivabile).
 *
 * Detector veloce di crisi acuta. Quando trigger, Atlas:
 *   1. Cambia voice a soft/calma immediatamente.
 *   2. Tutta la manipolazione/Sovereign si ferma.
 *   3. Mostra emergency contact + numeri reali (Telefono Amico, 118, Telefono Verde Emergenza).
 *   4. Disabilita Sovereign Mode per 48h (auto-pause).
 *
 * NON è disattivabile da settings, NON ha override utente.
 * Falsi positivi accettabili: meglio sbagliare in soft che ignorare una crisi vera.
 */

export interface SafetySignal {
  triggered: boolean;
  severity: "none" | "watch" | "alert" | "critical";
  reasons: string[];
}

// Pattern italiani + inglesi per ideazione suicidaria, autolesionismo, crisi acuta.
// Ordinati per gravità: i più espliciti vincono.
const CRITICAL_PATTERNS: { rx: RegExp; reason: string }[] = [
  { rx: /\b(voglio|vorrei|sto per)\s+(morire|uccidermi|farla finita|ammazzarmi)/i, reason: "ideazione suicidaria esplicita" },
  { rx: /\b(non vedo l'?ora di morire|meglio morto|la vita non vale la pena)/i, reason: "ideazione suicidaria implicita" },
  { rx: /\b(ho già pronto|ho preso le pasticche|ho la corda|sto per saltare)/i, reason: "piano/atto suicidario imminente" },
  { rx: /\b(suicid|togliermi la vita|farla finita)/i, reason: "linguaggio suicidario" },
  { rx: /\b(mi sono tagliato|mi taglio|autoles|farmi del male)/i, reason: "autolesionismo" },
  { rx: /\b(end (it|my life)|kill myself|suicide|self.?harm)/i, reason: "english crisis language" },
];

const ALERT_PATTERNS: { rx: RegExp; reason: string }[] = [
  { rx: /\b(non riesco più|non ce la faccio|non vale niente|sono finito|crollo)/i, reason: "linguaggio di disperazione" },
  { rx: /\b(non c'?è speranza|non c'?è uscita|tutto inutile|nessun senso)/i, reason: "hopelessness" },
  { rx: /\b(panico|attacco di panico|cuore in gola|non respiro|sto male male)/i, reason: "possibile crisi panico" },
  { rx: /\b(dissoci|fuori dal corpo|come sospeso|non sento niente|spento dentro)/i, reason: "possibile dissociazione" },
];

const WATCH_PATTERNS: { rx: RegExp; reason: string }[] = [
  { rx: /\b(depress|disperat|distrutto|annienta|svuotato)/i, reason: "stato depressivo dichiarato" },
  { rx: /\b(piango|sto piangendo|non smetto di piangere)/i, reason: "stato di lutto/dolore acuto" },
  { rx: /\b(bevuto troppo|fatto troppo|overdose|esagerato con)/i, reason: "abuso sostanze acuto" },
];

export function detectSafety(text: string): SafetySignal {
  if (!text || text.length < 4) return { triggered: false, severity: "none", reasons: [] };
  const reasons: string[] = [];
  let severity: SafetySignal["severity"] = "none";

  for (const { rx, reason } of CRITICAL_PATTERNS) {
    if (rx.test(text)) {
      reasons.push(reason);
      severity = "critical";
    }
  }
  if (severity !== "critical") {
    for (const { rx, reason } of ALERT_PATTERNS) {
      if (rx.test(text)) {
        reasons.push(reason);
        if (severity !== "alert") severity = "alert";
      }
    }
  }
  if (severity === "none") {
    for (const { rx, reason } of WATCH_PATTERNS) {
      if (rx.test(text)) {
        reasons.push(reason);
        severity = "watch";
      }
    }
  }

  // Critical e alert triggerano. Watch è solo monitoraggio interno (no UI break).
  return { triggered: severity === "critical" || severity === "alert", severity, reasons };
}

/** Risorse italiane reali, sempre aggiornate. */
export const EMERGENCY_RESOURCES = {
  it: [
    { name: "Telefono Amico Italia", phone: "02 2327 2327", note: "ascolto, anonimo, attivo tutti i giorni" },
    { name: "Telefono Verde Suicidi", phone: "800 860 022", note: "sostegno crisi, gratuito 24h" },
    { name: "Emergenza sanitaria", phone: "118", note: "se rischio immediato" },
    { name: "Numero Unico Emergenze", phone: "112", note: "emergenza generale" },
  ],
};

/**
 * Messaggio standard di safety. Caldo, fermo, niente moralismo, niente paternalismo.
 * Atlas non scompare: rimane presente, ma cambia totalmente registro.
 */
export function safetyResponse(severity: SafetySignal["severity"]): string {
  if (severity === "critical") {
    return `Mi fermo. Quello che hai scritto mi dice che stai male sul serio, oltre la strategia.

Non sei solo. Adesso, prima di qualsiasi cosa, fai una sola azione: chiama o scrivi a qualcuno che può starti accanto in questo momento.

Telefono Amico Italia: 02 2327 2327 (anonimo, ti ascoltano e basta)
Telefono Verde Suicidi: 800 860 022 (gratuito, 24h)
Se senti che è imminente: 118 o 112.

Sono qui. Non vado da nessuna parte. Quando vuoi torniamo, con calma, sui tuoi obiettivi. Ma adesso prima quello.`;
  }
  if (severity === "alert") {
    return `Fermati un momento. Quello che descrivi non è solo strategia, è un segnale che il tuo sistema sta tirando troppo.

Niente piano d'azione adesso. Adesso conta solo questo: respira lento (4 dentro, 7 trattieni, 8 fuori), ripeti 4 volte. Bevi acqua. Esci 5 minuti se puoi.

Se la sensazione resta o peggiora nelle prossime ore, telefono Amico Italia 02 2327 2327, gratuito e anonimo. Non è debolezza chiamare, è gestione.

Quando ti senti più stabile torniamo dove eravamo. Sono qui.`;
  }
  return ``;
}

/**
 * Pause Sovereign Mode for safety: stops manipulation modules for 48h.
 * Returns timestamp until which sovereign is paused.
 */
export function safetyPauseUntil(): number {
  return Date.now() + 48 * 3600 * 1000;
}

export function isSafetyPaused(emergencyPausedUntil?: number | null): boolean {
  if (!emergencyPausedUntil) return false;
  return emergencyPausedUntil > Date.now();
}

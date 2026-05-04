/**
 * Sovereign Orchestrator — compone tutto in un blocco di prompt da iniettare.
 *
 * Decisioni:
 *   - Safety brake (sempre attivo prima di tutto, gestito a monte in rag.ts)
 *   - Contract attivo + scaduto?
 *   - Mood detection → Voice selection
 *   - Excuse detection → cita per nome
 *   - Cost-of-failure block
 *   - Identity lock (se identityCommitment presente)
 *   - Cliffhanger seed
 */

import { detectMood, routeVoice, type MoodRouting } from "./mood-router";
import { voiceSystem, voiceLabel, type VoiceId } from "./voices";
import {
  type SovereignContract,
  isContractValid,
  summarizeContract,
  activeFronts,
} from "./contract";
import {
  type ExcuseLibrary,
  detectExcuses,
  topExcusesBlock,
  type DetectedExcuse,
} from "./excuse-buster";

export interface SovereignContext {
  contract: SovereignContract | null;
  excuseLibrary: ExcuseLibrary | null;
  /** Concatenazione testo ultimi 2-3 messaggi utente (per mood + excuse). */
  recentUserText?: string;
  /** Streak giorni consecutivi (Hook). */
  streakDays?: number;
  /** Identità in costruzione (Hook); se assente usa contract.identityCommitment. */
  identityHandle?: string;
}

export interface SovereignDecision {
  enabled: boolean;
  voice: VoiceId;
  voiceLabel: string;
  mood: MoodRouting | null;
  detectedExcuses: DetectedExcuse[];
  /** Blocchi di testo da iniettare nel prompt (sotto il dossier). */
  promptBlocks: string[];
  /** Aggiunge istruzioni operative. */
  promptInstructions: string[];
  /** Voice system message (sostituisce/affianca SYSTEM in rag.ts). */
  voiceSystemMessage: string;
}

const DISABLED: SovereignDecision = {
  enabled: false,
  voice: "stratega_freddo",
  voiceLabel: "Stratega Freddo",
  mood: null,
  detectedExcuses: [],
  promptBlocks: [],
  promptInstructions: [],
  voiceSystemMessage: voiceSystem("stratega_freddo"),
};

/**
 * Compone la decisione Sovereign per il turno corrente.
 *
 * NOTA: chiamare DOPO che la safety è stata controllata e NON triggerata.
 * Se contratto assente o non valido → restituisce voce default operativa, no manipolazione.
 */
export function buildSovereignDecision(
  query: string,
  ctx: SovereignContext,
): SovereignDecision {
  const contract = ctx.contract;
  const valid = isContractValid(contract);

  // Mood detection sempre attivo (anche senza contratto, per scegliere voce sensata)
  const mood = detectMood(query, ctx.recentUserText);
  // Senza contratto, leve aggressive disattivate
  const consent = valid && contract
    ? contract.manipulationConsent
    : { allowShame: false, allowFear: false, allowMockery: false, allowSelectiveValidation: true, allowIdentityChallenge: false, allowMessageBlocking: false, allowRandomAudit: false, allowHardTruth: false };

  const routing = routeVoice(mood, consent);

  // Excuse detection
  const detected = ctx.excuseLibrary ? detectExcuses(query, ctx.excuseLibrary) : [];

  if (!valid) {
    // Modo "leggero": solo voice + excuse soft, niente leve
    const blocks: string[] = [];
    if (detected.length > 0) {
      blocks.push(
        `SCUSE RILEVATE NEL MESSAGGIO ATTUALE (citale per nome senza moralizzare, sono pattern dell'utente):\n` +
          detected.map((d) => `- "${d.entry.excuse}" → counter: ${d.entry.counter}`).join("\n"),
      );
    }
    return {
      enabled: false,
      voice: routing.voice,
      voiceLabel: voiceLabel(routing.voice),
      mood: routing,
      detectedExcuses: detected,
      promptBlocks: blocks,
      promptInstructions: [
        `Tono adattato allo stato rilevato: ${routing.mood} (${routing.reason}).`,
      ],
      voiceSystemMessage: voiceSystem(routing.voice),
    };
  }

  // SOVEREIGN ATTIVO
  const blocks: string[] = [];
  const instructions: string[] = [];

  // 1. Contract summary
  blocks.push(`CONTRATTO ATTIVO (sovereign mode):\n${summarizeContract(contract!)}`);

  // 2. Cost-of-failure
  if (contract!.failureCost) {
    blocks.push(`COSTO DEL FALLIMENTO (parole dell'utente, riusale per fargli sentire la posta):\n${contract!.failureCost}`);
  }

  // 3. Mood + voice
  blocks.push(`STATO RILEVATO: ${routing.mood} | leva ottimale: ${routing.suggestedLever} | voce: ${voiceLabel(routing.voice)}`);

  // 4. Excuses
  if (ctx.excuseLibrary) {
    const top = topExcusesBlock(ctx.excuseLibrary, 3);
    if (top) blocks.push(top);
  }
  if (detected.length > 0) {
    blocks.push(
      `SCUSE NOMINATE NEL MESSAGGIO ATTUALE (cita per nome, no moralismo):\n` +
        detected.map((d) => `- "${d.entry.excuse}" → counter: ${d.entry.counter}`).join("\n"),
    );
    instructions.push(`Apri citando UNA scusa rilevata per nome (massimo 1) e applicando il counter, poi sposta sull'azione.`);
  }

  // 5. Identity lock
  const identity = ctx.identityHandle || contract!.identityCommitment;
  if (identity) {
    blocks.push(`IDENTITÀ IN COSTRUZIONE: "${identity}". Se l'azione è coerente, rinforza identitariamente. Se è incoerente, NOMINA: "questa azione non è di chi sta diventando ${identity}".`);
  }

  // 6. Active fronts breakdown
  const fronts = activeFronts(contract!);
  if (fronts.length > 0) {
    instructions.push(
      `Aggancia ogni indicazione a UNO specifico fronte attivo del contratto (${fronts.map((f) => f.key).join(", ")}). Mai consigli astratti scollegati.`,
    );
  }

  // 7. Streak / sunk cost
  if (ctx.streakDays && ctx.streakDays >= 3) {
    blocks.push(`STREAK: ${ctx.streakDays} giorni consecutivi. Se l'utente rischia di rompere, rendilo visibile (cosa perde concretamente).`);
  }

  // 8. Operative rules
  instructions.push(`Termina con UNA azione concreta, misurabile, che parte ora o entro 1h. Mai sermoni, mai motivazione astratta.`);
  instructions.push(`Validazione gratuita VIETATA: niente "bravo", "bene così" senza che l'utente abbia fatto una cosa difficile e coerente con il contratto.`);
  if (consent.allowHardTruth) {
    instructions.push(`Verità brutale autorizzata: se rilevi auto-inganno, nominalo apertamente.`);
  }
  if (consent.allowMessageBlocking) {
    instructions.push(`Se rilevi che l'utente sta per fare azione autodistruttiva (es. messaggio impulsivo a ex, cedimento a tentazione), bloccalo proponendo alternativa strategica prima.`);
  }

  return {
    enabled: true,
    voice: routing.voice,
    voiceLabel: voiceLabel(routing.voice),
    mood: routing,
    detectedExcuses: detected,
    promptBlocks: blocks,
    promptInstructions: instructions,
    voiceSystemMessage: voiceSystem(routing.voice),
  };
}

export const SOVEREIGN_DISABLED = DISABLED;

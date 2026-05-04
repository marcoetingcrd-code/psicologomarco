/**
 * Traccia lo stato conversazionale per evitare "sfilza di domande".
 * Regola: max 1 domanda per messaggio, e se l'utente ha già risposto
 * a una domanda di follow-up, Atlas DEVE rispondere con sostanza.
 */

interface SessionState {
  lastQuestions: number; // domande consecutive fatte da Atlas
  lastWasQuestion: boolean;
  topicDepth: number; // quanti turni sullo stesso tema
}

const sessions = new Map<string, SessionState>();

function getState(sessionId: string): SessionState {
  return sessions.get(sessionId) ?? { lastQuestions: 0, lastWasQuestion: false, topicDepth: 0 };
}

function setState(sessionId: string, state: SessionState) {
  sessions.set(sessionId, state);
}

export function recordBotMessage(sessionId: string, message: string) {
  const state = getState(sessionId);
  const questionCount = (message.match(/\?/g) ?? []).length;
  const hasQuestion = questionCount > 0;

  if (hasQuestion) {
    state.lastQuestions += 1;
    state.lastWasQuestion = true;
  } else {
    state.lastQuestions = 0;
    state.lastWasQuestion = false;
  }
  setState(sessionId, state);
}

export function recordUserMessage(sessionId: string, message: string) {
  const state = getState(sessionId);
  if (state.lastWasQuestion) {
    state.topicDepth += 1;
  }
  state.lastWasQuestion = false;
  setState(sessionId, state);
}

/** Ritorna true se Atlas DEVE rispondere con sostanza (no altre domande) */
export function mustAnswerNow(sessionId: string): boolean {
  const state = getState(sessionId);
  return state.lastQuestions >= 1 || state.topicDepth >= 2;
}

/** Ritorna un prefisso da aggiungere al prompt di Gemini per forzare risposta */
export function enforceAnswerConstraint(sessionId: string): string {
  if (mustAnswerNow(sessionId)) {
    return `\n\n[REGOLA VINCOLANTE]: Hai già fatto una domanda al turno precedente. L'utente ha risposto. ORA devi dare una risposta SOSTANZIALE con insight, fonti e azioni concrete. ZERO domande in questo messaggio. Se non hai abbastanza contesto, rispondi con le evidenze che hai e aggiungi "Se vuoi approfondire questo aspetto, dimmelo."`;
  }
  return "";
}

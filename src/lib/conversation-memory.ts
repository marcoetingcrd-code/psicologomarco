/**
 * Memoria conversazionale persistente per sessione.
 * Salva i messaggi in localStorage in modo che la conversazione
 * sopravviva ai refresh della pagina.
 */

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  sources?: any[];
  cached?: boolean;
  usedLLM?: boolean;
}

const STORAGE_KEY = (sessionId: string) => `atlas-chat-${sessionId}`;
const MAX_MESSAGES = 100; // limita per non esplodere localStorage

export function saveMessage(sessionId: string, message: ChatMessage) {
  const key = STORAGE_KEY(sessionId);
  const existing = loadMessages(sessionId);
  const next = [...existing, message].slice(-MAX_MESSAGES);
  localStorage.setItem(key, JSON.stringify(next));
}

export function loadMessages(sessionId: string): ChatMessage[] {
  const key = STORAGE_KEY(sessionId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as ChatMessage[];
  } catch {
    return [];
  }
}

export function clearMessages(sessionId: string) {
  localStorage.removeItem(STORAGE_KEY(sessionId));
}

export function getLastMessages(sessionId: string, count = 10): ChatMessage[] {
  const all = loadMessages(sessionId);
  return all.slice(-count);
}

export function formatForPrompt(messages: ChatMessage[], maxChars = 4000): string {
  let text = "";
  for (const m of messages) {
    const prefix = m.role === "user" ? "Utente" : "Atlas";
    text += `${prefix}: ${m.content}\n\n`;
  }
  // Tronca se troppo lungo, mantenendo i messaggi più recenti
  if (text.length > maxChars) {
    text = "...\n\n" + text.slice(-maxChars);
  }
  return text;
}

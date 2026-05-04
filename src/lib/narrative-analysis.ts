/**
 * Estrae profilo psicologico da testo narrativo o chat logs.
 * Zero scale, zero interviste — solo pattern linguistici.
 * 
 * Riconosce automaticamente:
 * - Testo narrativo singolo (diario, storia)
 * - Chat logs (WhatsApp, Telegram, Messenger)
 * 
 * Per chat: analizza dinamica relazionale, identifica pattern
 * inseguimento-fuga, attaccamento ansioso-evitante, etc.
 */

export interface NarrativeProfile {
  themes: string[];
  dominantEmotions: string[];
  attachmentClues: { style?: "anxious" | "avoidant" | "fearful" | "secure"; confidence: number };
  copingPatterns: string[];
  goals?: string;
  confidence: number; // 0-1, quanto testo abbiamo
}

export interface ChatMessage {
  sender: string;
  text: string;
  timestamp?: string;
}

export interface ChatAnalysis {
  isChat: boolean;
  participants: string[];
  userMessages: ChatMessage[];
  otherMessages: ChatMessage[];
  userProfile: NarrativeProfile;
  otherProfile: NarrativeProfile;
  relationshipDynamics: {
    pattern: "pursuer-distancer" | "hostile-dependent" | "volatile" | "avoidant-avoidant" | "secure" | "unknown";
    description: string;
    confidence: number;
  };
  keyConflictThemes: string[];
}

const THEME_KEYWORDS: Record<string, string[]> = {
  lavoro: ["lavoro", "carriera", "colleghi", "capo", "ufficio", "studio", "università", "esame", "promozione", "licenziamento", " burnout"],
  relazione: ["relazione", "amore", "partner", "ragazzo", "ragazza", "marito", "moglie", "fidanzat", "abbandono", "tradimento", "gelosia", "intimità", "sesso", "amore", "lasciare", "chiudere"],
  famiglia: ["famiglia", "mamma", "mamma", "padre", "genitori", "figlio", "figlia", "fratello", "sorella", "infanzia", "casa", "genitoriale"],
  corpo: ["corpo", "salute", "sonno", "sport", "palestra", "peso", "mangiare", "cibo", "malattia", "sintomo", "fatica", "energia", "alcol", "alchool", "droga", "bere", "bevo", "smettere", "fumo", "droghe"],
  identità: ["identità", "autostima", "fiducia", "valore", "merito", "inadeguatezza", "insicurezza", "vergogna", "orgoglio", "identità", "senso di me"],
  ansia: ["ansia", "paura", "panico", "stress", "angoscia", "inquietudine", "agitazione"],
  rabbia: ["rabbia", "odio", "irritazione", "delusione", "risentimento", "collera", "furia", "incazzare", "incazzo", "cazzo", "merda", "stronzo"],
  tristezza: ["tristezza", "depressione", "malinconia", "vuoto", "solitudine", "dolore", "soffrire", "piangere"],
};

// ===== PARSING CHAT LOGS =====

const CHAT_PATTERNS = [
  // WhatsApp: [02/05/26, 14:34:24] Nome: messaggio
  /^\[(\d{2}\/\d{2}\/\d{2},? \d{2}:\d{2}:\d{2})\]\s*([^:]+):\s*(.+)$/,
  // Telegram: Nome, 02/05/26, 14:34
  /^([^,]+),?\s*(?:\d{1,2}\/\d{1,2}\/\d{2,4})?\s*(?:\d{1,2}:\d{2})?\s*(?:\[.+\])?:\s*(.+)$/,
  // Semplice: Nome: messaggio
  /^([^:]+):\s*(.+)$/,
];

export function isChatLog(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim());
  let chatLines = 0;
  for (const line of lines) {
    for (const pattern of CHAT_PATTERNS) {
      if (pattern.test(line.trim())) {
        chatLines++;
        break;
      }
    }
  }
  // Se almeno 30% delle righe matcha pattern chat, è una chat
  return lines.length > 5 && chatLines / lines.length > 0.3;
}

export function parseChatLog(text: string): ChatAnalysis | null {
  if (!isChatLog(text)) return null;

  const lines = text.split('\n').filter(l => l.trim());
  const messages: ChatMessage[] = [];
  const senderCounts: Record<string, number> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    let match: RegExpMatchArray | null = null;
    let pattern: RegExp | null = null;

    for (const p of CHAT_PATTERNS) {
      match = trimmed.match(p);
      if (match) {
        pattern = p;
        break;
      }
    }

    if (match && pattern) {
      let sender: string;
      let messageText: string;
      let timestamp: string | undefined;

      if (pattern.source.includes('\\d\\{2\\}')) {
        // WhatsApp pattern: [data] Nome: msg
        timestamp = match[1];
        sender = match[2].trim();
        messageText = match[3].trim();
      } else {
        // Semplice Nome: msg
        sender = match[1].trim();
        messageText = match[2].trim();
      }

      // Pulisci emoji e spazi dal nome
      sender = sender.replace(/[🐦‍⬛🔥💔❤️🥺😭😡🤬💩]/g, '').trim();
      if (sender.length > 50) sender = sender.substring(0, 50);

      if (sender && messageText) {
        messages.push({ sender, text: messageText, timestamp });
        senderCounts[sender] = (senderCounts[sender] || 0) + 1;
      }
    }
  }

  if (messages.length === 0) return null;

  // Identifica i partecipanti (top 2)
  const participants = Object.entries(senderCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);

  if (participants.length < 2) return null;

  // Identifica chi è l'utente: quello che inizia con "vorrei capire", "ti incollo",
  // o ha pattern di chi sta chiedendo aiuto
  // Altrimenti prendi il primo come user
  const firstLine = text.split('\n')[0]?.toLowerCase() || '';
  let userName = participants[0];

  // Euristiche per identificare l'utente
  for (const p of participants) {
    const pLower = p.toLowerCase();
    // Se il nome è nel primo messaggio introduttivo, è probabile che sia l'altro
    // (l'utente dice "ti incollo la chat di Marco e Giada")
    if (firstLine.includes(pLower) && !firstLine.includes('io ') && !firstLine.includes('sono ')) {
      userName = participants.find(x => x !== p) || participants[0];
      break;
    }
  }

  // Se uno dei nomi è chiaramente femminile e l'utente ha detto "non sopporto la mia ragazza",
  // l'utente è l'altro
  const userMessages = messages.filter(m => m.sender === userName);
  const otherMessages = messages.filter(m => m.sender !== userName);
  const otherName = participants.find(p => p !== userName) || participants[1];

  // Analisi profili separati
  const userText = userMessages.map(m => m.text).join('. ');
  const otherText = otherMessages.map(m => m.text).join('. ');

  const userProfile = extractProfileFromNarrativeInternal(userText);
  const otherProfile = extractProfileFromNarrativeInternal(otherText);

  // Analisi dinamica relazionale
  const dynamics = analyzeRelationshipDynamics(userMessages, otherMessages, userName, otherName);

  return {
    isChat: true,
    participants,
    userMessages,
    otherMessages,
    userProfile,
    otherProfile,
    relationshipDynamics: dynamics,
    keyConflictThemes: extractConflictThemes(userText + '. ' + otherText),
  };
}

const ATTACHMENT_CLUES: Record<string, { style: "anxious" | "avoidant" | "fearful" | "secure"; weight: number }[]> = {
  anxious: [
    { style: "anxious", weight: 1.0 },
  ],
  avoidant: [
    { style: "avoidant", weight: 1.0 },
  ],
};

// ===== ANALISI DINAMICA RELAZIONALE =====

const PURSUER_WORDS = [
  "arrivo", "vengo", "parto", "prendo la macchina", "ti chiamo", "dove sei",
  "perché non", "rispondi", "aspetto", "non mi lasciare", "non abbandonarmi",
  "torniamo", "parliamo", "dobbiamo", "non puoi", "non devi", "ti prego",
];

const DISTANCER_WORDS = [
  "basta", "non venire", "non voglio", "lasciami", "ho da fare", "esco",
  "non troverai", "non sono a casa", "domani", "più tardi", "sereno",
  "spazio", "fottiti", "stai a casa", "non rispondo",
];

const HOSTILE_WORDS = [
  "merda", "stronzo", "cazzo", "fottiti", "tossica", "orribile",
  "distruggi", "rovinare", "sputato", "dilaniata", "rovinando",
];

const CONTROLLING_WORDS = [
  "dieci minuti", "minuti arrivo", "ti trovo", "vado a cercare",
  "dovresti", "devi", "altrimenti", "sennò", "o vengo",
];

function analyzeRelationshipDynamics(
  userMessages: ChatMessage[],
  otherMessages: ChatMessage[],
  userName: string,
  otherName: string
): { pattern: any; description: string; confidence: number } {
  const userText = userMessages.map(m => m.text.toLowerCase()).join(' ');
  const otherText = otherMessages.map(m => m.text.toLowerCase()).join(' ');

  let pursuerScore = 0;
  let distancerScore = 0;
  let hostileScore = 0;
  let controlScore = 0;

  // Conta pattern
  for (const w of PURSUER_WORDS) {
    if (userText.includes(w)) pursuerScore++;
    if (otherText.includes(w)) {
      pursuerScore--; // l'altro insegue = user si allontana
    }
  }
  for (const w of DISTANCER_WORDS) {
    if (userText.includes(w)) distancerScore++;
    if (otherText.includes(w)) {
      distancerScore--; // l'altro si allontana = user insegue
    }
  }
  for (const w of HOSTILE_WORDS) {
    if (userText.includes(w)) hostileScore++;
    if (otherText.includes(w)) hostileScore++;
  }
  for (const w of CONTROLLING_WORDS) {
    if (userText.includes(w)) controlScore++;
    if (otherText.includes(w)) controlScore++;
  }

  // Analisi sequenziale: chi risponde, chi ignora
  let userIgnoredCount = 0;
  let otherIgnoredCount = 0;
  let userChases = 0;
  let otherChases = 0;

  for (let i = 1; i < userMessages.length + otherMessages.length; i++) {
    // Questa è un'euristica semplice - guardiamo se un messaggio ha risposta
    // Non implementiamo sequenza temporale precisa per semplicità
  }

  // Pattern recognition
  const totalIntensity = Math.abs(pursuerScore) + Math.abs(distancerScore) + hostileScore;
  
  if (hostileScore > 5 && (pursuerScore > 3 || distancerScore > 3)) {
    return {
      pattern: "hostile-dependent",
      description: `Dinamica tossica con alta conflittualità. ${pursuerScore > 0 ? userName : otherName} insegue, ${pursuerScore > 0 ? otherName : userName} si allontana, ma entrambi usano linguaggio fortemente aggressivo.`,
      confidence: Math.min(0.7 + hostileScore * 0.05, 0.95),
    };
  }

  if (pursuerScore > 2 && distancerScore > 0) {
    return {
      pattern: "pursuer-distancer",
      description: `Pattern classico inseguimento-fuga. ${userName} tende a ${pursuerScore > distancerScore ? "inseguire/pressionare" : "allontanarsi/fuggire"}, ${otherName} ${pursuerScore > distancerScore ? "si ritrae" : "insegue disperatamente"}. Ciclo di prossimità-allontanamento tipico dell'attaccamento ansioso-evitante.`,
      confidence: Math.min(0.6 + totalIntensity * 0.03, 0.9),
    };
  }

  if (distancerScore > 2 && pursuerScore <= 0) {
    return {
      pattern: "avoidant-avoidant",
      description: `Entrambi tendono all'evitamento, ma ${otherName} insegue disperatamente mentre ${userName} si ritrae. Conflitto non risolto con accumulo di rabbia.`,
      confidence: Math.min(0.5 + distancerScore * 0.05, 0.85),
    };
  }

  if (hostileScore > 3) {
    return {
      pattern: "volatile",
      description: `Relazione ad alta intensità emotiva con frequenti scambi aggressivi. Entrambi esprimono rabbia e ferita apertamente. Può essere passionale ma estremamente instabile.`,
      confidence: Math.min(0.55 + hostileScore * 0.04, 0.85),
    };
  }

  return {
    pattern: "unknown",
    description: "Dinamica non chiaramente identificabile da questo campione.",
    confidence: 0.3,
  };
}

function extractConflictThemes(combinedText: string): string[] {
  const themes: string[] = [];
  const lower = combinedText.toLowerCase();

  const conflictKeywords: Record<string, string[]> = {
    "abbandono/abbandono": ["non mi ami", "non mi vuole", "lasciare", "chiudere", "abbandono", "andare via"],
    "tradimento/fiducia": ["bugie", "falso", "tradimento", "non ti fido", "nascondi", "segreti"],
    "comunicazione": ["non capisce", "non ascolti", "non parli", "non dici", "ignori"],
    "controllo/autonomia": ["devi", "dovresti", "obbligo", "forzare", "non posso", "non mi lasci"],
    "intimità/sesso": ["sesso", "intimità", "fisico", "toccare", "vicino"],
    "responsabilità": ["responsabilità", "colpa", "tua colpa", "mi hai fatto", "rovini"],
    "rispetto": ["rispetto", "svalutato", "prendi per i fondelli", "merito", "scontata"],
  };

  for (const [theme, keywords] of Object.entries(conflictKeywords)) {
    if (keywords.some(k => lower.includes(k))) themes.push(theme);
  }

  return [...new Set(themes)];
}

const ANXIOUS_WORDS = [
  "abbandono", "lasciare", "paura di perdere", "non mi ama", "non mi vuole", "mi ignora",
  "troppo attaccat", "dipendo", "bisogno di", "senza di lui", "senza di lei",
  "ansioso quando", "panico se", "controllo dove", "messaggi subito",
  "non venire", "non troverai", "non sono a casa", "esco", "non rispondo",
  "lasciami", "ho da fare", "non voglio", "basta",
];

export function extractProfileFromNarrative(text: string): NarrativeProfile {
  // Prima verifica se è un chat log
  const chat = parseChatLog(text);
  if (chat) {
    // Se è una chat, restituisce il profilo dell'utente
    return chat.userProfile;
  }
  // Altrimenti analizza il testo narrativo singolo
  return extractProfileFromNarrativeInternal(text);
}

export function analyzeChatLog(text: string): ChatAnalysis | null {
  return parseChatLog(text);
}

const AVOIDANT_WORDS = [
  "preferisco solo", "non mi serve nessuno", "dipendenza mi spaventa", "spazio", "lontano",
  "non mi interessa", "superficiale", "non mi coinvolgo", "evito", "fuggire",
];

const FEARFUL_WORDS = [
  "voglio vicino ma", "paura di avvicinarsi", "amo ma fuggo", "desidero ma evito",
];

const COPING_WORDS: Record<string, string[]> = {
  rumination: ["penso sempre", "non riesco a smettere di pensare", "loop", "testa che gira", "notte pensando", "ripetere", "ruminare"],
  suppression: ["non mostro", "nascondo", "non piango", "non dico", "tengo dentro", "controllo", "non lo faccio vedere"],
  avoidance: ["evito", "non ci penso", "distrarmi", "scappo", "non affronto", "smetto di pensarci"],
  expression: ["parlo", "dico", "esprimo", "mostro", "condivido", "racconto"],
  reflection: ["rifletto", "capisco", "analogia", "pattern", "riconosco", "consapevole"],
};

function extractProfileFromNarrativeInternal(text: string): NarrativeProfile {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // 1. Temi
  const themes: string[] = [];
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    if (keywords.some(k => lower.includes(k))) themes.push(theme);
  }

  // 2. Emozioni dominanti (conta occorrenze)
  const emotionCounts: Record<string, number> = {};
  const emotionKeywords: Record<string, string[]> = {
    ansia: ["ansia", "paura", "panico", "stress", "angoscia", "agitazione", "nervoso"],
    rabbia: ["rabbia", "odio", "irritato", "deluso", "risentimento", "furioso", "arrabbiato"],
    tristezza: ["triste", "depresso", "vuoto", "solitudine", "malinconia", "piangere", "lacrime"],
    vergogna: ["vergogna", "imbarazzo", "umiliazione", "inadeguato", "non merito"],
    gioia: ["felice", "contento", "soddisfatto", "orgoglioso", "gratitudine", "amore"],
  };
  for (const [emotion, keywords] of Object.entries(emotionKeywords)) {
    const count = keywords.reduce((sum, k) => sum + (lower.split(k).length - 1), 0);
    if (count > 0) emotionCounts[emotion] = count;
  }
  const dominantEmotions = Object.entries(emotionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([e]) => e);

  // 3. Attaccamento (euristica linguistica)
  let anxiousScore = 0;
  let avoidantScore = 0;
  let fearfulScore = 0;
  for (const w of ANXIOUS_WORDS) if (lower.includes(w)) anxiousScore++;
  for (const w of AVOIDANT_WORDS) if (lower.includes(w)) avoidantScore++;
  for (const w of FEARFUL_WORDS) if (lower.includes(w)) fearfulScore++;

  let style: "anxious" | "avoidant" | "fearful" | "secure" | undefined;
  const maxScore = Math.max(anxiousScore, avoidantScore, fearfulScore);
  if (maxScore > 0) {
    if (fearfulScore > 0 && (anxiousScore > 0 || avoidantScore > 0)) style = "fearful";
    else if (anxiousScore > avoidantScore) style = "anxious";
    else if (avoidantScore > anxiousScore) style = "avoidant";
    else style = "secure"; // se pochi indizi, default sicuro
  }
  const attachmentConfidence = Math.min(maxScore * 0.3, 0.9);

  // 4. Coping patterns
  const copingPatterns: string[] = [];
  for (const [pattern, keywords] of Object.entries(COPING_WORDS)) {
    if (keywords.some(k => lower.includes(k))) copingPatterns.push(pattern);
  }

  // 5. Goal extraction (euristica: frasi che iniziano con "voglio", "spero", "mi piacerebbe")
  const sentences = text.split(/[.!?\n]+/).map(s => s.trim()).filter(Boolean);
  const goalSentences = sentences.filter(s =>
    /^(voglio|spero|mi piacerebbe|desidero|vorrei|obiettivo|scopo|per me importante|voglio capire|voglio imparare)/i.test(s)
  );
  const goals = goalSentences.length > 0 ? goalSentences[0] : undefined;

  let confidence = Math.min(0.3 + words.length * 0.01, 1);

  if (themes.length < 2) confidence *= 0.6;
  if (dominantEmotions.length === 0) confidence *= 0.8;
  if (copingPatterns.length === 0) confidence *= 0.9;
  if (words.length < 40) confidence *= 0.7;

  // Boost per temi sensibili: anche frasi brevi sono molto informative
  const sensitiveWords = ["alcol", "alchool", "droga", "droghe", "bere", "bevo", "smettere", "fumo", "suicidio", "morire", "taglio", "autolesionismo", "abuso", "violenza", "aggredito", "aggredita", "morto", "morta"];
  if (sensitiveWords.some(w => lower.includes(w))) {
    confidence = Math.max(confidence, 0.45); // input brevi ma densi sono sufficienti
  }

  confidence = Math.min(confidence, 1);

  return {
    themes: [...new Set(themes)],
    dominantEmotions,
    attachmentClues: style ? { style, confidence: attachmentConfidence } : { confidence: 0 },
    copingPatterns: [...new Set(copingPatterns)],
    goals,
    confidence,
  };
}

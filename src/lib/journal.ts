// Journaling strutturato - Metodo Pennebaker evidence-based
// + analisi pattern semantica

export interface JournalEntry {
  id: string;
  sessionId: string;
  text: string;
  prompt?: string;
  mood: number; // 1-10
  timestamp: number;
  tags: string[];
  wordCount: number;
  negativeEmotionWords: number;
  positiveEmotionWords: number;
  firstPersonCount: number;
  insightMarkers: string[]; // "realize", "understand", "because", "reason", etc.
}

const NEG_EMOTION = new Set([
  "triste","angoscia","ansia","paura","rabbia","odio","dolore","sofferenza","vuoto","solitudine",
  "abbandono","delusione","tradimento","colpa","vergogna","umiliazione","pianto","piangere","piango",
  "disperazione","disperato","disperata","sconforto","sconfortato","morte","morire","morirei",
  "suicidio","suicida","uccidere","spavento","terrorizzato","terrorizzata","panico","attacco di panico",
  "depresso","depressa","depressione","stress","stressato","stressata","incapace","inadeguato",
  "inadeguata","fallimento","fallito","fallita","perdita","perso","persa","mancanza","manca",
  "insoddisfazione","insoddisfatto","insoddisfatta","frustrazione","frustrato","frustrata"
]);

const POS_EMOTION = new Set([
  "felice","felicità","gioia","gioioso","gioiosa","amore","amare","amarlo","amarla","desiderio",
  "desiderare","piacere","piacerebbe","soddisfazione","soddisfatto","soddisfatta","orgoglio",
  "orgoglioso","orgogliosa","realizzazione","realizzato","realizzata","speranza","sperare",
  "spero","gratitudine","grato","grata","pace","tranquillità","calma","calmo","calma",
  "serenità","sereno","serena","forza","forte","coraggio","coraggioso","coraggiosa",
  "successo","vittoria","vincente","entusiasmo","entusiasta","passione","appassionato","appassionata"
]);

const INSIGHT_MARKERS = [
  "capisco","capito","realizzo","realizzato","realizzata","comprendo","compreso","perché",
  "perche","motivo","ragione","causa","causato","effetto","significa","significato",
  "intuisco","intuito","scopro","scoperto","ho capito","ho realizzato","ho compreso"
];

export function analyzeEntry(text: string): Omit<JournalEntry, "id" | "sessionId" | "text" | "timestamp"> {
  const words = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const negativeEmotionWords = words.filter((w) => NEG_EMOTION.has(w)).length;
  const positiveEmotionWords = words.filter((w) => POS_EMOTION.has(w)).length;
  const firstPersonCount = words.filter((w) => w.startsWith("io") || w.startsWith("mi") || w.startsWith("me") || w.startsWith("mio") || w.startsWith("mia")).length;
  const insightMarkers = INSIGHT_MARKERS.filter((m) => text.toLowerCase().includes(m));
  return {
    mood: 5, // default, user sets
    tags: [],
    wordCount,
    negativeEmotionWords,
    positiveEmotionWords,
    firstPersonCount,
    insightMarkers,
  };
}

// Pennebaker instructions - evidence-based prompt
export const PENNEBAKER_PROMPT = `Pennebaker Journaling Protocol - 15-20 minuti

Istruzioni (evidence-based):
1. Scrivi continuamente per 15-20 minuti. Non fermarti. Non correggere. Non giudicare.
2. Esplora i tuoi pensieri e sentimenti più profondi su un evento stressante o significativo.
3. Concentrati sulle emozioni - come ti sentivi, cosa provavi nel corpo.
4. Cerca connessioni: come questo evento si collega ad altri aspetti della tua vita?
5. Puoi scrivere sullo stesso evento per 3-4 giorni consecutivi, approfondendo ogni volta.

NON fare:
- Analizzare grammaticalmente
- Censurare per vergogna
- Riportare solo fatti senza emozioni
- Interromperti prima dei 15 minuti

Questo protocollo (Pennebaker 1997) ha effetti dimostrati su salute fisica, funzione immunitaria e regolazione emotiva.`;

// Session storage
const JOURNALS = new Map<string, JournalEntry[]>();

export function addEntry(sessionId: string, entry: JournalEntry) {
  const arr = JOURNALS.get(sessionId) ?? [];
  arr.push(entry);
  JOURNALS.set(sessionId, arr);
  return arr;
}

export function getEntries(sessionId: string): JournalEntry[] {
  return JOURNALS.get(sessionId) ?? [];
}

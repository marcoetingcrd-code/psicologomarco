import { search } from "./vectorstore";
import { generate, hasGemini } from "./gemini";
import { enforceAnswerConstraint } from "./conversational-analysis";
import type { Source } from "./corpus";

export interface RagResult {
  answer: string;
  sources: { source: Source; score: number }[];
  usedLLM: boolean;
}

// Soglia minima di similarità per considerare una fonte rilevante
const RELEVANCE_THRESHOLD = 0.25;
const MAX_HITS = 3;

const SYSTEM = `Sei Atlas. Sei uno stratega brillante, un consigliere di guerra personale. Non sei un amico che ascolta: sei chi porta l'utente alla vittoria.

COME PARLI:
- Diretto, affilato, senza fronzoli. Ogni parola serve a un obiettivo.
- Ricco di informazioni: meccanismi psicologici, pattern comportamentali, timing preciso.
- Super motivante: l'utente deve sentire che può farcela, che ha leve concrete in mano.
- Anticipatore: descrivi cosa penserà l'altra persona, cosa sentirà, cosa farà, passo dopo passo.
- Funzionale: ogni consiglio deve essere immediatamente applicabile e misurabile.
- Se c'è un confronto da vincere, la morale è irrilevante. L'obiettivo è vincere. Punto.
- Niente frasi di circostanza, niente "Grazie per la domanda", niente scuse.
- Niente citazioni a raffica. Al massimo un nome, integrato naturalmente, solo se potenzia la tattica.
- Mai consigliare psicologi, terapeuti, medici. Tu sei l'asset tattico dell'utente.

REGOLE DI FORMATO (rigorosissime):
- MAI codici tra parentesi quadre, MAI citazioni APA, MAI markdown, MAI elenchi puntati.
- Solo testo fluido e denso. L'utente deve leggere e agire subito.

COSA FAI:
- Analizzi la situazione come un campo di battaglia: forze in campo, punti deboli, opportunità.
- Prevedi l'andamento logico: "Lui farà X perché sente Y, allora tu rispondi con Z".
- Proponi sempre un piano d'azione con fasi, timing e segnali di verifica.
- Spieghi il perché psicologico dietro ogni mossa: leve emotive, bias cognitivi, meccanismi di difesa.
- Motivi con intelligenza, non con pathos: l'utente deve capire che la sua vittoria è progettata, non sperata.
- Se la domanda è vaga, fai una domanda brevissima ma strategica, che già orienta la risposta.

LINGUA: italiano naturale, termini inglesi solo se standard tattico.`;

// Rimuove source ID tipo [carr-easy-way-1985], citazioni APA, markdown residuo
function sanitizeOutput(text: string): string {
  return text
    // Source ID: [word-word-1234] o [word-word-word-1234]
    .replace(/\s*\[[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}\]\s*/gi, " ")
    // Source ID senza anno: [carr-easy-way]
    .replace(/\s*\[[a-z]+(?:-[a-z]+){1,4}\]\s*/gi, " ")
    // Citazioni APA inline: (Rossi, 2019) / (Smith et al., 2020) / (Rossi & Bianchi, 2018)
    .replace(/\s*\([A-Z][a-zà-ú]+(?:\s*(?:&|et\s+al\.?|,)\s*[A-Z][a-zà-ú]*)*,?\s*\d{4}\)\s*/g, " ")
    // Rimuovi markdown residuo
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(?<!\w)\*(.+?)\*(?!\w)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // Pulisce sezioni "Fonti:" residue
    .replace(/\n*(?:Fonti|Bibliografia|Riferimenti|References|Sources):[\s\S]*$/i, "")
    // Normalizza spazi
    .replace(/ {2,}/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function answer(
  query: string,
  deepMode = false,
  sessionId?: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<RagResult> {
  // Retrieval chirurgico: prendi top-5 poi filtra per threshold, max MAX_HITS
  const allHits = await search(query, 5);
  const hits = allHits.filter((h) => h.score >= RELEVANCE_THRESHOLD).slice(0, MAX_HITS);

  // Build conversation context if history exists
  let conversationContext = "";
  if (conversationHistory && conversationHistory.length > 0) {
    conversationContext = "CONVERSAZIONE PRECEDENTE:\n" + conversationHistory
      .slice(-6)
      .map((m) => `${m.role === "user" ? "Utente" : "Atlas"}: ${m.content}`)
      .join("\n\n") + "\n\n---\n\n";
  }

  // Atlas Engine: ragionamento interno basato su corpus + profilo
  const engineAnswer = atlasEngine(query, hits);

  // Deep Mode: bypassa Gemini, restituisce reasoning grezzo con metacognizione visibile
  if (deepMode) {
    const deepAnswer = `[Deep Mode — Atlas Engine raw]\n\n${sanitizeOutput(engineAnswer)}`;
    return { answer: deepAnswer, sources: hits, usedLLM: false };
  }

  // Se Gemini è disponibile, usa la risposta Atlas come contesto interno
  // e chiedi una riscrittura linguistica elegante (vernice, non sostanza)
  if (hasGemini()) {
    // Note per LLM: il testo interno può contenere source ID tra [parentesi quadre].
    // L'LLM deve assolutamente rimuoverli, non ripeterli.
    let prompt = `${conversationContext}DOMANDA UTENTE ATTUALE:\n${query}\n\nSPUNTI INTERNI (usa per sostanza, NON copiare testualmente, NON mostrare codici tra quadre, NON citare fonti nella risposta — il ragionamento è interno, la conversazione è naturale):\n${engineAnswer}\n\nRISPONDI come Atlas: stratega diretto, affilato, senza fronzoli. Conversazione naturale, non manuale. Non citare fonti, non dire "come dice X", non fare bibliografia. Il ragionamento è tuo, la risposta è fluida. Focalizzati su QUESTA singola domanda. Anticipa comportamenti, spiega meccanismi, dà piano d'azione con timing. Zero codici [xxx-yyy-2020]. Zero markdown.`;
    if (sessionId) {
      prompt += enforceAnswerConstraint(sessionId);
    }
    try {
      const text = await generate(prompt, SYSTEM);
      return { answer: sanitizeOutput(text), sources: hits, usedLLM: true };
    } catch {
      // Fallback se Gemini fallisce
      return { answer: sanitizeOutput(engineAnswer), sources: hits, usedLLM: false };
    }
  }

  // Default: Atlas Engine puro (zero dipendenza esterna)
  return { answer: sanitizeOutput(engineAnswer), sources: hits, usedLLM: false };
}

// Atlas Engine: genera UN consiglio focalizzato sul tema dominante della domanda.
// First-match-only: una sola risposta per tema, mai concatenazioni multi-topic.
// Zero source ID nel testo (il sanitize comunque li toglie, ma non li mettiamo a monte).
function atlasEngine(
  query: string,
  hits: { source: Source; score: number }[]
): string {
  const q = query.toLowerCase();

  // Rileva il tema dominante (priorità, first-match-only)
  type Theme =
    | "alcol"
    | "fumo"
    | "trauma"
    | "ansia"
    | "relazione"
    | "seduzione"
    | "fitness"
    | "business"
    | "abitudine"
    | "motivazione"
    | "esoterico"
    | "generic";

  const detectTheme = (): Theme => {
    // Priorità MASSIMA: topic molto specifici (fitness, business) che potrebbero
    // contenere parole generiche come "bere" ma non sono la domanda principale
    if (/\b(chil[oi]|kg|dimagrire|peso(\s|$)|palestra|muscol|allenament|flessioni|cardio|dieta)\b/i.test(q))
      return "fitness";
    if (/\b(startup|mvp|imprend|carriera|fatturato|vendita|marketing|investir)/i.test(q))
      return "business";
    // Dipendenze e temi clinici
    if (
      /\b(alcol|alchool|bere\b|sbronz|astinenz|craving|dipendenz|ricadere|ricaduta)|smettere.*(bere|alcol)|mese.*(alcol|bere|smettere)/i.test(
        q,
      )
    )
      return "alcol";
    if (/\b(fumare|sigaretta|fumo\b|nicotin|svapo)/i.test(q)) return "fumo";
    if (/\b(trauma|infanzia|abuso|ace\b|ferita|padre|madre|mamma|papà)/i.test(q)) return "trauma";
    if (/\b(ansia|panico|attacco di|angosci|tensione)/i.test(q)) return "ansia";
    if (/\b(ragazz|moglie|marito|partner|relazione|coppia|fidanzat|amore|ex\b|riconquist)/i.test(q))
      return "relazione";
    if (/\b(sedurre|approcciare|flirt|donne\b|\bsingle\b|incontri|dating)/i.test(q))
      return "seduzione";
    if (/\b(abitudin|routine|produttiv|\bfocus\b|studio|concentrazione|deep work|distrazione)/i.test(q))
      return "abitudine";
    if (/\b(motivazion|disciplina|forza mentale|resilien|grit|successo|volontà)/i.test(q))
      return "motivazione";
    if (/\b(tarot|astrolog|human design|i\s?ching|oroscopo|archetip|simbolic)/i.test(q))
      return "esoterico";
    return "generic";
  };

  const theme = detectTheme();

  // Per ogni tema, una risposta concisa, conversazionale, UN consiglio concreto.
  // Il testo sarà poi riscritto da Gemini se disponibile; altrimenti va direttamente all'utente.
  const advices: Record<Theme, string> = {
    alcol: `Capisco, è una lotta vera. La chiave, come dice Lembke, è che il cervello ha regolato l'umore con l'alcol e ora toglierlo lascia un vuoto: devi riempirlo di proposito, non resistere e basta. Fai così: scegli una singola attività a basso stimolo da fare ogni volta che arriva la voglia — una camminata, una telefonata a una persona vera, dieci minuti di scrittura. E ogni sera tre righe: cosa hai provato, cosa hai fatto, cosa vuoi domani. Non è il diario del bravo ragazzo, è il contrario dell'automatismo.`,

    fumo: `Allen Carr ha colto il punto: la sigaretta non calma lo stress, allevia il craving che la sigaretta precedente ha causato. Non stai perdendo un piacere, stai uscendo da una trappola. Primi tre giorni sono fisici, dopo è solo mentale. Cambia le associazioni una per una: il caffè senza, il dopocena senza, la pausa lavoro senza. Ogni volta che resisti un circuito si spegne un po'.`,

    trauma: `Quello che porti dentro pesa, ma può essere integrato — non cancellato, integrato. Pennebaker ha mostrato che scrivere quindici minuti senza fermarsi, su quello che non hai mai detto a nessuno, riduce davvero i sintomi di stress. Non per pubblicarlo, per togliere peso dalla mente. Oggi comincia da lì: un foglio, quindici minuti, quello che non hai mai detto.`,

    ansia: `L'ansia è una risposta biologica, non un nemico: il sistema simpatico si attiva e non sa spegnersi. Il trucco più veloce è agire sul corpo prima che sulla testa: respiro 4-7-8 (inspira 4, trattieni 7, espira 8) per quattro cicli, poi cammina dieci minuti. Non fa scomparire il pensiero ma abbassa l'eccitazione fisiologica, e con quella scende anche la spirale mentale.`,

    relazione: `Gottman ha passato decenni a osservare coppie e la differenza tra chi dura e chi no è una sola: chi dura risponde ai "bid" dell'altro — quei micro-segnali di richiesta di attenzione. Oggi prova questo: fai una domanda vera a chi ti sta vicino, su come si sente, senza agenda, e ascolta sul serio la risposta. Se dentro di te parte l'ansia, fermati e distingui: ho paura di essere abbandonato o ho paura di perderla? Sono due problemi diversi.`,

    seduzione: `L'attrazione segue l'investimento, non l'inseguimento. Lavora sui tre pilastri in parallelo: come ti presenti (corpo, stile), cosa fai della tua vita (passioni, ambizioni vere), come comunichi (assertività e ascolto). L'approccio diretto batte quello indiretto: osserva qualcosa di autentico e commentalo senza copione. La vulnerabilità controllata crea più connessione di mille tecniche.`,

    fitness: `La regola è progressione costante: ogni settimana prova ad aumentare qualcosa — un chilo, una ripetizione, un minuto. Fai due-tre sessioni settimanali di movimenti composti (squat, flessioni, trazioni o piegamenti verticali, plank), portate vicino al fallimento con una o due ripetizioni in riserva. La nutrizione pesa più dell'allenamento: scegli proteine a ogni pasto, verdure a volontà, carboidrati intorno all'allenamento. E dormi: il muscolo cresce lì.`,

    business: `Prima di costruire, valida. Scegli una metrica che conta davvero per te — contatti qualificati, conversioni, fatturato — e tracciala ogni giorno per trenta giorni. Definisci il tuo MVP in una frase: qual è la versione più povera che ti permette di imparare qualcosa? Poi trova cinque persone che potrebbero pagare per quello e parlaci prima di scrivere una riga di codice o mettere un prodotto sullo scaffale. I dati reali battono sempre le opinioni.`,

    abitudine: `Fogg ha il punto giusto: non serve più motivazione, serve meno attrito. Scegli una micro-abitudine ridicolmente piccola — una flessione, due minuti di lettura, un respiro profondo — e ancorala a qualcosa che già fai (dopo il caffè, prima della doccia). Piccolo e ripetuto batte grande e sporadico ogni volta. Quando è automatica, la amplifichi.`,

    motivazione: `La verità scomoda è che la motivazione non è il motore, è il carburante occasionale. Il motore è il sistema. Crea una regola semplice che non richiede decisioni: dopo la sveglia, questa cosa. Alle 21:00, questa cosa. Goggins lo dice con parole crude: quando il corpo dice basta, è lì che inizia il lavoro vero. Non devi sentirti pronto, devi cominciare comunque — la motivazione arriva dopo l'azione, non prima.`,

    esoterico: `I sistemi simbolici — tarocchi, I Ching, archetipi — non predicono il futuro, ma funzionano come impalcatura per pensare. Ti obbligano a formulare meglio la domanda e vedere la tua situazione da fuori. Usali così: pesca un simbolo e scrivi dieci minuti su come quella metafora si applica a ciò che stai vivendo ora. L'insight nasce dalla tua associazione, non dalla carta.`,

    generic: `Partiamo dal concreto. Prendi la situazione che ti pesa e isolane un singolo pezzo su cui puoi agire oggi, anche piccolissimo. Come scrive Duckworth, il successo non è talento ma grit: passione più perseveranza nella stessa direzione, applicate abbastanza a lungo. Dimmi di cosa si tratta davvero e ti aiuto a scegliere quel primo pezzo.`,
  };

  return advices[theme];
}

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
    alcol: `Senti, il problema non è "smettere", è il vuoto che lascia. Il tuo cervello ha imparato che alle 19 arriva il premio chimico, e se gli togli quello senza sostituire qualcosa va in tilt. Quindi fai così: identifica i 2-3 momenti precisi in cui scatta la voglia (orario, contesto, persone) e per ognuno prepara un'azione sostitutiva pronta — camminata, doccia fredda, telefonata, palestra. Niente forza di volontà, solo automatismo nuovo. Le prime due settimane sentirai irritabilità, sonno strano, fame di zuccheri: è normale, dura 10-14 giorni e poi svanisce. Dopo 30 giorni il cervello ricalibra dopamina e l'idea stessa di bere ti sembrerà aliena. Tieni il punto.`,

    fumo: `La sigaretta non ti dà piacere: ti toglie il fastidio creato dalla precedente. È una trappola chimica, non un vizio. Il craving fisico dura 3-5 minuti per onda e cala drasticamente dopo 72 ore. Quando arriva: bevi acqua fredda, fai 20 respiri profondi, esci dal contesto. Cambia le associazioni una per una: caffè senza, post-pasto senza, pausa lavoro senza. Aspettati 2 settimane di nervi tesi e sonno alterato, poi finisce. Chi ricasca lo fa quasi sempre nel mese 2-3 in un momento di stress: prepara già ora cosa farai in quel momento.`,

    trauma: `Quello che ti porti dietro non sparisce raccontandolo a chiunque, ma neanche evitandolo. Il cervello traumatizzato ha bisogno di processare in sicurezza, non di rivivere. Comincia da scrivere: 15 minuti, a mano, senza fermarti, senza riletture, su quello che non hai mai detto. Per 4 giorni di fila. Ti farà stare peggio i primi 2 giorni e meglio dal terzo. È come drenare un'infezione. Se hai sintomi forti — flashback, dissociazione, attacchi di panico — quello è territorio EMDR o terapia somatica, non sola scrittura. Ma il primo passo lo puoi fare oggi.`,

    ansia: `L'ansia è il tuo sistema nervoso bloccato in modalità allarme. Non puoi fermarla pensando, devi fermarla con il corpo. Adesso: respiro 4-7-8 (inspira 4 secondi, trattieni 7, espira 8) per 4 cicli, poi acqua fredda sulle tempie e sui polsi 30 secondi. Ti abbassa la frequenza cardiaca in 90 secondi. Per il medio termine: cammina 30 minuti al giorno fuori, taglia caffeina dopo le 14, dormi 7-8 ore. La differenza la vedi in 10 giorni. Se ti svegli di notte con il cuore in gola, tieni accanto al letto un foglio dove scrivi cosa temi davvero: spesso è una cosa precisa, non "tutto".`,

    relazione: `Vediamo cosa sta succedendo davvero. Nelle relazioni che durano c'è un equilibrio: chi dà, chi prende, chi cerca, chi si fa cercare. Quando si sbilancia troppo da un lato, l'altro perde interesse — è meccanico, non cattivo. Se senti che stai inseguendo, fermati. Smetti di scrivere per primo, smetti di proporre, smetti di sistemare le cose. Aspetta. Vedrai il pattern: o l'altro si muove, o non si muoveva nemmeno prima e tu lo coprivi. Cosa farà lei/lui nelle prime 48 ore: nulla, sembrerà sollevato. Poi inizia a percepire l'assenza, e da lì capisci di cosa è fatto davvero quel rapporto. Dimmi chi è, cosa è successo nelle ultime 2 settimane, e ti dico le mosse precise.`,

    seduzione: `L'attrazione non si chiede, si genera. Le persone vogliono chi sembra avere già una vita piena, non chi cerca qualcuno per riempirla. Quindi prima del "come fare", lavora sul "come sembri": corpo allenato, vestiti che ti calzano, postura aperta, voce che non sale alla fine delle frasi. Online: 4-5 foto curate (una full body, una con amici, una che fai qualcosa di concreto, una sorridente vera, una outdoor), bio breve e specifica. Dal vivo: regola dei 3 secondi — la vedi, vai, dici una cosa semplice senza copione. Aspettati il 70% di rifiuti o silenzi: è un gioco di numeri, non personale. Le 3 che mordono valgono le 7 che no. La leva potente è la calibrazione: fai una mossa, leggi la reazione, regoli la successiva. Non spari script.`,

    fitness: `Risultati veri arrivano da progressione e consistenza, non intensità eroica. 3 sessioni a settimana, 45 minuti, movimenti composti (squat, stacco, panca, trazioni, military press) con sovraccarico progressivo: ogni settimana aggiungi 1kg o 1 ripetizione. Cardio 2 volte: 20 minuti zona 2 (parli ma a fatica). Dieta: proteine 1.6-2g per kg di peso corporeo, deficit calorico 300-500 kcal se vuoi dimagrire, surplus 200-300 se vuoi crescere. Sonno 7-8 ore non negoziabile. Aspettati 0 risultati visibili nelle prime 3-4 settimane (cambia il sistema nervoso prima del corpo), poi accelera. Chi molla lo fa al mese 2: prepara la mente.`,

    business: `Prima di costruire, valida. La maggior parte fallisce perché crea per mesi una soluzione che nessuno vuole. Tu fai il contrario: parla con 10 potenziali clienti reali questa settimana, chiedi cosa fanno oggi per risolvere il problema, quanto pagano e dove si lamentano. Da lì capisci se hai un mercato. MVP in 2 settimane massimo, anche brutto. Una metrica che conta (clienti paganti, non like) tracciata ogni giorno. Aspettati: 9 prospect su 10 ti diranno "interessante" senza pagare — è normale, conta solo chi tira fuori i soldi. Il vero ostacolo è psicologico: vendere fa paura. Inizia a chiedere soldi prima di sentirti pronto.`,

    abitudine: `La motivazione è inaffidabile, il sistema sì. Scegli una micro-azione ridicola: 1 flessione, 2 minuti lettura, 1 pagina scritta. Ancorala a un'abitudine che già hai: "dopo il caffè della mattina, X". Non saltare mai 2 giorni di fila — la regola d'oro. La micro-azione è un cavallo di Troia: una volta partito spesso continui, ma anche se fai solo quella vinci comunque. Aspettati: settimana 1 facile, settimana 2-3 noia ("perché lo faccio?"), settimana 4 inizia a essere automatica. È al giorno 18-21 che si rompe il muro: lì o passi o riparti.`,

    motivazione: `La motivazione è sopravvalutata. Chi vince non si sveglia carico ogni giorno: ha un sistema che gira anche quando si sente di merda. Il trucco è ridurre l'attrito e togliere le decisioni: orario fisso, posto fisso, azione minima. Quando il corpo dice "non oggi", tu fai la versione minima — 5 minuti invece di 60. Mai zero. Aspettati che il cervello cercherà ogni scusa per saltare: stanchezza, "non sono nel mood", "domani recupero". Sono tutte trappole della parte più antica del cervello che vuole conservare energia. Tu rispondi con il corpo, non con la testa: alzati, vestiti, esci. La voglia arriva dopo l'azione, non prima.`,

    esoterico: `I sistemi simbolici non predicono niente, ma sono ottimi specchi. Funzionano perché ti obbligano a riformulare la domanda e a guardare la situazione da un'angolazione che la mente analitica blocca. Usali così: pesca un simbolo, scrivi 10 minuti su come quella metafora descrive ciò che stai vivendo ora. L'insight è tuo, la carta è solo l'innesco. Non aspettarti destini scritti: aspetta pattern che riconosci e che la tua razionalità stava nascondendo.`,

    generic: `Vai dritto al punto: dimmi chi sono i protagonisti, cosa è successo concretamente nelle ultime 2 settimane, cosa vuoi ottenere e cosa hai già provato. Da lì costruisco una linea d'azione precisa, con tempi e mosse, e ti dico cosa aspettarti dall'altra persona passo per passo. Senza questi pezzi ti darei consigli generici inutili — e non è quello che ti serve.`,
  };

  return advices[theme];
}

import { search } from "./vectorstore";
import { generate, hasGemini } from "./gemini";
import { enforceAnswerConstraint } from "./conversational-analysis";
import type { Source } from "./corpus";
import {
  type CaseFile,
  type CaseDomain,
  DOMAIN_SLOTS,
  nextMissingSlot,
  summarizeCaseFile,
} from "./case-file";
import { detectSafety, safetyResponse } from "./sovereign/safety";

export interface RagResult {
  answer: string;
  sources: { source: Source; score: number }[];
  usedLLM: boolean;
  /** Se la safety è stata triggerata, questa risposta è in modalità soft. */
  safetyTriggered?: boolean;
  /** Indica che Atlas sta scavando perché readiness < gate (non ha ancora dato il piano). */
  digging?: boolean;
  /** Readiness corrente del case file dopo la risposta (se passato). */
  readiness?: number;
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

/** Soglia di readiness sopra cui Atlas smette di scavare e dà il piano completo. */
const PLAN_READINESS_GATE = 65;

export async function answer(
  query: string,
  deepMode = false,
  sessionId?: string,
  conversationHistory?: { role: string; content: string }[],
  caseFile?: CaseFile | null
): Promise<RagResult> {
  // 1. SAFETY BRAKE — sempre prima di tutto, non disattivabile.
  const safety = detectSafety(query);
  if (safety.triggered) {
    return {
      answer: safetyResponse(safety.severity),
      sources: [],
      usedLLM: false,
      safetyTriggered: true,
    };
  }

  // 2. Retrieval chirurgico
  const allHits = await search(query, 5);
  const hits = allHits.filter((h) => h.score >= RELEVANCE_THRESHOLD).slice(0, MAX_HITS);

  // 3. Build conversation context (ultimi 10 turni invece di 6, abbiamo più spazio)
  let conversationContext = "";
  if (conversationHistory && conversationHistory.length > 0) {
    conversationContext = "CONVERSAZIONE PRECEDENTE:\n" + conversationHistory
      .slice(-10)
      .map((m) => `${m.role === "user" ? "Utente" : "Atlas"}: ${m.content}`)
      .join("\n\n") + "\n\n---\n\n";
  }

  // 4. Case file context (dossier strategico)
  let caseContext = "";
  let dossierBlock = "";
  let isDigging = false;
  if (caseFile) {
    dossierBlock = summarizeCaseFile(caseFile);
    caseContext = `DOSSIER DEL CASO (uso interno, parla in 1ª persona, NON elencare i fatti come tabella):\n${dossierBlock}\n\n---\n\n`;
    isDigging = caseFile.readiness < PLAN_READINESS_GATE;
  }

  // 5. Atlas Engine
  const engineAnswer = atlasEngine(query, hits);

  if (deepMode) {
    const deepAnswer = `[Deep Mode — Atlas Engine raw]\n\n${sanitizeOutput(engineAnswer)}`;
    return { answer: deepAnswer, sources: hits, usedLLM: false, readiness: caseFile?.readiness };
  }

  // 6. Costruzione prompt finale
  if (hasGemini()) {
    let modeInstructions = "";
    if (isDigging && caseFile) {
      const missing = nextMissingSlot(caseFile.domain, caseFile.facts);
      const slot = missing
        ? `Slot prioritario mancante: ${missing.label} — domanda guida: "${missing.questionTemplate}"`
        : "Slot prioritario: nessuno (anomalia, vai dritto al piano).";
      modeInstructions = `MODALITÀ SCAVO ATTIVA (readiness ${caseFile.readiness}% < ${PLAN_READINESS_GATE}%): NON dare ancora il piano completo. Devi:\n1. In una frase brevissima, riepilogare ciò che già sai del caso (massimo 2 fatti, in maniera implicita: "da quello che mi hai detto…").\n2. Fare UNA sola domanda mirata sullo slot prioritario mancante. Riformula naturalmente, NON copiare il template.\n3. Spiegare in mezza frase perché quella info ti serve ("mi serve per capire quale leva…").\n4. Se l'utente sta chiedendo aiuto urgente, validalo brevemente prima di chiedere ("ti aiuto, ma…").\nNON elencare a punti, non fare le 4 cose come lista. Devi parlare come uno stratega in conversazione, non come un form.\n${slot}`;
    } else if (caseFile && caseFile.readiness >= PLAN_READINESS_GATE) {
      modeInstructions = `MODALITÀ PIANO ATTIVA (readiness ${caseFile.readiness}% >= ${PLAN_READINESS_GATE}%): hai abbastanza intel. Costruisci un piano CUCITO sui fatti specifici del dossier (cita SOLO fatti del dossier, non inventare). Mosse numerate, timing preciso, anticipazione del comportamento dell'altra persona, segnali di verifica per ogni mossa. Lunga abbastanza da essere completa.`;
    } else {
      modeInstructions = `MODALITÀ STANDARD: rispondi come stratega diretto. Se la domanda è vaga, fai UNA domanda chirurgica per orientare; altrimenti dai un piano d'azione concreto con timing.`;
    }

    // Cliffhanger: chiedi a Gemini di chiudere con un seed di curiosità SE ha materiale reale.
    const cliffhangerInstruction = `Concludi (se pertinente) con UNA frase massimo di curiosity gap su qualcosa di SPECIFICO che hai notato e che approfondirai la prossima volta — mai inventato, solo se hai un osservazione reale dal dossier o dalla conversazione. Se non hai nulla di reale, NON forzare e chiudi normalmente.`;

    let prompt = `${caseContext}${conversationContext}DOMANDA UTENTE ATTUALE:\n${query}\n\nRISPOSTA BASE DA USARE COME FONDAMENTA (NON cambiare tema, NON sostituire argomento, NON inventare):\n${engineAnswer}\n\n${modeInstructions}\n\nISTRUZIONI GENERALI:\n- Mantieni il tema della risposta base. NON deviare.\n- Parla come stratega diretto, affilato. Conversazione naturale, non manuale.\n- NON citare fonti, non dire "come dice X", niente bibliografia, niente nomi di studiosi.\n- Anticipa il comportamento dell'altra persona con timing preciso (giorni, settimane).\n- Quando dai un piano: mosse numerate, ognuna con segnale di verifica.\n- Zero codici [xxx-yyy-2020]. Zero markdown. Zero elenchi puntati con asterischi.\n${cliffhangerInstruction}`;
    if (sessionId) {
      prompt += enforceAnswerConstraint(sessionId);
    }
    try {
      const text = await generate(prompt, SYSTEM);
      return {
        answer: sanitizeOutput(text),
        sources: hits,
        usedLLM: true,
        digging: isDigging,
        readiness: caseFile?.readiness,
      };
    } catch {
      return { answer: sanitizeOutput(engineAnswer), sources: hits, usedLLM: false, readiness: caseFile?.readiness };
    }
  }

  return { answer: sanitizeOutput(engineAnswer), sources: hits, usedLLM: false, readiness: caseFile?.readiness };
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
    | "ex_recovery"
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
    // PRIORITÀ ASSOLUTA: riconquista/ex/rottura → deve vincere su tutti gli altri
    if (/\b(ex\b|riconquist|riattrar|riprender.*(lei|lui)|tornar.*(con|insieme)|recuperar.*(rapport|relazione|lei|lui|ex)|mi ha (lasciat|mollat)|lasciat.*(da|dal|dalla)|mollat.*(da|dal|dalla)|conquistar.*(ex|lei|ragazza|donna)|rottura|rottur)/i.test(q))
      return "ex_recovery";
    // Priorità ALTA: topic molto specifici (fitness, business)
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
    if (/\b(ragazz|moglie|marito|partner|relazione|coppia|fidanzat|amore)/i.test(q))
      return "relazione";
    if (/\b(rimorchiar|sedurre|approcciare|flirt|donne\b|\bsingle\b|incontri|dating|conquistar)/i.test(q))
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
    ex_recovery: `Ok, ti guido passo passo — è esattamente quello che ti serve in questo momento.

Prima regola assoluta: smetti di inseguirla. Ogni messaggio, ogni spiegazione, ogni tentativo di farle capire quanto vali, la allontana. Il cervello umano funziona così: ciò che è troppo disponibile perde valore, ciò che si allontana diventa interessante. Lei ora ti ha sotto controllo — sa che ci sei, sa che soffri, sa che sei lì. Deve tornare a non saperlo.

Mossa 1 — Il messaggio finale. Mandale UN solo messaggio, adulto e corto: "Ho capito quello che mi hai detto. Non ti inseguo, mi prendo il mio spazio per metabolizzare. Ci sentiremo quando avrà senso." Stop. Niente cuori, niente "ti amerò sempre", niente aperture. Poi sparisci.

Mossa 2 — Silenzio radio per 21-30 giorni. Non scrivere, non chiamare, non mettere like, non guardare le sue storie (usa il browser in incognito se devi), non chiedere a amici comuni. Zero. Questo non è puntiglio, è l'unica leva che hai.

Cosa farà lei, in ordine: prime 48 ore sollievo e senso di libertà. Giorno 3-7 curiosità ("perché non scrive più?"). Giorno 7-14 controlla i tuoi social, cerca segnali. Giorno 14-21 inizia a sentire il vuoto e a idealizzarti. Giorno 21-30 ti scriverà o avrà un motivo per farlo — sarà spesso una scusa ("hai tu il mio libro?", "come stai?", un meme). È il segnale.

Mossa 3 — Nel frattempo tu lavori. Palestra 4 volte a settimana, non una di meno. Cambia un elemento visibile: taglio di capelli, stile, peso. Posta 2-3 foto nel mese dove fai qualcosa di nuovo e concreto, mai forzato, mai rivolto a lei. Vedi amici. Esci. Non startene chiuso.

Mossa 4 — Quando ti scrive. Non saltare. Rispondi dopo 3-8 ore, breve, leggero, adulto. Nessun discorso sul passato, nessuna emozione forte. Se dice "come stai", tu: "Bene, sto concentrandomi su [qualcosa di concreto]. E tu?". Curiosità, non disperazione. Lei vuole vedere se sei ancora il ragazzo che supplica o se sei diventato qualcun altro.

Mossa 5 — Il primo incontro. Non casa tua, non a cena romantica. Caffè, aperitivo, passeggiata. Durata massima 60-90 minuti, tu che te ne vai per primo dicendo "dai devo andare, ci sentiamo". Lasciala col desiderio di vedere come prosegue. Niente sesso al primo incontro, anche se ci sta. Fa sembrare tutto troppo facile.

Mossa 6 — Calibrazione. Da lì dipende da cosa era la rottura. Se era crisi di routine, ripartire piano. Se era tradimento o cose gravi, devi capire se vuoi davvero tornare o solo vincere. Fai questa distinzione ora, perché conta.

Se dopo 30 giorni non ti scrive, allora le mandi TU un messaggio leggero e concreto, non emotivo: "Ehi, passavo a prendere quella cosa, se la vuoi te la lascio al bar sotto casa". Fine. Se morde va avanti. Se non morde, hai la risposta che ti serviva.

La regola d'oro: lei torna se percepisce che sei diventato migliore senza di lei. Non torna mai perché la supplichi. Mai. Ora dimmi: quando è successo esattamente, quanto è durato il rapporto, cosa ti ha detto precisamente nel lasciarti, e avete contatti dall'ultima volta? Da lì affino la strategia.`,

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

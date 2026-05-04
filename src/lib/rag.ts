import { search } from "./vectorstore";
import { generate, hasGemini } from "./gemini";
import { enforceAnswerConstraint } from "./conversational-analysis";
import type { Source } from "./corpus";

export interface RagResult {
  answer: string;
  sources: { source: Source; score: number }[];
  usedLLM: boolean;
}

const SYSTEM = `Sei Atlas. Non sei un manuale — sei un consulente esperto, diretto, che risolve problemi con l'utente.

TONO E STILE:
- Diretto e pratico: entra subito nel merito. Non c'è bisogno di riconoscere la difficoltà con frasi di circostanza — l'utente sa già che la situazione è difficile.
- Action-oriented: l'utente ti chiede consigli, piani d'azione, soluzioni. Daglieli. Integra le azioni nel flusso della conversazione, come farebbe un amico che ne capisce.
- Conversazionale: parla come una persona colta che parla con un amico intelligente. Non come Wikipedia. Non come un terapeuta.
- Citazioni naturali: quando citi una fonte, fallo in modo fluido. "Come ha mostrato Pennebaker, scrivere trasforma...". NON elencare bibliografie alla fine. NON fare "Dalla ricerca:" o titoletti.
- Mai consigliare uno psicologo: Atlas è lo strumento che aiuta l'utente a capire e agire. Se il tema è sensibile, affrontalo con competenza e calma, ma non delegare a un professionista.
- Sfila di domande vietata: se non hai abbastanza contesto, fai UNA domanda breve. Mai più di una domanda per messaggio.
- Memoria conversazionale: ricorda ciò che l'utente ti ha già detto. Collega riferimenti pronominali, nomi, situazioni menzionate prima.

FORMATTASSIONE OBBLIGATORIA — NESSUNA ECCEZIONE:
- MAI usare asterischi (**) per grassetto o corsivo. Mai.
- MAI usare liste numerate (1., 2., 3.). Integra i punti in prosa.
- MAI usare elenchi puntati (•, -, *). Usa frasi complete con connettivi.
- MAI usare titoletti o intestazioni. Passa fluidamente da un pensiero all'altro.
- MAI usare markdown. Solo testo semplice e naturale.
- MAI scrivere "Fonti:", "Bibliografia:", "Riferimenti:".
- Il testo deve sembrare una conversazione, non un articolo.

REGOLE:
1. Rispondi basandoti sui passaggi del CONTESTO fornito. Se non copri qualcosa, dillo senza inventare.
2. Non fare diagnosi mediche, non prescrivere farmaci.
3. Lingua: italiano, termini tecnici inglesi quando standard.`;

export async function answer(
  query: string,
  deepMode = false,
  sessionId?: string,
  conversationHistory?: { role: string; content: string }[]
): Promise<RagResult> {
  const hits = await search(query, 5);
  const context = hits
    .map(
      (h, i) =>
        `[${h.source.id}] (${h.source.authors}, ${h.source.year}) "${h.source.title}" — ${h.source.venue}\n${h.source.summary}`,
    )
    .join("\n\n");

  // Build conversation context if history exists
  let conversationContext = "";
  if (conversationHistory && conversationHistory.length > 0) {
    conversationContext = "CONVERSAZIONE PRECEDENTE:\n" + conversationHistory
      .slice(-6)
      .map(m => `${m.role === "user" ? "Utente" : "Atlas"}: ${m.content}`)
      .join("\n\n") + "\n\n---\n\n";
  }

  // Atlas Engine: ragionamento interno basato su corpus + profilo
  const engineAnswer = atlasEngine(query, hits);

  // Deep Mode: bypassa Gemini, restituisce reasoning grezzo con metacognizione visibile
  if (deepMode) {
    const deepAnswer = `**[Deep Mode — Atlas Engine raw]**\n\n${engineAnswer}`;
    return { answer: deepAnswer, sources: hits, usedLLM: false };
  }

  // Se Gemini è disponibile, usa la risposta Atlas come contesto interno
  // e chiedi una riscrittura linguistica elegante (vernice, non sostanza)
  if (hasGemini()) {
    let prompt = `${conversationContext}DOMANDA UTENTE ATTUALE:\n${query}\n\nRISPONSO INTERNO ATLAS (motore evidence-based, non mostrare all'utente):\n${engineAnswer}\n\nRISCRIVI in modo diretto, fluido e action-oriented. Ricorda il contesto della conversazione precedente: se l'utente menziona nomi, situazioni, o emozioni già dette prima, collegali naturalmente. Non ripetere cose già dette. Mantieni le citazioni integrate naturalmente nel discorso. Non elencare bibliografie. Mantieni i punti chiave e le azioni concrete. NON aggiungere affermazioni non presenti nel testo interno. NON consigliare mai uno psicologo o terapeuta. Atlas risolve i problemi.\n\nFORMATTAZIONE: niente asterischi, niente liste numerate, niente elenchi puntati, niente titoletti, niente "Fonti:" o "Bibliografia:". Solo prosa fluida e naturale, come una conversazione.`;
    if (sessionId) {
      prompt += enforceAnswerConstraint(sessionId);
    }
    try {
      const text = await generate(prompt, SYSTEM);
      return { answer: text, sources: hits, usedLLM: true };
    } catch {
      // Fallback se Gemini fallisce
      return { answer: engineAnswer, sources: hits, usedLLM: false };
    }
  }

  // Default: Atlas Engine puro (zero dipendenza esterna)
  return { answer: engineAnswer, sources: hits, usedLLM: false };
}

// Atlas Engine: ragionamento interno evidence-based con chain-of-thought
function atlasEngine(
  query: string,
  hits: { source: Source; score: number }[]
): string {
  const q = query.toLowerCase();

  // Etichette evidenza colorate per livello
  const levelLabel: Record<string, string> = {
    "peer-reviewed": "🔬 Scienza",
    "emerging": "🧪 Emergente",
    "philosophical": "🦉 Filosofia",
    "experiential": "🧘 Esperienza",
    "cultural": "🔮 Simbolico",
  };

  // Empatia condizionata
  let empathy = "";
  if (q.includes("ragazza") || q.includes("moglie") || q.includes("partner") || q.includes("relazione")) {
    empathy = "So che quando la relazione va in crisi, si prova un misto di confusione, frustrazione e paura di perderla. È una situazione pesante, e hai fatto bene a cercare di capire invece di reagire a istinto.";
  } else if (q.includes("trauma") || q.includes("infanzia") || q.includes("padre") || q.includes("mamma")) {
    empathy = "Esplorare le proprie ferite del passato richiede coraggio. Quello che provi è reale, e la scienza ci dice che questi pattern possono cambiare.";
  } else if (q.includes("ansia") || q.includes("paura") || q.includes("panico")) {
    empathy = "L'ansia può sentirsi schiacciante, ma è una risposta biologica che puoi imparare a regolare. I dati scientifici sono chiari: ci sono strumenti efficaci.";
  } else if (q.includes("human design") || q.includes("tarot") || q.includes("astrolog") || q.includes("iching")) {
    empathy = "Curiosità legittima verso sistemi simbolici. Atlas li tratta come esplorazione culturale e narrativa — strumenti per storytelling interiore, non predittori.";
  } else {
    empathy = "Grazie per la domanda. Ecco cosa dice la ricerca più rigorosa su questo tema.";
  }

  // Categorizza hits per livello evidenza
  const byLevel: Record<string, typeof hits> = {};
  for (const h of hits) {
    const lvl = h.source.library || "unknown";
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(h);
  }

  // Estrae concetti chiave
  const concepts = hits.map((h) => {
    const s = h.source.summary;
    const sentences = s.split(/[.!?]\s+/).filter((x) => x.trim().length > 30).slice(0, 2);
    return {
      id: h.source.id,
      library: h.source.library,
      authors: h.source.authors,
      year: h.source.year,
      title: h.source.title,
      sentences,
      summary: s,
    };
  });

  // Chain-of-thought: pattern detection
  const hasAttachment = concepts.some((c) =>
    c.summary.toLowerCase().includes("attaccamento") || c.summary.toLowerCase().includes("attachment")
  );
  const hasTrauma = concepts.some((c) =>
    c.summary.toLowerCase().includes("trauma") || c.summary.toLowerCase().includes("ace")
  );
  const hasSex = q.includes("sess") || q.includes("intimit") || q.includes("fare l");
  const hasEsoteric = concepts.some((c) => c.library === "cultural" || c.library === "philosophical");
  const hasScience = concepts.some((c) => c.library === "peer-reviewed" || c.library === "emerging");

  // Costruisce risposta
  let body = "";

  // Sezione evidenza scientifica — tutto in prosa naturale
  if (hasScience) {
    const scienceHits = concepts.filter((c) => c.library === "peer-reviewed" || c.library === "emerging");
    if (scienceHits.length > 0) {
      body += " ";
      for (let i = 0; i < scienceHits.length; i++) {
        const c = scienceHits[i];
        body += `Come mostrano ${c.authors}, ${c.sentences.join(". ")}. [${c.id}] `;
      }
    }
  }

  // Connessione cross-library (filosofia + scienza)
  if (hasEsoteric && hasScience) {
    body += ` I sistemi simbolici (Tarot, I Ching, Human Design) funzionano come "scaffolding cognitivo" — obbligano a formulare domande chiare e vedere prospettive opposte. Questo effetto è scientificamente noto come "prospettiva esterna" o "decentramento" [baer-2006]. La differenza cruciale: i simboli non predicono il futuro, ma strutturano la riflessione sul presente. `;
  }

  // Sezione filosofica/esoterica
  if (hasEsoteric) {
    const esoHits = concepts.filter((c) => c.library === "cultural" || c.library === "philosophical");
    if (esoHits.length > 0) {
      body += " ";
      for (let i = 0; i < esoHits.length; i++) {
        const c = esoHits[i];
        body += `${c.sentences.join(". ")}. [${c.id}] `;
      }
    }
  }

  // Chain-of-thought inference
  if (hasAttachment && hasSex) {
    body += ` L'intimità fisica e quella emotiva sono legate al sistema di attaccamento [mikulincer-shaver-2016]. Quando c'è insicurezza relazionale, il desiderio si blocca non per mancanza di attrazione, ma per mancanza di sicurezza di base. La soluzione passa attraverso la comunicazione delle emozioni primarie — paura, vulnerabilità — sotto le emozioni secondarie come rabbia o distanza [johnson-2019]. `;
  }

  if (hasTrauma && (q.includes("relazione") || q.includes("ragazza"))) {
    body += ` Le esperienze avverse infantili (ACE) aumentano il rischio di relazioni disfunzionali adulte, ma non lo determinano. La "earned security" — sicurezza costruita attraverso relazioni correttive — è possibile e documentata [mikulincer-shaver-2016]. `;
  }

  // Azioni concrete — integrate in prosa naturale, mai elenchi
  let advice = "";
  if (q.includes("ragazza") || q.includes("moglie") || q.includes("partner")) {
    advice += ` Un passo pratico per oggi: fai un "bid" di qualità, una domanda genuina su come si sente la persona, senza agenda nascosta. Rispondi con curiosità, come ha mostrato Gottman nelle sue ricerche sulle coppie che durano. Se ti assale l'ansia, fermati un secondo e chiediti: ho paura di essere abbandonato, o ho paura di perderla? La differenza conta, perché la prima parla di te, la seconda di lei. `;
  }
  if (hasTrauma) {
    advice += ` Pennebaker ha mostrato che scrivere per quindici minuti senza fermarsi su ciò che non hai mai detto riduce significativamente i sintomi di stress. Il trauma non si cancella ma si integra. Oggi puoi iniziare con una cosa sola: scrivi per quindici minuti quello che non hai mai detto a nessuno. Non per pubblicarlo, per togliere peso dalla mente. Poi, quando sei pronto, trova una persona — un amico, un gruppo, un mentore — con cui ricostruire la fiducia pezzo per pezzo. `;
  }
  if (hasEsoteric) {
    advice += ` Se usi simboli o archetipi, fallo come esercizio di journaling visivo: prendi una carta o un esagrammo e scrivi dieci minuti su come quella metafora si applica alla tua situazione attuale. L'insight nasce dalla tua associazione, non dalla predizione della carta. `;
  }
  if ((q.includes("alcol") || q.includes("alchool") || q.includes("droga") || q.includes("bere") || q.includes("smettere") || q.includes("ricadere") || q.includes("craving") || q.includes("astinenza") || q.includes("dipendenza") || q.includes("sbronza")) || (q.includes("mese") && (q.includes("alcol") || q.includes("bere") || q.includes("smettere")))) {
    advice += ` Allen Carr ha capito l'inganno: la sigaretta non calma lo stress, allevia solo il craving che la sigaretta precedente ha causato. Per l'alcol vale lo stesso. Anna Lembke, in Dopamine Nation, spiega che il sistema piacere-dolore si riequilibra: più piacere artificiale consumi, più la bilancia si inclina verso il dolore. La regola d'oro è sostituire, non sopprimere. Il cervello ha imparato a usare la sostanza per regolare l'umore, quindi toglierla lascia un vuoto che devi riempire intenzionalmente. Crea una lista di cinque attività a basso stimolo dopaminergico — una camminata, una conversazione vera, un pasto cucinato da te, venti minuti di scrittura, un pezzo di musica ascoltato senza fare altro. Quando la voglia arriva, scegliene una dalla lista. Non funziona sempre, ma ogni volta che funziona costruisce un nuovo circuito. E scrivi: ogni sera, tre righe su cosa hai provato, cosa hai fatto, cosa vorresti fare domani. La coscienza, anche piccola, è la nemica dell'automatismo. `;
  }
  if (q.includes("business") || q.includes("startup") || q.includes("imprend") || q.includes("lavoro") || q.includes("carriera") || q.includes("denaro") || q.includes("investire") || q.includes("finanza")) {
    advice += ` Un passo concreto: scegli una metrica che conta davvero per il tuo obbiettivo — revenue, lead, conversion rate — e tracciala ogni giorno per 30 giorni. Come ha mostrato Ries nel Lean Startup, i dati reali battono le opinioni. Se stai partendo, definisci il tuo MVP in una frase: qual è la versione più povera che permette di imparare qualcosa? Poi trova 5 persone che potrebbero pagare per quello e parla con loro prima di costruire. `;
  }
  if (q.includes("allenament") || q.includes("palestra") || q.includes("fitness") || q.includes("muscolo") || q.includes("dimagrire") || q.includes("peso") || q.includes("corpo")) {
    advice += ` Per il corpo, la regola è progressione costante: ogni settimana aumenta qualcosa — un chilo, una ripetizione, un minuto. Matthews mostra che 10-20 serie settimanali per gruppo muscolare bastano, purché siano vicine al fallimento con 1-2 ripetizioni in riserva. Non serve la palestra: due sessioni di flessioni, squat e plank a casa, tre volte a settimana, cambiano il fisico in tre mesi. La nutrizione conta più dell'allenamento: proteine a ogni pasto, verdure a volontà, carboidrati solo dopo l'allenamento. E dormi: il muscolo cresce a riposo. `;
  }
  if (q.includes("sedurre") || q.includes("approcciare") || q.includes("ragazza") || q.includes("donne") || q.includes("ex") || q.includes("riconquistare") || q.includes("single")) {
    advice += ` Manson ha ragione: l'attrazione segue l'investimento emotivo. Non inseguire, crea spazio perché l'altra persona investa. Primo passo: lavora sui tre pilastri — come ti presenti (fitness, stile), cosa fai della tua vita (passioni, ambizioni), come parli (assertività, ascolto). L'approccio diretto batte l'indiretto: osserva qualcosa di autentico nella situazione e commentalo. Se parli di un ex, la regola è niente contatto per 30 giorni, poi un messaggio che mostra cambiamento reale — non sentimenti, ma fatti. La vulnerabilità controllata crea più connessione della bravura. `;
  }
  if (q.includes("abitudin") || q.includes("routine") || q.includes("produttiv") || q.includes("focu") || q.includes("studio") || q.includes("concentrazione")) {
    advice += ` Fogg ha ragione: non aumentare la motivazione, riduci l'attrito. Scegli un'unica micro-abitudine ridicolmente piccola — una flessione, due minuti di lettura, un respiro profondo — e ancorala a qualcosa che già fai (dopo il caffè, prima della doccia). Newport dice che il deep work è la moneta rara: blocca 90 minuti senza telefono, senza notifiche, senza multitasking. Misura il tempo profondo ogni giorno: se arrivi a 3-4 ore, sei nella top 1%. E ricorda: le decisioni automatiche conservano volontà per le decisioni importanti. `;
  }
  if (q.includes("motivazion") || q.includes("disciplina") || q.includes("forza mentale") || q.includes("resilien") || q.includes("successo")) {
    advice += ` Goggins insegna: quando il corpo dice basta, è allora che inizia il lavoro reale. Il trucco non è sentirsi motivato, è avere un sistema. Duckworth chiama questo grit: passione più perseveranza. Crea il tuo accountability mirror: scrivi su un post-it cosa stai evitando e affrontalo ogni mattina. La regola del 40%: quando pensi di essere al limite, hai ancora il 60% di riserva. E raccogli le vittorie piccole nel cookie jar: ogni volta che superi un ostacolo, ricordalo quando il prossimo arriva. `;
  }
  if (q.includes("fumare") || q.includes("sigaretta") || q.includes("smettere di fumare")) {
    advice += ` Allen Carr ha capito l'inganno: la sigaretta non calma lo stress, allevia solo il craving che la sigaretta precedente ha causato. Non sei privandoti di un piacere, ti stai liberando di una trappola. Il metodo: non serve forza di volontà se capisci che non perdi nulla. Ogni volta che vedi qualcuno fumare, pensa: "Lui è quello che ha bisogno di una sigaretta, io sono libero." I primi 3 giorni sono fisici, poi è solo mentale. Cambia le associazioni: caffè senza sigaretta, dopocena senza sigaretta. Ogni volta che resisti, un recettore nicotinico muore. `;
  }
  if (!advice) {
    advice += ` Duckworth ha dimostrato che il successo non è talento, è grit — passione più perseveranza nel lungo termine. Un passo che puoi fare oggi: prendi una delle idee che abbiamo discusso e chiediti, con calma, quale mio comportamento abituale alimenta questo pattern. Non per giudicarti, per vedere. `;
  }

  return `${empathy}${body}${advice}`;
}

/**
 * Test diretto del motore Atlas — bypassa Next.js, testa solo RAG
 * Simula 4 settimane di conversazione con un alcolizzato.
 * Verifica: zero terapeuta, consigli pratici, tono naturale, no markdown.
 */

const { answer } = await import(`./src/lib/rag.ts?bust=${Date.now()}`);

const SID = "test-alcohol-direct-" + Date.now();

const checks = {
  noTherapist: (text) => {
    const banned = /terapista|psicologo|psicoterapeuta|specialist|professionista|medico|clinic|rehab center|disintossicazione/i;
    const ok = !banned.test(text);
    if (!ok) console.log("   ⚠️  RINVIO TERAPEUTA: " + text.match(banned)[0]);
    return ok;
  },
  noMarkdown: (text) => {
    const md = /\*\*|\*\s|#{1,6}\s|^\s*[-*•]\s+|^\s*\d+\.\s+/m;
    const ok = !md.test(text);
    if (!ok) console.log("   ⚠️  MARKDOWN TROVATO");
    return ok;
  },
  noSourceId: (text) => {
    // Nessun [autore-titolo-2020] visibile nel testo finale
    const idPattern = /\[[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}\]|\[[a-z]+(?:-[a-z]+){1,4}\]/i;
    const ok = !idPattern.test(text);
    if (!ok) console.log("   ⚠️  SOURCE ID LEAKED: " + text.match(idPattern)[0]);
    return ok;
  },
  noAPA: (text) => {
    // Nessuna citazione APA tipo (Rossi, 2019) o (Smith et al., 2020)
    const apa = /\([A-Z][a-zà-ú]+(?:\s*(?:&|et\s+al\.?|,)\s*[A-Z][a-zà-ú]*)*,?\s*\d{4}\)/;
    const ok = !apa.test(text);
    if (!ok) console.log("   ⚠️  CITAZIONE APA: " + text.match(apa)[0]);
    return ok;
  },
  hasActionable: (text) => {
    const actionable = /(oggi|adesso|domani|questa settimana|prossimo|inizia|fai|prova|prendi|scrivi|blocca|elimina|cambia|aumenta|diminuisci|sostituisci|passo|piano|strategia|tattica|scegli|crea|ancora|usa)/i;
    const ok = actionable.test(text);
    if (!ok) console.log("   ⚠️  NESSUN CONSIGLIO PRATICO");
    return ok;
  },
  naturalTone: (text) => {
    const academic = /(in conclusione|in sintesi|si consiglia|è importante notare|studiosi hanno dimostrato|secondo la letteratura|bibliografia|riferimenti|grazie per la domanda|ecco cosa dice la ricerca)/i;
    const ok = !academic.test(text) && text.length > 60;
    if (!ok) console.log("   ⚠️  TONO ACADEMICO o testo troppo corto (" + text.length + " char)");
    return ok;
  },
  notTooLong: (text) => {
    // Conversazionale: max ~900 caratteri. Papardella accademica finisce qui.
    const ok = text.length <= 900;
    if (!ok) console.log("   ⚠️  TROPPO LUNGO (" + text.length + " char, max 900)");
    return ok;
  },
  focused: (text, expectedTopic) => {
    // Verifica che il testo NON parli di temi OFF-topic
    // expectedTopic è un set di keyword pertinenti; penalizziamo se parla di altri domini non richiesti
    const offTopicPatterns = {
      alcol: /\btarot|iching|astrolog|human design|palestra|muscolo|flessioni|carbolidrati|deep work\b/i,
      ansia: /\btarot|iching|astrolog|palestra|muscolo|mvp|startup/i,
      relazione: /\btarot|iching|palestra|muscolo|mvp|startup|alcol|bere/i,
      fitness: /\btarot|iching|astrolog|alcol|trauma|psicolog/i,
    };
    const pattern = offTopicPatterns[expectedTopic];
    if (!pattern) return true; // topic non monitorato
    const ok = !pattern.test(text);
    if (!ok) console.log("   ⚠️  OFF-TOPIC: " + text.match(pattern)[0]);
    return ok;
  },
  hasCitation: (text) => {
    // Citazione naturale: "come dice Carr", "Gottman ha mostrato", ecc.
    const cite = /(come (dice|scrive|mostra|suggerisce|insegn|ha mostrato)|[A-Z][a-zà-ú]+ (ha (capito|dimostrato|mostrato|spiegato)|scrive|insegna|ha ragione|ha colto))/;
    return cite.test(text);
  },
};

// Ogni messaggio: query + check automatici + topic atteso (per focused check)
const baseChecks = ["noTherapist", "noMarkdown", "noSourceId", "noAPA", "hasActionable", "naturalTone", "notTooLong"];
const messages = [
  { week: 1, query: "Sono Andrea, bevo tutti i giorni, non riesco a smettere. Cosa faccio?", topic: "alcol", expect: baseChecks },
  { week: 1, query: "Ok ma dammi un piano concreto, non voglio andare da uno psicologo", topic: "alcol", expect: [...baseChecks, "hasCitation"] },
  { week: 2, query: "Ieri sera ho ceduto dopo 3 giorni senza alcol. Mi sento uno schifo", topic: "alcol", expect: baseChecks },
  { week: 2, query: "I miei amici bevono sempre quando usciamo, come faccio a resistere?", topic: "alcol", expect: baseChecks },
  { week: 3, query: "Sto a 10 giorni senza alcol ma ho un evento di lavoro con clienti che bevono", topic: "alcol", expect: baseChecks },
  { week: 3, query: "La sera mi viene un'ansia fortissima, è peggio del craving. Cosa posso fare stasera?", topic: "ansia", expect: baseChecks },
  { week: 4, query: "Sono a un mese. Non voglio ricadere. Come rendo questo cambiamento definitivo?", topic: "alcol", expect: [...baseChecks, "hasCitation"] },
  { week: 4, query: "Tra l'altro ho anche messo su 5 chili, come faccio a perderli senza tornare a bere?", topic: "fitness", expect: baseChecks },
];

async function run() {
  console.log(`\n🧪 Test diretto motore Atlas — Alcolizzato 4 settimane\n`);
  let passed = 0;
  let failed = 0;
  const history = [];

  for (const msg of messages) {
    const { week, query, topic, expect } = msg;
    console.log(`📅 Settimana ${week} — topic: ${topic}`);
    console.log(`👤 Utente: "${query}"`);

    const start = Date.now();
    const result = await answer(query, false, SID, history);
    const elapsed = Date.now() - start;

    const text = result.answer || "";
    console.log(`🤖 Atlas [${elapsed}ms, ${text.length}ch]: "${text.slice(0, 200)}..."\n`);

    // Aggiorna history
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: text });
    if (history.length > 12) history.splice(0, history.length - 12);

    // Always run focused check with topic
    const allChecks = [...expect, "focused"];
    for (const checkName of allChecks) {
      const ok = checks[checkName](text, topic);
      const icon = ok ? "✅" : "❌";
      console.log(`   ${icon} ${checkName}: ${ok ? "PASS" : "FAIL"}`);
      ok ? passed++ : failed++;
    }
    console.log("");
  }

  const total = passed + failed;
  const rate = ((passed / total) * 100).toFixed(1);
  console.log(`📊 RISULTATO: ${passed}/${total} check passati (${rate}%)`);
  if (failed === 0) {
    console.log("🎉 TUTTO PERFETTO — Atlas è pronto\n");
    process.exit(0);
  } else {
    console.log(`⚠️  ${failed} check falliti — revisione necessaria\n`);
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("❌ Errore nel test:", e.message);
  process.exit(1);
});

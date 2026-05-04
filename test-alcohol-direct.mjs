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
  hasActionable: (text) => {
    const actionable = /(oggi|adesso|domani|questa settimana|prossimo|inizia|fai|prova|prendi|scrivi|blocca|elimina|cambia|aumenta|diminuisci|sostituisci|passo|piano|strategia|tattica)/i;
    const ok = actionable.test(text);
    if (!ok) console.log("   ⚠️  NESSUN CONSIGLIO PRATICO");
    return ok;
  },
  naturalTone: (text) => {
    const academic = /(in conclusione|in sintesi|si consiglia|è importante notare|studiosi hanno dimostrato|secondo la letteratura|bibliografia|riferimenti)/i;
    const ok = !academic.test(text) && text.length > 80;
    if (!ok) console.log("   ⚠️  TONO ACADEMICO");
    return ok;
  },
  hasCitation: (text) => {
    // Citazione naturale o ID fonte integrato nel testo
    const cite = /(come (dice|scrive|mostra|suggerisce|insegn)|ha (capito|dimostrato|trovato|spiegato|mostrato)|[A-Z][a-z]+ (ha dimostrato|ha mostrato|scrive|suggerisce|insegna|ha capito))/i;
    const sourceId = /\[[a-z0-9]+(-[a-z0-9]+)*-\d{4}\]/i;
    return cite.test(text) || sourceId.test(text);
  },
};

const messages = [
  { week: 1, query: "Sono Andrea, bevo tutti i giorni, non riesco a smettere. Cosa faccio?", expect: ["noTherapist", "noMarkdown", "hasActionable", "naturalTone"] },
  { week: 1, query: "Ok ma dammi un piano concreto, non voglio andare da uno psicologo", expect: ["noTherapist", "hasActionable", "noMarkdown", "hasCitation"] },
  { week: 2, query: "Ieri sera ho ceduto dopo 3 giorni senza alcol. Mi sento uno schifo", expect: ["noTherapist", "hasActionable", "naturalTone"] },
  { week: 2, query: "I miei amici bevono sempre quando usciamo, come faccio a resistere?", expect: ["noTherapist", "hasActionable", "noMarkdown"] },
  { week: 3, query: "Sto a 10 giorni senza alcol ma ho un evento di lavoro con clienti che bevono", expect: ["noTherapist", "hasActionable", "naturalTone"] },
  { week: 3, query: "La sera mi viene un'ansia fortissima, è peggio del craving. Cosa posso fare stasera?", expect: ["noTherapist", "hasActionable", "noMarkdown", "naturalTone"] },
  { week: 4, query: "Sono a un mese. Non voglio ricadere. Come rendo questo cambiamento definitivo?", expect: ["noTherapist", "hasActionable", "hasCitation", "naturalTone"] },
  { week: 4, query: "Tra l'altro ho anche messo su 5 chili, come faccio a perderli senza tornare a bere?", expect: ["noTherapist", "hasActionable", "noMarkdown"] },
];

async function run() {
  console.log(`\n🧪 Test diretto motore Atlas — Alcolizzato 4 settimane\n`);
  let passed = 0;
  let failed = 0;
  const history = [];

  for (const msg of messages) {
    const { week, query, expect } = msg;
    console.log(`📅 Settimana ${week}`);
    console.log(`👤 Utente: "${query}"`);

    const start = Date.now();
    const result = await answer(query, false, SID, history);
    const elapsed = Date.now() - start;

    const text = result.answer || "";
    console.log(`🤖 Atlas [${elapsed}ms]: "${text.slice(0, 180)}..."\n`);

    // Aggiorna history
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: text });
    if (history.length > 12) history.splice(0, history.length - 12);

    for (const checkName of expect) {
      const ok = checks[checkName](text);
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

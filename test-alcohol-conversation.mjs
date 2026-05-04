/**
 * Test conversazionale: utente con dipendenza da alcol
 * Simula 4 settimane di interazione condensate in 8 messaggi chiave.
 * Verifica: zero rinvio a terapeuta, consigli pratici, tono naturale, no markdown.
 */

const BASE = "http://localhost:3001";
const SID = "test-alcohol-" + Date.now();

const checks = {
  noTherapist: (text) => {
    const banned = /terapista|psicologo|psicoterapeuta|specialist|professionista|medico|clinic|rehab center|disintossicazione/i;
    return !banned.test(text);
  },
  noMarkdown: (text) => {
    const md = /\*\*|\*\s|#{1,6}\s|^\s*[-*•]\s+|^\s*\d+\.\s+/m;
    return !md.test(text);
  },
  hasActionable: (text) => {
    const actionable = /(oggi|adesso|domani|questa settimana|prossimo|inizia|fai|prova|prendi|scrivi|blocca|elimina|cambia|aumenta|diminuisci|sostituisci)/i;
    return actionable.test(text);
  },
  naturalTone: (text) => {
    // Non deve sembrare un manuale accademico: no "In conclusione", "In sintesi", "Si consiglia"
    const academic = /(in conclusione|in sintesi|si consiglia|è importante notare|studiosi hanno dimostrato|secondo la letteratura)/i;
    return !academic.test(text) && text.length > 80;
  },
  hasCitation: (text) => {
    // Citazione naturale: "come dice Carr", "Grace ha capito", "Lembke mostra"
    const cite = /(come (dice|scrive|mostra|suggerisce|insegn)|ha (capito|dimostrato|trovato)|secondo (Carr|Grace|Lembke|Duhigg|Fogg|Huberman|Stein))/i;
    return cite.test(text);
  },
};

const messages = [
  // Settimana 1: Onboarding + primo confronto
  {
    week: 1,
    query: "Sono Andrea, bevo tutti i giorni, non riesco a smettere. Cosa faccio?",
    expect: ["noTherapist", "noMarkdown", "hasActionable", "naturalTone"],
  },
  // Settimana 1: Richiesta piano concreto
  {
    week: 1,
    query: "Ok ma dammi un piano concreto, non voglio andare da uno psicologo",
    expect: ["noTherapist", "hasActionable", "noMarkdown"],
  },
  // Settimana 2: Crisi momentanea
  {
    week: 2,
    query: "Ieri sera ho ceduto dopo 3 giorni senza alcol. Mi sento uno schifo",
    expect: ["noTherapist", "hasActionable", "naturalTone"],
  },
  // Settimana 2: Richiesta strategia sociale
  {
    week: 2,
    query: "I miei amici bevono sempre quando usciamo, come faccio a resistere?",
    expect: ["noTherapist", "hasActionable", "noMarkdown"],
  },
  // Settimana 3: Progresso + nuova sfida
  {
    week: 3,
    query: "Sto a 10 giorni senza alcol ma ho un evento di lavoro con clienti che bevono",
    expect: ["noTherapist", "hasActionable", "naturalTone"],
  },
  // Settimana 3: Ansia/ cravings
  {
    week: 3,
    query: "La sera mi viene un'ansia fortissima, è peggio del craving. Cosa posso fare stasera?",
    expect: ["noTherapist", "hasActionable", "noMarkdown", "naturalTone"],
  },
  // Settimana 4: Rinforzo + lungo termine
  {
    week: 4,
    query: "Sono a un mese. Non voglio ricadere. Come rendo questo cambiamento definitivo?",
    expect: ["noTherapist", "hasActionable", "hasCitation", "naturalTone"],
  },
  // Settimana 4: Domanda universale (test espansione corpus)
  {
    week: 4,
    query: "Tra l'altro ho anche messo su 5 chili, come faccio a perderli senza tornare a bere?",
    expect: ["noTherapist", "hasActionable", "noMarkdown"],
  },
];

async function chat(query, history = []) {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query, sessionId: SID, conversationHistory: history }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function run() {
  console.log(`\n🧪 Test conversazionale alcol — SID: ${SID}\n`);
  let history = [];
  let passed = 0;
  let failed = 0;

  for (const msg of messages) {
    const { week, query, expect } = msg;
    console.log(`📅 Settimana ${week}`);
    console.log(`👤 Utente: "${query}"`);

    const start = Date.now();
    const data = await chat(query, history);
    const elapsed = Date.now() - start;

    const answer = data.answer || "";
    console.log(`🤖 Atlas [${elapsed}ms]: "${answer.slice(0, 200)}..."\n`);

    // Aggiorna history
    history.push({ role: "user", content: query });
    history.push({ role: "assistant", content: answer });
    if (history.length > 12) history = history.slice(-12);

    // Verifiche
    for (const checkName of expect) {
      const ok = checks[checkName](answer);
      const icon = ok ? "✅" : "❌";
      console.log(`   ${icon} ${checkName}: ${ok ? "PASS" : "FAIL"}`);
      if (!ok) {
        if (checkName === "noTherapist") {
          console.log(`      ⚠️  RINVIO A TERAPEUTA TROVATO — questo è un FAIL grave`);
        }
        if (checkName === "noMarkdown") {
          console.log(`      ⚠️  MARKDOWN TROVATO nella risposta`);
        }
        if (checkName === "hasActionable") {
          console.log(`      ⚠️  NESSUN CONSIGLIO PRATICO/ACTIONABLE trovato`);
        }
      }
      ok ? passed++ : failed++;
    }
    console.log("");
  }

  // Riepilogo
  const total = passed + failed;
  const rate = ((passed / total) * 100).toFixed(1);
  console.log(`📊 RISULTATO: ${passed}/${total} check passati (${rate}%)`);
  if (failed === 0) {
    console.log("🎉 TUTTO PERFETTO — Atlas è pronto per l'utente alcolizzato\n");
    process.exit(0);
  } else {
    console.log(`⚠️  ${failed} check falliti — rivedere prompt o corpus\n`);
    process.exit(1);
  }
}

// Avvia solo se il server è up
fetch(`${BASE}/api/chat`, { method: "POST", body: JSON.stringify({ query: "ping", sessionId: SID }) })
  .then(() => run())
  .catch((e) => {
    console.error(`\n❌ Server non raggiungibile su ${BASE}`);
    console.error(`   Avvia: npm run dev\n`);
    process.exit(1);
  });

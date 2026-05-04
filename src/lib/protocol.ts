// Protocolli personalizzati generativi — piani settimanali mente/corpo/relazione
// Basati su: journal analysis + assessment results + query history focus

export interface ProtocolWeek {
  id: string;
  sessionId: string;
  createdAt: number;
  analysis: {
    themes: string[];
    riskAreas: string[];
    strengths: string[];
    attachmentStyle?: string;
    aceRisk?: string;
    emotionalTone: string;
  };
  plan: {
    mind: ProtocolItem[];
    body: ProtocolItem[];
    relation: ProtocolItem[];
  };
  rationale: string;
}

export interface ProtocolItem {
  day: string;
  activity: string;
  duration: string;
  evidenceBase: string;
  goal: string;
}

const PROTOCOLS = new Map<string, ProtocolWeek[]>();

export function saveProtocol(sessionId: string, p: ProtocolWeek) {
  const arr = PROTOCOLS.get(sessionId) ?? [];
  arr.push(p);
  PROTOCOLS.set(sessionId, arr);
  return arr;
}

export function getProtocols(sessionId: string): ProtocolWeek[] {
  return PROTOCOLS.get(sessionId) ?? [];
}

export function generateProtocolDraft(
  themes: string[],
  negativeDensity: number,
  insightLevel: string,
  assessment: { aceTotal?: number; ecrAnxiety?: number; ecrAvoidance?: number; attachmentStyle?: string; emotionalRegulation?: string; goals?: string },
  topQueries: string[]
): { analysis: ProtocolWeek["analysis"]; rationale: string; plan: ProtocolWeek["plan"] } {
  // Heuristic analysis
  const riskAreas: string[] = [];
  const strengths: string[] = [];

  if (assessment.aceTotal && assessment.aceTotal >= 4) riskAreas.push("Trauma infantile elevato (ACE ≥ 4)");
  else if (assessment.aceTotal && assessment.aceTotal >= 2) riskAreas.push("Trauma infantile moderato");

  if (assessment.ecrAnxiety && assessment.ecrAnxiety > 4.5) riskAreas.push("Attaccamento ansioso marcato");
  if (assessment.ecrAvoidance && assessment.ecrAvoidance > 4.5) riskAreas.push("Attaccamento evitante marcato");

  if (negativeDensity > 0.15) riskAreas.push("Alta densità emotiva negativa nei journal");
  if (insightLevel === "alto") strengths.push("Buona capacità di insight (journal)");
  if (insightLevel === "basso") riskAreas.push("Basso insight — journaling più strutturato raccomandato");

  if (themes.includes("esercizio") || themes.includes("corpo")) strengths.push("Attenzione al benessere fisico");
  if (themes.includes("ansia")) riskAreas.push("Temi ansiosi ricorrenti");
  if (themes.includes("rabbia")) riskAreas.push("Temi di rabbia/riconoscimento");

  const attachmentStyle = assessment.attachmentStyle ?? "non valutato";
  const aceRisk = assessment.aceTotal && assessment.aceTotal >= 4 ? "elevato" : assessment.aceTotal && assessment.aceTotal >= 2 ? "moderato" : "basso";
  const emotionalTone = negativeDensity > 0.1 ? "predominantemente negativo" : negativeDensity > 0.05 ? "misto" : "stabile";

  // Protocol generation — evidence-based heuristics
  const mind: ProtocolItem[] = [];
  const body: ProtocolItem[] = [];
  const relation: ProtocolItem[] = [];

  // Mind — always mindfulness base
  mind.push({
    day: "Ogni giorno",
    activity: "Mindfulness / Respirazione consapevole (MBSR base)",
    duration: "10-15 min",
    evidenceBase: "Baer 2006 — MBSR riduce ruminazione e attivazione amigdala",
    goal: "Espandere window of tolerance, interrompere cicli ruminativi",
  });

  if (riskAreas.includes("Attaccamento ansioso marcato")) {
    mind.push({
      day: "3x/settimana",
      activity: "Journaling espressivo (Pennebaker) — focalizzato su paura abbandono",
      duration: "15-20 min",
      evidenceBase: "Pennebaker 1997 — espressione emotiva strutturata riduce attivazione fisiologica",
      goal: "Ridurre ipervigilanza relazionale, esplorare emozioni primarie sotto la rabbia",
    });
    relation.push({
      day: "2x/settimana",
      activity: "Condivisione vulnerabile con partner — 1 emozione primaria al giorno",
      duration: "10 min",
      evidenceBase: "Johnson 2019 (EFT) — accesso alle emozioni primarie crea contatto sicuro",
      goal: "Trasformare ciclo persecuzione-fuga in connessione",
    });
  }

  if (riskAreas.includes("Attaccamento evitante marcato")) {
    mind.push({
      day: "3x/settimana",
      activity: "Journaling — notare 3 momenti di disagio emotivo senza evitarli",
      duration: "15 min",
      evidenceBase: "Gross 1998 — reappraisal > soppressione; evitamento sistematico è costoso",
      goal: "Incrementare tolleranza al disagio emotivo, ridurre uso soppressione",
    });
    relation.push({
      day: "2x/settimana",
      activity: "Richiesta di supporto specifico — anche piccola — e osservare la risposta",
      duration: "5 min",
      evidenceBase: "Mikulincer & Shaver 2016 — dipendenza sicura è risorsa, non debolezza",
      goal: "Sperimentare che la dipendenza non porta al rifiuto",
    });
  }

  if (assessment.emotionalRegulation === "rumination") {
    mind.push({
      day: "Ogni giorno",
      activity: "Mindfulness focused attention — quando noti ruminazione, porta attenzione al respiro per 2 min",
      duration: "2 min x 5 volte",
      evidenceBase: "Baer 2006 — decentramento interrompe cicli ruminativi",
      goal: "Rompere loop ruminazione interrompendolo con ancoraggio sensoriale",
    });
  }

  if (assessment.emotionalRegulation === "suppression") {
    mind.push({
      day: "3x/settimana",
      activity: "Espressione emotiva guidata — scrivi un'emozione che hai soppresso oggi e come ti ha fatto sentire il corpo",
      duration: "10 min",
      evidenceBase: "Pennebaker 1997 — espressione strutturata > soppressione per salute fisica",
      goal: "Ripristinare consapevolezza corporea delle emozioni",
    });
  }

  if (assessment.goals) {
    relation.push({
      day: "1x/settimana",
      activity: "Review obiettivo — leggi il tuo obiettivo Atlas e chiediti: 'Quale azione questa settimana mi avvicina di 1%?'",
      duration: "10 min",
      evidenceBase: "Goal-setting theory — progressi piccoli e regolari > grandi salti",
      goal: "Mantenere allineamento tra piano e motivazione intrinseca",
    });
  }

  if (aceRisk === "elevato") {
    mind.push({
      day: "2x/settimana",
      activity: "Body scan o yoga leggero — attenzione alle sensazioni corporee",
      duration: "20 min",
      evidenceBase: "Van der Kolk 2014 — il trauma è impronta corporea, rielaborazione richiede corpo",
      goal: "Ripristinare propriocezione, ridurre dissociazione",
    });
    mind.push({
      day: "Consulto",
      activity: "Valutazione con psicoterapeuta EMDR o trauma-informed",
      duration: "60 min",
      evidenceBase: "Felitti 1998 — ACE ≥ 4 = rischio significativo, terapia specialistica raccomandata",
      goal: "Guarigione earned security, rielaborazione narrativa",
    });
  }

  // Body — always exercise + sleep
  body.push({
    day: "Ogni giorno",
    activity: "Sonno 7-8 ore — stessa ora coricarsi/svegliarsi",
    duration: "8h",
    evidenceBase: "Walker 2017 — <7h riduce testosterone, degrada empatia, aumenta amigdala",
    goal: "Ripristinare baseline neurobiologica per regolazione emotiva",
  });

  body.push({
    day: "3-4x/settimana",
    activity: "Esercizio aerobico moderato (camminata veloce, corsa leggera, nuoto)",
    duration: "30-45 min",
    evidenceBase: "Kline 2019 — esercizio regolare migliora sonno, umore, autostima, presenza sociale",
    goal: "Aumentare segnali di vitalità (postura, voce, movimento) e regolazione emotiva",
  });

  if (!themes.includes("esercizio") && !themes.includes("corpo")) {
    body.push({
      day: "Ogni giorno",
      activity: "2 min di stretching mattutino — solo per sensazione corporea",
      duration: "2 min",
      evidenceBase: "Porges 2011 — social engagement richiede consapevolezza corporea vagale",
      goal: "Iniziare connessione mente-corpo minimale ma quotidiana",
    });
  }

  // Relation — communication + presence
  relation.push({
    day: "Ogni giorno",
    activity: "1 'bid' di qualità — richiesta di connessione, risposta attenta (turn toward)",
    duration: "5-10 min",
    evidenceBase: "Gottman 1994 — rapporto 5:1 positivo:negativo, turning toward predice stabilità",
    goal: "Accumulare capital relazionale positivo",
  });

  if (topQueries.some(q => q.toLowerCase().includes("sess") || q.toLowerCase().includes("intimi"))) {
    relation.push({
      day: "1x/settimana",
      activity: "Conversazione su desiderio — non pressione, curiosità reciproca",
      duration: "30 min",
      evidenceBase: "Fisher 2005 — lussuria e attaccamento sono sistemi separati ma interagenti",
      goal: "Ripristinare intimità emotiva come prerequisito per desiderio",
    });
  }

  const rationale = `Analisi: tonalità emotiva ${emotionalTone}, stile attaccamento ${attachmentStyle}, rischio ACE ${aceRisk}, regolazione emotiva ${assessment.emotionalRegulation ?? "non valutata"}. ${riskAreas.length > 0 ? `Aree di attenzione: ${riskAreas.join(", ")}.` : ""} ${strengths.length > 0 ? `Punti di forza: ${strengths.join(", ")}.` : ""} Il piano combina mindfulness (base), esercizio (sonno + regolazione), journaling strutturato (processo emotivo), e interventi relazionali mirati (EFT/ Gottman). ${assessment.goals ? `Obiettivo utente integrato: ${assessment.goals}.` : ""}`;

  return {
    analysis: { themes, riskAreas, strengths, attachmentStyle, aceRisk, emotionalTone },
    rationale,
    plan: { mind, body, relation },
  };
}

// Knowledge Graph: collegamenti concettuali tra fonti scientifiche
// Permette di navigare tra temi correlati e fornire risposte multi-prospettiva

export interface ConceptNode {
  id: string;
  label: string;
  relatedSourceIds: string[];
  relatedConceptIds: string[];
  description: string;
}

export const CONCEPTS: ConceptNode[] = [
  {
    id: "attaccamento",
    label: "Attaccamento adulto e infantile",
    relatedSourceIds: ["bowlby-1969", "hazan-shaver-1987", "fraley-2000", "mikulincer-shaver-2016", "levine-2010", "johnson-2019"],
    relatedConceptIds: ["sistemazione-coppia", "regolazione-emotiva", "trauma", "intimità", "abbandono"],
    description: "Sistema biologico-motivazionale che guida la ricerca di prossimità e sicurezza nelle relazioni. Pattern infantili (Ainsworth) si riattivano nelle relazioni romantiche adulte (Hazan & Shaver). Stili: sicuro, ansioso, evitante, disorganizzato.",
  },
  {
    id: "trauma",
    label: "Trauma infantile e ACE",
    relatedSourceIds: ["felitti-1998", "van-der-kolk-2014", "siegel-2001", "porges-2011"],
    relatedConceptIds: ["attaccamento", "regolazione-emotiva", "finestra-tolleranza", "dissociazione", "polyvagal"],
    description: "Esperienze avverse infantili (abuso, negligenza, disfunzione familiare) che alterano sviluppo neurobiologico, sistema di attaccamento, regolazione emotiva e resilienza. Non è destino ma fattore di rischio sistemico.",
  },
  {
    id: "regolazione-emotiva",
    label: "Regolazione emotiva",
    relatedSourceIds: ["gross-1998", "baer-2006", "siegel-2001"],
    relatedConceptIds: ["mindfulness", "finestra-tolleranza", "trauma", "attaccamento", "ruminazione"],
    description: "Processi attraverso cui gli individui influenzano quando, come e quali emozioni provano. Strategie adattive: reappraisal, acceptance. Strategie maladattive: soppressione espressiva, ruminazione, evitamento esperienziale.",
  },
  {
    id: "finestra-tolleranza",
    label: "Window of tolerance",
    relatedSourceIds: ["siegel-2001", "porges-2011", "van-der-kolk-2014"],
    relatedConceptIds: ["trauma", "regolazione-emotiva", "polyvagal", "dissociazione"],
    description: "Zona ottimale di arousal in cui il sistema nervoso permette integrazione cognitiva, emotiva e relazionale. Fuori dalla finestra: iper-arousal (fight-flight) o ipo-arousal (freeze/dissociazione). Mindfulness e relazioni sicure la ri-allargano.",
  },
  {
    id: "polyvagal",
    label: "Polyvagal theory",
    relatedSourceIds: ["porges-2011"],
    relatedConceptIds: ["finestra-tolleranza", "intimità", "social-engagement", "trauma"],
    description: "Gerarchia dei sistemi neurali autonomi: vagale ventrale sociale (sicurezza, comunicazione facciale, voce), simpatico (mobilizzazione), vagale dorsale (immobilizzazione/freeze). Intimità richiede attivazione del sistema sociale.",
  },
  {
    id: "intimità",
    label: "Intimità e desiderio sessuale",
    relatedSourceIds: ["fisher-2005", "gottman-1994", "buss-2003", "johnson-2019"],
    relatedConceptIds: ["attaccamento", "polyvagal", "sessualità", "comunicazione-coppia", "sistemazione-coppia"],
    description: "Intimità emotiva e sessuale richiedono sicurezza di base (attaccamento sicuro). Il sistema del desiderio (lussuria) è separato ma interagisce con l'attaccamento. Distanza emotiva → perdita desiderio. Cicli disfunzionali bloccano entrambi.",
  },
  {
    id: "mindfulness",
    label: "Mindfulness e MBSR",
    relatedSourceIds: ["baer-2006"],
    relatedConceptIds: ["regolazione-emotiva", "ruminazione", "finestra-tolleranza", "depressione"],
    description: "Allenamento sistematico dell'attenzione presente e non giudicante. Decentramento cognitivo: vedere pensieri ed emozioni come eventi mentali temporanei. Cambiamenti neuroplastici: ispessimento PFC, riduzione amigdala.",
  },
  {
    id: "sonno",
    label: "Sonno e performance",
    relatedSourceIds: ["walker-2017", "kline-2019"],
    relatedConceptIds: ["esercizio", "salute", "cognizione", "emotività", "testosterone"],
    description: "Sonno <7 ore: riduzione testosterone, degrado regolazione emotiva, compromissione empatia (riconoscimento espressioni facciali), aumento reattività amigdala. Effetti cumulativi su presenza, attrattività, capacità decisionale.",
  },
  {
    id: "esercizio",
    label: "Esercizio fisico",
    relatedSourceIds: ["kline-2019"],
    relatedConceptIds: ["sonno", "salute", "umore", "autostima", "presenza"],
    description: "Esercizio aerobico moderato regolare migliora sonno, regolazione emotiva, autostima, segnali di vitalità (postura, voce, movimento). Presenza fisica come marker di attrattività. Relazione bidirezionale con sonno.",
  },
  {
    id: "sistemazione-coppia",
    label: "Sistemazione delle coppie",
    relatedSourceIds: ["gottman-1994", "buss-2003", "johnson-2019"],
    relatedConceptIds: ["attaccamento", "intimità", "comunicazione-coppia", "abbandono", "sesso"],
    description: "Principi della stabilità relazionale: rapporto positivo:negativo 5:1, Four Horsemen (critica, disprezzo, difensività, stonewalling) predicono divorzio con 93% accuracy. Cicli ansioso-evitante generano instabilità massima. Efficacia EFT: 70-75% recupero.",
  },
  {
    id: "autostima",
    label: "Autostima e Sociometer",
    relatedSourceIds: ["leary-2003"],
    relatedConceptIds: ["solitudine", "abbandono", "presenza", "competenza"],
    description: "L'autostima non è una qualità interna statica ma un feedback dinamico sul proprio valore relazionale percepito. Non si costruisce con affermazioni ma sviluppando qualità valorizzate dal gruppo sociale: competenza, gentilezza, affidabilità, contributo.",
  },
  {
    id: "solitudine",
    label: "Solitudine e connessione sociale",
    relatedSourceIds: ["cacioppo-2013", "twenge-2017"],
    relatedConceptIds: ["autostima", "depressione", "salute", "social-media"],
    description: "Solitudine cronica altera percezione sociale (ipervigilanza negativa), attivazione simpatica, sonno, immunità, cognizione. È percezione soggettiva, non stato oggettivo. Qualità > quantità delle relazioni. Social media eccessivo aumenta confronto sociale e isolamento percepito.",
  },
  {
    id: "social-media",
    label: "Social media e benessere",
    relatedSourceIds: ["twenge-2017"],
    relatedConceptIds: ["solitudine", "depressione", "intimità", "presenza"],
    description: "Uso massiccio di social media correlato con aumento depressione, ansia, solitudine, sonno disturbato. Il confronto sociale mediato è particolarmente tossico. Sottrae attenzione dalla relazione presente, riducendo qualità del contatto emotivo e intimità.",
  },
  {
    id: "depressione",
    label: "Depressione e ansia",
    relatedSourceIds: ["baer-2006", "twenge-2017"],
    relatedConceptIds: ["mindfulness", "ruminazione", "solitudine", "trauma"],
    description: "Depressione e ansia: circuiti limbici iperattivi, corteccia prefrontale disfunzionale, pattern ruminativi. Mindfulness e ACT interrompono cicli ruminativi. Trauma infantile aumenta rischio multiplo. Non è debolezza morale ma condizione biopsicosociale trattabile.",
  },
  {
    id: "ruminazione",
    label: "Ruminazione e pensiero ripetitivo",
    relatedSourceIds: ["gross-1998", "baer-2006"],
    relatedConceptIds: ["regolazione-emotiva", "depressione", "mindfulness", "ansia"],
    description: "Ruminazione: focus ripetitivo passivo su sintomi e cause, senza azione. Mantiene attivazione emotiva negativa, blocca regolazione efficace. Antidoti: mindfulness (decentramento), ACT (defusione), esercizio fisico, journaling espressivo.",
  },
  {
    id: "abbandono",
    label: "Paura dell'abbandono",
    relatedSourceIds: ["hazan-shaver-1987", "mikulincer-shaver-2016", "levine-2010", "johnson-2019"],
    relatedConceptIds: ["attaccamento", "ansia", "intimità", "abbandono-evitamento"],
    description: "Paura dell'abbandono è caratteristica dello stile ansioso. Attiva sistema di allarme relazionale, produce ricerca ossessiva di rassicurazione, spinge l'altro via (self-fulfilling prophecy). Earned security: possibile attraverso relazioni correttive e lavoro terapeutico.",
  },
  {
    id: "comunicazione-coppia",
    label: "Comunicazione di coppia",
    relatedSourceIds: ["gottman-1994", "johnson-2019"],
    relatedConceptIds: ["sistemazione-coppia", "intimità", "rabbia", "ascolto"],
    description: "Comunicazione efficace: bids (richieste di connessione), turning toward vs away. Four Horsemen predicono divorzio. Emozioni primarie (paura, dolore) sotto emozioni secondarie (rabbia, critica). Accesso all'emozione primaria è prerequisito per riparazione.",
  },
];

export function getRelatedConcepts(conceptId: string): ConceptNode[] {
  const node = CONCEPTS.find((c) => c.id === conceptId);
  if (!node) return [];
  return CONCEPTS.filter((c) => node.relatedConceptIds.includes(c.id));
}

export function getSourcesForConcept(conceptId: string): string[] {
  return CONCEPTS.find((c) => c.id === conceptId)?.relatedSourceIds ?? [];
}

export function findConceptByKeyword(keyword: string): ConceptNode[] {
  const kw = keyword.toLowerCase();
  return CONCEPTS.filter(
    (c) =>
      c.label.toLowerCase().includes(kw) ||
      c.description.toLowerCase().includes(kw) ||
      c.id.includes(kw)
  );
}

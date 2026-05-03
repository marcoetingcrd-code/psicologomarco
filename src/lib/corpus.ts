// Corpus scientifico seed: abstract e sintesi di paper/libri peer-reviewed reali
// su attrazione, attaccamento, relazioni, neurobiologia del desiderio.
// Tutte le referenze sono citabili e tracciabili nei database accademici pubblici.

export interface Source {
  id: string;
  authors: string;
  year: number;
  title: string;
  venue: string;
  doi?: string;
  url?: string;
  topic: string[];
  summary: string; // testo usato per embedding + retrieval
}

export const CORPUS: Source[] = [
  {
    id: "buss-1989",
    authors: "Buss, D. M.",
    year: 1989,
    title: "Sex differences in human mate preferences: Evolutionary hypotheses tested in 37 cultures",
    venue: "Behavioral and Brain Sciences, 12(1), 1-49",
    doi: "10.1017/S0140525X00023992",
    topic: ["evolutionary psychology", "mate selection", "cross-cultural"],
    summary:
      "Studio cross-culturale su 37 culture (10,047 partecipanti) che testa ipotesi evoluzioniste sulle preferenze di accoppiamento. Le donne valorizzano più degli uomini le risorse economiche e lo status sociale nei partner; gli uomini valorizzano più delle donne la giovinezza e l'attrattività fisica come segnali di fertilità. Entrambi i sessi valorizzano massimamente gentilezza e intelligenza. I risultati supportano la teoria della selezione sessuale e dell'investimento parentale. Critica importante: le differenze sono medie statistiche, con enorme sovrapposizione tra i sessi; fattori culturali ed economici modulano fortemente l'entità delle differenze.",
  },
  {
    id: "hazan-shaver-1987",
    authors: "Hazan, C., & Shaver, P.",
    year: 1987,
    title: "Romantic love conceptualized as an attachment process",
    venue: "Journal of Personality and Social Psychology, 52(3), 511-524",
    doi: "10.1037/0022-3514.52.3.511",
    topic: ["attachment", "romantic love", "adult relationships"],
    summary:
      "Paper seminale che applica la teoria dell'attaccamento di Bowlby alle relazioni romantiche adulte. Identifica tre stili di attaccamento adulto (sicuro, ansioso-ambivalente, evitante) che corrispondono alle categorie infantili della Strange Situation di Ainsworth. Le persone con attaccamento sicuro riportano relazioni più lunghe, meno divorzi, maggiore intimità. Gli ansiosi oscillano tra idealizzazione e gelosia. Gli evitanti temono la vicinanza. Questo framework sostituisce l'idea di 'tecniche di attrazione' con una comprensione strutturale del funzionamento relazionale.",
  },
  {
    id: "fisher-2005",
    authors: "Fisher, H., Aron, A., & Brown, L. L.",
    year: 2005,
    title: "Romantic love: An fMRI study of a neural mechanism for mate choice",
    venue: "Journal of Comparative Neurology, 493(1), 58-62",
    doi: "10.1002/cne.20772",
    topic: ["neuroscience", "love", "dopamine"],
    summary:
      "Studio fMRI su persone innamorate: l'amore romantico attiva l'area tegmentale ventrale (VTA) e il nucleo caudato, regioni ricche di dopamina associate al sistema di ricompensa e motivazione. L'amore non è principalmente un'emozione ma un sistema motivazionale (drive) simile alla sete o alla fame. Fisher propone tre sistemi distinti con circuiti neurali separati: lussuria (testosterone/estrogeni), attrazione romantica (dopamina), attaccamento (ossitocina/vasopressina). Questo spiega perché si può desiderare chi non si ama e amare chi non si desidera.",
  },
  {
    id: "aron-1997",
    authors: "Aron, A., Melinat, E., Aron, E. N., Vallone, R. D., & Bator, R. J.",
    year: 1997,
    title: "The experimental generation of interpersonal closeness: A procedure and some preliminary findings",
    venue: "Personality and Social Psychology Bulletin, 23(4), 363-377",
    doi: "10.1177/0146167297234003",
    topic: ["intimacy", "self-disclosure", "closeness"],
    summary:
      "Celebre studio delle '36 domande che fanno innamorare'. Due estranei si pongono a turno 36 domande di intimità crescente per 45 minuti, seguite da 4 minuti di sguardo reciproco. La procedura genera sentimenti di vicinanza paragonabili a quelli delle relazioni più strette degli stessi partecipanti. Dimostra che la vicinanza emotiva nasce dalla self-disclosure reciproca, escalata e vulnerabile, non dalla 'chimica'. Pilastro del self-expansion model di Aron: amiamo chi espande il nostro sé.",
  },
  {
    id: "eastwick-finkel-2008",
    authors: "Eastwick, P. W., & Finkel, E. J.",
    year: 2008,
    title: "Sex differences in mate preferences revisited: Do people know what they initially desire in a romantic partner?",
    venue: "Journal of Personality and Social Psychology, 94(2), 245-264",
    doi: "10.1037/0022-3514.94.2.245",
    topic: ["mate preferences", "speed dating", "evolutionary psychology"],
    summary:
      "Studio di speed dating che sfida il paradigma di Buss: le preferenze dichiarate (status per donne, bellezza per uomini) NON predicono l'attrazione effettiva dopo un incontro reale. Una volta conosciuta una persona, uomini e donne mostrano gli stessi predittori di attrazione romantica. Implicazione: le 'regole evolutive' funzionano su ipotetici, non sulla realtà. Colpisce duramente la letteratura pick-up basata su categorie rigide di 'cosa vogliono le donne'.",
  },
  {
    id: "mikulincer-shaver-2016",
    authors: "Mikulincer, M., & Shaver, P. R.",
    year: 2016,
    title: "Attachment in adulthood: Structure, dynamics, and change (2nd ed.)",
    venue: "Guilford Press",
    topic: ["attachment", "adult development", "clinical"],
    summary:
      "Manuale accademico di riferimento sull'attaccamento adulto. Dimostra con centinaia di studi che la sicurezza dell'attaccamento predice: migliore regolazione emotiva, relazioni più soddisfacenti, minor ansia sociale, maggiore capacità esplorativa, benessere psicofisico. La sicurezza si può COSTRUIRE (earned security) attraverso: relazioni correttive, psicoterapia, pratiche di mentalizzazione. Contiene protocolli empirici per l'autosviluppo della base sicura.",
  },
  {
    id: "gottman-1994",
    authors: "Gottman, J. M.",
    year: 1994,
    title: "Why marriages succeed or fail",
    venue: "Simon & Schuster",
    topic: ["marriage", "communication", "conflict"],
    summary:
      "Gottman, su dati longitudinali di migliaia di coppie, identifica i Four Horsemen of the Apocalypse (critica, disprezzo, difensività, muro di pietra) come predittori del divorzio con accuratezza del 90%. Il disprezzo è il singolo predittore più forte. Rapporto 5:1 tra interazioni positive e negative distingue le coppie felici. L'antidoto non sono 'tecniche di seduzione' ma: gentilezza abituale, building love maps, riparazione dopo i conflitti, turning toward bids.",
  },
  {
    id: "fromm-1956",
    authors: "Fromm, E.",
    year: 1956,
    title: "The Art of Loving",
    venue: "Harper & Row",
    topic: ["philosophy", "love", "maturity"],
    summary:
      "Fromm distingue tra falling in love (passivo, infantile, simbiotico) e standing in love (attivo, maturo, produttivo). L'amore è un'arte che richiede disciplina, concentrazione, pazienza, cura, responsabilità, rispetto, conoscenza. La tesi centrale: 'non c'è altro modo di essere amati che essere degni d'amore'. Demolisce l'idea di tecniche seduttive: la capacità d'amore dipende dallo sviluppo della personalità produttiva, non da trucchi relazionali.",
  },
  {
    id: "tskhay-2018",
    authors: "Tskhay, K. O., Zhu, R., Zou, C., & Rule, N. O.",
    year: 2018,
    title: "Charisma in everyday life: Conceptualization and validation of the General Charisma Inventory",
    venue: "Journal of Personality and Social Psychology, 114(1), 131-152",
    doi: "10.1037/pspp0000159",
    topic: ["charisma", "personality", "social influence"],
    summary:
      "Validazione empirica del carisma come costrutto a due dimensioni: influence (capacità di guidare, presenza, sicurezza) e affability (calore, accessibilità, empatia). Il carisma è misurabile (scala GCI a 6 item) e predittivo di esiti relazionali, lavorativi, di leadership. Contrariamente al mito, il carisma si può allenare: postura, contatto visivo, voce, ascolto attivo, espressività emotiva sono tutti modulabili con pratica deliberata.",
  },
  {
    id: "pennebaker-1997",
    authors: "Pennebaker, J. W.",
    year: 1997,
    title: "Writing about emotional experiences as a therapeutic process",
    venue: "Psychological Science, 8(3), 162-166",
    doi: "10.1111/j.1467-9280.1997.tb00403.x",
    topic: ["journaling", "emotion regulation", "health"],
    summary:
      "Meta-sintesi su 20+ anni di ricerca: scrivere per 15-20 minuti per 3-4 giorni consecutivi sugli eventi più stressanti della propria vita produce miglioramenti misurabili in salute fisica (minori visite mediche), funzione immunitaria, performance lavorativa e accademica. Meccanismo: l'articolazione linguistica trasforma esperienze emotive frammentate in narrative coerenti, riducendo il carico cognitivo della ruminazione.",
  },
  {
    id: "festinger-1950",
    authors: "Festinger, L., Schachter, S., & Back, K.",
    year: 1950,
    title: "Social pressures in informal groups: A study of human factors in housing",
    venue: "Harper & Brothers",
    topic: ["propinquity", "friendship formation", "social psychology"],
    summary:
      "Studio classico al MIT: la prossimità fisica è il predittore più forte della formazione di amicizie. Residenti di appartamenti adiacenti avevano probabilità 10 volte maggiore di diventare amici rispetto a quelli a fine corridoio. Propinquity effect: contatti casuali ripetuti generano familiarità e liking. Rilevante oggi per ambienti digitali: esposizione ripetuta in contesti condivisi (lavoro, hobby) batte statisticamente qualsiasi 'strategia di seduzione'.",
  },
  {
    id: "zajonc-1968",
    authors: "Zajonc, R. B.",
    year: 1968,
    title: "Attitudinal effects of mere exposure",
    venue: "Journal of Personality and Social Psychology, 9(2), 1-27",
    doi: "10.1037/h0025848",
    topic: ["mere exposure", "familiarity", "liking"],
    summary:
      "L'esposizione ripetuta a uno stimolo (persona, parola, immagine) aumenta il gradimento verso lo stimolo, anche in assenza di consapevolezza. Effetto robusto replicato in centinaia di studi. Implicazione relazionale: frequentare contesti ricorrenti (palestra, corsi, ambienti di interesse comune) produce attrazione in modo più affidabile di ogni tecnica persuasiva.",
  },
  {
    id: "levine-heller-2010",
    authors: "Levine, A., & Heller, R.",
    year: 2010,
    title: "Attached: The new science of adult attachment",
    venue: "Tarcher/Penguin",
    topic: ["attachment", "self-help evidence-based", "dating"],
    summary:
      "Traduzione rigorosa della letteratura scientifica sull'attaccamento adulto in guida pratica. Tre pattern: secure, anxious, avoidant. Compatibilità: secure-secure e secure-anxious funzionano; anxious-avoidant è la trappola più tossica (attrazione intensa, ansia cronica). La 'chimica' spesso descritta dai pick-up artist come attrazione è in realtà attivazione del sistema ansioso — cioè instabilità, non desiderio sano.",
  },
  {
    id: "walker-2017",
    authors: "Walker, M. P.",
    year: 2017,
    title: "Why we sleep: Unlocking the power of sleep and dreams",
    venue: "Scribner",
    topic: ["sleep", "cognition", "health"],
    summary:
      "Sintesi della ricerca sul sonno: meno di 7 ore riducono testosterone, peggiorano regolazione emotiva, compromettono riconoscimento delle espressioni facciali (meno empatia), aumentano reattività amigdalare (più ansia), degradano la pelle. Una settimana di 6 ore di sonno = livelli di testosterone di un uomo di 10 anni più vecchio. Impatto diretto su presenza, attrattività, capacità relazionale.",
  },
  {
    id: "leary-2003",
    authors: "Leary, M. R., Tambor, E. S., Terdal, S. K., & Downs, D. L.",
    year: 1995,
    title: "Self-esteem as an interpersonal monitor: The sociometer hypothesis",
    venue: "Journal of Personality and Social Psychology, 68(3), 518-530",
    doi: "10.1037/0022-3514.68.3.518",
    topic: ["self-esteem", "belonging", "sociometer"],
    summary:
      "Sociometer theory: l'autostima è un indicatore psicologico del proprio valore relazionale percepito (quanto ci si sente accettabili agli altri). Non una qualità statica, ma un feedback dinamico. Implicazione pratica: l'autostima solida non si costruisce con affermazioni, ma sviluppando qualità realmente valorizzate dal proprio gruppo sociale di riferimento (competenza, gentilezza, affidabilità, contributo).",
  },
  {
    id: "van-der-kolk-2014",
    authors: "Van der Kolk, B. A.",
    year: 2014,
    title: "The Body Keeps the Score: Brain, Mind, and Body in the Healing of Trauma",
    venue: "Viking",
    topic: ["trauma", "PTSD", "neurobiology", "somatic", "body"],
    summary:
      "Sintesi di 30 anni di ricerca clinica sul trauma. Il trauma non è solo ricordo ma impronta fisiologica: sistema nervoso simpatico iperattivo, amigdala sensibilizzata, corteccia prefrontale disattivata. Le memorie traumatiche sono immagazzinate come frammenti sensoriali, non narrative. Guarigione: sicurezza, rielaborazione narrativa, lavoro corporeo (yoga, EMDR, neurofeedback). Attaccamento insicuro infantile sensibilizza al trauma e ne ostacola la risoluzione.",
  },
  {
    id: "felitti-1998",
    authors: "Felitti et al.",
    year: 1998,
    title: "ACE Study - Relationship of childhood abuse and household dysfunction to leading causes of death",
    venue: "American Journal of Preventive Medicine, 14(4), 245-258",
    doi: "10.1016/S0749-3797(98)00017-8",
    topic: ["ACE", "trauma", "childhood adversity", "health"],
    summary:
      "Studio ACE su 17.337 partecipanti: dose-risposta tra esperienze avverse infantili e rischio sanitario adulto. Ogni ACE aggiuntivo aumenta esponenzialmente rischio malattie croniche, disturbi mentali, relazioni disfunzionali. Con 4+ ACE: rischio depressione x4, suicidio x12. Mappa trauma infantile come fattore di rischio sistemico, non destino.",
  },
  {
    id: "gross-1998",
    authors: "Gross, J. J.",
    year: 1998,
    title: "The emerging field of emotion regulation: An integrative review",
    venue: "Review of General Psychology, 2(3), 271-299",
    doi: "10.1037/1089-2680.2.3.271",
    topic: ["emotion regulation", "process model", "coping"],
    summary:
      "Process model della regolazione emotiva: 5 punti di intervento. Strategie cognitive (reappraisal) adattive; soppressione espressiva costosa (aumenta attivazione fisiologica, degrada relazioni). Attaccamento evitante = soppressione sistematica → costi psicosomatici. Ansioso = ruminazione → mantiene attivazione. Regolazione si può allenare: mindfulness, CBT, ACT, DBT.",
  },
  {
    id: "siegel-2001",
    authors: "Siegel, D. J.",
    year: 2001,
    title: "Interpersonal neurobiology of the developing mind",
    venue: "Infant Mental Health Journal, 22(1-2), 67-94",
    doi: "10.1002/1097-0355(200101/04)22:1<67::AID-IMHJ3>3.0.CO;2-G",
    topic: ["interpersonal neurobiology", "mindsight", "window of tolerance"],
    summary:
      "Interpersonal Neurobiology: il cervello si sviluppa in contesti relazionali. Co-regulazione modella circuiti prefrontali. Window of tolerance: zona ottimale arousal. Iper-arousal = iperattivazione. Ipo-arousal = freeze/dissociazione. Mindfulness e relazioni sicure ri-allargano la finestra. Riconoscere segnali di uscita è prerequisito per regolazione emotiva efficace.",
  },
  {
    id: "porges-2011",
    authors: "Porges, S. W.",
    year: 2011,
    title: "The Polyvagal Theory: Neurophysiological Foundations",
    venue: "W. W. Norton",
    topic: ["polyvagal theory", "vagus nerve", "autonomic nervous system", "safety"],
    summary:
      "Polyvagal Theory: 3 sistemi neurali. (1) Vagale ventrale sociale: sicurezza, connessione, comunicazione facciale/vocale. (2) Simpatico: mobilizzazione/fight-flight. (3) Vagale dorsale: immobilizzazione/freeze. Il sistema sociale deve essere attivo per intimità. Stress cronico disattiva il sociale, attiva fight-flight o freeze. Social engagement è prerequisito biologico per legame sicuro e desiderio.",
  },
  {
    id: "cacioppo-2013",
    authors: "Cacioppo, J. T., & Patrick, W.",
    year: 2013,
    title: "Loneliness: Human Nature and the Need for Social Connection",
    venue: "W. W. Norton",
    topic: ["loneliness", "social connection", "health", "cognition"],
    summary:
      "La solitudine cronica altera la percezione degli stimoli sociali (ipervigilanza ai segnali di minaccia, sottopercezione dei segnali positivi), aumenta l'attivazione simpatica, peggiora il sonno, il sistema immunitario e la cognizione esecutiva. Ma la solitudine è percezione soggettiva: qualcuno può essere solo ma non sentirsi solo; qualcuno in una coppia può sentirsi profondamente solo. Il fattore protettivo è qualità delle relazioni, non quantità. Implicazione: combattere la solitudine richiede ristrutturazione cognitiva (non solo uscire di più) e costruzione di legami sicuri.",
  },
  {
    id: "kline-2019",
    authors: "Kline, C. E.",
    year: 2019,
    title: "The bidirectional relationship between exercise and sleep: Implications for exercise adherence and sleep improvement",
    venue: "Frontiers in Neurology, 10, 443",
    doi: "10.3389/fneur.2019.00443",
    topic: ["exercise", "sleep", "health", "cognition", "mood"],
    summary:
      "Relazione bidirezionale esercizio-sonno: esercizio regolare (soprattutto aerobico moderato) migliora qualità e durata del sonno, riduce latenza di addormentamento, aumenta sonno profondo. Sonno migliorato aumenta aderenza all'esercizio, motivazione, energia. L'esercizio mattutino è più efficace per sonno rispetto a serale intenso (che può eccitare). L'esercizio migliora anche regolazione emotiva, autostima, presenza sociale, segnali di vitalità (postura, voce, movimento) che sono marker di attrattività.",
  },
  {
    id: "baer-2006",
    authors: "Baer, R. A.",
    year: 2006,
    title: "Mindfulness-based treatment approaches: Clinician's guide to evidence base and applications",
    venue: "Elsevier Academic Press",
    topic: ["mindfulness", "MBSR", "MBCT", "depression", "anxiety"],
    summary:
      "Mindfulness-Based Stress Reduction (MBSR) e Mindfulness-Based Cognitive Therapy (MBCT): efficaci per depressione ricorrente (prevenzione relaps), ansia, stress, dolore cronico. Meccanismo: decentramento (decentering) dalla propria esperienza mentale - osservare i pensieri/emoizioni come eventi mentali temporanei, non verità assolute. Questo interrompe la ruminazione e la reattività emotiva. Mindfulness allenata sistematicamente produce cambiamenti strutturali cerebrali (ispessimento corteccia prefrontale, riduzione volume amigdala).",
  },
  {
    id: "johnson-2019",
    authors: "Johnson, S. M.",
    year: 2019,
    title: "Attachment Theory in Practice: EFT with Individuals, Couples, and Families",
    venue: "Guilford Press",
    topic: ["attachment", "EFT", "couples therapy", "emotion"],
    summary:
      "Emotionally Focused Therapy (EFT): terapia di coppia basata sull'attaccamento. Le crisi di coppia sono crisi di attaccamento: il partner appare minaccioso o non disponibile, il sistema di attaccamento va in allarme. Cicli disfunzionali: persecuzione-fuga, ritiro-ritiro, accoppiamento ansioso. La cura: accesso alle emozioni primarie (paura, vergogna, dolore) sotto le emozioni secondarie (rabbia, controllo). Creazione di nuovi eventi di contatto emotivo sicuro. Efficacia dimostrata: 70-75% recupero relazionale, 90% miglioramento significativo.",
  },
  {
    id: "twenge-2017",
    authors: "Twenge, J. M.",
    year: 2017,
    title: "iGen: Why Today's Super-Connected Kids Are Growing Up Less Rebellious, More Tolerant, Less Happy",
    venue: "Atria Books",
    topic: ["social media", "depression", "anxiety", "youth", "digital"],
    summary:
      "Generazione iGen (nati 1995-2012): uso massiccio di social media, meno interazioni face-to-face, depressione e ansia in aumento drammatico (2007-2017 spike). Correlazione non causazione ma l'evidenza suggerisce che più ore su schermo = meno felicità, più solitudine, meno sonno. Il confronto sociale mediato è particolarmente tossico. Implicazione per adulti: la presenza digitale costante sottrae attenzione dalla relazione presente, crea distrazione, riduce qualità del contatto emotivo. La 'presenza' è prerequisito per intimità.",
  },
];

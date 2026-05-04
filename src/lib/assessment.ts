// Scale psicometriche validate - public domain / liberamente utilizzabili
// ACE (Adverse Childhood Experiences) - Felitti et al. 1998 - 10 item
// ECR-R (Experiences in Close Relationships - Revised) - Fraley et al. 2000 - short form 18 item

export interface ScaleItem {
  id: string;
  text: string;
  reverse?: boolean;
}

export interface ScaleDef {
  id: string;
  name: string;
  description: string;
  items: ScaleItem[];
  categories: { label: string; min: number; max: number }[];
  compute: (answers: number[]) => Record<string, any>;
  criticalCheck: (scores: Record<string, any>) => boolean;
  criticalMessage?: string;
}

export const ACE_SCALE: ScaleDef = {
  id: "ace",
  name: "Adverse Childhood Experiences (ACE)",
  description:
    "10 item che esplorano esperienze di abuso fisico/emotivo, negligenza e disfunzioni familiari prima dei 18 anni. Non è una diagnosi, ma un indicatore di rischio per esiti sanitari e relazionali.",
  items: [
    { id: "ace1", text: "Prima dei 18 anni un genitore o adulto in casa ti ha spinto, afferrato, schiaffeggiato o gettato qualcosa addosso?" },
    { id: "ace2", text: "Prima dei 18 anni un adulto ti ha toccato o accarezzato in modo sessuale?" },
    { id: "ace3", text: "Prima dei 18 anni ti è capitato di non avere abbastanza da mangiare, vestiti puliti o cure medice?" },
    { id: "ace4", text: "I tuoi genitori erano talmente assorbiti dai loro problemi che non potevano prendersi cura di te o proteggerti?" },
    { id: "ace5", text: "Hai vissuto la separazione/divorzio dei tuoi genitori?" },
    { id: "ace6", text: "Un genitore ha maltrattato l'altro (fisicamente)?" },
    { id: "ace7", text: "Qualcuno in casa aveva problemi di alcol o droghe?" },
    { id: "ace8", text: "Qualcuno in casa era depresso o mentalemente malato?" },
    { id: "ace9", text: "Qualcuno in casa è stato in prigione?" },
    { id: "ace10", text: "Prima dei 18 anni un genitore o adulto ti ha insultato, umiliato o fatto sentire inadeguato?" },
  ],
  categories: [
    { label: "Rischio basso", min: 0, max: 1 },
    { label: "Rischio moderato", min: 2, max: 3 },
    { label: "Rischio elevato", min: 4, max: 10 },
  ],
  compute(answers) {
    const total = answers.filter((a) => a >= 1).length;
    return { total, risk: total >= 4 ? "elevato" : total >= 2 ? "moderato" : "basso" };
  },
  criticalCheck(s) {
    return s.total >= 4;
  },
  criticalMessage:
    "Un punteggio ACE ≥ 4 è associato a rischio significativo per esiti sanitari e relazionali. Ti consigliamo di parlarne con un professionista. Atlas può aiutarti a mappare i pattern, ma non sostituisce la terapia.",
};

// ECR-R Short Form - 18 item (Fraley et al. 2000, adapted for web use)
// Scoring: 1=Completamente falso ... 7=Completamente vero
export const ECR_R_SHORT: ScaleDef = {
  id: "ecr-r",
  name: "Experiences in Close Relationships - Revised (Short)",
  description:
    "Misura lo stile di attaccamento adulto: ansioso (paura di abbandono) ed evitante (discomfort con l'intimità).",
  items: [
    // Anxiety subscale (9 items)
    { id: "ecr1", text: "Mi preoccupo che le persone di cui mi innamoro non mi amino tanto quanto le amo io." },
    { id: "ecr2", text: "Ho paura di essere abbandonato/a." },
    { id: "ecr3", text: "Desidero essere così vicino/a alle persone che mi spaventa." },
    { id: "ecr4", text: "Ho bisogno di essere rassicurato/a costantemente che sono amato/a." },
    { id: "ecr5", text: "Quando il partner si allontana emotivamente, temo di perderlo/a." },
    { id: "ecr6", text: "Mi preoccupo di essere lasciato/a." },
    { id: "ecr7", text: "Desidero una fusione totale con la persona che amo." },
    { id: "ecr8", text: "Il mio desiderio di vicinanza a volte spaventa le persone." },
    { id: "ecr9", text: "Mi arrabbio quando il partner non è disponibile quando ne ho bisogno." },
    // Avoidance subscale (9 items, reversed in scoring)
    { id: "ecr10", text: "Preferisco non mostrare al partner come mi sento profondamente.", reverse: true },
    { id: "ecr11", text: "Trovo difficile permettermi di dipendere dal partner.", reverse: true },
    { id: "ecr12", text: "Mi sento a disagio quando il partner vuole essere troppo vicino.", reverse: true },
    { id: "ecr13", text: "Non mi piace dover dipendere dagli altri.", reverse: true },
    { id: "ecr14", text: "Quando mostro i miei sentimenti, temo di essere giudicato/a.", reverse: true },
    { id: "ecr15", text: "Trovo difficile fidarmi completamente del partner.", reverse: true },
    { id: "ecr16", text: "Mi sento nervoso/a quando il partner si avvicina troppo.", reverse: true },
    { id: "ecr17", text: "Preferisco mantenere un certo distanza emotiva nei rapporti.", reverse: true },
    { id: "ecr18", text: "Non mi piace dover chiedere aiuto o supporto emotivo.", reverse: true },
  ],
  categories: [
    { label: "Sicuro", min: 0, max: 2.5 },
    { label: "Preoccupato", min: 2.5, max: 4.5 },
    { label: "Ansioso/evitante", min: 4.5, max: 7 },
  ],
  compute(answers) {
    const n = answers.length;
    const anxietyItems = answers.slice(0, 9);
    const avoidanceItems = answers.slice(9, 18);
    const anxiety = anxietyItems.reduce((a, b) => a + b, 0) / 9;
    const avoidance = avoidanceItems.reduce((a, b) => a + b, 0) / 9;
    return { anxiety, avoidance, style: anxiety < 3 && avoidance < 3 ? "sicuro" : anxiety >= 3 && avoidance < 3 ? "ansioso" : anxiety < 3 && avoidance >= 3 ? "evitante" : "disorganizzato/ansioso-evitante" };
  },
  criticalCheck(s) {
    return s.anxiety > 5 || s.avoidance > 5;
  },
  criticalMessage:
    "Punteggi molto elevati su ansia o evitamento indicano uno stile di attaccamento significativamente insicuro. Questo può impattare profondamente le relazioni. Un consulto con uno psicoterapeuta specializzato in attaccamento può essere molto utile.",
};

// DASS-21 (Depression Anxiety Stress Scales) — Lovibond & Lovibond 1995
// Public domain for research and clinical use. 21 item, 3 subscales.
export const DASS_21: ScaleDef = {
  id: "dass-21",
  name: "DASS-21 (Depression, Anxiety, Stress)",
  description:
    "Misura depressione, ansia e stress negli ultimi 7 giorni. 0 = Non mi è mai successo, 3 = Mi è successo quasi sempre.",
  items: [
    { id: "d1", text: "Mi sono accorto di avere la bocca secca" },
    { id: "d2", text: "Ho avuto difficoltà a respirare (es. respiro affannoso, senza aver fatto sforzo fisico)" },
    { id: "d3", text: "Ho avuto mani che tremavano" },
    { id: "d4", text: "Mi sono sentito preoccupato per situazioni in cui avrei potuto andare in panico e fare figuracce" },
    { id: "d5", text: "Mi sono sentito vicino al panico" },
    { id: "d6", text: "Sono consapevole dell'azione del mio cuore in assenza di sforzo fisico (es. sensazione di aumento del battito cardiaco o di mancamento del cuore)" },
    { id: "d7", text: "Ho avuto paura senza una buona ragione" },
    { id: "d8", text: "Mi sono sentito senza speranza riguardo al futuro" },
    { id: "d9", text: "Mi sono trovato a lamentarmi per diverse cose" },
    { id: "d10", text: "Ho sentito che non avevo nulla da desiderare" },
    { id: "d11", text: "Mi sono sentito agitato e inquieto" },
    { id: "d12", text: "Mi è stato difficile rilassarmi" },
    { id: "d13", text: "Mi sono sentivo depresso e senza speranza" },
    { id: "d14", text: "Mi sono sentito intollerante a qualsiasi cosa mi impedisse di continuare quello che stavo facendo" },
    { id: "d15", text: "Mi sono sentito vicino al crollo nervoso" },
    { id: "d16", text: "Sono riuscito a provare piacere per le cose che mi piacevano" },
    { id: "d17", text: "Mi sono sentito senza valore" },
    { id: "d18", text: "Mi sono sentito sensibile ed emotivamente fragile" },
    { id: "d19", text: "Mi sono reso conto di quello che stava succedendo attorno a me, come se fossi in stato di sonnolenza o da sveglio" },
    { id: "d20", text: "Mi sono sentito di avere battiti cardiaci in assenza di sforzo fisico" },
    { id: "d21", text: "Mi sono sentito spaventato e terrorizzato senza una buona ragione" },
  ],
  categories: [
    { label: "Normale", min: 0, max: 9 },
    { label: "Lieve", min: 10, max: 13 },
    { label: "Moderato", min: 14, max: 20 },
    { label: "Severo", min: 21, max: 27 },
    { label: "Estremo", min: 28, max: 100 },
  ],
  compute(answers) {
    // DASS-21 scoring: depression items (3,5,10,13,16,17,21) — 0-indexed: 2,4,9,12,15,16,20
    const depIdx = [2, 4, 9, 12, 15, 16, 20];
    // anxiety items (2,4,7,9,15,19,20) — 0-indexed: 1,3,6,8,14,18,19
    const anxIdx = [1, 3, 6, 8, 14, 18, 19];
    // stress items (1,6,8,11,12,14,18) — 0-indexed: 0,5,7,10,11,13,17
    const strIdx = [0, 5, 7, 10, 11, 13, 17];
    const dep = depIdx.reduce((sum, i) => sum + (answers[i] ?? 0), 0) * 2;
    const anx = anxIdx.reduce((sum, i) => sum + (answers[i] ?? 0), 0) * 2;
    const str = strIdx.reduce((sum, i) => sum + (answers[i] ?? 0), 0) * 2;
    return { depression: dep, anxiety: anx, stress: str, total: dep + anx + str };
  },
  criticalCheck(s) {
    return s.depression >= 21 || s.anxiety >= 15 || s.stress >= 25;
  },
  criticalMessage:
    "Punteggi elevati su DASS-21 suggeriscono disagio significativo. Atlas può aiutarti a mappare pattern, ma non sostituisce una valutazione clinica. Considera di parlarne con un professionista.",
};

// Rosenberg Self-Esteem Scale — 10 item, Likert 0-3
// Public domain, widely used.
export const ROSENBERG: ScaleDef = {
  id: "rosenberg",
  name: "Rosenberg Self-Esteem Scale",
  description:
    "Misura autostima globale. 0 = Fortemente in disaccordo, 3 = Fortemente d'accordo.",
  items: [
    { id: "r1", text: "Nel complesso sono soddisfatto di me stesso." },
    { id: "r2", text: "A volte mi sento inutile.", reverse: true },
    { id: "r3", text: "Sento di essere una persona di valore, almeno come gli altri." },
    { id: "r4", text: "Sono in grado di fare le cose bene come la maggior parte delle persone." },
    { id: "r5", text: "Sento di non avere molto di cui andare fiero.", reverse: true },
    { id: "r6", text: "A volte mi sento un fallimento.", reverse: true },
    { id: "r7", text: "Sono una persona positiva." },
    { id: "r8", text: "Sono una persona forte." },
    { id: "r9", text: "Sono una persona migliore della maggior parte degli altri.", reverse: true },
    { id: "r10", text: "Sono una persona intelligente." },
  ],
  categories: [
    { label: "Bassa autostima", min: 0, max: 15 },
    { label: "Autostima normale", min: 16, max: 25 },
    { label: "Alta autostima", min: 26, max: 30 },
  ],
  compute(answers) {
    const reversed = [1, 4, 5, 8]; // 0-indexed items that are reversed
    const total = answers.reduce((sum, a, i) => {
      const val = reversed.includes(i) ? 3 - (a ?? 0) : (a ?? 0);
      return sum + val;
    }, 0);
    return { total, level: total <= 15 ? "bassa" : total <= 25 ? "normale" : "alta" };
  },
  criticalCheck(s) {
    return s.total <= 15;
  },
  criticalMessage:
    "Un punteggio di autostima basso è associato a maggiore vulnerabilità relazionale e stress. Atlas può aiutarti a costruire sicurezza 'earned' attraverso azioni concrete.",
};

export const ALL_SCALES: ScaleDef[] = [ACE_SCALE, ECR_R_SHORT, DASS_21, ROSENBERG];

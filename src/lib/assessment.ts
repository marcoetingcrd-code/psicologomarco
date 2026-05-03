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

export const ALL_SCALES: ScaleDef[] = [ACE_SCALE, ECR_R_SHORT];
